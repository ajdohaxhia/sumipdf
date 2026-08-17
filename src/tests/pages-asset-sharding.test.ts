// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PAGES_FILE_LIMIT,
  shardLargePagesAssets,
  validateDist,
} from '../../scripts/shard-large-pages-assets.mjs';

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sumi-shards-'));
  roots.push(root);
  const assets = join(root, 'libreoffice-wasm');
  await mkdir(assets, { recursive: true });
  await writeFile(
    join(assets, 'soffice.wasm.gz'),
    Buffer.from('wasm-'.repeat(61))
  );
  await writeFile(
    join(assets, 'soffice.data.gz'),
    Buffer.from('data-'.repeat(47))
  );
  return { root, assets };
}

async function reconstruct(assets: string, entry: any) {
  const chunks = await Promise.all(
    entry.parts.map((part: any) => readFile(join(assets, part.name)))
  );
  return Buffer.concat(chunks);
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true }))
  );
});

describe('Cloudflare Pages asset sharding', () => {
  it('is deterministic, ordered, content-addressed, and reconstructs exact bytes', async () => {
    const first = await fixture();
    const second = await fixture();
    const source = await readFile(join(first.assets, 'soffice.wasm.gz'));
    const one = await shardLargePagesAssets({
      distDirectory: first.root,
      chunkSize: 64,
    });
    const two = await shardLargePagesAssets({
      distDirectory: second.root,
      chunkSize: 64,
    });

    expect(one).toEqual(two);
    expect(one.version).toBe(1);
    const wasm = one.assets.find(
      (asset: any) => asset.filename === 'soffice.wasm.gz'
    );
    expect(wasm.parts.every((part: any) => part.size <= 64)).toBe(true);
    expect(wasm.parts.map((part: any) => part.name)).toEqual(
      wasm.parts.map(
        (_: any, index: number) =>
          `soffice.wasm.gz.${wasm.sha256.slice(0, 16)}.part-${String(index).padStart(3, '0')}`
      )
    );
    const rebuilt = await reconstruct(first.assets, wasm);
    expect(rebuilt).toEqual(source);
    expect(createHash('sha256').update(rebuilt).digest('hex')).toBe(
      wasm.sha256
    );
  });

  it('is idempotent and rejects a corrupt generated part', async () => {
    const { root, assets } = await fixture();
    const manifest = await shardLargePagesAssets({
      distDirectory: root,
      chunkSize: 64,
    });
    await expect(
      shardLargePagesAssets({ distDirectory: root, chunkSize: 64 })
    ).resolves.toEqual(manifest);
    await writeFile(join(assets, manifest.assets[0].parts[0].name), 'corrupt');
    await expect(
      shardLargePagesAssets({ distDirectory: root, chunkSize: 64 })
    ).rejects.toThrow(/size mismatch|hash mismatch/);
  });

  it('rejects final output above the exact Pages limit', async () => {
    const { root } = await fixture();
    await writeFile(
      join(root, 'oversized.bin'),
      Buffer.alloc(PAGES_FILE_LIMIT + 1)
    );
    await expect(validateDist(root)).rejects.toThrow(/exceed/);
  });
});
