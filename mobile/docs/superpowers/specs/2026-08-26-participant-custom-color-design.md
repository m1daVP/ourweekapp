# Participant Custom Color Selection Design

## Goal

Let people choose any avatar color while adding or editing a household participant, without changing the existing preset palette.

## Scope

- Keep the six existing preset color swatches in their current order.
- Add a seventh, multicolor swatch at the end of the color selector.
- Selecting the multicolor swatch opens the platform-native color picker through a native HTML color input.
- Show the chosen hex value next to the picker for clear confirmation.
- Use the selected value as the participant draft's `avatarColor`, so the existing create and update flows persist it unchanged.
- When editing a participant with a custom color, show that color as the active custom selection.

## Interaction Design

The preset swatches remain radio-style choices. The final multicolor swatch is a button that opens a visually hidden native color input. Its visual is a compact conic-gradient circle, distinct from a saved solid-color swatch. When the native picker returns a color, the draft updates immediately and the displayed hex value reflects the normalized value. Saving, cancelling, and reopening the drawer retain their existing behavior.

## Accessibility and Mobile Behavior

- The custom-color control is a real button with an accessible label.
- The native color input is triggered by the visible control and is excluded from the keyboard sequence to avoid presenting the same action twice.
- The hit target matches the existing swatches and works in Android WebView without a new dependency.
- The current color value is readable as text rather than conveyed by color alone.

## Data and Error Handling

No storage migration is required: `avatarColor` already stores strings, and the participant store already persists the field for both newly created and edited participants. Native color input emits browser-normalized `#RRGGBB` values. If the picker is dismissed, the draft remains unchanged.

## Verification

- Verify preset colors still select and save.
- Verify the custom control opens the native picker and changes the draft color and hex display.
- Verify a custom color persists after saving both a new and an existing participant.
- Run `npm run build` and `npm run check`.
