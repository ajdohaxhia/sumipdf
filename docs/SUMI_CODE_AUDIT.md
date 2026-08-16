# Sumi PDF code and product audit

Audit date: 2026-08-16

Branch: `fix/product-foundation-redesign`
Upstream: BentoPDF `main` at `053f22a87b8b7671fc0b6eddd6eaba612558d6da`

## Executive finding

The fork had substantial original code, but the product presentation and
several interaction contracts made it feel like a themed BentoPDF directory.
The highest-risk issue was not the visual layer alone: some Original modules
accepted the wrong file shapes, auto-ran ambiguous work, or described best-
effort behavior more strongly than the implementation justified.

This pass rebuilt the primary experience as a document workspace, corrected
those contracts, removed inherited release/deployment identity leaks, and
established a real upstream merge. It is a credible release candidate, but it
is not yet qualified as 1.0.0.

## Findings closed in this pass

| Severity | Finding                                                                                             | Resolution                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Privacy Finder could treat a visual cover as a successful privacy operation                         | Cover is explicitly non-redaction; only true redaction with no remaining markers is verified                                                    |
| High     | Batch, Packet, Proof, and Capture shared a generic single-PDF input contract                        | Each studio now has an explicit file policy, queue, validation, and run action                                                                  |
| High     | Folder Import implied a watcher that the browser implementation did not provide                     | Renamed behavior to honest manual refresh; experimental status retained                                                                         |
| High     | Canonical generation could silently fall back to the upstream BentoPDF domain                       | Empty origin now omits absolute canonical/sitemap output and fails no ownership claim                                                           |
| High     | Empty-origin builds still leaked BentoPDF through Open Graph and Twitter image metadata             | Social/canonical metadata and JSON-LD are stripped without a real origin; the SEO audit rejects upstream and placeholder origins                |
| High     | Release workflows could publish BentoPDF-branded images or unrelated commercial workflow            | Publishing is restricted to the Sumi repository/GHCR; upstream CLA automation was removed                                                       |
| High     | Three copied upstream patches did not repair Git ancestry, so GitHub still reported the fork behind | Checkout was unshallowed and `upstream/main` was merged; final relation is 0 behind / 25 ahead                                                  |
| Medium   | Homepage was a dense utility grid with a new skin                                                   | Home is now the Document Atelier: document entrance, Inspect → Transform → Prove narrative, Originals, flows, and a collapsed inherited archive |
| Medium   | Command palette used fragile rendering and incomplete keyboard behavior                             | DOM construction, combobox/listbox semantics, arrow/Enter/Escape handling, stale-render cancellation, and focus return added                    |
| Medium   | Capture's advertised image path did not match the PDF builder                                       | JPEG and PNG inputs are accepted and exercised through a real PDF download journey                                                              |
| Medium   | Documentation and deploy gates claimed more qualification than the session had proved               | Evidence/checklists now separate passing local gates from real-origin, edge, cross-browser, and performance qualification                       |
| Low      | Documentation build output was accidentally linted                                                  | VitePress `dist`, cache, and temp output are excluded from source linting                                                                       |

## Verification after the upstream merge

| Gate                                      | Result                                                        |
| ----------------------------------------- | ------------------------------------------------------------- |
| TypeScript                                | Pass                                                          |
| Sumi suite                                | 16 files / 49 tests passed                                    |
| Full unit suite                           | 66 files / 946 tests passed                                   |
| ESLint                                    | Pass; 0 errors / 483 inherited warnings                       |
| Security patterns                         | Pass; 2 sanitize-then-mutate review warnings                  |
| VitePress                                 | Pass; large-chunk warning                                     |
| Production build without canonical origin | Pass; 3,108 HTML files audited                                |
| Chromium Playwright                       | 18 / 18 journeys passed                                       |
| Visual QA                                 | Desktop comparison plus 390 × 844 mobile check passed locally |

## Open release blockers and debt

1. Run the build with the real public `SITE_URL` / `VITE_SITE_URL`, then verify
   canonical output and Cloudflare response headers at the edge.
2. Run Firefox, WebKit, mobile interaction, live-camera, keyboard, and screen-
   reader qualification. Chromium success is not a browser support matrix.
3. Measure Lighthouse, Web Vitals, initial-route transfer, and heavy-tool chunk
   budgets. The current build still reports large chunks.
4. Review or eliminate the two inherited sanitize-then-mutate warnings in
   `src/js/utils/helpers.ts` and `src/js/utils/markdown-editor.ts`.
5. Decide how to isolate or replace vendor code that uses direct `eval` in
   `wasm-vips`; it is a build warning and a CSP/security maintenance concern.
6. Reduce the 483-warning lint baseline instead of treating a zero-error exit as
   a clean codebase.
7. Complete browser-level inspection of Packet TOC links/outlines, Smart Split
   barcode decoding, and the remaining release-critical Originals.
8. Finish Compare reporting, merge virtualization, remaining locale/legal copy,
   and production bundle measurement before calling the release 1.0.0.

## Copyable next-pass prompt

> Continue on `fix/product-foundation-redesign` without pushing or tagging.
> Treat `docs/SUMI_CODE_AUDIT.md`, `docs/SUMI_RC_EVIDENCE.md`, and
> `docs/SUMI_RELEASE_CHECKLIST.md` as the source of truth. Configure a real
> staging origin, run the production build and verify canonical URLs plus
> Cloudflare COOP/COEP/CSP/cache headers. Then run Firefox, WebKit, 390 px mobile,
> live-camera Capture, full keyboard, screen-reader, Lighthouse, Web Vitals, and
> bundle-budget checks. Fix the two sanitize-then-mutate warnings and report a
> reduced lint-warning count. Qualify Packet TOC links/outlines and Smart Split
> decoding with synthetic fixtures. Do not declare or tag 1.0.0 unless every
> required release-checklist row passes; preserve local-only document handling,
> AGPL attribution, direct `.html` routes, and the Document Atelier design.
