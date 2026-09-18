# Haptic Feedback Expansion Design

## Goal

Extend OurWeek's native haptic feedback so meaningful confirmed edits feel responsive while wheel controls and pull-to-refresh provide subtle tactile guidance. Feedback must remain calm, best-effort, and unavailable on the web without affecting the user flow.

## Scope

Add semantic haptic operations to the existing shared service:

- `confirm()` for successful add and explicit save/update confirmations.
- `remove()` for confirmed delete, remove, and disable actions.
- `wheelChange()` for a subtle hour/minute wheel value change.
- `refreshReady()` for entering the pull-to-refresh ready zone.

Apply them to:

- Meeting notes, tasks, and agreements when added, explicitly saved after editing, or deleted.
- Meeting guest participants when successfully added to the check-in.
- Tasks screen tasks when added, explicitly saved after editing, or deleted. Existing task-completion feedback remains separate.
- Household participants when created, explicitly saved after editing, removed, or disabled. A single participant confirmation produces one haptic even when duplicate records are updated together.
- Pull-to-refresh on every transition into the ready zone during a drag, including repeated crossings after pulling back below the threshold.
- The time picker hour and minute wheels when the snapped value actually changes during user scrolling.

Do not add feedback for validation failures, canceled dialogs, navigation, opening or closing overlays, intermediate field edits, undo/restore, or programmatic wheel positioning.

## Architecture

Keep `src/shared/services/hapticsService.ts` as the only module that imports Capacitor Haptics. Each semantic method uses the existing native-platform guard and failure handling.

`wheelChange()` uses Capacitor selection feedback. The picker begins a native selection interaction when the user starts interacting with a wheel, sends selection-change feedback only when the calculated option differs from the previous option, and ends the selection on interaction completion. Programmatic `scrollTop` positioning is silent. If the native selection operation rejects, the service absorbs the error using the existing safe logging behavior; haptics never block or roll back a picker change.

`refreshReady()` uses a light impact. `usePullToRefresh` tracks the previous ready/not-ready state while handling touch movement. It triggers feedback only on a below-threshold to ready transition. Returning below the threshold re-arms the transition, allowing another pulse on the next crossing. Gesture cancellation, gesture completion, disabled state, and refresh start reset the edge state.

Feature code calls semantic methods immediately after the underlying store mutation reports success. It does not call the service from stores, keeping sync, restore, and other non-confirmation mutations silent.

## Interaction and failure behavior

- Add/save confirmation: light feedback after the store returns success.
- Delete/remove/disable confirmation: medium feedback after the store returns a successful snapshot or entity.
- Participant edit: one light feedback after the complete confirmed edit succeeds, regardless of how many duplicate participant records were updated.
- Wheel scrolling: one light selection tick per snapped value change; no tick for the same value, opening the picker, or clicking an already-selected option.
- Pull-to-refresh: one light pulse at each ready-zone crossing, before refresh work begins if the gesture is released there.
- Web/browser execution: no native plugin call.
- Native plugin failure: warn through the existing safe logger and resolve without changing visible app behavior.

## Testing and verification

Add or update focused tests for:

- Semantic service mappings, browser no-op behavior, and rejected native calls.
- Pull-to-refresh repeated threshold crossings and reset behavior.
- Time picker value-change ticks, duplicate-value suppression, and silent programmatic positioning.
- Meeting note/task/agreement add, edit-save, and delete success paths.
- Task screen add, edit-save, and delete success paths.
- Participant create, edit-save, remove, and disable success paths.

Run the targeted Vitest tests, then `npm run build` and `npm run check`.

## Out of scope

- New haptic settings or user preferences.
- Changes to haptic behavior for meeting completion or task completion beyond preserving the existing behavior.
- New dependencies, user-facing copy, translation keys, backend changes, or native platform configuration.
