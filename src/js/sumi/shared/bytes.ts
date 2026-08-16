export function latin1(bytes: Uint8Array, limit = 4_000_000): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, limit));
  return new TextDecoder('latin1').decode(slice);
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const { sha256Hex: hash } = await import('../../proof/hash.js');
  return hash(bytes);
}

export function djb2Hex(bytes: Uint8Array): string {
  let hash = 5381;
  const step = Math.max(1, Math.floor(bytes.length / 8192));
  for (let i = 0; i < bytes.length; i += step) {
    hash = (hash * 33) ^ bytes[i];
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesContainAscii(bytes: Uint8Array, needle: string): boolean {
  if (!needle) return false;
  return latin1(bytes).includes(needle);
}
