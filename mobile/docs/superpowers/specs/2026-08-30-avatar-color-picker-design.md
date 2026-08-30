# Avatar color picker design

## Goal

Replace the native HTML color input used for participant avatar colors with one
rich, touch-friendly picker that renders consistently in Android and iOS
Capacitor WebViews.

## Scope

The change applies only to the custom participant avatar color control in
`HouseholdMembersSettings.vue`. The existing preset avatar-color swatches stay
available for quick selection.

## Approach

Add `@jaames/iro` and wrap it in a feature component named
`AvatarColorPickerSheet.vue`. The wrapper uses the existing `BaseBottomSheet`
component and exposes a Vue `v-model` interface for opaque hex colors.

The picker will contain:

- an iro.js color wheel for hue and saturation;
- a brightness/value slider;
- a live avatar-color preview;
- an editable hex input;
- Cancel and Select actions.

The picker has no alpha/transparency controls because participant avatar colors
are stored and displayed as opaque hex values.

## Interaction and data flow

1. The participant form retains the selected preset or custom color in
   `participantDraft.avatarColor`.
2. Tapping the custom-color trigger opens the picker with that color as its
   initial temporary value.
3. Color wheel, slider, and hex-field changes update only the temporary value
   and preview.
4. Tapping Select emits a normalized lowercase `#rrggbb` value, which updates
   `participantDraft.avatarColor`.
5. Tapping Cancel, the sheet backdrop, or Android back closes the picker
   without changing the participant draft.
6. The existing person-form Save action remains the only action that persists
   the participant.

## Accessibility and mobile behavior

- The sheet receives a clear translated title and uses the existing sheet
  focus/backdrop/back-button behavior.
- Buttons keep the project minimum tap target.
- The color preview is paired with a visible hex value; color is not the only
  means of communicating the selection.
- The hex input is validated and normalized before Select is enabled; an
  invalid value leaves the previous temporary color intact and presents a
  nearby friendly error.

## Error handling

If the color-picker library cannot initialize, the sheet shows a concise error
and a Close action. The current selected participant color is preserved. No
native color input is retained as a fallback because the purpose is to avoid
platform-specific picker UI.

## Tests and verification

- Unit-test hex normalization and validation.
- Unit-test that Select emits the staged normalized value and Cancel emits no
  change.
- Run `npm run build` and `npm run check`.
- Manually verify the flow on Android and iOS: opening, dragging, entering hex,
  Cancel, Select, sheet backdrop, Android back, and saving the person.
