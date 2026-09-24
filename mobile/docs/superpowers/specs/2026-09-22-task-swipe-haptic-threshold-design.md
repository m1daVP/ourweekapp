# Task Swipe Haptic Threshold Design

## Goal

Give a light tactile confirmation whenever a task-card swipe reaches the existing apply-action threshold on the Tasks page.

## Scope

- Apply to both task-card swipe actions:
  - right: finish a task;
  - left: request task deletion.
- Use the existing light `haptics.refreshReady()` pulse.
- Keep the existing threshold, visuals, swipe direction rules, and finish/delete behavior unchanged.
- Do not add dependencies, native configuration, copy, or settings.

## Interaction Behavior

Each active task-card drag has an in-memory readiness latch.

1. When the drag first crosses the active action threshold, send one light haptic pulse.
2. While the card stays at or beyond that threshold, send no additional pulses.
3. When the card moves back below the threshold, re-arm the latch.
4. Crossing the threshold again sends another light pulse, even within the same drag.
5. Moving through the neutral zone and reaching the opposite action threshold is treated as a new crossing and also pulses.
6. Vertical or below-threshold movement produces no haptic feedback.
7. Pointer cancel, pointer end, and swipe reset clear the latch. Releasing a ready drag continues to perform the existing action exactly as it does now.

## Architecture

`TaskSwipeActionCard.vue` already owns pointer movement, clamped drag offset, and action readiness. It will derive threshold crossings from the existing swipe state immediately after updating the horizontal offset.

A small pure helper in `taskSwipeActions.ts` will compare the prior and current ready states. This mirrors the pull-to-refresh transition pattern and keeps the repeated-crossing rule directly testable without coupling tests to DOM events.

The component will call `haptics.refreshReady()` only when that helper reports an unready-to-ready transition. The existing haptics service remains the sole Capacitor Haptics boundary.

## Testing

- Unit-test the transition helper for entering, holding, leaving, and re-entering readiness.
- Component-test right and left drag thresholds.
- Verify one pulse per crossing, including return-below-threshold then re-cross behavior.
- Verify no pulse for below-threshold movement, vertical gestures, cancelled-before-threshold gestures, or release without a new crossing. A cancellation after a threshold crossing preserves the already-sent pulse and clears the latch for the next drag.

## Failure Handling

The haptics service already makes browser and native-plugin failures safe no-ops. Gesture actions must continue normally if feedback is unavailable.
