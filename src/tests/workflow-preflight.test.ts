import { describe, expect, it } from 'vitest';
import { WORKFLOW_RECIPES } from '@/js/workflow/recipes';
import {
  preflightErrors,
  preflightWorkflow,
  migrateWorkflow,
} from '@/js/workflow/preflight';
import { isLinearPipeline } from '@/js/workflow/list-editor';
import { WORKFLOW_VERSION } from '@/js/workflow/types';

describe('workflow preflight', () => {
  it('accepts built-in recipes', () => {
    for (const recipe of WORKFLOW_RECIPES) {
      expect(preflightErrors(recipe.workflow), recipe.id).toEqual([]);
      expect(isLinearPipeline(recipe.workflow)).toBe(true);
    }
  });

  it('rejects unknown nodes and embedded PDF bytes', () => {
    const errors = preflightErrors({
      version: WORKFLOW_VERSION,
      nodes: [{ id: 'x', type: 'NotARealNode', position: { x: 0, y: 0 }, controls: {} }],
      connections: [],
    });
    expect(errors.some((message) => message.includes('Unknown'))).toBe(true);

    const leaked = preflightWorkflow({
      version: WORKFLOW_VERSION,
      nodes: [
        {
          id: 'in',
          type: 'PDFInputNode',
          position: { x: 0, y: 0 },
          controls: { note: '%PDF-1.4 leaked' },
        },
      ],
      connections: [],
    });
    expect(leaked.some((issue) => issue.level === 'error')).toBe(true);
  });

  it('migrates older version numbers', () => {
    const migrated = migrateWorkflow({
      version: 0,
      nodes: [],
      connections: [],
    });
    expect(migrated.version).toBe(WORKFLOW_VERSION);
  });

  it('rejects stored passwords', () => {
    const errors = preflightErrors({
      version: WORKFLOW_VERSION,
      nodes: [
        {
          id: 'in',
          type: 'PDFInputNode',
          position: { x: 0, y: 0 },
          controls: {},
        },
        {
          id: 'enc',
          type: 'EncryptNode',
          position: { x: 100, y: 0 },
          controls: { password: 'secret-value' },
        },
        {
          id: 'out',
          type: 'DownloadNode',
          position: { x: 200, y: 0 },
          controls: {},
        },
      ],
      connections: [
        { id: 'c1', source: 'in', sourceOutput: 'pdf', target: 'enc', targetInput: 'pdf' },
        { id: 'c2', source: 'enc', sourceOutput: 'pdf', target: 'out', targetInput: 'pdf' },
      ],
    });
    expect(errors.some((message) => message.toLowerCase().includes('password'))).toBe(
      true
    );
  });
});
