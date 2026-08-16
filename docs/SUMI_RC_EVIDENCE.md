# Sumi PDF release-candidate evidence

Sumi PDF is **not qualified as 1.0.0**. This file records what has actually
been exercised and keeps experimental or partial modules from being presented
as complete.

The fork is synchronized with BentoPDF through upstream commit
`053f22a87b8b7671fc0b6eddd6eaba612558d6da`. The final ancestry check was
`0 behind / 23 ahead` against `upstream/main`. The original comparison baseline
for the Sumi Originals audit remains
`5bf54f1dad75bdf3139e6314671f730f4c4a28de`.

## Originals status

| Module                | Evidence currently available                                                                   | Honest status                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Sentinel              | Structural scanning and Safe Copy unit tests; active content is not executed                   | Candidate; never a malware verdict                                  |
| Privacy Finder        | Pattern/checksum tests; cover-vs-redaction extraction test; post-redaction marker verification | Candidate; text layer only, OCR not wired                           |
| Smart Split & Rename  | Grouping, naming, collision, rendered-page BarcodeDetector/ZXing code, and barcode fixtures    | Candidate; browser decoding journey still required                  |
| Duplicate Page Finder | Exact/text/visual grouping unit tests and explicit keep strategies                             | Candidate; no automatic deletion                                    |
| Batch Form Studio     | Parser/generator tests, UI input-policy test, and Chromium mapping-to-ZIP journey              | Candidate; generated field fidelity still needs broader fixtures    |
| Packet Builder        | TOC pages/links/outlines tests plus Chromium mapping, build, and PDF-download journey          | Candidate; links/outlines still need browser-level inspection       |
| Proof Verifier        | SHA-256 receipt and tamper-rejection tests; three-input UI policy test                         | Candidate; not a digital signature or timestamp                     |
| Capture               | Pixel helpers plus Chromium ordered PNG import, reorder controls, build, and PDF download      | Experimental; live camera path still needs browser qualification    |
| Print Preflight       | Mixed-size and not-verifiable unit tests                                                       | Candidate; not ISO/GWG certification                                |
| Accessibility Audit   | Indicator and safe metadata-fix tests                                                          | Candidate; not PDF/UA or WCAG certification                         |
| Folder Import         | Manual directory read/diff tests and UI integration test                                       | Experimental; no background watcher or automatic workflow execution |

## Current checks

Update this section only from fresh command output on the release candidate.

| Check                                    | Current result                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run typecheck`                      | Passed                                                                        |
| `npm run test:sumi`                      | 16 files / 49 tests passed                                                    |
| Full `npm run test:run`                  | 66 files / 945 tests passed                                                   |
| `npm run lint`                           | Passed with 0 errors / 483 inherited warnings                                 |
| `npm run security:patterns`              | Passed; 2 existing sanitize-then-mutate warnings remain for review            |
| `npm run docs:build`                     | Passed; VitePress reports a large-chunk warning                               |
| Empty-origin production build            | Passed; 148 source HTML files produced 3,108 audited HTML files               |
| SEO audit                                | Passed; sitemap intentionally empty until a public origin is configured       |
| Chromium Playwright                      | 18 / 18 journeys passed against the production build                          |
| Desktop/mobile visual comparison         | Passed locally at 1,487 × 1,058 and 390 × 844                                 |
| Real-origin build / edge-header check    | Pending                                                                       |
| Firefox / WebKit / camera qualification  | Pending                                                                       |
| Lighthouse / Web Vitals / bundle budgets | Pending; Vite still warns about large chunks and vendor `eval` in `wasm-vips` |

No tag or release should be created while any required row remains pending. The
passing empty-origin build proves buildability, not a production deployment:
canonical URLs, Cloudflare response headers, Lighthouse, and cross-browser
camera behavior remain unverified.
