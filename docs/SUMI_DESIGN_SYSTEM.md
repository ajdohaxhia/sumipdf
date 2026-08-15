# Sumi PDF design system

Voice: **editorial workbench** — exact, calm, paper and ink. Not a Japanese theme, not a SaaS dashboard.

## Type

- **UI / body:** IBM Plex Sans (self-hosted `@fontsource/ibm-plex-sans`). Tabular numerals on counts, sizes, progress.
- **Display headings only:** Source Serif 4 (self-hosted `@fontsource/source-serif-4`).
- Scale: 12 / 14 / 16 / 20 / 28 / 40. Line length for prose ~65ch.
- Signature fonts (Dancing Script, Great Vibes, Kalam, Cedarville) remain for visual signatures only.

## Color roles

Tokens in `src/css/styles.css` (`--sumi-*`), mapped into Tailwind `@theme`.

| Role          | Light                                     | Dark      |
| ------------- | ----------------------------------------- | --------- |
| Paper (page)  | `#F5F1E8`                                 | `#0D0D0C` |
| Surface       | `#EFEAE1`                                 | `#171715` |
| Ink (text)    | `#11110F`                                 | `#F2EDE4` |
| Ash (muted)   | `#6E6A63`                                 | `#A39E95` |
| Rule (border) | `#D9D2C7`                                 | `#2A2926` |
| Signal        | `#E24A30` (contrast-tuned from `#F05A3C`) | `#F06A4C` |
| Success       | `#237A57`                                 | `#3D9A71` |
| Danger        | `#A32D2D`                                 | `#E07070` |

Accent is rare: primary actions, focus, privacy badge. Do not paint every card vermilion.

## Space / radius / shadow

- 4/8px rhythm. Section padding 24–48px.
- Radius: 2px for inputs, 4px for cards, 0 for the mark. No pill nav.
- Shadows: one elevation (`0 1px 0` rule + optional `0 8px 24px` for dialogs). No glow.

## Motion

- Enter/exit: 160ms ease.
- Drag reorder: short spring only.
- Honor `prefers-reduced-motion`.
- No custom cursor, parallax, or intro loader.

## Hierarchy

One focal action per view: drop files or run the tool. Marketing never precedes the work.

## Rejected

Giant gradient headlines, purple blobs, glassmorphism, fake 3D document piles, fake testimonials, emoji icon systems, Inter-on-white template layouts.
