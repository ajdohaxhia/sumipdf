import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorkspaceFile,
  clearWorkspace,
  listWorkspaceItems,
  removeWorkspaceItem,
  workspaceBytes,
} from '@/js/workspace/session';

describe('local workspace', () => {
  afterEach(() => {
    clearWorkspace();
  });

  it('holds blobs in memory and revokes URLs on clear', () => {
    const blob = new Blob(['%PDF-1.4 workspace-marker'], {
      type: 'application/pdf',
    });
    const item = addWorkspaceFile(blob, { name: 'note.pdf' });
    expect(listWorkspaceItems()).toHaveLength(1);
    expect(workspaceBytes()).toBe(blob.size);
    expect(item.objectUrl.startsWith('blob:')).toBe(true);
    removeWorkspaceItem(item.id);
    expect(listWorkspaceItems()).toHaveLength(0);
  });

  it('does not write PDF bytes into localStorage', () => {
    const marker = 'SUMI_PRIVACY_MARKER_NOT_FOR_STORAGE';
    addWorkspaceFile(new Blob([marker], { type: 'application/pdf' }), {
      name: 'secret.pdf',
    });
    expect(JSON.stringify(localStorage)).not.toContain(marker);
    expect(localStorage.getItem('sumi:workspace')).toBeNull();
  });
});
