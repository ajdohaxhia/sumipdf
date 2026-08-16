import { describe, expect, it } from 'vitest';
import {
  formatCompareSummary,
  summarizeComparePairs,
} from '@/js/compare/reporting/compare-summary';
import { initialThumbnailRenderCount } from '@/js/utils/thumbnail-window';

describe('compare summary', () => {
  it('counts added, removed, and unchanged pairs without claiming legal equivalence', () => {
    const summary = summarizeComparePairs(
      [
        { pairIndex: 0, leftPageNumber: 1, rightPageNumber: 1, confidence: 1 },
        {
          pairIndex: 1,
          leftPageNumber: 2,
          rightPageNumber: null,
          confidence: 0,
        },
        {
          pairIndex: 2,
          leftPageNumber: null,
          rightPageNumber: 3,
          confidence: 0,
        },
      ],
      'a.pdf',
      'b.pdf',
      [0]
    );
    expect(summary.changed).toBe(1);
    expect(summary.removed).toBe(1);
    expect(summary.added).toBe(1);
    expect(formatCompareSummary(summary)).toContain(
      'not semantic or legal equivalence'
    );
  });
});

describe('merge thumbnail windowing', () => {
  it('does not eagerly render every page canvas for large documents', () => {
    expect(initialThumbnailRenderCount(200, true)).toBe(20);
    expect(initialThumbnailRenderCount(8, true)).toBe(8);
    expect(initialThumbnailRenderCount(200, false)).toBe(200);
  });
});
