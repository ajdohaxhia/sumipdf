# Sumi PDF architecture

Evidence from the BentoPDF tree at `5bf54f1dad75bdf3139e6314671f730f4c4a28de`, plus Sumi incremental layers.

## Purpose

Client-side PDF workspace: merge, edit, convert, protect, and automate PDF work in the browser. Documents are processed locally. There is no application server for file processing.

## Runtime

- **App:** static Vite multi-page site (HTML + TypeScript). Not React/Next/Vue for the product UI.
- **Docs:** VitePress under `docs/` (Vue only as a docs toolchain).
- **Hosting:** static (`dist/`). Cloudflare Pages, nginx, Docker, GitHub Pages.
- **Data stores:** in-memory Blobs (session workspace), `localStorage` for preferences/workflows/recent tool IDs only.

## Entrypoints

| Path                        | Role                                          |
| --------------------------- | --------------------------------------------- |
| `index.html`                | Home / command center                         |
| `src/pages/*.html`          | One HTML file per tool                        |
| `src/js/main.ts`            | Shared shell: i18n, nav, tool grid, shortcuts |
| `src/js/logic/*-page.ts`    | Per-tool bootstrap                            |
| `src/js/workflow/editor.ts` | Workflow Builder (Rete)                       |
| `public/sw.js`              | Service worker                                |

## Layers

1. **Shell** — navbar/footer partials, theme, command palette, session workspace tray.
2. **Registry** — `src/js/config/tools.ts` plus `src/js/config/tool-registry.ts` (Sumi categories, search, featured, metadata).
3. **Engines** — pdf-lib, pdf.js, qpdf-wasm, PyMuPDF WASM, Ghostscript WASM, CoherentPDF, LibreOffice WASM, Tesseract, EmbedPDF. Loaded per tool, not on first home paint (Sumi splits `ui-core` from `ui.ts`).
4. **Workflow** — Rete graph + list editor + versioned JSON recipes.
5. **Build** — `tsc` → `vite build` → `generate-i18n-pages.mjs` → sitemap → security headers → SEO audit.

## Commands

From `package.json`:

- `dev` — Vite
- `build` — typecheck + production MPA + i18n pages + sitemap + headers + SEO audit
- `preview` — `vite preview`
- `test` / `test:run` — Vitest
- `lint` / `lint:security`
- `security:patterns` / `security:audit`
- `docs:dev` / `docs:build`

## Constraints

- Do not rewrite the app in another framework.
- Preserve AGPL-3.0 and BentoPDF attribution.
- Preserve tool routes (`merge-pdf.html`, etc.).
- SharedArrayBuffer needs COOP/COEP for LibreOffice WASM.
- `SIMPLE_MODE=true` is build-time only (self-host branding strip).

## Risky zones

- `src/pages/*.html` SEO duplication
- WASM CDN URLs and CSP
- `cloudflare/cors-proxy-worker.js` (certs only; never documents)
- `src/js/logic/redact.ts` (visual cover vs real redaction)
- Generated `dist/` and `docs/.vitepress/cache/`
