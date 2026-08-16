import type { ComparePagePair } from '../types.ts';

export interface CompareSummary {
  leftName: string;
  rightName: string;
  pagePairs: number;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  disclaimer: string;
}

export function summarizeComparePairs(
  pairs: ComparePagePair[],
  leftName: string,
  rightName: string,
  changedPairIndexes: Iterable<number> = []
): CompareSummary {
  const changedSet = new Set(changedPairIndexes);
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;
  for (const pair of pairs) {
    if (pair.leftPageNumber == null && pair.rightPageNumber != null) added += 1;
    else if (pair.leftPageNumber != null && pair.rightPageNumber == null)
      removed += 1;
    else if (changedSet.has(pair.pairIndex)) changed += 1;
    else unchanged += 1;
  }
  return {
    leftName,
    rightName,
    pagePairs: pairs.length,
    added,
    removed,
    changed,
    unchanged,
    disclaimer:
      'Visual difference is not semantic or legal equivalence. This report is generated locally.',
  };
}

export function formatCompareSummary(summary: CompareSummary): string {
  return [
    'Sumi PDF comparison report',
    `Left: ${summary.leftName}`,
    `Right: ${summary.rightName}`,
    `Paired pages: ${summary.pagePairs}`,
    `Added pages: ${summary.added}`,
    `Removed pages: ${summary.removed}`,
    `Changed pages: ${summary.changed}`,
    `Unchanged pages: ${summary.unchanged}`,
    summary.disclaimer,
  ].join('\n');
}
