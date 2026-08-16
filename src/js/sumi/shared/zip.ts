import JSZip from 'jszip';

export async function zipPdfs(
  files: Array<{ name: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.bytes);
  }
  const blob = await zip.generateAsync({ type: 'uint8array' });
  return blob;
}
