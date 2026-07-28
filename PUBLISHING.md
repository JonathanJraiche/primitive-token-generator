# Publishing Primitives

Use this document as the submission packet and final release checklist for the Figma Community.

## Publishing identity

Publishing account details and the public support contact are intentionally not stored in this repository. Enter them directly in Figma Desktop during submission.

## Community listing copy

**Name**

Primitive Token Generator

**Tagline**

Generate a complete primitive Variables library from one color.

**Category**

Design tools

**Description**

Primitive Token Generator turns one seed color into a stable, accessible Figma Variables library for a new product or design system.

Choose a curated color and scale preset or tune the recipe yourself. The plugin creates deterministic OKLCH color ramps, neutrals, feedback colors, spacing, typography, and radius primitives. Regenerate safely as the system evolves: existing variables update in place, preserving their IDs and bindings.

Preview defined WCAG contrast pairings, export the portable recipe or DTCG tokens, and place a complete primitive style guide on the canvas. Everything runs locally in Figma with no account, analytics, or network access.

**Feature summary**

- Deterministic OKLCH color ramps from one seed
- Coordinated spacing and typography presets
- Font family, size, weight, line-height, letter-spacing, and radius primitives
- Defined WCAG AA contrast guarantees
- Stable variable IDs across regeneration
- Removal warnings for variables used by canvas layers
- Recipe and DTCG token export
- One-click canvas style guide with live Variable bindings
- Local-first operation with no network access

**Suggested search terms**

Design tokens, variables, design system, color palette, OKLCH, accessibility, spacing, typography

## Data security disclosure notes

- The manifest declares no network access.
- The plugin does not require an external account.
- The plugin does not contain analytics, advertising, payments, or crash reporting.
- Token recipes are stored in Figma client storage, collection plugin data, and a hidden local metadata variable so they can be regenerated.
- The plugin reads local Variables and scans document layers only when it needs to warn about removing variables that may still be bound.
- The plugin creates or updates local Variables and creates a style-guide frame only after an explicit user action.
- No document content or personal data is transmitted outside Figma.

These notes describe the current implementation; answer Figma's disclosure form according to its exact wording.

## Listing assets

Figma currently recommends:

- Plugin icon: 128 × 128px
- Thumbnail image or video: 1920 × 1080px
- Optional playground file
- Up to nine optional carousel images or videos

Recommended carousel story:

1. Seed color and palette preview
2. Spacing and typography preset controls
3. WCAG contrast view
4. Generated Variables collection
5. Placed canvas style guide
6. Safe regeneration and removal warning

Avoid showing development menus, temporary copy, debug output, or unfinished canvas content.

## Automated release check

Run:

```bash
npm ci
npm run verify
```

This verifies TypeScript, tests, the production build, manifest requirements, generated entry points, single-file UI output, and the no-network declaration.

## Manual QA

- [ ] Verify `manifest.json` uses the Figma-assigned development plugin ID.
- [ ] Test in a new blank Figma Design file.
- [ ] Generate the default library and confirm all Variables are created.
- [ ] Bind `color/brand/500` to a canvas layer, change the seed, and confirm the layer updates without changing the variable ID.
- [ ] Reduce a scale count and choose **Keep and regenerate**; confirm other changes apply and older variables remain.
- [ ] Repeat the removal flow with **Remove and regenerate**; confirm the summary and canvas-binding warning are accurate.
- [ ] Export and re-import a recipe.
- [ ] Export DTCG tokens and confirm the JSON opens successfully.
- [ ] Place a style guide and confirm its frame contains all children.
- [ ] Confirm style-guide samples use upright font styles and handle unavailable configured fonts gracefully.
- [ ] Test light and dark Figma themes.
- [ ] Test the minimum and maximum plugin window sizes.
- [ ] Test a file with multiple pages and a variable bound outside the current page.
- [ ] Test offline; all core behavior should remain available.
- [ ] Confirm all errors use user-facing language and no console or developer messages appear in the UI.

## Account and submission details

Complete these before opening Figma's publish dialog:

- [ ] Confirm Figma Desktop is signed in to the intended publishing account.
- [ ] Enable two-factor authentication on the publishing account.
- [ ] Decide whether the plugin is free or paid.
- [ ] Decide whether to publish as yourself, a team, or an organization.
- [ ] Enter the intended public support URL directly in Figma's publishing form.
- [ ] Confirm the applicable Community license and legal terms.
- [ ] Decide whether Community comments should be enabled.
- [ ] Prepare the icon, thumbnail, and any carousel media.

In Figma Desktop, open **Plugins → Manage plugins**, open the plugin menu, choose **Publish**, paste the listing copy, upload the assets, complete the security disclosure, and submit for review.
