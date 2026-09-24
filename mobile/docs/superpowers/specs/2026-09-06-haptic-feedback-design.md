# Haptic Feedback Design

## Goal

Make meaningful completed actions feel responsive on native mobile devices without making OurWeek feel noisy, game-like, or demanding.

## Scope

Haptic feedback is limited to confirmed, user-initiated outcomes:

- a task is marked complete;
- a task or agreement is saved;
- a meeting is started;
- a meeting is finished;
- a destructive action is confirmed.

Completing a meeting receives the strongest feedback in this set. Other supported outcomes use a light confirmation.

No haptic feedback is used for ordinary navigation, opening or closing overlays, typing, validation errors, loading states, background sync, or individual routine taps.

## Architecture

Add a `src/shared/services/hapticsService.ts` abstraction. It owns the Capacitor haptics dependency and exposes small semantic methods rather than plugin calls throughout the UI:

- `confirm()` for light successful outcomes;
- `completeMeeting()` for the meeting-finished confirmation;
- `impact()` for a confirmed destructive action, if its native effect is suitably distinct from `confirm()`.

The service checks whether the app is running on a native Capacitor platform before calling the native plugin. It catches plugin failures and resolves without surfacing an error to the user. On the web, including browser development and tests that do not mock the plugin, it is a no-op.

Feature components and pages invoke the semantic service only after their underlying action succeeds. The service never determines whether an action succeeded and does not own any product state.

## Dependencies and Platform Behavior

Use Capacitor's maintained haptics plugin. The plugin is isolated to the shared service so Android-first behavior remains clean and iOS-ready.

The app does not provide its own haptics setting in this change. Native system/device settings remain authoritative. Haptics are best-effort feedback only; unavailable hardware, disabled system haptics, browser execution, and plugin errors must not affect the user flow.

## Error Handling

Haptic calls must never block a completed action or replace user-visible feedback. Failure is intentionally silent in production. Development-only logging may be used if consistent with the existing project error-handling convention, but must not expose technical errors in the UI.

## Testing and Verification

Add focused unit tests for the shared service to verify:

- native calls select the intended semantic feedback;
- web execution makes no plugin call;
- a rejected plugin call is safely handled.

Test each changed user flow to ensure haptics happen only after success. Run `npm run build` and `npm run check`. Native verification on Android should confirm that feedback is subtle, does not trigger on navigation or input, and does not prevent any flow when disabled or unavailable.
