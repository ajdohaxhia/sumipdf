# Sumi PDF implementation log

Upstream base: `5bf54f1dad75bdf3139e6314671f730f4c4a28de`  
Branch: `feat/sumi-pdf-1.0`  
Origin: https://github.com/ajdohaxhia/sumipdf  
Upstream: https://github.com/alam00000/bentopdf

## Phase 0 — Baseline and risk audit

### Decisions

- Empty workspace was not a BentoPDF checkout. Forked `alam00000/bentopdf` to `ajdohaxhia/sumipdf` (public, GitHub fork) and cloned it here.
- Remotes: `origin` = Sumi fork, `upstream` = BentoPDF.
- Stay on Vite MPA + TypeScript; no framework rewrite.
- Record inherited test failures honestly (jsdom localStorage + missing fixtures).

### Files

- `docs/SUMI_BASELINE.md`
- `docs/SUMI_ARCHITECTURE.md`
- `docs/SUMI_DESIGN_SYSTEM.md`
- `docs/SUMI_PRIVACY_MODEL.md`
- `docs/SUMI_RELEASE_CHECKLIST.md`
- `docs/SUMI_NAME_COLLISION.md`
- this log

### Tests

See `docs/SUMI_BASELINE.md`: 833 passed, 14 failed, lint 0 errors / 466 warnings, security-patterns pass.

### Open

- Production build and Lighthouse not yet measured at Phase 0.

## Phase 1 — Legal rebrand and design system

### Decisions

- Keep AGPL-3.0 and git history. NOTICE.md / CREDITS.md name BentoPDF as upstream.
- Semantic tokens in `src/css/sumi.css` (paper/ink/ash/rule/signal).
- Self-hosted IBM Plex Sans + Source Serif 4. No third-party font CDN for UI.
- Do not sell Polar commercial licenses from this fork.
- Name collision check recorded; not a trademark clearance.

### Files

- `src/js/config/brand.ts`, logos in `public/images/`, `package.json` name `sumi-pdf`
- README, NOTICE, CREDITS, CONTRIBUTING, SECURITY, CHANGELOG
- `licensing.html` storefront hidden; AGPL notice added

## Phase 2 — Application shell and discovery

### Decisions

- Shared header/footer; command palette; home drop zone above the fold.
- Canonical registry derived from `tools.ts` to avoid a second source of truth for routes.
- Homepage `main.ts` imports `ui-core` + `format`, not `ui.ts` / pdfjs.

## Phase 3 — Local workspace and core tools

### Decisions

- In-memory Blobs only. Recent tool IDs in localStorage. No PDF bytes in localStorage.
- Handoff via `sessionStorage` item ids + DataTransfer into `#file-input`.
- `downloadFile` also stores the result in the session workspace.
- Compress keeps the original in the workspace and reports when size does not drop.
- Privacy Clean returns an honest pdf-lib report. Redact PDF uses PyMuPDF `addRedaction` / `applyRedactions`.

## Phase 4 — Workflow Builder 2.0

### Decisions

- Improve the existing Rete builder; do not add a second engine.
- Six recipes using registered node types. `?recipe=` loads them.
- Accessible list view with linear reorder. Branched graphs stay canvas-only.
- Preflight rejects unknown nodes, missing IO, and stored passwords.

## Phase 5 — Privacy, offline, performance, accessibility

### Decisions

- No analytics SDK. GitHub star API disabled unless `ENABLE_GITHUB_STARS=true`.
- Service worker cache `sumi-pdf-v1`; clears legacy `bentopdf-*` caches. User documents are not cached.
- Engine settings page can clear offline assets.
- `prefers-reduced-motion` honored in `sumi.css`.

## Phase 6 — Cloudflare, SEO, docs, QA

### Decisions

- `public/_headers` for COOP/COEP/WASM. No SPA catch-all rewrite (this is an MPA).
- `SITE_URL` / `VITE_SITE_URL` required for production canonicals and sitemap. Empty is valid for local builds.
- Playwright is not in this repository; E2E was not invented.

### Remaining (not claimed done)

- 117 tool pages still use legacy gray/indigo markup (themed via CSS remap).
- Playwright / Lighthouse / production bundle sizes: run and record at verification.
- Other locales besides EN/IT are incomplete for new keys (fallback works).
- Compare PDF downloadable report and merge virtualization are incomplete.
- Missing upstream fixtures still fail two split-pdf tests if those files are absent.
