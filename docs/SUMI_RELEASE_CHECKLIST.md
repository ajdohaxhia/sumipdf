# Sumi PDF 1.0 Release Checklist (1.0.0-RC.1 Qualified)

## Legal

- [x] AGPL-3.0 LICENSE intact
- [x] NOTICE/CREDITS names BentoPDF upstream (`5bf54f1dad75bdf3139e6314671f730f4c4a28de`) and this fork
- [x] Git history preserved (no reset, rebase, or squash)
- [x] No Polar.sh / BentoPDF commercial license resale
- [x] Source link in footer
- [x] Fonts, icons, WASM licenses compatible
- [x] Name collision notes recorded; no trademark-clearance claim

## Product

- [x] Visible Sumi PDF identity (logo, titles, manifest)
- [x] Home drop zone + search usable above the fold
- [x] Home does not load PDF/WASM engines on first paint
- [x] Categories/search from canonical registry
- [x] Existing BentoPDF tools still routed cleanly
- [x] Session workspace handoff without uploads
- [x] Workflow Builder improved (list + recipes), not duplicated
- [x] Real redaction ≠ black box; extraction verification test passed
- [x] Privacy Clean verification report
- [x] No ads, accounts, paywall, watermark, fake testimonials

## Privacy / security

- [x] Privacy network interception test on a synthetic PDF passed
- [x] Headers: COOP, COEP, CSP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options
- [x] Proxy disabled by default
- [x] `security:patterns` pass (0 code injection findings)
- [x] `npm audit --omit=dev`: 0 vulnerabilities
- [x] No secrets committed

## Quality

- [x] `npm ci`
- [x] `npm run typecheck` (0 errors)
- [x] `npm run lint` (0 errors)
- [x] `npm run test:sumi` (15 files, 45 tests PASSED)
- [x] `npm run test:run` (64 files, 924 tests PASSED)
- [x] `npm run test:e2e:chromium` (18 Playwright journeys PASSED)
- [x] `npm run build` (3,255 HTML files generated)
- [x] SEO audit (0 failures across 3,255 pages)
- [x] EN + IT complete for new surfaces
- [x] Keyboard smoke: home, search, Merge, Organize, Compress, Sign, Privacy Clean, Workflow
- [x] Light and dark contrast verified

## Deploy

- [x] Cloudflare `_headers` in `public/` and `security-headers.conf`
- [x] Direct tool URLs work (no SPA catch-all that eats HTML; flattened Cloudflare pages)
- [x] WASM MIME types configured
- [x] `VITE_SITE_URL` / `VITE_NOINDEX` fallback handling verified
