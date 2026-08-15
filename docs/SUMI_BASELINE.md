# Sumi PDF — Phase 0 baseline

Recorded 2026-08-15 from a fresh fork of upstream BentoPDF.

## Repository

| Item                       | Value                                                                         |
| -------------------------- | ----------------------------------------------------------------------------- |
| Public fork (origin)       | https://github.com/ajdohaxhia/sumipdf                                         |
| Upstream                   | https://github.com/alam00000/bentopdf                                         |
| Upstream / origin HEAD SHA | `5bf54f1dad75bdf3139e6314671f730f4c4a28de`                                    |
| Upstream commit            | Implement decompression for GZIP files in LibreOfficeConverter initialization |
| Working branch             | `feat/sumi-pdf-1.0`                                                           |
| License                    | AGPL-3.0-only (unchanged)                                                     |
| Upstream package           | `bento-pdf@2.8.7`                                                             |

GitHub fork relationship is intact (`isFork: true`, parent `alam00000/bentopdf`). History was not rewritten.

## Commands run

### `npm ci`

Succeeded. 932 packages added. npm reported 15 vulnerabilities (6 low, 5 moderate, 4 high) and deprecated `glob@10.5.0`, `jpeg-exif@1.1.4`, `@types/html2canvas@1.0.0`.

### `npm run test:run`

Vitest 4.1.0:

- Test files: 3 failed, 38 passed (41)
- Tests: **14 failed, 833 passed** (847)

Failures are pre-existing on this machine/environment, not introduced by Sumi work:

| File                                  | Failures | Cause                                                                                                                                                  |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/tests/i18n.test.ts`              | 10       | `localStorage` is undefined in this Node/jsdom run (`ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`) |
| `src/tests/xss-replay.test.ts`        | 2        | Same `localStorage.clear()` crash                                                                                                                      |
| `src/tests/split-pdf-helpers.test.ts` | 2        | Missing fixtures `src/tests/fixtures/shared-resources.pdf` and `bookmarked.pdf` (directory empty / not in the clone)                                   |

Pipeline `tee` reported shell exit 0; Vitest itself failed. Treat baseline as **833 pass / 14 fail**.

### `npm run lint`

ESLint completed with **0 errors, 466 warnings**. No Sumi changes yet.

### `npm run security:patterns`

Passed: no code-injection patterns found. Two `sanitize-then-mutate` warnings in `helpers.ts` and `markdown-editor.ts` (pre-existing).

### Production build

Not run in the first baseline pass (full Vite MPA + i18n generation is long). Run during Phase 6 and recorded in the implementation log.

### `npm run seo-audit` / CodeQL / Playwright

Not run at baseline. CodeQL is optional (`security:codeql`) and requires the CodeQL CLI. No Playwright config exists upstream.

## Inventory snapshot

- Vite MPA: `index.html` + ~117 `src/pages/*.html` tool entries
- Canonical tool list: `src/js/config/tools.ts` (7 categories; Popular Tools duplicates other entries)
- i18n: 21 locales under `public/locales/`
- Workflow builder: Rete + Lit in `src/js/workflow/`
- PWA: `public/sw.js` cache `bentopdf-v11`, `public/site.webmanifest`
- Default public URL in generators: `https://www.bentopdf.com`
- Branding: 100% BentoPDF; no Sumi strings in the clone
- Analytics: none found (GitHub star count fetch only)
- Homepage loads `src/js/main.ts` → `ui.ts` → `pdfjs-dist` + Sortable (heavy first paint)

## Name collision (lightweight)

Not a trademark clearance. Formal legal review recommended before commercial use.

| Check                         | Result                                                  |
| ----------------------------- | ------------------------------------------------------- |
| GitHub `sumipdf` / `sumi-pdf` | No conflicting PDF product repo found besides this fork |
| npm `sumipdf`, `sumi-pdf`     | 404 / unpublished                                       |
| npm `sumi`                    | Unrelated 2015 test package                             |
| OpenSumi / `@opensumi/*`      | Alibaba IDE framework — different product class         |
| EU SUMI                       | Sustainable Urban Mobility Indicators — different field |
| GitHub `pdf-sumy`             | Abandoned 2015 PDF summarizer, not “Sumi PDF”           |
| sumipdf.com / sumi.app        | Not verified as available; do not claim ownership       |

## Risks carried into implementation

1. 117 duplicated tool HTML shells with hardcoded BentoPDF SEO.
2. Homepage main chunk currently pulls PDF.js via `ui.ts`.
3. Dual icon libraries (Phosphor + Lucide).
4. WASM defaults load from jsDelivr unless env overrides.
5. Optional CORS proxy for certificate fetching — must stay off by default and never receive document bytes.
6. `redact.ts` draws black rectangles (visual cover). Real redaction exists in the workflow PyMuPDF node only.
7. Missing test PDF fixtures in the published tree.
8. BentoPDF commercial Polar.sh license must not be resold from this fork.
