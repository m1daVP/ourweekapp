# Top Error Notifications Design

## Goal

Replace inline feedback for failed asynchronous actions with the existing shared top notification. Keep errors that explain how to correct a specific input or form inline.

## Scope

Move operational failures to `useInAppNotification` with the `error` tone in these areas:

- Google account linking and account data actions in Settings;
- subscription purchase, restore, and management actions;
- Google Calendar connection and synchronization actions;
- reminder permission or scheduling actions;
- meeting export, copy, and sharing actions;
- equivalent asynchronous actions found during the implementation audit.

Do not move these messages:

- required-field and invalid-input validation;
- permission explanations that are persistent UI state rather than an action result;
- recovery panels whose actions and explanation must remain visible;
- loading, empty, or long-lived sync status content.

## Behavior

When an asynchronous user action fails, its existing localized message is passed to:

```ts
showInAppNotification(message, {
  tone: 'error',
});
```

The corresponding inline error element is removed. Each failure produces one notification, and stale store errors must not be replayed when the user revisits a screen. Successful actions continue using the current status notification behavior.

If an error belongs to a shared store, the consuming page watches or handles the result at the action boundary and clears any consumed feedback through an existing store method. A narrowly scoped clear method may be added where needed. Local component actions notify directly in their catch or failure branch.

## Accessibility and Mobile Behavior

The shared notification remains the single top-of-screen live region and uses its existing error styling and dismissal behavior. Removing duplicate inline alerts avoids two screen-reader announcements for one failure. Input validation stays near the affected control for context.

## Testing

Focused component tests will verify that:

- an operational failure calls `showInAppNotification` with the expected message and `error` tone;
- the old inline operational error is absent;
- validation feedback that belongs to a field or form remains inline;
- consumed store feedback is not shown repeatedly.

After focused tests, run `npm run build` and `npm run check`.

## Constraints

- Reuse the existing notification composable and styles.
- Add no dependency or new notification system.
- Preserve existing user-facing translations unless a missing generic error requires an existing translation key.
- Preserve unrelated working-tree changes.
- Do not create a Git commit unless explicitly requested.
