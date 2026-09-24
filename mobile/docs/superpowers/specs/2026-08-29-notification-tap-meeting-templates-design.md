# Notification tap to meeting templates

## Goal

Open the meeting-template selection screen when a person taps either local reminder notification.

## Scope

- Listen for Capacitor Local Notifications' `localNotificationActionPerformed` event on native platforms.
- Route notification taps to the existing `meeting-templates` Vue Router route.
- Register the listener while the app shell is mounted and remove it when the shell unmounts.
- Do not change notification copy, schedules, Android intent configuration, or the existing deep-link URL contract.

## Design

Create an app-level `useNotificationActions` composable. On native platforms with the Local Notifications plugin available, it registers one listener for `localNotificationActionPerformed`. When the listener fires, it waits for router readiness and calls `router.push({ name: 'meeting-templates' })`.

The listener does not branch on notification ID because both current reminder notifications share the same required outcome. The templates page remains responsible for its existing draft-resume card, access locks, and template selection flow.

The composable is initialized from `App.vue`, alongside `useDeepLinks` and the existing notification reminder synchronization. It retains the plugin listener handle and removes it during component unmount, preventing duplicate listeners during remounts.

## Navigation and error handling

The existing global router guard applies to the destination. A signed-out person is sent to sign-in with `/meeting/templates` as the redirect target; an authenticated person reaches the templates page directly. Listener registration is skipped in browser development and when the plugin is unavailable. A routing failure is contained in the event handler so it cannot cause an unhandled native listener rejection.

## Testing and verification

Unit-test the composable's native registration, route target, unavailable-platform no-op, and listener cleanup using mocked Capacitor APIs and router methods. Build a debug Android APK, schedule either reminder, tap it while the app is closed and while it is foregrounded, and confirm it reaches the meeting-template screen.
