import { searchTools, type ToolDefinition } from '../config/tool-registry';
import { escapeHtml } from '../utils/format';
import { t } from '../i18n/i18n';

let dialog: HTMLDialogElement | null = null;

function toolHref(tool: ToolDefinition): string {
  return tool.href;
}

export function openCommandPalette(): void {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'sumi-command';
    dialog.setAttribute('aria-label', t('command.title') || 'Search tools');
    dialog.innerHTML = `
      <form method="dialog" class="sumi-command__form">
        <label class="sr-only" for="sumi-command-input">${t('command.title') || 'Search tools'}</label>
        <input id="sumi-command-input" class="sumi-command__input" type="search" autocomplete="off" />
        <ul id="sumi-command-list" class="sumi-command__list" role="listbox"></ul>
        <p class="sumi-command__hint">${t('command.hint') || 'Type to find a tool. Esc to close.'}</p>
      </form>
    `;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog?.close();
    });
  }

  const input = dialog.querySelector('#sumi-command-input') as HTMLInputElement;
  const list = dialog.querySelector('#sumi-command-list') as HTMLUListElement;
  input.placeholder = t('tools.searchPlaceholder') || 'Search tools';

  const render = () => {
    const matches = searchTools(input.value).slice(0, 12);
    if (!input.value.trim()) {
      list.innerHTML = `<li class="sumi-command__empty">${t('command.empty') || 'Start typing a tool name'}</li>`;
      return;
    }
    if (matches.length === 0) {
      list.innerHTML = `<li class="sumi-command__empty">${t('command.none') || 'No tools match'}</li>`;
      return;
    }
    list.innerHTML = matches
      .map(
        (tool, index) => `
        <li>
          <a class="sumi-command__item" role="option" href="${toolHref(tool)}" data-index="${index}">
            <span class="sumi-command__name">${escapeHtml(tool.name)}</span>
            <span class="sumi-command__sub">${escapeHtml(tool.subtitle)}</span>
          </a>
        </li>`
      )
      .join('');
  };

  input.oninput = render;
  input.onkeydown = (event) => {
    if (event.key === 'Enter') {
      const first = list.querySelector('a') as HTMLAnchorElement | null;
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  };

  render();
  if (!dialog.open) dialog.showModal();
  input.focus();
  input.select();
}

export function initCommandPalette(): void {
  document.addEventListener('keydown', (event) => {
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const combo = (isMac && event.metaKey && event.key.toLowerCase() === 'k') ||
      (!isMac && event.ctrlKey && event.key.toLowerCase() === 'k');
    if (!combo) return;
    event.preventDefault();
    openCommandPalette();
  });

  document.querySelectorAll('[data-open-command]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openCommandPalette();
    });
  });
}
