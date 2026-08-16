import { initTheme } from '../ui/theme';
import { mountThemeSwitcher } from '../ui/theme-switcher';
import { initCommandPalette } from '../ui/command-palette';
import {
  initI18n,
  applyTranslations,
  injectLanguageSwitcher,
} from '../i18n/index';
import { brand } from '../config/brand';
import { initWorkspaceEntrance, mountWorkspaceApp } from '../ui/workspace-app';
import { paneFromLocation } from '../workspace/controller';
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
  hidePolarStorefront();
  initWorkspaceEntrance();
  await mountWorkspaceApp({ pane: paneFromLocation() });
  createIcons({ icons });
  document.title = `${brand.name} — Workspace`;
};

void init();
