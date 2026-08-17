import { createHash } from 'node:crypto';
import { createReadStream, existsSync, promises as fs } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_VERSION = 1;
export const DEFAULT_CHUNK_SIZE = 20 * 1024 * 1024;
export const PAGES_FILE_LIMIT = 25 * 1024 * 1024;
export const SHARDED_FILES = ['soffice.wasm.gz', 'soffice.data.gz'];

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function assertSafePartName(name) {
  if (basename(name) !== name || name.includes('/') || name.includes('\\')) {
    throw new Error(`Unsafe shard filename: ${name}`);
  }
}

async function verifyAsset(asset, assetDirectory) {
  const hash = createHash('sha256');
  let size = 0;
  for (const part of asset.parts) {
    assertSafePartName(part.name);
    const path = join(assetDirectory, part.name);
    const stat = await fs.stat(path);
    if (stat.size !== part.size) {
      throw new Error(`Shard size mismatch for ${part.name}`);
    }
    const partHash = await sha256File(path);
    if (partHash !== part.sha256) {
      throw new Error(`Shard hash mismatch for ${part.name}`);
    }
    for await (const chunk of createReadStream(path)) {
      size += chunk.length;
      hash.update(chunk);
    }
  }
  if (size !== asset.size || hash.digest('hex') !== asset.sha256) {
    throw new Error(`Reconstructed bytes do not match ${asset.filename}`);
  }
}

export async function validateDist(distDirectory = 'dist') {
  const root = resolve(distDirectory);
  const oversized = [];
  const redundant = [];
  for (const path of await listFiles(root)) {
    const name = basename(path);
    const size = (await fs.stat(path)).size;
    if (size > PAGES_FILE_LIMIT) {
      oversized.push(`${relative(root, path)} (${size} bytes)`);
    }
    if (name.endsWith('.gz.gz') || name.endsWith('.br.br')) {
      redundant.push(relative(root, path));
    }
  }
  if (redundant.length) {
    throw new Error(
      `Redundant compressed sidecars found:\n${redundant.join('\n')}`
    );
  }
  if (oversized.length) {
    throw new Error(
      `Cloudflare Pages files exceed ${PAGES_FILE_LIMIT} bytes:\n${oversized.join('\n')}`
    );
  }
}

async function validateExistingManifest(manifestPath, assetDirectory) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (
    manifest.version !== MANIFEST_VERSION ||
    !Array.isArray(manifest.assets)
  ) {
    throw new Error('Existing LibreOffice shard manifest is invalid');
  }
  for (const filename of SHARDED_FILES) {
    const asset = manifest.assets.find((item) => item.filename === filename);
    if (!asset) throw new Error(`Manifest is missing ${filename}`);
    await verifyAsset(asset, assetDirectory);
  }
  return manifest;
}

export async function shardLargePagesAssets({
  distDirectory = 'dist',
  chunkSize = DEFAULT_CHUNK_SIZE,
} = {}) {
  if (
    !Number.isInteger(chunkSize) ||
    chunkSize <= 0 ||
    chunkSize > PAGES_FILE_LIMIT
  ) {
    throw new Error(`Invalid shard size: ${chunkSize}`);
  }

  const dist = resolve(distDirectory);
  const assetDirectory = join(dist, 'libreoffice-wasm');
  const manifestPath = join(assetDirectory, 'assets-manifest.json');
  const sourcePaths = SHARDED_FILES.map((name) => join(assetDirectory, name));
  const sourceExists = sourcePaths.map(existsSync);

  if (sourceExists.every((present) => !present)) {
    if (!existsSync(manifestPath)) {
      throw new Error(
        'LibreOffice sources and shard manifest are missing from dist'
      );
    }
    const manifest = await validateExistingManifest(
      manifestPath,
      assetDirectory
    );
    await validateDist(dist);
    return manifest;
  }
  if (!sourceExists.every(Boolean)) {
    throw new Error(
      'LibreOffice sharding requires both compressed source files'
    );
  }

  const tempDirectory = join(assetDirectory, `.shard-tmp-${process.pid}`);
  await fs.rm(tempDirectory, { recursive: true, force: true });
  await fs.mkdir(tempDirectory, { recursive: true });

  const manifest = { version: MANIFEST_VERSION, assets: [] };
  try {
    for (const sourcePath of sourcePaths) {
      const filename = basename(sourcePath);
      const stat = await fs.stat(sourcePath);
      const sourceSha256 = await sha256File(sourcePath);
      const hashPrefix = sourceSha256.slice(0, 16);
      const handle = await fs.open(sourcePath, 'r');
      const parts = [];
      try {
        let offset = 0;
        let index = 0;
        while (offset < stat.size) {
          const length = Math.min(chunkSize, stat.size - offset);
          const buffer = Buffer.allocUnsafe(length);
          const { bytesRead } = await handle.read(buffer, 0, length, offset);
          if (bytesRead !== length)
            throw new Error(`Short read from ${filename}`);
          const bytes = buffer.subarray(0, bytesRead);
          const name = `${filename}.${hashPrefix}.part-${String(index).padStart(3, '0')}`;
          await fs.writeFile(join(tempDirectory, name), bytes);
          parts.push({
            name,
            size: bytesRead,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
          offset += bytesRead;
          index += 1;
        }
      } finally {
        await handle.close();
      }
      manifest.assets.push({
        filename,
        size: stat.size,
        sha256: sourceSha256,
        encoding: 'gzip',
        parts,
      });
      await verifyAsset(manifest.assets.at(-1), tempDirectory);
    }

    const tempManifestPath = join(tempDirectory, 'assets-manifest.json.tmp');
    await fs.writeFile(
      tempManifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    );

    for (const file of await fs.readdir(assetDirectory)) {
      if (
        SHARDED_FILES.some(
          (source) => file.startsWith(`${source}.`) && file.includes('.part-')
        )
      ) {
        await fs.rm(join(assetDirectory, file), { force: true });
      }
    }
    for (const asset of manifest.assets) {
      for (const part of asset.parts) {
        await fs.rename(
          join(tempDirectory, part.name),
          join(assetDirectory, part.name)
        );
      }
    }
    await fs.rename(tempManifestPath, `${manifestPath}.tmp`);
    await fs.rename(`${manifestPath}.tmp`, manifestPath);
    await validateExistingManifest(manifestPath, assetDirectory);

    for (const sourcePath of sourcePaths) {
      await fs.rm(`${sourcePath}.gz`, { force: true });
      await fs.rm(`${sourcePath}.br`, { force: true });
      await fs.rm(sourcePath);
    }
    await validateDist(dist);
    return manifest;
  } catch (error) {
    throw new Error(`LibreOffice asset sharding failed: ${error.message}`, {
      cause: error,
    });
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const validateOnly = process.argv.includes('--validate');
  const distArg = process.argv.find((arg) => arg.startsWith('--dist='));
  const distDirectory = distArg ? distArg.slice('--dist='.length) : 'dist';
  try {
    if (validateOnly) {
      await validateDist(distDirectory);
      console.log(
        '[pages-assets] final Cloudflare file-size validation passed'
      );
    } else {
      const manifest = await shardLargePagesAssets({ distDirectory });
      const count = manifest.assets.reduce(
        (sum, asset) => sum + asset.parts.length,
        0
      );
      console.log(
        `[pages-assets] generated and verified ${count} LibreOffice shards`
      );
    }
  } catch (error) {
    console.error(`[pages-assets] ${error.message}`);
    process.exitCode = 1;
  }
}
