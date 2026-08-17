import { searchTools, type ToolDefinition } from '../config/tool-registry';
import { t } from '../i18n/i18n';

interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  run: () => void;
}

let dialog: HTMLDialogElement | null = null;
let renderVersion = 0;
let returnFocus: HTMLElement | null = null;

function toolHref(tool: ToolDefinition): string {
  return tool.href;
}

function buildDialog(): HTMLDialogElement {
  const next = document.createElement('dialog');
  next.className = 'sumi-command';
  next.setAttribute('aria-label', t('command.title') || 'Search tools');

  const form = document.createElement('form');
  form.method = 'dialog';
  form.className = 'sumi-command__form';

  const label = document.createElement('label');
  label.className = 'sr-only';
  label.htmlFor = 'sumi-command-input';
  label.textContent = t('command.title') || 'Search tools';

  const input = document.createElement('input');
  input.id = 'sumi-command-input';
  input.className = 'sumi-command__input';
  input.type = 'search';
  input.autocomplete = 'off';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'sumi-command-list');
  input.setAttribute('aria-expanded', 'true');

  const list = document.createElement('div');
  list.id = 'sumi-command-list';
  list.className = 'sumi-command__list';
  list.setAttribute('role', 'listbox');

  const hint = document.createElement('p');
  hint.className = 'sumi-command__hint';
  hint.textContent =
    t('command.hint') || 'Type to find a tool. Use arrows to move; Esc closes.';

  form.append(label, input, list, hint);
  next.append(form);
  next.addEventListener('click', (event) => {
    if (event.target === next) next.close();
  });
  next.addEventListener('close', () => {
    input.removeAttribute('aria-activedescendant');
    queueMicrotask(() => returnFocus?.focus());
  });
  document.body.append(next);
  return next;
}

function paletteItems(list: HTMLElement): HTMLElement[] {
  return [...list.querySelectorAll<HTMLElement>('[role="option"]')];
}

function setActiveOption(
  input: HTMLInputElement,
  list: HTMLElement,
  nextIndex: number
): void {
  const items = paletteItems(list);
  if (!items.length) {
    input.removeAttribute('aria-activedescendant');
    return;
  }
  const index = (nextIndex + items.length) % items.length;
  items.forEach((item, itemIndex) => {
    const active = itemIndex === index;
    item.setAttribute('aria-selected', String(active));
    item.classList.toggle('is-active', active);
  });
  const active = items[index];
  input.setAttribute('aria-activedescendant', active.id);
  active.scrollIntoView({ block: 'nearest' });
}

function appendEmpty(list: HTMLElement, message: string): void {
  const empty = document.createElement('p');
  empty.className = 'sumi-command__empty';
  empty.textContent = message;
  list.append(empty);
}

function appendCommand(
  list: HTMLElement,
  command: PaletteCommand,
  index: number
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = `sumi-command-option-${index}`;
  button.className = 'sumi-command__item';
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', 'false');
  const name = document.createElement('span');
  name.className = 'sumi-command__name';
  name.textContent = command.label;
  const sub = document.createElement('span');
  sub.className = 'sumi-command__sub';
  sub.textContent = command.group;
  button.append(name, sub);
  button.addEventListener('click', () => {
    dialog?.close();
    command.run();
  });
  list.append(button);
}

function appendTool(
  list: HTMLElement,
  tool: ToolDefinition,
  index: number
): void {
  const link = document.createElement('a');
  link.id = `sumi-command-option-${index}`;
  link.className = 'sumi-command__item';
  link.setAttribute('role', 'option');
  link.setAttribute('aria-selected', 'false');
  link.href = toolHref(tool);
  const name = document.createElement('span');
  name.className = 'sumi-command__name';
  name.textContent = tool.name;
  const sub = document.createElement('span');
  sub.className = 'sumi-command__sub';
  sub.textContent = tool.subtitle;
  link.append(name, sub);
  list.append(link);
}

export function openCommandPalette(): void {
  dialog ||= buildDialog();
  const input = dialog.querySelector<HTMLInputElement>('#sumi-command-input');
  const list = dialog.querySelector<HTMLElement>('#sumi-command-list');
  if (!input || !list) return;
  input.placeholder = t('tools.searchPlaceholder') || 'Search tools';

  const render = async (): Promise<void> => {
    const version = ++renderVersion;
    const query = input.value.trim().toLowerCase();
    let extra: PaletteCommand[] = [];
    try {
      const mod = await import('./workspace-app.js');
      extra = mod.getWorkspaceCommands();
    } catch {
      // The static registry still works when workspace code is unavailable.
    }
    if (version !== renderVersion) return;

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

    list.replaceChildren();
    let optionIndex = 0;
    for (const item of extraMatches) {
      appendCommand(list, item, optionIndex++);
    }
    for (const tool of tools) {
      appendTool(list, tool, optionIndex++);
    }
    if (!optionIndex) {
      appendEmpty(
        list,
        query
          ? t('command.none') || 'No tools match'
          : t('command.empty') || 'Start typing a tool, recipe, or operation'
      );
      input.removeAttribute('aria-activedescendant');
      return;
    }
    setActiveOption(input, list, 0);
  };

  input.oninput = () => void render();
  input.onkeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog?.close();
      return;
    }

    const items = paletteItems(list);
    const currentId = input.getAttribute('aria-activedescendant');
    const current = Math.max(
      0,
      items.findIndex((item) => item.id === currentId)
    );
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveOption(
        input,
        list,
        current + (event.key === 'ArrowDown' ? 1 : -1)
      );
    } else if (event.key === 'Enter') {
      const active = items[current];
      if (active) {
        event.preventDefault();
        active.click();
      }
    }
  };

  void render();
  if (!dialog.open) {
    const active = document.activeElement;
    returnFocus =
      active instanceof HTMLElement && active !== document.body
        ? active
        : document.querySelector<HTMLElement>('[data-open-command]');
    dialog.showModal();
  }
  input.focus();
  input.select();
}

export function initCommandPalette(): void {
  document.addEventListener('keydown', (event) => {
    const combo =
      (event.metaKey || event.ctrlKey) &&
      (event.key.toLowerCase() === 'k' || event.code === 'KeyK');
    if (!combo) return;
    event.preventDefault();
    openCommandPalette();
  });

  document.querySelectorAll('[data-open-command]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.preventDefault();
      openCommandPalette();
    });
  });
}
