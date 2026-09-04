# AI canonical commitments design

Date: 2026-09-04.

References: `D:/Projects/myself/weekly-us-api/AI_READINESS_REVIEW.md`, AI-09;
`D:/Projects/myself/weekly-us-api/AI_RELEASE_CHECKLIST.md`, step 9.

## Goal

Ensure that an AI recap can never change the commitments a household sees or
shares. Stored meeting tasks and agreements are authoritative; the generated
short narrative is supplemental only.

## Scope

This work changes the mobile meeting-summary projection and its share text in
`src/pages/MeetingSummaryPage.vue`, plus focused page tests. It addresses
AI-09 only.

It does not change AI prompts, the backend response schema, recap generation,
the task/agreement editing flow, export entitlement behavior, or the meeting
details page. It intentionally does not add a UI for applying AI suggestions.

## Chosen approach

The summary view model will derive `keyDecisions` only from agreements stored
in `meeting.sections`, and `actionItems` only from open tasks stored in those
same sections. It will not read `meeting.aiSummary.agreements` or
`meeting.aiSummary.tasks`.

`meeting.aiSummary.shortSummary` remains an optional AI insight in the
separate, explicitly labelled AI card. The existing inaccuracy disclaimer
continues to apply to that narrative. No AI-generated commitment is displayed
as a saved decision or action item, and no model output can write or mutate a
stored commitment through this page.

## Data flow

1. The page resolves the authorized local meeting record as it does today.
2. `createSummaryViewModel` reads canonical agreements and tasks from the
   meeting sections.
3. The template renders those canonical values under Key decisions and Action
   items.
4. `getShareText` consumes the same view model, so shared text contains the
   canonical decisions and action items.
5. If an AI narrative exists, it is included only in the AI-insight portion of
   the shared recap together with its existing disclaimer.

An AI response that omits a genuine task, invents a task, or rewords an
agreement therefore has no effect on visible or shared commitments.

## Confirmation boundary

AI task and agreement arrays are deliberately hidden rather than presented as
editable suggestions. A future suggestion workflow must be separately
designed: it may show suggestions distinctly from saved commitments and must
require an explicit user confirmation before creating or updating a canonical
task or agreement. This work does not create that workflow or imply that the
current AI output is safe to apply automatically.

## Verification

Add a focused `MeetingRecapPages` test with a canonical task and agreement
that differ from the AI recap arrays. Assert that the summary renders the
canonical task and agreement, does not render the altered or invented AI
commitments, and continues to render the AI narrative separately.

Extend the share-path test with the same conflicting values. Assert that the
native-share payload contains the canonical commitments and does not contain
the AI task/agreement substitutions. Retain coverage that a saved narrative
remains shareable after recap allowance exhaustion.

Run the focused page test, then `npm run build` and `npm run check` when
practical. No backend request, schema migration, provider request, deployment,
or device state change is required.

## Manual check

Create or load a completed meeting with a stored agreement and open task, then
attach an AI recap that omits the task and rewrites the agreement. Confirm the
page and its share sheet show the saved records, while the AI card shows only
the narrative with its disclaimer.

## Spec self-review

No placeholders remain. The source of truth, affected page/share path,
non-goals, confirmation boundary, test cases, and manual acceptance behavior
are explicit. Scope is confined to AI-09 and does not alter account,
authorization, allowance, provider, or persistence behavior.
