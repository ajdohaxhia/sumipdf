# Sumi PDF — product differentiation

This document classifies what Sumi inherited, what it reskins, and what it adds. Branding is not the product. The product is a private, local-first workspace:

> Drop → Inspect → Build flow → Preview → Export → Verify

BentoPDF remains the PDF engine and compatibility foundation. Sumi does not rewrite the app in React/Next. Vite + TypeScript + existing engines. Client-side only. No uploads, analytics, ads, accounts, Polar storefront, remote AI, or document persistence.

## Classification

### Inherited engines and utilities (BentoPDF)

Keep and reuse. Do not reimplement.

| Layer                             | Evidence                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| pdf-lib operations                | `src/js/utils/pdf-operations.ts`, merge/split/rotate/delete/watermark/page numbers/fix size |
| Sanitize / flatten                | `src/js/utils/sanitize.ts`, `src/js/utils/flatten-annotations.ts`                           |
| Compress                          | `src/js/utils/compress.ts` (PyMuPDF condense / photon)                                      |
| Real redaction                    | `src/js/utils/redact-real.ts` (PyMuPDF `addRedaction` / `applyRedactions`)                  |
| qpdf load/repair/decrypt          | `src/js/utils/load-pdf-document.ts`, `src/js/utils/pdf-decrypt.ts`                          |
| OCR / Tesseract                   | `src/js/utils/ocr.ts`, `src/js/utils/tesseract-runtime.ts`                                  |
| WASM loaders                      | PyMuPDF, Ghostscript, CoherentPDF, LibreOffice                                              |
| Rete workflow nodes               | `src/js/workflow/nodes/*` — compatibility graph, not the primary Sumi UI                    |
| 100+ tool pages                   | `src/pages/*.html` + `src/js/logic/*-page.ts`                                               |
| EmbedPDF editor / visual sign     | existing Sign and Edit tools                                                                |
| Service worker asset cache        | `public/sw.js` (must never cache user documents)                                            |
| AGPL-3.0, NOTICE, upstream credit | legal, not optional                                                                         |

### Reskin (not claimed as differentiation)

- Paper / ink / vermilion tokens (`src/css/sumi.css`)
- IBM Plex Sans + Source Serif 4
- Navbar/footer copy, logo, homepage hero wording
- CSS remap of inherited gray/indigo tool markup
- Tool registry labels and search

A theme on a button grid is still a button grid. That is not Sumi.

### Original to Sumi (this pass)

| Surface             | What it is                                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workspace**       | Homepage is a document entrance. After a PDF is chosen, a real workspace opens (preview, page map, inspection, flow, output preview, export/verify). Files stay in memory for this tab. No bounce to a legacy tool as the default path. |
| **Inspect**         | Progressive local document map. Findings are hedged, cancellable, never auto-applied. Selecting a finding highlights pages and can propose a Flow action with an explanation.                                                           |
| **Flow**            | Vertical operation stack as the primary UI. Reuses inherited engines. Undo/redo, validation, preview of projected output, fail-at-step, blob cleanup, batch that isolates failures.                                                     |
| **Recipes**         | Named, editable Flows. Steps are visible before run. JSON never contains files, passwords, redaction text, or personal metadata.                                                                                                        |
| **Proof**           | After a flow: before/after metrics, SHA-256, warnings, honest PDF/A limits, redaction-vs-cover check, downloadable JSON + human-readable receipt. Not a legal or cryptographic certificate.                                             |
| **Connect**         | Finding → action, page selection → step scope, Flow → Proof, Proof warning → step, recipe → Flow + Inspect preflight, quick action → single-step Flow, ⌘K/CtrlK for the same objects.                                                   |
| **Legacy adapters** | Tool pages remain. They hand off into workspace progress/output/Proof where practical. Product-facing Bento/Polar sales copy is removed. Legal AGPL/NOTICE/upstream credit stays.                                                       |

## Information architecture

Primary nav (visible, not icon-only):

1. Workspace
2. Inspect
3. Flow
4. Proof
5. Tools (secondary directory)
6. Recipes
7. Privacy
8. Open source

Homepage (`index.html`) is the workspace entrance: drop or choose files first. Merge / Compress / Organize / Sign are **preconfigured Flows**, not four unrelated destinations.

`tools.html` and `src/pages/*.html` remain for compatibility and deep links. Shared chrome is `{{> navbar }}` on tool pages. Exception: `pdf-multi-tool.html` uses a compact full-viewport editor bar instead of the standard navbar.

## Inspect / Flow / Proof architecture

```
[drop zone] --in-memory Blob--> WorkspaceController
                                      |
                 +--------------------+--------------------+
                 |                    |                    |
            InspectEngine        FlowStack            ProofEngine
            (pdf-lib worker,     (vertical ops,       (metrics, SHA-256,
             optional pdf.js      inherited utils,     redaction check,
             for preview)         undo/redo)           receipt)
                 |                    |                    |
                 +-------- recommendations / scope -------+
                                      |
                                 Export + receipt
                                 (download only;
                                  no persistence)
```

Rules:

- Homepage must not import PDF.js, PyMuPDF, LibreOffice, OCR, or other WASM engines before user intent.
- Inspect and Flow lazy-load their modules after a file is present or the user opens that pane.
- Workers and object URLs are revoked on cancel, replace, and leave.
- No PDF bytes, object URLs, or passwords in `localStorage` / IndexedDB.
- Recipes serialize operations and non-secret params only.
- Wording is hedged: “appears blank”, “probable duplicate”, “little extractable text”.
- Never auto-modify a document.

## Acceptance criteria

- [ ] Choosing a PDF on the homepage opens the workspace (preview + Inspect + Flow + export), not a legacy tool page.
- [ ] Inspect reports size, pages, dimensions, mixed size, orientation, rotation, blank, probable duplicates, text vs scan, image-heavy, metadata, dates, author/title, encryption, attachments, forms, annotations, JS/active content, signatures, a11y indicators, large resources, and privacy findings — with hedged copy.
- [ ] Accepting a finding adds a Flow step with an explanation; the PDF is unchanged until Execute.
- [ ] Flow supports reorder, duplicate, remove, enable/disable, param edit, undo/redo, incompatible-op warnings, cancel, fail-at-step with original preserved.
- [ ] Recipes show steps before run and export JSON without files/passwords/redaction text/personal metadata.
- [ ] After Execute, Proof shows before/after metrics, SHA-256, warnings, and a downloadable receipt that is explicitly not a certificate.
- [ ] Covering text with a black rectangle is reported as extractable; PyMuPDF redaction is distinguished.
- [ ] Batch: one file failing does not discard successful outputs.
- [ ] Command palette finds tools, operations, recipes, findings, execute, and Proof; nav remains visible.
- [ ] Unit tests cover inspect heuristics, flow validation/undo, recipe privacy, proof hashes, redaction vs cover, no network leak of document markers, no homepage engine import.
- [ ] Playwright covers drop → inspect → accept recommendation → add step → preview → execute → proof → download output + receipt, using synthetic fixtures only.

## Non-goals

- React/Next rewrite
- Rete canvas as the default Flow UI (kept as advanced Workflow Builder)
- Remote inference, accounts, Polar licenses, analytics
- Claiming PDF/A ISO compliance or legal-hold certification
- Calling this release v1.0.0 or production-ready
