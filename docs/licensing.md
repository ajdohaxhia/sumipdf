# Licensing

Sumi PDF is licensed under **AGPL-3.0-only**. This fork does not sell a commercial or proprietary license and does not relicense AGPL code as proprietary.

::: tip Full Details
See [licensing.html](/licensing.html), [NOTICE.md](https://github.com/ajdohaxhia/sumipdf/blob/main/NOTICE.md), and the [upstream BentoPDF repository](https://github.com/alam00000/bentopdf).
:::

## What that means

| Use case                               | Requirement                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Open-source project with public source | AGPL-3.0                                                                                                                                       |
| Network-accessible modified copy       | AGPL-3.0, including source for your modifications                                                                                              |
| Proprietary / closed-source product    | Not offered by Sumi. Contact [upstream BentoPDF](https://github.com/alam00000/bentopdf) if you need a proprietary license for _their_ software |

## Upstream commercial option

The original BentoPDF project may offer a separate proprietary license for _their_ software. Sumi PDF does not collect payment for that license.

## Third-party AGPL components

Some processing libraries may load at runtime from CDN URLs configured at build time:

| Component       | License  | Typical default |
| --------------- | -------- | --------------- |
| **PyMuPDF**     | AGPL-3.0 | jsDelivr        |
| **Ghostscript** | AGPL-3.0 | jsDelivr        |
| **CoherentPDF** | AGPL-3.0 | jsDelivr        |

Using those components does not remove AGPL obligations for Sumi itself. Override URLs for air-gapped deployments via environment variables or Advanced Settings.

See [Self-Hosting > WASM Configuration](/self-hosting/#wasm-configuration-agpl-components) for details.
