# Contributing to Sumi PDF

Sumi PDF is a modified open-source distribution of [BentoPDF](https://github.com/alam00000/bentopdf), licensed under **AGPL-3.0**. Thank you for helping improve it.

This fork does **not** use BentoPDF’s commercial dual-license CLA. Contributions to Sumi PDF are accepted under AGPL-3.0. If you want a change in upstream BentoPDF, open it there and follow their contributor agreement.

## How to contribute

1. Fork https://github.com/ajdohaxhia/sumipdf
2. Create a focused branch
3. Keep PDF processing client-side. Do not add document upload APIs
4. Prefer the canonical tool registry (`src/js/config/tool-registry.ts`) and shared shell
5. Add or update tests next to the change
6. Open a pull request describing the user-visible outcome

## Local setup

```bash
npm ci
npm run dev
npm run test:run
npm run lint
```

## Bug reports

Use the bug template. Include browser, tool, and steps. **Do not attach confidential PDFs.** Recreate the issue with a synthetic file when you can.

## Security

See [SECURITY.md](SECURITY.md). Do not file public issues for exploitable document-processing bugs if they could harm other users.

## Code of conduct

Be precise, kind, and specific. Review comments should address the change, not the person.

## Attribution

Preserve copyright and license headers. Do not rewrite git history to hide the BentoPDF origin. Do not imply that original BentoPDF code was authored by the Sumi maintainer.
