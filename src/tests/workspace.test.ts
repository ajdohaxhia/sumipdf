import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorkspaceFile,
  clearWorkspace,
  listWorkspaceItems,
  removeWorkspaceItem,
  workspaceBytes,
} from '@/js/workspace/session';
import { mountLegacyAdapter } from '@/js/workspace/adapters';
import { workspaceController } from '@/js/workspace/controller';

describe('local workspace', () => {
  afterEach(() => {
    clearWorkspace();
    document.body.replaceChildren();
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

describe('legacy adapter chrome', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('does not paint classic-tool chrome on legal pages', () => {
    window.history.pushState({}, '', '/terms.html');
    document.body.innerHTML = '<div id="app"></div>';
    mountLegacyAdapter();
    expect(document.getElementById('sumi-legacy-adapter')).toBeNull();
  });

  it('offers workspace continuation on real tool pages', () => {
    window.history.pushState({}, '', '/merge-pdf.html');
    document.body.innerHTML = '<div id="app"></div>';
    mountLegacyAdapter();
    expect(document.getElementById('sumi-legacy-adapter')).toBeTruthy();
  });
});

describe('workspace pane location', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('writes the pane hash when the current hash is empty', () => {
    window.history.pushState({}, '', '/workspace.html');
    workspaceController.setPane('flow');
    expect(window.location.hash).toBe('#flow');
  });
});
