# Settings Trailing Icons Design

## Goal

Align the icons in the Settings page's Support & Legal rows to the right edge,
matching the intended mobile settings-row layout shown in the provided visual
reference.

## Design

Add an explicit `settings-redesign-row--trailing-icon` modifier to the four
Support & Legal rows: Contact us, Support diagnostics, Privacy Policy, and
Terms. The modifier changes the row grid to two columns:

```css
grid-template-columns: minmax(0, 1fr) auto;
```

This lets the text body expand into the first column and places the icon in the
second, right-aligned column. Existing preference rows with a leading icon keep
their current three-column grid and are unaffected.

## Scope and fallback

No new behavior, navigation, or dependencies are introduced. The Contact us
row remains conditionally rendered based on `VITE_CONTACT_EMAIL`; this change
only adjusts the placement of existing trailing icons. The layout continues to
use the existing row styles on narrow mobile screens.

## Verification

- Confirm all four Support & Legal rows use the modifier.
- Confirm preference rows retain their leading-icon layout.
- Run `npm run build`.
- Run targeted lint and formatting checks for changed files.
- Run the full test suite.
