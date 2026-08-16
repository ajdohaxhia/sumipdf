export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}
