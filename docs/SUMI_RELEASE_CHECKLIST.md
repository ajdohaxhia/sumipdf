# Sumi PDF 1.0 release checklist

Use PASS / FAIL / BLOCKED / N/A with evidence. Build success alone is not a release.

## Legal

- [ ] AGPL-3.0 LICENSE intact
- [ ] NOTICE/CREDITS names BentoPDF upstream and this fork
- [ ] Git history not rewritten
- [ ] No Polar.sh / BentoPDF commercial license resale
- [ ] Source link in footer
- [ ] Fonts, icons, WASM licenses compatible
- [ ] Name collision notes recorded; no trademark-clearance claim

## Product

- [ ] Visible Sumi PDF identity (logo, titles, manifest)
- [ ] Home drop zone + search usable above the fold
- [ ] Home does not load PDF/WASM engines
- [ ] Categories/search from canonical registry
- [ ] Existing BentoPDF tools still routed
- [ ] Session workspace handoff without uploads
- [ ] Workflow Builder improved (list + recipes), not duplicated
- [ ] Real redaction ≠ black box; extraction test exists
- [ ] Privacy Clean verification report
- [ ] No ads, accounts, paywall, watermark, fake testimonials

## Privacy / security

- [ ] Privacy network interception test on a synthetic PDF
- [ ] Headers: COOP, COEP, CSP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options
- [ ] Proxy disabled by default
- [ ] `security:patterns` pass
- [ ] No secrets committed

## Quality

- [ ] `npm ci`
- [ ] lint (0 errors)
- [ ] unit tests (document any inherited failures)
- [ ] production build
- [ ] SEO audit
- [ ] EN + IT complete for new surfaces
- [ ] Keyboard smoke: home, search, Merge, Organize, Compress, Sign, Privacy Clean, Workflow
- [ ] Light and dark contrast

## Deploy

- [ ] Cloudflare `_headers` in `public/`
- [ ] Direct tool URLs work (no SPA catch-all that eats HTML)
- [ ] WASM MIME types
- [ ] `VITE_SITE_URL` / `VITE_NOINDEX` documented
