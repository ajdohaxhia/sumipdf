import { afterEach, describe, expect, it } from 'vitest';
import { addWorkspaceFile, clearWorkspace } from '@/js/workspace/session';
import {
  peekHandoff,
  consumeHandoff,
  stashFilesForTool,
} from '@/js/ui/home-command';

describe('tool handoff', () => {
  afterEach(() => {
    clearWorkspace();
    sessionStorage.clear();
  });

  it('stashes files for a tool without writing PDF bytes to localStorage', () => {
    const marker = 'SUMI_HANDOFF_MARKER_bytes';
    const file = new File([marker], 'a.pdf', { type: 'application/pdf' });
    stashFilesForTool([file], 'merge-pdf');
    expect(peekHandoff('merge-pdf')).toHaveLength(1);
    expect(peekHandoff('compress-pdf')).toHaveLength(0);
    expect(JSON.stringify(localStorage)).not.toContain(marker);
    const consumed = consumeHandoff('merge-pdf');
    expect(consumed[0].name).toBe('a.pdf');
    expect(consumeHandoff('merge-pdf')).toHaveLength(0);
  });
});
