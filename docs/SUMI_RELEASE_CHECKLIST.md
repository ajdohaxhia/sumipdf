# Sumi PDF 1.0 release checklist

Sumi PDF is currently a release candidate, not a verified 1.0.0 release.

## Legal and provenance

- [x] AGPL-3.0 license and upstream attribution retained
- [x] Sumi source and BentoPDF upstream are linked separately
- [x] Upstream commercial/Polar storefront is not resold by this fork
- [x] Upstream dual-licensing CLA automation removed from this fork
- [ ] Review every locale for stale commercial or upstream-only copy
- [ ] Obtain independent trademark clearance if the project needs it

## Product

- [x] Sumi Originals are first-class home/workspace entries
- [x] Full inherited utility directory is secondary on the homepage
- [x] Home does not statically import the PDF engines
- [x] Multi-file Originals use explicit queues and run buttons
- [x] Privacy Finder distinguishes cover from verified redaction
- [x] Folder Import makes manual refresh and experimental status explicit
- [ ] Complete browser journeys for each release-critical Original
- [ ] Qualify Packet TOC pages, links, and outlines in a browser journey
- [ ] Qualify camera Capture across supported browsers

## Quality gates

- [x] `npm run typecheck`
- [x] `npm run test:sumi` (16 files / 49 tests in the redesign pass)
- [ ] `npm run lint`
- [ ] `npm run test:run`
- [ ] `npm run security:patterns`
- [ ] `npm run build` with the real `SITE_URL` / `VITE_SITE_URL`
- [ ] Playwright desktop and mobile journeys
- [ ] Keyboard and screen-reader smoke tests
- [ ] Lighthouse and production bundle measurement

## Deploy

- [x] Cloudflare Pages output remains `dist`
- [x] Direct `.html` tool routes remain static; no catch-all SPA rewrite
- [x] Empty canonical origin no longer falls back to `bentopdf.com`
- [x] GitHub Pages deployment is manual rather than an automatic production path
- [ ] Configure the real public origin in repository/deployment variables
- [ ] Verify COOP/COEP, WASM MIME types, CSP, and cache headers at the edge
- [ ] Push and tag only after every required quality gate passes
