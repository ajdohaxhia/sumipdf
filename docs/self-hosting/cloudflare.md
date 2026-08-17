# Deploy Sumi PDF to Cloudflare

Sumi PDF is a **static multi-page app** (MPA). Prefer **Cloudflare Pages** for the site.
Use a **Worker** only for the optional digital-signature certificate CORS proxy.

Do **not** add an SPA fallback (`/* → /index.html`). Each tool is a real HTML file.

## Recommendation

| Piece                      | Product               | Why                                           |
| -------------------------- | --------------------- | --------------------------------------------- |
| App (`dist/`)              | **Cloudflare Pages**  | Static HTML/JS/WASM CDN hosting               |
| Cert CORS proxy (optional) | **Cloudflare Worker** | Only needed for digital signature chain fetch |
| Document processing        | Browser only          | PDFs never upload to Cloudflare               |

## Prerequisites

- Node.js **≥ 20.19** (see `package.json` `engines`)
- A Cloudflare account
- Your production URL (custom domain or `*.pages.dev`)

---

## Option A — Git-connected Pages (recommended)

### 1. Push the branch

```bash
git push -u origin feat/sumi-pdf-1.0
```

Or merge to `main` if that is your production branch.

### 2. Create the Pages project

1. Open [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Pages** → **Connect to Git**
3. Select the `sumipdf` repository
4. Configure:

| Setting                | Value                         |
| ---------------------- | ----------------------------- |
| Framework preset       | **None** (or Vite)            |
| Build command          | `npm run build`               |
| Build output directory | `dist`                        |
| Root directory         | `/`                           |
| Production branch      | `main` or `feat/sumi-pdf-1.0` |

### 3. Environment variables (Pages → Settings → Environment variables)

Set for **Production** (and Preview if you want correct preview canonicals):

| Variable                 | Required    | Example / notes                            |
| ------------------------ | ----------- | ------------------------------------------ |
| `NODE_VERSION`           | Yes         | `20.19.0`                                  |
| `SITE_URL`               | Yes for SEO | `https://sumi.yourdomain.com`              |
| `VITE_SITE_URL`          | Yes for SEO | Same as `SITE_URL`                         |
| `VITE_REPO_URL`          | Optional    | `https://github.com/ajdohaxhia/sumipdf`    |
| `VITE_BRAND_NAME`        | Optional    | `Sumi PDF`                                 |
| `ENABLE_GITHUB_STARS`    | Optional    | leave empty / unset (privacy default)      |
| `VITE_CORS_PROXY_URL`    | Optional    | Worker URL after you deploy the CORS proxy |
| `VITE_CORS_PROXY_SECRET` | Optional    | Only if you enable HMAC on the worker      |

`CF_PAGES`, `CF_PAGES_URL`, and `CF_PAGES_COMMIT_SHA` are injected automatically by Pages.

### LibreOffice assets are sharded automatically

`npm run build` splits the two compressed LibreOffice engine files into
content-addressed chunks below Cloudflare Pages' per-file limit. It writes and
verifies `libreoffice-wasm/assets-manifest.json`, removes only the oversized
copies in `dist`, and performs a final recursive size check. The source assets
in `public/` are never modified.

The browser loads the same-origin manifest and chunks lazily when a
LibreOffice-backed converter is first used, verifies every SHA-256 hash,
reconstructs the compressed engine locally, and then performs conversion in the
browser. No R2 bucket or external asset CDN is required, and document bytes are
never uploaded.

### 4. Deploy

Save → Cloudflare builds and publishes to `https://<project>.pages.dev`.

### 5. Custom domain

Pages project → **Custom domains** → add your domain. If the DNS zone is on Cloudflare, records are configured for you.

---

## Option B — Direct upload with Wrangler (CLI)

Useful for one-off deploys from your machine without Git integration.

```bash
# 1. Install deps
npm ci

# 2. Build with your public URL
export SITE_URL="https://sumi.yourdomain.com"
export VITE_SITE_URL="$SITE_URL"
npm run build

# 3. Log in (opens browser)
npx wrangler login

# 4. Deploy the dist folder
npx wrangler pages deploy dist --project-name=sumi-pdf
```

Or use the npm script:

```bash
SITE_URL=https://sumi.yourdomain.com VITE_SITE_URL=https://sumi.yourdomain.com npm run deploy:pages
```

Root `wrangler.toml` sets `pages_build_output_dir = "dist"` and project name `sumi-pdf`.

---

## Required headers (already in the repo)

`public/_headers` ships with:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp` (needed for `SharedArrayBuffer` / LibreOffice WASM)
- WASM MIME + long cache for `/assets` and `*.wasm`
- `Permissions-Policy: camera=(self)` so **Capture** can request the camera after a user gesture

There is **no** `public/_redirects` SPA rule on purpose.

---

## Optional — Certificate CORS Worker

Digital signature certificate fetching may need a tiny proxy. Documents never go through it.

```bash
cd cloudflare
npx wrangler login

# Prefer your own KV namespace (do not reuse another project's ID):
# npx wrangler kv namespace create "RATE_LIMIT_KV"
# then put the id into cloudflare/wrangler.toml

# Set allowed browser origins (comma-separated), e.g.:
# npx wrangler secret put ALLOWED_ORIGINS
# value: https://sumi.yourdomain.com,https://sumi-pdf.pages.dev

npx wrangler deploy
```

Then rebuild Pages with:

```bash
VITE_CORS_PROXY_URL=https://sumi-pdf-cors-proxy.<account>.workers.dev npm run build
```

HMAC (`PROXY_SECRET`) is optional and limited because any secret embedded in frontend JS is visible.

---

## What not to do

- Do **not** deploy the Vite app as a generic Workers “hello world” script — use **Pages** for `dist/`.
- Do **not** add `/* /index.html 200` redirects — tool URLs like `/sentinel.html` must resolve to real files.
- Do **not** set `SITE_URL` to empty in production if you care about sitemap/canonicals.
- Do **not** enable analytics SDKs; Sumi stays local-first.

## Verify after deploy

1. Open `https://<project>.pages.dev/` — homepage loads without downloading PyMuPDF/OCR/qpdf.
2. Open `/sentinel.html` — drop zone mounts.
3. DevTools → Network: PDF bytes stay in the browser (no upload of document bodies).
4. DevTools → Application → check COOP/COEP on document response headers.
5. Capture: camera prompt only after an explicit click (and only if the browser supports it).

## Troubleshooting

| Symptom                               | Likely cause                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Build OOM                             | Pages build memory; keep `NODE_OPTIONS` in `npm run build`, or use Wrangler direct upload from a larger machine |
| LibreOffice / SharedArrayBuffer fails | Missing COOP/COEP (`public/_headers` not published)                                                             |
| Broken tool links                     | Accidental SPA `_redirects`                                                                                     |
| Huge upload / file limit              | Run the full `npm run build`; it shards and validates LibreOffice assets automatically                          |
| Camera blocked                        | Old `Permissions-Policy: camera=()` — fixed to `camera=(self)` in `_headers`                                    |
| Wrong canonical URLs                  | Set both `SITE_URL` and `VITE_SITE_URL`                                                                         |
