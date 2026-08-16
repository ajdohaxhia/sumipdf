# Sumi PDF release-candidate evidence

Sumi PDF is **not qualified as 1.0.0**. This file records what has actually
been exercised and keeps experimental or partial modules from being presented
as complete.

The fork is synchronized with BentoPDF through upstream commit
`053f22a87b8b7671fc0b6eddd6eaba612558d6da`. The original comparison baseline
for the Sumi Originals audit remains
`5bf54f1dad75bdf3139e6314671f730f4c4a28de`.

## Originals status

| Module                | Evidence currently available                                                                   | Honest status                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Sentinel              | Structural scanning and Safe Copy unit tests; active content is not executed                   | Candidate; never a malware verdict                                  |
| Privacy Finder        | Pattern/checksum tests; cover-vs-redaction extraction test; post-redaction marker verification | Candidate; text layer only, OCR not wired                           |
| Smart Split & Rename  | Grouping, naming, collision, rendered-page BarcodeDetector/ZXing code, and barcode fixtures    | Candidate; browser decoding journey still required                  |
| Duplicate Page Finder | Exact/text/visual grouping unit tests and explicit keep strategies                             | Candidate; no automatic deletion                                    |
| Batch Form Studio     | Parser/generator tests plus UI input-policy integration test                                   | Candidate; browser journey still required                           |
| Packet Builder        | Measured section assembly, inserted TOC pages/links/outlines, and explicit slot/options UI     | Candidate; browser output journey still required                    |
| Proof Verifier        | SHA-256 receipt and tamper-rejection tests; three-input UI policy test                         | Candidate; not a digital signature or timestamp                     |
| Capture               | Pixel helpers, ordered image import, JPEG/PNG PDF path, and camera fallback code               | Experimental; camera path still needs browser qualification         |
| Print Preflight       | Mixed-size and not-verifiable unit tests                                                       | Candidate; not ISO/GWG certification                                |
| Accessibility Audit   | Indicator and safe metadata-fix tests                                                          | Candidate; not PDF/UA or WCAG certification                         |
| Folder Import         | Manual directory read/diff tests and UI integration test                                       | Experimental; no background watcher or automatic workflow execution |

## Current checks

Update this section only from fresh command output on the release candidate.

| Check                                    | Current result                                  |
| ---------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                      | Passed in the redesign pass                     |
| `npm run test:sumi`                      | 16 files / 49 tests passed in the redesign pass |
| Targeted registry/privacy/original tests | Passed in the redesign pass                     |
| Full `npm run test:run`                  | Pending after the redesign                      |
| `npm run lint`                           | Pending after the redesign                      |
| `npm run build`                          | Pending after the redesign                      |
| Playwright journeys                      | Pending after the redesign                      |
| Lighthouse / Web Vitals                  | Pending                                         |

No tag or release should be created while any required row remains pending.
