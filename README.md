<p align="center"><img src="public/images/logo-mark.svg" width="64" alt="Sumi PDF"></p>
<h1 align="center">Sumi PDF</h1>
<p align="center"><strong>Powerful PDF tools. Your files stay on your device.</strong></p>
<p align="center">No account. No artificial limits. No document uploads.</p>

**Sumi PDF** is a privacy-first, client-side PDF workspace. It is a modified open-source distribution of [BentoPDF](https://github.com/alam00000/bentopdf), licensed under **AGPL-3.0**.

This is not a claim that original BentoPDF code was written by the Sumi maintainer. See [NOTICE.md](NOTICE.md) and [CREDITS.md](CREDITS.md).

Source: https://github.com/ajdohaxhia/sumipdf  
Upstream: https://github.com/alam00000/bentopdf

---

## Privacy architecture

Documents are processed in the browser. There is no application upload API. Optional CDN requests fetch **engine code** (WASM), not your files. Details: [docs/SUMI_PRIVACY_MODEL.md](docs/SUMI_PRIVACY_MODEL.md).

## Feature categories

Organize, Edit, Convert to PDF, Convert from PDF, Scan & OCR, Compress & optimize, Protect & sanitize, Sign & validate, Print & prepare, Automate (Workflow Builder).

## Local development

```bash
npm ci
npm run dev
```

## Production build

```bash
npm run build
```

Set `SITE_URL` / `VITE_SITE_URL` to the public origin before a production deploy.

## Cloudflare Pages

- Build command: `npm run build`
- Output: `dist`
- Headers: `public/_headers` (COOP/COEP for SharedArrayBuffer)
- Do **not** add a catch-all SPA redirect; each tool is a static HTML page
- See `docs/self-hosting/cloudflare.md` (upstream) plus Sumi env vars in `.env.example`

## Docker / self-hosting

Upstream Docker and SIMPLE_MODE flows still apply. Brand defaults to Sumi PDF via `VITE_BRAND_NAME`.

## Offline / PWA

Installable manifest. The service worker caches application assets, not user documents.

## WASM / CDN

PyMuPDF, Ghostscript, and CoherentPDF default to jsDelivr unless you override `VITE_WASM_*`. Self-host for air-gapped use.

## Browser support

Chrome/Edge 90+, Firefox 90+, Safari 15+. LibreOffice WASM needs COOP/COEP and HTTPS off localhost.

## Limitations

No artificial quotas. Device RAM still applies. Visual signatures are not cryptographic signatures. PDF/A conversion is best-effort, not an ISO compliance claim. Drawing a black box is not redaction — use Redact PDF.

## License and attribution

AGPL-3.0. Copyright for original BentoPDF remains with its authors. Sumi-specific work © Adelajdo Haxhiaj.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please do not attach confidential PDFs to issues.

## Security reporting

See [SECURITY.md](SECURITY.md).

## Upstream sync

```bash
git fetch upstream
git merge upstream/main
```

Keep Sumi brand, privacy, and shell changes; do not silently drop BentoPDF tools.
