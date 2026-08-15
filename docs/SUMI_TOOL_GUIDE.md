# Adding a Sumi PDF tool

Keep processing in the browser. Do not add upload APIs.

## 1. Register the tool

Add the tool to `src/js/config/tools.ts` (legacy lists still feed tests and some shortcuts). The canonical catalog is derived in `src/js/config/tool-registry.ts`.

Set, as applicable:

- stable `id` and `href`
- category override, engine, related tools
- featured flag only for the four home actions

## 2. Page and logic

- HTML in `src/pages/<id>.html`
- Logic in `src/js/logic/<id>-page.ts`
- Add the rollup input in `vite.config.ts`
- Prefer `#file-input` so local workspace handoff works
- Copy should say “Choose files”, not “Upload”

## 3. Shell

`src/js/main.ts` loads on tool pages. Handoff, theme, command palette, and the workspace tray come from the shared shell. Do not load PDF engines from the homepage entry.

## 4. i18n

Add keys to `public/locales/en/tools.json` and `public/locales/it/tools.json`. Other locales fall back.

## 5. Tests

Add a focused Vitest file under `src/tests/` using synthetic PDFs only.
