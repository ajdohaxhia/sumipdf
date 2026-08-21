import { initTheme } from '../ui/theme';
import { mountThemeSwitcher } from '../ui/theme-switcher';
import { initCommandPalette } from '../ui/command-palette';
import { initCurrentNav, markCurrentNav } from '../ui/current-nav';
import {
  initI18n,
  applyTranslations,
  injectLanguageSwitcher,
} from '../i18n/index';
import { brand } from '../config/brand';
import { initWorkspaceEntrance, mountWorkspaceApp } from '../ui/workspace-app';
import { paneFromLocation, workspaceController } from '../workspace/controller';
import { hidePolarStorefront } from '../workspace/adapters';
import '../../css/styles.css';
import { createIcons, icons } from 'lucide';

const init = async () => {
  initTheme();
  mountThemeSwitcher(document.getElementById('sumi-theme-switcher'));
  await initI18n();
  injectLanguageSwitcher();
  applyTranslations();
  initCommandPalette();
  initCurrentNav();
  hidePolarStorefront();
  initWorkspaceEntrance();
  await mountWorkspaceApp({ pane: paneFromLocation() });
  createIcons({ icons });
  workspaceController.subscribe(() => markCurrentNav());
  markCurrentNav();
  const page =
    window.location.pathname
      .split('/')
      .pop()
      ?.replace(/\.html$/, '') || 'workspace';
  const titles: Record<string, string> = {
    workspace: `${brand.name} — Workspace`,
    inspect: `Inspect — ${brand.name}`,
    flow: `Flow — ${brand.name}`,
    proof: `Proof — ${brand.name}`,
    recipes: `Recipes — ${brand.name}`,
  };
  document.title = titles[page] || `${brand.name} — Workspace`;
  window.addEventListener('hashchange', () => {
    workspaceController.setPane(paneFromLocation());
    markCurrentNav();
  });
};

void init();
