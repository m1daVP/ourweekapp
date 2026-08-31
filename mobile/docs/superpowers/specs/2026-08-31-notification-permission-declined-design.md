# Notification permission decline handling

## Goal

Keep the Settings reminder toggle truthful when device notification access is declined, and give a concise explanation without repeatedly prompting the user.

## Behavior

When a user enables reminders, the app requests notification permission only when the native platform permits a request. A granted result enables reminders and schedules them as today.

Every declined or failed native request disables the persisted reminder setting and cancels any pending local reminders. Since the stored setting is already off while the Android prompt is visible, the Settings handler explicitly clears the input after an unsuccessful result so the checkbox visibly returns to unchecked.

When the request is explicitly declined, the Settings page shows the toast: `Notifications access was declined`.

On later attempts after Android has reported denied permission, the app does not attempt to display a permission prompt that Android will suppress. It preserves the disabled setting and shows the same toast. Users can grant access later through Android system settings.

## Implementation boundaries

- `useNotifications` owns permission-result interpretation, reminder cleanup, and a stable declined result for UI consumers.
- `SettingsPage` owns displaying the toast after an attempted enable returns the declined result.
- Existing localized Settings status copy remains available for the reminder detail sheet; the new toast copy is added to every supported locale.

## Error handling

Permission API errors are handled as an unsuccessful enable: the toggle is disabled and scheduled reminders are cancelled. They retain the existing user-safe error message rather than being reported as an explicit decline.

## Tests

- Add composable tests for denied permission and rejected permission calls, asserting that reminders are disabled and notifications are cancelled.
- Add a Settings page test that a denied enable attempt produces the localized declined-permission toast.
- Run the focused tests, `npm run build`, and `npm run check`.
