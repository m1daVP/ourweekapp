# AI Recap Content Guidance Design

## Goal

Help people avoid spending an AI recap credit on a completed meeting that has
too little discussion context to produce a useful recap, without forcing every
meeting template section to be filled in or preventing an intentional recap.

## Decision

Use a soft, confirmation-based low-content check. A completed meeting is
**recap-ready** when it contains at least two discussion signals in at least
two different sections.

A discussion signal is one non-empty shared note or one non-empty agreement.
Tasks do not make a meeting recap-ready on their own: they describe follow-up,
but usually do not explain the discussion, decision, or context behind it.
Tasks remain in the model input and enrich a recap once the meeting is
recap-ready.

Private notes remain excluded from both this check and the AI payload.

This deliberately does not require one note in every template section. A
meeting can reasonably cover only two of five or six prompts, and the rule
should not turn the ritual into a checklist.

## User Experience

When a person asks to generate a recap for a low-content meeting, show a calm
bottom-sheet confirmation before any API request or recap-credit reservation:

> Add a little more context for a better recap. Recaps work best when two
> different parts of the meeting include a note or agreement. You can still
> generate one now.

The sheet offers `Add more context` (dismisses the sheet and does not generate)
and `Generate anyway` (continues generation). It is not destructive, does not
use blame-oriented language, and does not disable the recap feature.

The first-use privacy disclosure continues to apply independently. At meeting
completion, a low-content meeting shows the content-quality confirmation first;
only after `Generate anyway` does the existing privacy disclosure appear when
it has not yet been acknowledged. A person who chooses `Add more context`
still completes the meeting and is taken to its recap screen without a recap.

The same confirmation is used from both completed-meeting recap screens. It is
shown for a retryable user action, not for an automatic retry after a provider
failure.

## Client Design

Place a pure `getAiRecapContentReadiness(meeting)` helper in the meeting
feature. It returns a small, typed result containing `isReady`,
`discussionSignalCount`, and `sectionCount` so all entry points evaluate the
same local meeting snapshot.

The client sends a new explicit request flag only after the person selects
`Generate anyway`. A ready meeting sends no override. This makes the warning
meaningful even if an old client or direct request reaches the server.

## API Design

Extend `POST /v1/ai/meeting-summary` with optional
`allowLowContent?: boolean`. Before creating an AI generation claim or
reserving a recap credit, the service runs the same deterministic rule against
the sanitized shared meeting sections.

For a low-content request without the explicit flag, return a stable `422`
error:

```json
{
  "message": "Add more meeting context before generating a recap.",
  "code": "ai_summary_insufficient_content",
  "details": {
    "discussionSignalCount": 1,
    "sectionCount": 1,
    "requiredDiscussionSignalCount": 2,
    "requiredSectionCount": 2
  }
}
```

The response must not include note text, private-note status, participant
details, or other meeting content. `allowLowContent: true` authorizes a low
content request to proceed through the existing entitlement, rate-limit,
credit, caching, provider, and persistence flow unchanged.

## Compatibility and Safety

The new flag is optional, making the request addition wire-compatible. Older
clients receive the safe `422` rather than unintentionally consuming a credit.
No database migration, model/prompt change, provider change, or private-note
handling change is required. The server must calculate readiness only from the
already-sanitized AI input, so private notes can never influence either the
guidance or an override requirement.

## Verification

Test the pure readiness helper with ready and low-content combinations,
including empty strings and private-marked records. Test every client entry
point: low content opens the confirmation; dismissing makes no API request;
confirming sends the override; recap-ready content proceeds unchanged.

On the API, test low content rejects before a claim/provider call, the error is
stable and non-sensitive, and an explicit override proceeds. Preserve the
existing tests for completion, first-use disclosure, quota, authorization,
sync, caching, and recap persistence.

## Out of Scope

- Scoring note quality, sentiment, or relationship health.
- Requiring content in every template section.
- Altering AI prompts or generated-recap shape.
- Changing quota or credit limits.
- Sending or exposing private notes.
