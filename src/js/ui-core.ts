import { t } from './i18n/i18n';

export const dom = {
  gridView: document.getElementById('grid-view'),
  toolGrid: document.getElementById('tool-grid'),
  toolInterface: document.getElementById('tool-interface'),
  toolContent: document.getElementById('tool-content'),
  backToGridBtn: document.getElementById('back-to-grid'),
  loaderModal: document.getElementById('loader-modal'),
  loaderText: document.getElementById('loader-text'),
  alertModal: document.getElementById('alert-modal'),
  alertTitle: document.getElementById('alert-title'),
  alertMessage: document.getElementById('alert-message'),
  alertOkBtn: document.getElementById('alert-ok'),
  heroSection: document.getElementById('hero-section'),
  featuresSection: document.getElementById('features-section'),
  toolsHeader: document.getElementById('tools-header'),
  dividers: document.querySelectorAll('.section-divider'),
  hideSections: document.querySelectorAll('.hide-section'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsModalBtn: document.getElementById('close-shortcuts-modal'),
  shortcutsList: document.getElementById('shortcuts-list'),
  shortcutSearch: document.getElementById('shortcut-search'),
  resetShortcutsBtn: document.getElementById('reset-shortcuts-btn'),
  importShortcutsBtn: document.getElementById('import-shortcuts-btn'),
  exportShortcutsBtn: document.getElementById('export-shortcuts-btn'),
  openShortcutsBtn: document.getElementById('open-shortcuts-btn'),
  warningModal: document.getElementById('warning-modal'),
  warningTitle: document.getElementById('warning-title'),
  warningMessage: document.getElementById('warning-message'),
  warningCancelBtn: document.getElementById('warning-cancel-btn'),
  warningConfirmBtn: document.getElementById('warning-confirm-btn'),
};

export const showLoader = (text = t('common.loading'), progress?: number) => {
  if (dom.loaderText) dom.loaderText.textContent = text;

  const loaderModal = dom.loaderModal;
  if (loaderModal) {
    let progressBar = loaderModal.querySelector(
      '.loader-progress-bar'
    ) as HTMLElement;
    let progressContainer = loaderModal.querySelector(
      '.loader-progress-container'
    ) as HTMLElement;

    if (progress !== undefined && progress >= 0) {
      if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.className = 'loader-progress-container w-64 mt-4';
        progressContainer.innerHTML = `
                    <div class="bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div class="loader-progress-bar bg-indigo-500 h-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                    <p class="loader-progress-text text-xs text-gray-400 mt-1 text-center tabular-nums">0%</p>
                `;
        loaderModal.querySelector('.solid-spinner')?.parentElement?.appendChild(
          progressContainer
        );
      }
      if (!progressBar) {
        progressBar = loaderModal.querySelector(
          '.loader-progress-bar'
        ) as HTMLElement;
      }
      if (progressBar) {
        progressBar.style.width = `${Math.min(100, progress)}%`;
      }
      const progressText = loaderModal.querySelector(
        '.loader-progress-text'
      ) as HTMLElement;
      if (progressText) {
        progressText.textContent = `${Math.round(progress)}%`;
      }
    } else if (progressContainer) {
      progressContainer.remove();
    }
  }

  if (dom.loaderModal) {
    dom.loaderModal.classList.remove('hidden');
    const live = document.getElementById('sumi-live-status');
    if (live) live.textContent = text;
  }
};

export const hideLoader = () => {
  if (dom.loaderModal) dom.loaderModal.classList.add('hidden');
};

export const showAlert = (title: string, message: string) => {
  if (dom.alertTitle) dom.alertTitle.textContent = title;
  if (dom.alertMessage) dom.alertMessage.textContent = message;
  if (dom.alertModal) {
    dom.alertModal.classList.remove('hidden');
    (dom.alertOkBtn as HTMLButtonElement | null)?.focus();
  }
  const live = document.getElementById('sumi-live-status');
  if (live) live.textContent = `${title}: ${message}`;
};

export const hideAlert = () => {
  if (dom.alertModal) dom.alertModal.classList.add('hidden');
};

export const switchView = (view: string) => {
  if (!dom.gridView || !dom.toolInterface) return;
  if (view === 'grid') {
    dom.gridView.classList.remove('hidden');
    dom.toolInterface.classList.add('hidden');
    dom.heroSection?.classList.remove('hidden');
    dom.featuresSection?.classList.remove('hidden');
    dom.toolsHeader?.classList.remove('hidden');
    dom.dividers.forEach((divider) => {
      divider.classList.remove('hidden');
    });
    dom.hideSections.forEach((section) => {
      section.classList.remove('hidden');
    });
  } else {
    dom.gridView.classList.add('hidden');
    dom.toolInterface.classList.remove('hidden');
    dom.featuresSection?.classList.add('hidden');
    dom.heroSection?.classList.add('hidden');
    dom.toolsHeader?.classList.add('hidden');
    dom.dividers.forEach((divider) => {
      divider.classList.add('hidden');
    });
    dom.hideSections.forEach((section) => {
      section.classList.add('hidden');
    });
  }
};
