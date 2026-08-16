# Sumi PDF — design QA

Date: 2026-08-16

Branch: `fix/product-foundation-redesign`
Visual direction: Document Atelier

## Reference and implementation

- Selected reference:
  `/workspace/scratch/1a1afc4a8c42/generated_images/exec-ee6b7282-2ea2-4e89-9fa3-6b6dac51cbbe.png`
- Implemented surface: `index.html` + `src/css/sumi-atelier.css`
- Production artwork: `public/images/sumi-document-atelier-report-v2.png`
- Image generation mode: precise object edit with the built-in image generator
- Asset prompt: replace the checkerboard background with a uniform warm ivory
  `#F5F1E8`, preserving the complete paper stack, mountain photograph,
  typography, paperclip, shadows, proportions, and transparent-looking edge
  integration.

## Visual comparison

The reference and production homepage were captured at the same
1,487 × 1,058 viewport and inspected side by side in one comparison image. The
implementation matches the selected direction in hierarchy, serif scale,
paper/ink palette, editorial spacing, centered document stack, phase rail, and
restrained vermilion accent. It intentionally uses the real Sumi file input and
privacy copy rather than the reference's illustrative control.

Additional local checks:

- 390 × 844: no horizontal overflow; the functional drop zone appears before
  the decorative document artwork.
- Batch Form Studio at 1,487 × 1,058: task title, constraints, input queue, and
  primary action remain legible and visually consistent with the home surface.
- Command palette: Ctrl/Cmd+K, arrows, Enter, Escape, and focus return verified.
- Core actions: 18 Chromium Playwright journeys passed against the production
  build, including real ZIP/PDF downloads.

## Remaining qualification

- Cloud-browser handoff could not be completed in this Work Mode environment:
  the preview URL was rejected with `ERR_BLOCKED_BY_CLIENT`. Local Playwright
  screenshots and journeys were used with the user's explicit approval.
- Firefox, WebKit, screen-reader, Lighthouse, and Web Vitals checks remain open.
- No real public origin was supplied, so canonical URLs and Cloudflare edge
  headers were not tested in production.

Final result: **blocked** for the required cloud-browser handoff; local visual
and interaction QA passed.
