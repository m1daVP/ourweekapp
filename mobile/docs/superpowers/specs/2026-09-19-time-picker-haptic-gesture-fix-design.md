# Time Picker Haptic Gesture Fix Design

## Goal

Make time-picker haptic feedback work for both wheel drags and changed hour/minute option taps on native devices.

## Problem

Every hour and minute option is a button. The current wheel interaction handler rejects pointer-down events whose target is inside a button, so normal finger drags starting on a visible option never begin the native selection session. The later scroll handler therefore sees no active wheel and produces no haptic feedback.

## Behavior

- A pointer-down anywhere in an hour or minute wheel begins that wheel's native selection session, including pointer-down events on option buttons.
- Dragging the wheel produces one selection haptic whenever the snapped hour or minute value changes.
- Tapping a different hour or minute option produces one selection haptic after the value changes.
- The delayed selection-session end remains in place so momentum scrolling continues to receive feedback.
- Opening the picker, initial programmatic scroll positioning, and tapping the already-selected option remain silent.

## Architecture

Keep gesture state within `TimePickerField.vue` and continue using the existing semantic shared service methods: `haptics.wheelStart()`, `haptics.wheelChange()`, and `haptics.wheelEnd()`.

Remove the option-button target guard from `startWheelInteraction`. In `selectHour` and `selectMinute`, compare the requested value with the current selection before mutating. If it differs, update the selected value, call `haptics.wheelChange()`, and retain the existing scheduled wheel end. Because the scroll handler then receives the already-updated value, it cannot emit a duplicate tick for the same tap.

## Testing and verification

Update the focused time-picker tests to:

- dispatch a pointer-down from an option button, then scroll to a different value and verify one selection tick;
- tap a different hour and minute option and verify one selection tick per changed value;
- verify selecting the active option does not add a tick;
- preserve the existing no-feedback-on-open behavior.

Run the focused time-picker test, then `npm run build` and `npm run check`.

## Out of scope

- Changing the shared haptics service or native Capacitor setup.
- New haptic settings, dependencies, user-facing copy, or other time-picker behavior.
