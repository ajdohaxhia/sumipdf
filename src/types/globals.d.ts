/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TESSERACT_WORKER_URL?: string;
  readonly VITE_TESSERACT_CORE_URL?: string;
  readonly VITE_TESSERACT_LANG_URL?: string;
  readonly VITE_TESSERACT_AVAILABLE_LANGUAGES?: string;
  readonly VITE_OCR_FONT_BASE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_REPO_URL?: string;
  readonly VITE_UPSTREAM_URL?: string;
  readonly VITE_AUTHOR_URL?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_LOGO?: string;
  readonly VITE_NOINDEX?: string;
  readonly SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __SIMPLE_MODE__: boolean;
declare const __DISABLE_GITHUB_STARS__: boolean;
declare const __DISABLED_TOOLS__: string[];
