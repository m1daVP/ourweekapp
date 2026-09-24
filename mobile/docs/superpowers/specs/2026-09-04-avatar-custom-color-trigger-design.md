# Avatar Custom-Color Trigger Design

## Goal

Restore the compact multicolor circular trigger for choosing a custom
participant avatar color after the color selector was moved into the Avatar
bottom sheet.

## Scope

- Replace the text-only custom-color button in `AvatarPickerSheet.vue` with a
  circular rainbow-gradient button beside the preset color swatches.
- Preserve the existing inline custom-color panel, colour-wheel initialization,
  hex input, draft state, and confirmation flow.
- Keep the control as a semantic button with a localized accessible label,
  pressed state, keyboard focus styling, and the existing 64px mobile touch
  target.

## Interaction and Visual Design

The final swatch in the Colors row is a 64px circle. Its inner visual is a
smaller conic-gradient circle, so it remains distinct from a chosen solid
color. Tapping it toggles the current inline custom-color panel. The selected
state continues to be conveyed by the existing primary-color border; it does
not change the wheel or the draft color itself.

## Data and Error Handling

No data model, i18n message, persistence, or error-handling changes are
needed. Dismissing the inline panel retains the current draft behavior.

## Verification

- Confirm the custom trigger is a circular rainbow control in the swatch row.
- Confirm it opens and closes the existing inline color panel.
- Confirm a wheel or hex-input update saves the selected custom color.
- Confirm the trigger remains usable with keyboard focus and screen-reader
  labeling.
- Run `npm run build` and `npm run check` after implementation.
