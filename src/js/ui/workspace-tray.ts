import {
  clearWorkspace,
  listWorkspaceItems,
  removeWorkspaceItem,
  subscribeWorkspace,
  workspaceMemoryWarning,
} from '../workspace/session';
import { formatBytes } from '../utils/format';
import { t } from '../i18n/i18n';

export function initWorkspaceTray(): void {
  const tray = document.getElementById('sumi-workspace-tray');
  const list = document.getElementById('sumi-workspace-list');
  const warning = document.getElementById('sumi-workspace-warning');
  const clearBtn = document.getElementById('sumi-workspace-clear');
  if (!tray || !list) return;

  const render = () => {
    const items = listWorkspaceItems();
    tray.hidden = items.length === 0;
    list.textContent = '';
    for (const item of items) {
      const li = document.createElement('li');
      const meta = document.createElement('span');
      meta.textContent = `${item.name} · ${formatBytes(item.size)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('workspace.remove') || 'Remove';
      remove.addEventListener('click', () => removeWorkspaceItem(item.id));
      li.append(meta, remove);
      list.appendChild(li);
    }
    if (warning) {
      const message = workspaceMemoryWarning();
      warning.hidden = !message;
      warning.textContent = message || '';
    }
  };

  clearBtn?.addEventListener('click', () => clearWorkspace());
  subscribeWorkspace(render);
  render();
}
