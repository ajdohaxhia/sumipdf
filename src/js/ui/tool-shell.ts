import { consumeHandoff, peekHandoff } from './home-command';
import { getToolById } from '../config/tool-registry';
import { recordRecentTool } from '../workspace/session';
import { t } from '../i18n/i18n';
import { escapeHtml } from '../utils/format';
import { hidePolarStorefront, mountLegacyAdapter } from '../workspace/adapters';

export function currentToolIdFromPath(): string {
  const file = window.location.pathname.split('/').pop() || '';
  const id = file.replace(/\.html$/, '');
  if (!id || id === 'index' || id === '') return 'home';
  return id;
}

function assignFilesToInput(input: HTMLInputElement, files: File[]): boolean {
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function applyHandoff(toolId: string, consume: boolean): boolean {
  const files = peekHandoff(toolId);
  if (files.length === 0) return false;
  const input = document.getElementById(
    'file-input'
  ) as HTMLInputElement | null;
  if (!input) return false;
  const ok = assignFilesToInput(input, files);
  if (ok && consume) consumeHandoff(toolId);
  return ok;
}

function mountContinueWith(toolId: string): void {
  const tool = getToolById(toolId);
  if (!tool || tool.related.length === 0) return;
  if (document.getElementById('sumi-continue')) return;

  const host =
    document.getElementById('tool-options') ||
    document.getElementById('app') ||
    document.querySelector('main');
  if (!host) return;

  const section = document.createElement('section');
  section.id = 'sumi-continue';
  section.className = 'sumi-continue';
  section.innerHTML = `<h2>${escapeHtml(t('workspace.continue') || 'Continue with another tool')}</h2>
    <p>${escapeHtml(t('workspace.continueHint') || 'Results stay in the local workspace. Nothing is uploaded.')}</p>
    <div class="sumi-continue__list"></div>`;
  const list = section.querySelector('.sumi-continue__list') as HTMLElement;
  for (const relatedId of tool.related.slice(0, 6)) {
    const related = getToolById(relatedId);
    if (!related) continue;
    const link = document.createElement('a');
    link.href = related.href;
    link.className = 'sumi-continue__link';
    link.textContent = related.name;
    list.appendChild(link);
  }
  host.appendChild(section);
}

export function initToolShell(): void {
  hidePolarStorefront();
  const toolId = currentToolIdFromPath();
  if (toolId !== 'home') {
    recordRecentTool(toolId);
    mountContinueWith(toolId);
    mountLegacyAdapter();
    const first = applyHandoff(toolId, false);
    window.setTimeout(
      () => {
        applyHandoff(toolId, true);
      },
      first ? 250 : 400
    );
  }

  const live = document.getElementById('sumi-live-status');
  if (live && toolId !== 'home') {
    const tool = getToolById(toolId);
    if (tool) {
      live.textContent = `${tool.name}. ${t('nav.localBadge') || 'Processed on this device'}.`;
    }
  }
}
