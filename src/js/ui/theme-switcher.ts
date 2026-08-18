import {
  applyTheme,
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from './theme';

export function mountThemeSwitcher(target: HTMLElement | null): void {
  if (!target) return;
  const label = document.createElement('label');
  label.className = 'sr-only';
  label.htmlFor = 'sumi-theme-select';
  label.textContent = 'Theme';

  const select = document.createElement('select');
  select.id = 'sumi-theme-select';
  select.setAttribute('aria-label', 'Theme');
  const pref = getThemePreference();
  for (const option of [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ] as [ThemePreference, string][]) {
    const el = document.createElement('option');
    el.value = option[0];
    el.textContent = option[1];
    if (option[0] === pref) el.selected = true;
    select.appendChild(el);
  }
  select.addEventListener('change', () => {
    setThemePreference(select.value as ThemePreference);
  });
  target.append(label, select);
  applyTheme(pref);
}
