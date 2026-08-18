import { addWorkspaceFile, listWorkspaceItems } from './session';
import { workspaceController } from './controller';
import { stashFilesForTool } from '../ui/home-command';
import { getToolById } from '../config/tool-registry';

const TOOL_TO_FLOW: Record<string, string> = {
  'merge-pdf': 'merge-flow',
  'compress-pdf': 'compress-flow',
  'organize-pdf': 'organize-flow',
  'sign-pdf': 'sign-flow',
  'sanitize-pdf': 'safe-to-share',
  'remove-metadata': 'safe-to-share',
  sentinel: 'sentinel-safe-copy',
};

export function flowIdForTool(toolId: string): string | undefined {
  return TOOL_TO_FLOW[toolId];
}

export function openToolFromWorkspace(toolId: string): void {
  const files = listWorkspaceItems().map(
    (item) => new File([item.blob], item.name, { type: item.mimeType })
  );
  if (files.length) stashFilesForTool(files, toolId);
  window.location.href = `${toolId}.html`;
}

export function captureToolOutput(
  blob: Blob,
  name: string,
  toolId?: string
): void {
  addWorkspaceFile(blob, {
    name,
    sourceToolId: toolId,
    mimeType: blob.type || 'application/pdf',
  });
}

export function mountLegacyAdapter(): void {
  const host =
    document.getElementById('tool-options') ||
    document.getElementById('app') ||
    document.querySelector('main');
  if (!host || document.getElementById('sumi-legacy-adapter')) return;
  const path = window.location.pathname.split('/').pop() || '';
  const toolId = path.replace(/\.html$/, '');
  if (!getToolById(toolId)) return;

  const section = document.createElement('section');
  section.id = 'sumi-legacy-adapter';
  section.className = 'sumi-legacy-adapter';
  const title = document.createElement('h2');
  title.textContent = 'Continue in the workspace';
  const note = document.createElement('p');
  note.textContent =
    'This classic tool still works. Outputs stay in this tab. Open Inspect, Flow, or Proof without uploading.';
  const actions = document.createElement('div');
  actions.className = 'sumi-legacy-adapter__actions';

  const openWs = document.createElement('a');
  openWs.href = 'workspace.html';
  openWs.textContent = 'Open workspace';
  openWs.addEventListener('click', (event) => {
    const items = listWorkspaceItems();
    if (items.length === 0) return;
    event.preventDefault();
    const recipe = flowIdForTool(toolId);
    if (recipe) workspaceController.loadRecipe(recipe);
    window.location.href = 'workspace.html#inspect';
  });

  const inspect = document.createElement('button');
  inspect.type = 'button';
  inspect.textContent = 'Inspect this file';
  inspect.addEventListener('click', () => {
    window.location.href = 'workspace.html#inspect';
  });

  const proof = document.createElement('button');
  proof.type = 'button';
  proof.textContent = 'Open Proof';
  proof.addEventListener('click', () => {
    window.location.href = 'workspace.html#proof';
  });

  actions.append(openWs, inspect, proof);
  section.append(title, note, actions);
  host.appendChild(section);
}

export function hidePolarStorefront(): void {
  document.querySelectorAll('a[href*="polar.sh"]').forEach((anchor) => {
    const el = anchor as HTMLAnchorElement;
    el.hidden = true;
    el.removeAttribute('href');
    el.textContent = '';
    const card = el.closest('section, article, .card');
    if (card instanceof HTMLElement) {
      const pricing = card.querySelector('[class*="price"], .text-4xl');
      if (pricing) card.hidden = true;
    }
  });
}
