# Sumi PDF 1.0.0-RC.1 — functional evidence

Branch: `feat/sumi-pdf-1.0`  
Audited upstream: `5bf54f1dad75bdf3139e6314671f730f4c4a28de`  
Origin: `https://github.com/ajdohaxhia/sumipdf`

Status legend: `PASS` | `FAIL` | `PARTIAL` | `BLOCKED` | `NOT RUN`

A green UI mount is **not** evidence. Each row needs a real fixture, a real operation, and an inspected output.

## Module matrix

| Module              | Input fixture                                       | Real operation exercised                                                         | Output inspected                                                                        | Negative test            | Browser test           | Status                      |
| ------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ | ---------------------- | --------------------------- |
| Sentinel            | unit fixtures in `sentinel.test.ts`                 | `scanSentinel` + Safe Copy path                                                  | findings cite structures                                                                | no malware-free claim    | E2E journey incomplete | PARTIAL                     |
| Privacy Finder      | PDF text + checksum fixtures                        | `scanPrivacy` + true/cover redaction; bounded custom regex                       | extractability after true redaction; catastrophic regex rejected                        | empty selection rejected | E2E incomplete         | PARTIAL                     |
| Smart Split         | `src/tests/fixtures/barcodes/*.pdf`                 | `scanPdfBarcodes` (render + image XObject + ZXing; BarcodeDetector when present) | QR `SUMI-QR-ALPHA`, Code128 `SUMI128TEST`, EAN-13 `5901234123457`; text markers ignored | no-code PDF → 0 hits     | E2E smoke only         | PASS (unit) / PARTIAL (E2E) |
| Duplicate Finder    | unit fixtures                                       | fingerprint grouping                                                             | classes; no auto-delete                                                                 | —                        | E2E incomplete         | PARTIAL                     |
| Batch Forms         | unit fixtures                                       | fillBatch                                                                        | multi PDF / ZIP notes                                                                   | skip invalid             | E2E incomplete         | PARTIAL                     |
| Packet Builder      | multi-slot PDFs in `priority-one-originals.test.ts` | `insertTableOfContents` + outlines                                               | TOC pages, titles, page numbers, multi-page TOC (45 sections)                           | missing slot warning     | E2E incomplete         | PASS (unit) / PARTIAL (E2E) |
| Proof Verifier      | receipt fixtures                                    | schema + hash verify                                                             | tamper reject                                                                           | malformed / version      | E2E incomplete         | PARTIAL                     |
| Capture             | unit path                                           | image→PDF                                                                        | —                                                                                       | camera gated             | E2E incomplete         | PARTIAL                     |
| Print Preflight     | unit fixtures                                       | property findings                                                                | not-verifiable rows                                                                     | —                        | E2E incomplete         | PARTIAL                     |
| Accessibility Audit | unit fixtures                                       | missing title/lang                                                               | no PDF/UA claim                                                                         | —                        | E2E incomplete         | PARTIAL                     |
| Watch Folder        | feature detect                                      | experimental Chromium API                                                        | unsupported degrade                                                                     | —                        | non-blocking           | PARTIAL                     |

## Gate results (this pass)

| Gate                                       | Result               | Evidence                                                                       |
| ------------------------------------------ | -------------------- | ------------------------------------------------------------------------------ |
| `npm run test:sumi`                        | PASS                 | 15 files, **45** tests                                                         |
| `npm run test:run`                         | PASS                 | 64 files, **924** tests                                                        |
| `npm run typecheck`                        | PASS                 | after RegexValidation / Uint8Array fixes                                       |
| `npm run lint`                             | PASS (0 errors)      | 484 historical warnings remain                                                 |
| `npm run security:patterns`                | PASS                 | no code-injection patterns                                                     |
| Production build                           | PASS                 | `SITE_URL=https://sumi.local` (provisional; real PUBLIC_ORIGIN still required) |
| Direct Original `.html` in `dist/`         | PASS                 | all 11 Original routes present                                                 |
| Playwright (full 18 journeys × 3 browsers) | NOT RUN / incomplete | `@playwright/test` installed; config + partial specs; not full matrix          |
| Lighthouse / axe                           | NOT RUN              | —                                                                              |
| Coverage 80%/70% new cores                 | NOT RUN              | —                                                                              |
| `npm audit --omit=dev`                     | FAIL                 | 3 high (mermaid, nanoid, postcss) — unresolved                                 |
| Version `1.0.0-rc.1`                       | NOT SET              | still `2.8.7`                                                                  |
| Push + draft PR                            | NOT DONE             | do not push until matrix green                                                 |

## Barcode formats proven (unit, production decoder on PDF bytes)

| Format   | Fixture       | Decoded value   |
| -------- | ------------- | --------------- |
| QR       | `qr.pdf`      | `SUMI-QR-ALPHA` |
| Code 128 | `code128.pdf` | `SUMI128TEST`   |
| EAN-13   | `ean13.pdf`   | `5901234123457` |
| Control  | `no-code.pdf` | zero hits       |

Engine: ZXing (`@zxing/library`) via page render and/or PDF image XObjects. Native `BarcodeDetector` used when present. Text markers `QR:` / `CODE128:` are **not** production decode signals.

## Packet TOC proven (unit)

- Inserted TOC page(s) with visible section titles and final page numbers
- Outline/bookmarks present when requested
- Multi-page TOC when section count requires pagination (`planTocPageCount(40) > 1`)

## Known remaining RC blockers

1. Full mandatory Playwright journeys 1–18 across Chromium/Firefox/WebKit
2. Lighthouse + automated a11y scores
3. Coverage thresholds for new Sumi cores
4. Resolve or document high runtime `npm audit` findings
5. Confirm real `PUBLIC_ORIGIN` (build used provisional `https://sumi.local`)
6. Version bump to `1.0.0-rc.1`, clean matrix re-run, push, draft PR

**Verdict: not RC-qualified.**
