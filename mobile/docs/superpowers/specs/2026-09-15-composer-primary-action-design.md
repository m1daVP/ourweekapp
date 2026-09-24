# Composer primary action layout

## Goal

Keep cancellation in the top-right sheet header and give the submit action the full bottom action row for task, note, and agreement composer sheets.

## Design

Remove the bottom Cancel button from `MeetingItemComposer`. The existing `BaseBottomSheet` header close button remains the cancellation control. The composer action layout uses its remaining submit button at full width.

## Verification

Update the composer test to assert that no bottom Cancel button is rendered and that the submit action remains present. Run the focused test suite and production build.
