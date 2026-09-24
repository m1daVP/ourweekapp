# Review task editor consistency

## Goal

When a task is edited from the meeting review-and-close screen, open the same `MeetingItemComposer` bottom sheet used to add a task, populated with the selected task's existing fields.

## Design

`MeetingPage` will derive a task-editor composer scope from the active meeting and the section associated with the selected task. This scope is independent of the currently active meeting step, which may be unavailable on the final review screen. The existing edit callback and save path remain unchanged.

If an edit scope cannot be resolved, the existing task editor remains available as a safe fallback rather than leaving the user without an editor.

## Verification

Add or update the review-and-close interaction test to assert that selecting a task edit action reaches the composer-based task editor. Run the focused test suite and the project's build and check scripts.
