import { initTheme } from '../ui/theme';
import { mountThemeSwitcher } from '../ui/theme-switcher';
import { initCommandPalette } from '../ui/command-palette';
import {
  initI18n,
  applyTranslations,
  injectLanguageSwitcher,
} from '../i18n/index';
import { hidePolarStorefront } from '../workspace/adapters';
import '../css/styles.css';
import { createIcons, icons } from 'lucide';

const init = async () => {
  initTheme();
  mountThemeSwitcher(document.getElementById('sumi-theme-switcher'));
  await initI18n();
  injectLanguageSwitcher();
  applyTranslations();
  initCommandPalette();
  hidePolarStorefront();
  const root = document.getElementById('sumi-original-root');
  const id = document.body.dataset.sumiOriginal || '';
  if (root && id) {
    const { mountOriginalTool } = await import('../sumi/ui/original-page.js');
    await mountOriginalTool(root, id);
  }
  createIcons({ icons });
};

void init();
