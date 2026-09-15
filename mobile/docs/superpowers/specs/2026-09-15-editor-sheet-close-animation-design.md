# Editor sheet close animation

## Goal

Make task, note, and agreement edit sheets animate down on close like their add-item counterparts.

## Design

Close handlers will only set the editor open state to false. Each edit composer keeps its scope until `MeetingItemComposer` emits `after-close`, after the bottom-sheet transition completes, then clears that scope and unmounts.

## Verification

Add a lifecycle assertion that an editor scope is retained through close and clear only on after-close. Run focused tests and the production build.
