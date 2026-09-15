# Review item editor consistency

## Goal

Use the same meeting composer bottom sheet for editing notes and agreements as for adding them.

## Design

Extend `MeetingItemComposer` with typed edit values and save callbacks for notes and agreements, alongside its existing task editing mode. `MeetingPage` will create an item-specific composer scope when an edit action is selected, including the item section and ID. The composer will preload the appropriate fields and call the existing meeting-session update actions.

## Verification

Add composer tests covering preloaded note and agreement values, then run their focused test suite and the production build.
