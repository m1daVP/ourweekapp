# AI-generated participant reference validation design

## Goal

Prevent an AI-generated meeting summary from assigning a task to a participant who is not an active participant of that meeting in its workspace.

## Scope

This change covers newly generated summaries in the backend AI service. It does not alter meeting membership, participant records, existing persisted summaries, the OpenAI response schema, or mobile UI behavior.

## Decision

Generated task owner IDs that are not authorized for the meeting are removed. If no valid owner IDs remain, the generated task is saved without `responsibleParticipantIds` (unassigned). The service never substitutes another participant and does not fail the entire recap solely because of an invalid model reference.

## Design

`AiSummaryService.generateMeetingSummary` already loads workspace-scoped, non-deleted participant records for the meeting before building the provider payload. The service will derive an allowed-ID set from that result, which is necessarily limited to the requested meeting participant IDs and current workspace. This change does not introduce a new active/inactive participant policy.

After the provider response is normalized and before the summary is parsed, finalized, cached, or returned, the service will sanitize `tasks[].responsibleParticipantIds`:

- Retain only IDs in the allowed-ID set.
- Remove duplicate valid IDs while retaining their first occurrence.
- Omit `responsibleParticipantIds` when the resulting list is empty.
- Leave all other generated fields unchanged.

The service remains the authorization boundary. The provider client continues to handle provider interaction and structured-output parsing only; the finalization RPC continues to atomically store the already-sanitized summary, request completion, and credit settlement.

## Data flow

1. Load the workspace-scoped meeting.
2. Load the workspace-scoped, non-deleted participants named by that meeting.
3. Build the prompt as today.
4. Receive and normalize model output.
5. Sanitize task owner IDs against the loaded participant IDs.
6. Validate the sanitized object with `meetingSummarySchema`.
7. Atomically finalize and return the sanitized summary.

## Error handling and compatibility

Invalid model owner references are expected untrusted-output data, not a client error. They produce an unassigned task rather than a failed generation, provider retry, or additional credit charge. The public response schema is unchanged because `responsibleParticipantIds` is already optional. Previously persisted summaries are not rewritten.

## Tests

Add focused service tests proving that:

- an unknown ID is removed and its task is unassigned;
- an ID belonging to another workspace is removed and its task is unassigned;
- a valid meeting participant ID is retained;
- mixed valid and invalid references retain only valid IDs, without duplicates.

The tests will assert that the summary passed to atomic finalization and the returned summary use the same sanitized ownership data.

## Verification

Run the focused AI service tests, then `npm run typecheck` and the full backend test suite when practical. No schema migration or deployment is required.
