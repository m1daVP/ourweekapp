# Weekly Meeting UX Redesign QA Handoff

Date: 2026-09-14

## Automated verification

| Area                       | Command                                                              | Result  | Notes                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend tests             | `npm test`                                                           | Pass    | 90 test files, 655 tests passed.                                                                                                                 |
| Frontend production build  | `npm run build`                                                      | Pass    | Vite emitted the existing large-chunk warning for the main bundle.                                                                               |
| Frontend type checking     | `npm run typecheck`                                                  | Pass    | App and Node TypeScript checks passed.                                                                                                           |
| Frontend style gate        | `npm run check`                                                      | Blocked | Prettier reports only `src/features/meeting/components/MeetingSectionStep.vue` and its test. These files were not reformatted during M5/M6 work. |
| Backend type checking      | `npm run typecheck`                                                  | Pass    |                                                                                                                                                  |
| Backend API contract       | `npm run openapi:check`                                              | Pass    | No public OpenAPI drift detected.                                                                                                                |
| Backend build              | `npm run build`                                                      | Pass    |                                                                                                                                                  |
| Backend database ownership | `npm test -- tests/database-workspace-ownership.integration.test.ts` | Pass    | 3 tests passed against the configured local Supabase environment.                                                                                |
| Backend app wiring         | `npm test -- tests/app.test.ts`                                      | Pass    | 3 tests passed. This was the suite that previously timed out while the database environment was misconfigured.                                   |

## M5 status before release

Implemented in the current working tree:

- Empty meetings complete after confirmed local persistence.
- A failed completion write restores the editable meeting state.
- Repeated Finish calls preserve the original completion timestamp.
- Completion routes immediately to the recorded recap and never starts AI work automatically.
- The final review omits empty outcome groups, collapses notes by source section, and exposes contextual final-section capture actions.
- Finish pauses for unsent composer drafts. **Review drafts** opens the draft in its source section and returns to review on close; **Discard drafts and finish** removes only confirmed local drafts before retrying completion. Drafts are never submitted automatically.

## Required physical Android QA

Run against a production-equivalent Android build and record device model, Android version, app build, account tier, and result for every row.

| Scenario                                      | Expected result                                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Keyboard open in note/task/agreement composer | Field, error, and submit action remain reachable with no horizontal scroll.                                 |
| Large text and narrow screen                  | Prompt, cards, review actions, and Finish remain readable and tappable.                                     |
| Android Back with composer open               | Composer closes and retains its draft before meeting or app navigation occurs.                              |
| Background, resume, and restart               | Saved meeting position and confirmed drafts recover; no false guarantee is made for an interrupted write.   |
| Offline submitted item and completion         | Local records/recap remain usable; UI distinguishes local save from cloud sync.                             |
| Repeated Add and Finish taps                  | Exactly one item or completion transition is created.                                                       |
| Empty meeting completion                      | Review permits Finish; recap says that nothing was recorded.                                                |
| Free/offline recap                            | Recorded agreements, tasks, and notes remain usable without AI, upgrade, calendar, or notification prompts. |
| Safe areas and gesture navigation             | Bottom actions stay reachable and do not conflict with system gestures.                                     |

## Required usability and locale validation

Conduct the specification's approximately five-household exercise using non-sensitive examples. Record whether each household can:

1. Explain the current meeting prompt.
2. Add a note and an unassigned task.
3. Discuss money without being forced to create a task or agreement.
4. Dismiss and recover a draft.
5. Review outcomes and complete both recorded and empty meetings.

Check every supported locale for missing translation keys, clipped labels, plural/date formatting, accessible names, and the empty-review wording. Verify reduced-motion behavior while adding an item and moving between steps.

## Release decision

Do not release until Android QA passes. The two frontend Prettier findings should be resolved by the owner of the existing `MeetingSectionStep` changes or reviewed and formatted as part of their change.
