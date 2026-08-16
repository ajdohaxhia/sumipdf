import { describe, expect, it } from 'vitest';
import { categories } from '@/js/config/tools';
import {
  getAllTools,
  getToolsByCategory,
  searchTools,
  getToolById,
  getToolIdFromHref,
} from '@/js/config/tool-registry';

describe('canonical tool registry', () => {
  it('keeps unique routes in the derived catalog', () => {
    const ids = getAllTools().map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(50);
  });

  it('exposes featured merge/compress/organize/sign tools', () => {
    expect(getToolById('merge-pdf')?.featured).toBe(true);
    expect(getToolById('compress-pdf')?.featured).toBe(true);
    expect(getToolById('organize-pdf')?.featured).toBe(true);
    expect(getToolById('sign-pdf')?.featured).toBe(true);
  });

  it('groups tools into Sumi categories without emptying the catalog', () => {
    const groups = getToolsByCategory();
    const grouped = groups.reduce((n, group) => n + group.tools.length, 0);
    expect(grouped).toBe(getAllTools().length);
  });

  it('finds merge via search', () => {
    expect(searchTools('merge').some((tool) => tool.id === 'merge-pdf')).toBe(
      true
    );
  });

  it('preserves legacy category export uniqueness within each list', () => {
    for (const category of categories) {
      const ids = category.tools.map((tool) => tool.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('parses absolute and relative html routes consistently', () => {
    expect(getToolIdFromHref('merge-pdf.html')).toBe('merge-pdf');
    expect(getToolIdFromHref('/tools/merge-pdf.html?from=home')).toBe(
      'merge-pdf'
    );
  });

  it('does not advertise universal batch and workflow support', () => {
    expect(getToolById('view-metadata')?.batch).toBe(false);
    expect(getToolById('view-metadata')?.workflowEligible).toBe(false);
    expect(getToolById('merge-pdf')).toMatchObject({
      minFiles: 2,
      maxFiles: null,
      batch: true,
      workflowEligible: true,
    });
  });

  it('describes Sumi multi-file tools truthfully', () => {
    expect(getToolById('batch-forms')).toMatchObject({
      minFiles: 2,
      maxFiles: 2,
      outputType: 'application/zip',
    });
    expect(getToolById('proof-verifier')).toMatchObject({
      minFiles: 3,
      maxFiles: 3,
    });
    expect(getToolById('capture')?.accept).toContain('image/jpeg');
  });
});
