# Sumi PDF privacy model

## Promise

Core document processing runs in the browser. Sumi PDF does not add document upload APIs, accounts, or remote conversion endpoints.

## What stays on the device

- PDF and image bytes
- Filenames, page text, metadata, thumbnails, hashes, signatures
- Session workspace Blobs (memory only; not written to `localStorage`)
- Drawn / typed visual signatures unless the user explicitly opts into local save
- Private keys for digital signatures (never leave the browser; released after use)
- Passwords (never persisted, logged, put in URLs, or exported in workflow JSON)

## What may leave the browser

Document bytes must not. The following **application/runtime** requests are allowed when a feature needs them:

| Request                                                                  | Why                               | Document bytes?                                                |
| ------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| Same-origin JS/CSS/WASM/workers/fonts                                    | App assets                        | No                                                             |
| jsDelivr WASM (PyMuPDF, Ghostscript, CoherentPDF) if CDN mode            | Engine code                       | No                                                             |
| Tesseract worker/core/lang and OCR font CDN if not self-hosted           | OCR assets                        | No                                                             |
| RFC 3161 TSA (timestamp tool only)                                       | Timestamp token                   | Hash/token per TSA protocol, not the PDF filename in analytics |
| Optional CORS proxy for **certificate chain fetch** on digital signature | Public certs                      | Must never receive the PDF                                     |
| GitHub API star count (optional, disable with `DISABLE_GITHUB_STARS`)    | Social proof of **upstream** repo | No                                                             |

Default analytics: **none**. Do not send filenames or processing parameters anywhere.

## Local storage (safe)

- Language, theme, collapsed categories, keyboard shortcuts
- Recent tool IDs (not filenames)
- Workflow definitions (no embedded documents)
- Optional WASM provider URL overrides (validated)
- Opt-in visual signature appearance

## Clearing state

Settings → Clear local workspace (session Blobs + object URLs). Settings → Clear local preferences. Settings → Clear offline assets (service worker caches). Closing the tab drops the session workspace.

## Limits (honest)

“No artificial limits” means Sumi does not impose accounts, quotas, or watermarks. Device RAM, CPU, and browser limits still apply. Extreme page counts, decompression bombs, and huge rasters should warn before crashing the tab.

## Redaction and sanitize

- Drawing a black rectangle is **not** redaction. Real redaction uses the PyMuPDF redaction APIs and is verified by text extraction when possible.
- Privacy Clean reports what was removed, what was checked, and what could not be verified. There is no “100% safe” badge.

## Threat notes

PDFs are untrusted binaries. Do not execute JavaScript from PDFs. Sanitize HTML/SVG/Markdown previews with DOMPurify. Preserve COOP/COEP/CSP.
