import { searchTools, type ToolDefinition } from '../config/tool-registry';
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

  const render = async () => {
    const query = input.value.trim().toLowerCase();
    let extra: Array<{
      id: string;
      label: string;
      group: string;
      run: () => void;
    }> = [];
    try {
      const mod = await import('./workspace-app.js');
      extra = mod.getWorkspaceCommands();
    } catch {
      /* workspace commands stay empty when the shell is unavailable */
    }
    const tools = searchTools(input.value).slice(0, 8);
    const extraMatches = extra
      .filter((item) => {
        if (!query) return item.group === 'Workspace';
        return (
          item.label.toLowerCase().includes(query) ||
          item.group.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);

    if (!query && extraMatches.length === 0 && tools.length === 0) {
      list.replaceChildren();
      const empty = document.createElement('li');
      empty.className = 'sumi-command__empty';
      empty.textContent =
        t('command.empty') || 'Start typing a tool, recipe, or operation';
      list.append(empty);
      return;
    }

    list.replaceChildren();
    for (const item of extraMatches) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sumi-command__item';
      button.setAttribute('role', 'option');
      const name = document.createElement('span');
      name.className = 'sumi-command__name';
      name.textContent = item.label;
      const sub = document.createElement('span');
      sub.className = 'sumi-command__sub';
      sub.textContent = item.group;
      button.append(name, sub);
      button.addEventListener('click', () => {
        dialog?.close();
        item.run();
      });
      li.append(button);
      list.append(li);
    }
    for (const tool of tools) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.className = 'sumi-command__item';
      a.setAttribute('role', 'option');
      a.href = toolHref(tool);
      const name = document.createElement('span');
      name.className = 'sumi-command__name';
      name.textContent = tool.name;
      const sub = document.createElement('span');
      sub.className = 'sumi-command__sub';
      sub.textContent = tool.subtitle;
      a.append(name, sub);
      li.append(a);
      list.append(li);
    }
    if (list.childElementCount === 0) {
      const empty = document.createElement('li');
      empty.className = 'sumi-command__empty';
      empty.textContent = t('command.none') || 'No tools match';
      list.append(empty);
    }
  };

  input.oninput = () => {
    void render();
  };
  input.onkeydown = (event) => {
    if (event.key === 'Enter') {
      const first = list.querySelector('a, button') as HTMLElement | null;
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  };

  void render();
  if (!dialog.open) dialog.showModal();
  input.focus();
  input.select();
}

export function initCommandPalette(): void {
  document.addEventListener('keydown', (event) => {
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const combo =
      (isMac && event.metaKey && event.key.toLowerCase() === 'k') ||
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
