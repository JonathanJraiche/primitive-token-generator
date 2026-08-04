# Primitive Token Generator

A local-first Figma plugin that turns one primary color into a stable Variables library of primitive design tokens.

## Run it in Figma

1. Install and build:

   ```bash
   npm install
   npm run build
   ```

2. In Figma Desktop, open **Plugins → Development → Import plugin from manifest…**
3. Choose `manifest.json` in this folder.
4. Run **Primitive Token Generator** from the Development plugins menu.

Before publishing, verify that the numeric ID in `manifest.json` matches the development plugin ID assigned by Figma.

## What is implemented

- Six curated presets and a free-form seed input feeding one deterministic generator
- OKLCH ramps with hue-preserving sRGB gamut mapping via Culori
- Stable names and diff-by-name writes that update existing variable IDs in place
- Harmony, tinted/pure neutral, and fixed green/amber/red/blue ramps
- Spacing, type (px and rem), and radius modular scales
- Coordinated Dense, Compact, Balanced, Spacious, and Editorial scale presets
- Defined WCAG contrast matrix with enforced AA pairings
- Chunked writes with progress
- Removal preview that scans bound layers and requires explicit confirmation
- Recipe persistence in `clientStorage`, collection plugin data, and a hidden metadata variable
- Recipe import/export and DTCG 2025.10 token export
- One-click canvas style guide covering every generated primitive
- Live Variable bindings for compatible color, spacing, radius, and typography samples
- Single Variables mode and primitive-only output

## Commands

```bash
npm test       # deterministic generator, presets, contrast, DTCG, and diff tests
npm run typecheck
npm run build  # dist/code.js + single-file dist/ui.html
npm run verify # complete release check
```

## Architecture

- `src/ui/generator.ts` — pure generation, gamut mapping, contrast, DTCG conversion
- `src/ui/main.tsx` — iframe UI, preview, import/export, and message orchestration
- `src/code.ts` — Figma Variables API access, diff/upsert, removal scan, persistence
- `src/style-guide.ts` — canvas layout, font loading, primitive samples, and Variable binding
- `src/shared/` — serializable contracts, defaults, and pure diff logic

The generator never reads the Figma document. The main thread never derives token values; it receives a finished `TokenSet` and writes only the required changes.

## Manual binding acceptance check

This final check requires a live Figma file:

1. Create the library and bind a rectangle fill to `color/primary/500`.
2. Change the seed and regenerate.
3. Confirm the rectangle repaints and the variable ID shown in the plugin console is unchanged.
4. Reduce ramp steps, confirm the removal dialog reports bound consumers, then choose **Keep and regenerate** and verify updates are applied without removing the older variables.

## Publishing

Run `npm run verify`, then follow the listing copy, security notes, asset requirements, and manual QA checklist in [`PUBLISHING.md`](PUBLISHING.md).
