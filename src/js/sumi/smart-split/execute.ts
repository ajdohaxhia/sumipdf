import { splitPdf } from '../../utils/pdf-operations';
import { zipPdfs } from '../shared/zip';
import type { SplitPlan } from './types';

export async function executeSplitPlan(
  bytes: Uint8Array,
  plan: SplitPlan
): Promise<{
  files: Array<{ name: string; bytes: Uint8Array }>;
  zip: Uint8Array;
}> {
  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const group of plan.groups) {
    const indices = group.pages.map((p) => p - 1);
    const part = await splitPdf(bytes, indices);
    files.push({ name: group.filename, bytes: part });
  }
  const zip = await zipPdfs(files);
  return { files, zip };
}
