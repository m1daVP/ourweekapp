# Weekly Meeting Flow UX Redesign Specification

## 1. Purpose and design decision

OurWeek should help couples and families have a useful weekly conversation and leave knowing what they agreed and what happens next.

The redesign has three goals:

1. **Easier interaction:** less typing, fewer decisions about the interface, and predictable saving and navigation.
2. **Better understanding:** every screen makes its purpose, available actions, and resulting outcomes clear.
3. **More meaningful engagement:** users see that their conversation matters and that unfinished business can be picked up next week.

Engagement means willingness to return because the meeting helped. It does not mean longer sessions, more recorded items, streaks, scores, or mandatory participation.

This is a proposed UX specification, not a description of features already implemented. The target is the existing mobile-only Vue/Capacitor app, Android first and iOS ready.

### Chosen approach

A guided conversation with lightweight capture is the recommended direction.

| Approach                                    | Benefit                                                               | Trade-off                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Refresh existing forms                      | Small visual change                                                   | Leaves repetitive data entry and unclear outcomes largely intact         |
| Guided conversation with contextual capture | Keeps orientation while making recording optional and outcomes useful | Requires clear composer, save, and completion behavior                   |
| Freeform conversation canvas                | Flexible for experienced users                                        | Less guidance, more navigation choices, and greater implementation scope |

Choose the middle approach. Retain the familiar sequence and warm visual language, but give reflection, planning, and review distinct jobs.

### Existing product foundations

Build on the current participant check-in, templates, notes, tasks, agreements, unfinished-task review, meeting lifecycle, history, and recap screens.

Use **agreement** consistently for a shared decision or rule. Do not introduce a competing decision entity just for this redesign.

The existing note model requires participant attribution, and the current completion handler requires meeting content. Shared notes and finishing without recorded content are intentional behavior changes that need compatible persistence/API validation during implementation.

## 2. Experience principles

- **Conversation is the activity.** The screen offers a prompt; recording is optional.
- **One obvious next action.** Users should not need to understand the data model to use a section.
- **Capture only what matters.** A short note or one clear action can be enough.
- **Show useful change.** A saved card appears where users expect it; the final review collects their outcomes.
- **Let people choose depth.** Examples and optional fields are available on request.
- **Make leaving safe.** Users can pause and return without guessing what was retained.
- **Stay neutral.** No blame, pressure to resolve disagreements, participation scores, or interpretations of a person's feelings.

A meeting can be useful even when nothing is written down. The approximately 15-minute positioning is an invitation, not a countdown or a completion requirement.

## 3. The meeting journey

```text
Check in
   ↓
Reflect: last week, good moments, difficult topics
   ↓
Plan: actions, money, family care, upcoming plans
   ↓
Agree: review the outcomes together
   ↓
Finish → saved recap → useful starting point next week
```

Keep participant setup short and reuse existing participants. Do not add a new agenda-building or onboarding screen to every meeting.

Returning users should be able to resume at their last saved position. Unfinished composer text is offered for continuation, never silently submitted.

### Last week's items

Reuse the existing unfinished-task review near the beginning of the meeting.

- Show it only when there are relevant items.
- Explain the purpose with “Still relevant this week?”
- Keep current review capabilities and apply each action only to its stated scope.
- A bulk action must clearly say it affects all displayed items.
- Continuing without a review decision leaves the previous items unchanged.
- Carrying an item forward uses the existing carry-forward relationship; do not create unrelated duplicates.
- Do not add a second review screen showing the same items later in Reflect.

Dedicated follow-up topics are a later extension described in section 13.

## 4. Shared screen structure

```text
[Close]          Reflect · 2 of 7          [More]

              What went well this week?
                   Even small wins count.

              [Compact saved note]
              [Compact saved note]

              + Add a good moment

              Need an example?

[Back]                                  [Next]
              Saved on this device
```

This is a hierarchy sketch, not a pixel-perfect layout. Counts come from the actual template and visible discussion/review steps; participant check-in is separate.

### Visual hierarchy

1. The question is the largest and clearest content.
2. Saved items are readable supporting content.
3. The contextual add action is easy to find.
4. Navigation stays consistent and reachable.
5. Progress and save status remain quiet but legible.

Use a small section label only when it adds information. Avoid stacking a title, a nearly identical question, and a paragraph of guidance.

Participant details belong in check-in and the meeting menu. A compact participant summary may remain in the header if space allows; do not repeat a large participant selector on every step.

The prompt begins at the top of the content and may scroll on short screens. Do not pin so much chrome that only one card fits above the keyboard.

Keep the add action after the cards. Do not duplicate it with a floating button. Do not autofocus an input until the user opens a composer.

## 5. Navigation and progress

Use template-configured phases: **Reflect → Plan → Agree**. Show the current phase with “Step X of Y” text available to assistive technology.

- Highlight the current phase; never use color alone.
- Moving forward measures position, not productivity or successful resolution.
- Back does not delete content or mark an item unfinished.
- Next is available with no items and never creates a placeholder record.
- Use “Review together” when entering the last step and “Finish meeting” on that step.
- On the first discussion step, Back returns to check-in and preserves captured content.
- Keep section jumping out of the first iteration; sequential navigation is sufficient.
- Omit unused phases for other templates rather than inventing steps to fill them.

Close pauses the meeting and returns to Home after local persistence succeeds. The menu uses the same pause-and-exit behavior, alongside the existing explicit end-incomplete and delete actions. Deleting remains secondary and requires confirmation.

Remove “Save draft” from primary navigation only after reliable autosave and failure feedback are implemented.

## 6. Section-specific conversations

The following table defines the default weekly template. Its primary action opens a composer directly. “Other actions” are available through a labeled “More ways to add” control, not a row of equally prominent buttons.

| Section / phase           | Main question                                 | Primary action           | Other actions                     |
| ------------------------- | --------------------------------------------- | ------------------------ | --------------------------------- |
| Good things / Reflect     | What went well this week?                     | Add a good moment → note | None                              |
| Tensions / Reflect        | What felt difficult this week?                | Add a topic → note       | None                              |
| Tasks / Plan              | What needs a clear next action?               | Add task                 | Add note                          |
| Money / Plan              | What should we buy, postpone, or agree on?    | Add agreement            | Add task, Add note                |
| Kids / family care / Plan | What needs attention around care or routines? | Add task                 | Add note                          |
| Plans / Plan              | What is coming up this week?                  | Add a plan note → note   | Add task                          |
| Final review / Agree      | Does this reflect what we agreed?             | Finish meeting           | Add agreement, Add task, Add note |

### Reflection

Good things can use “Even small wins count.” Tensions can use “Focus on the situation, not the person.”

Do not show a task composer beside a tension prompt. People may name a problem without being ready to solve it.

Saving a tension does not mark it unresolved, assign blame, or require a response from another participant.

### Planning

Task ownership and due dates are optional. Show “Who will take care of this?” and “When?” as optional controls beneath the title.

Money conversations may produce an agreement, a task, or just a note. A purchase is a task only if someone chooses an action such as “Buy shoes.”

In the first iteration, plans are ordinary notes with contextual wording. “Add a plan note” must not imply an event, reminder, date picker, or calendar connection.

### Final review

Use a distinct review layout, not the generic discussion template with a different title. Its details are in section 10.

## 7. Contextual capture

### Direct action first

A primary add action opens the relevant composer in one tap. If alternatives exist, “More ways to add” opens a short labeled action sheet.

Use familiar names and optional one-line explanations:

- **Note:** Something to remember.
- **Task:** Something someone will do.
- **Agreement:** Something we have agreed.

Close the action menu before opening the composer. Do not stack sheets.

### Composer fields

| Type      | Required       | Optional                                     |
| --------- | -------------- | -------------------------------------------- |
| Note      | One text field | Nothing required beyond the text             |
| Task      | Short title    | Details, responsibility, due date            |
| Agreement | One statement  | Related participants where already supported |

A note does not require both a title and a body. Let the card derive its preview from the text.

Use explicit actions: “Add note,” “Add task,” “Add agreement,” and “Save changes” when editing. Reject whitespace-only input and show field errors after submission, without scolding during typing.

Keep optional fields visible as compact labeled controls; expand details only when requested. Retain existing shared/unassigned responsibility choices. Do not default task ownership to whoever holds the phone.

### After adding

1. Persist the item locally.
2. Close the composer after persistence succeeds.
3. Show the saved card in its section.
4. Restore focus and keep the new card in view without a large jump.
5. Return to the conversation; do not reopen an empty form.

Prevent repeated taps from producing duplicate items. Do not use a toast for every successful note; the card itself confirms the result.

### Composer dismissal

Swipe-down, backdrop dismissal, Close, and Android back retain unfinished text as a local composer draft. Reopening offers “Continue your note” or the corresponding type.

Store drafts separately from real meeting items, scoped to account/workspace, meeting, section, item type, and edited item where relevant. Drafts must never appear in recaps, exports, shared sync payloads, or AI input.

Retain drafts across navigation and app restart through the existing persistence layer. Clear them after successful submission, explicit discard, or the applicable account-data cleanup. Do not describe this storage as encrypted unless verified.

If draft persistence fails, keep the composer open with Retry and an explicit discard option. Do not silently dismiss text that cannot be retained.

## 8. Saved cards and editing

Use shared spacing and typography but meaningful content differences.

```text
Morning routines were calmer.
Preparing clothes the night before helped.
                                      [More]
```

```text
Buy kindergarten shoes
Task · Rita · Fri, 18 Sep
                                      [More]
```

```text
Prepare clothes together in the evening.
Agreement
                                      [More]
```

- Notes emphasize text; tasks show responsibility and date when supplied; agreements show a clear type label.
- Use “Not assigned yet” for unassigned tasks in review. Missing ownership is not an error.
- Show dates in the user's locale. Avoid harsh “Overdue” labels; use the actual date.
- For long text, offer “Read more.” Never require horizontal scrolling.
- Use consistent “More” menus for Edit and Delete; do not use ambiguous “Open” status buttons.
- Retain existing task completion controls with accessible labels.
- Deletion must have a recoverable Undo when supported, or a clear confirmation.
- Keep existing ordering stable when navigating back or editing.

### Turning a discussion into an outcome

A note's secondary menu can offer “Create task from note” and “Create agreement from note” where that outcome is allowed in the section.

Prefill editable text and require explicit submission. Keep the original note: creating an outcome must not destroy the context. Do not label this action “Convert” if it creates another item.

For reflection-only sections, users add an outcome during planning or final review. Cross-section linking and automatic tension resolution are deferred.

## 9. Shared notes and attribution

Normal meeting notes are shared meeting content. Remove author selection from the standard composer.

Distinguish:

- **Creator:** the authenticated actor recorded for audit/sync where supported.
- **Attribution:** whose perspective a note represents.
- **Responsibility:** who will act on a task.

Do not substitute one concept for another or accept a client-supplied actor as trusted audit identity.

Preserve attribution on existing notes. Never rewrite historical notes as anonymous merely to simplify the new UI.

Templates where separate perspectives matter, such as conflict cleanup, may retain optional attribution behind “Whose perspective?” using existing participants. It is not required for a normal shared note.

Do not invent a fake participant to satisfy the current required participant field. Shared notes require an explicit backward-compatible model/API path before release. Private notes remain separate and are never pulled into this flow automatically.

## 10. Final review and completion

### Review together

Display what the participants actually recorded, grouped in this order:

1. **What we agreed:** agreements.
2. **What happens next:** tasks with optional ownership and dates.
3. **Notes to remember:** recorded notes, grouped by source section and initially collapsed.

Hide empty groups. Do not show four empty dashboard panels.

Use real saved records and stable IDs. Editing an item from review edits its source; it does not create a summary copy. Newly added review items belong to the final section.

Do not infer that every tension remains unresolved or that recording an agreement means every participant has digitally approved it. This screen invites a verbal check; there are no mandatory checkboxes or individual sign-offs.

Optional helper: “Anything to clarify before you finish?” Unassigned tasks remain editable and do not block completion.

### Finish behavior

“Finish meeting” completes the meeting once and opens the saved recap.

- A meeting can finish without notes, tasks, or agreements.
- For an empty meeting, show “You made time to check in. Nothing was recorded.” Allow normal completion without a second confirmation.
- If composer drafts remain, show a focused choice to review them or explicitly discard them before finishing. Never submit them automatically.
- Flush local changes before marking the meeting complete.
- Prevent duplicate completion while the operation is running.
- On local persistence failure, remain in review with the content intact and a Retry action.
- A remote sync delay must be distinguished from local save failure.
- Preserve existing history and completed-record editing permissions; do not introduce a reopen workflow in this redesign.

The current content-required completion check must be updated in every applicable validation layer and tested. Empty completion cannot be achieved only by enabling the button.

### Saved recap

Open the existing recap route with recorded agreements, tasks, and notes available immediately. “Back to Home” is the primary exit.

Core completion and the recorded recap must work for Free users and offline where existing local persistence supports it.

AI summaries remain optional and respect existing disclosure, entitlement, and content-readiness rules. Do not generate an AI summary for an empty meeting or make completion wait for generation. AI failure must leave the recorded recap usable.

Finishing does not enable notifications, create calendar events, or alter sharing permissions. Existing explicitly configured integrations retain their own behavior.

## 11. Saving, interruption, and recovery

“Autosave” has three distinct meanings:

| Content                        | Save behavior                                          | User-facing meaning                    |
| ------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| Submitted items and edits      | Persist on explicit Add / Save changes                 | A real meeting record                  |
| Meeting position and lifecycle | Persist after navigation or lifecycle change           | Resume where you left off              |
| Unsubmitted composer text      | Retain locally while typing and flush before dismissal | A recoverable draft, not a shared item |

Use the established local persistence and sync services. A cloud acknowledgment is not required to truthfully say an item is saved on this device.

| State                                    | Feedback and behavior                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Local write pending                      | “Saving…”; protect against duplicate submission                             |
| Local write succeeded                    | “Saved on this device”                                                      |
| Supported cloud sync acknowledged        | “Synced”                                                                    |
| Offline or sync pending after local save | “Saved on this device · Sync pending” only if sync actually exists          |
| Local save failed                        | Persistent “Couldn't save. Try again.” with Retry; preserve current content |
| Remote conflict                          | Use existing conflict recovery; never overwrite another version silently    |

Use a quiet status area for success, a persistent actionable message for errors. Never label in-memory state as durably saved.

Pause/exit and Finish wait for local persistence. If a pending write fails, retain the current screen and content. An explicit discard action may leave, with copy naming what will be lost.

On restart, restore the saved meeting position and available drafts. A force-stop during an unfinished write cannot be described as guaranteed recovery; test and document the actual persistence boundary.

## 12. Engagement, copy, and visual rhythm

Engagement should come from recognition, choice, and a useful result.

### Make it easier to start speaking

Each step has one main question and at most one visible helper sentence.

“Need an example?” reveals one or two short examples inline:

| Section     | Optional example                                              |
| ----------- | ------------------------------------------------------------- |
| Good things | Was there a small moment that made the week easier?           |
| Tensions    | Was there a routine or situation that felt harder than usual? |
| Tasks       | Is there one practical thing to take care of this week?       |
| Money       | Is there a purchase to postpone or agree on?                  |
| Family care | Is there an appointment or routine to coordinate?             |
| Plans       | Is there something coming up that you want to remember?       |

Examples are not preselected answers and never become saved content without user input. Avoid rotating prompts that change while someone is reading.

### Treat an empty screen as an invitation

Lead with the question. A supporting line can say “Talk it through. Add a note if you want to remember something.”

Do not greet users with “Nothing comes to mind?” before they have had a chance to think. Keep permission to skip concise: “You can move on without adding anything.”

### Make progress perceptible

Use distinct layouts for prior-task review, conversation, and final review. Keep common navigation and card conventions consistent.

A small card entrance or existing confirmation haptic can acknowledge a meaningful action. Respect reduced motion and existing haptic preferences. No confetti, streaks, countdown pressure, badges, or comparisons between participants.

The ending should reflect actual outcomes: “Your check-in is saved,” followed by their recorded content. Avoid claims such as “You resolved your tensions.”

### Protect attention

Do not introduce upsells, notification-permission requests, calendar setup, or AI setup during the conversation. Optional services belong after the usable recap or in their established settings flows.

Keep the existing warm palette. Improve spacing, typography, content hierarchy, and density before adding illustrations or new colors.

## 13. Item semantics and later extensions

The first iteration uses the existing note, task, and agreement concepts.

| Concept   | Meaning                                         | First iteration                                 |
| --------- | ----------------------------------------------- | ----------------------------------------------- |
| Note      | Something to remember without a required action | Existing note, shared attribution support added |
| Task      | An action to complete                           | Existing task and responsibility model          |
| Agreement | A shared decision or rule                       | Existing agreement                              |
| Follow-up | A topic explicitly chosen for reconsideration   | Deferred as a dedicated entity                  |
| Plan      | An intended event or arrangement                | Captured as a note; structured event deferred   |

This replaces the earlier generic five-type storage proposal. A UI redesign does not require merging all existing records into one table.

Follow-ups and structured plans can be added later only with clear lifecycle and storage support:

- A follow-up needs an explicit revisit choice, next-meeting retrieval, and a way to close it.
- A plan needs date/time semantics and a clear distinction from a task and calendar event.
- A follow-up date is not notification permission.
- A note must not be presented as a scheduled follow-up when it is only stored as text.
- User-authored follow-ups remain distinct from generated follow-through suggestions.
- Unresolved-topic grouping requires an explicit user state; do not infer it from section membership.

Reuse existing task carry-forward for continuity in the first release. Do not promise automatic resurfacing of arbitrary notes.

### Data compatibility requirements

Preserve item IDs, source sections, task statuses, historical attribution, and existing references used by sync, recap, and export.

Scope shared-note changes across local storage, backend schemas, ownership checks, sync conflict handling, and serializers. Authentication/audit ownership remains explicit.

Meeting section identity remains scoped to its meeting. Store template presentation metadata without changing the content or order of meetings already in progress.

## 14. Template configuration and implementation boundaries

Templates define phase, screen kind, question, helper/example copy, allowed creation types, and primary action.

Conceptual presentation contract, not a database migration:

```ts
type CaptureType = 'note' | 'task' | 'agreement';
type MeetingPhase = 'reflect' | 'plan' | 'agree';

type SectionPresentation = {
  sectionId: MeetingSectionId;
  phase: MeetingPhase;
  screenKind: 'conversation' | 'review';
  promptKey: string;
  helperKey?: string;
  exampleKeys?: string[];
  allowedItemTypes: CaptureType[];
  primaryCaptureType?: CaptureType;
  addActionLabelKey?: string;
  attributionMode: 'shared' | 'optional';
};
```

Conversation sections must have a primary capture type included in allowed item types and an add-action label. Review uses Finish as its main action and has no primary capture type.

Allowed types govern new creation, not whether existing content is visible. Historical records of other types remain accessible and editable according to permissions.

Keep presentation configuration near the existing templates and stable IDs. Localize all copy and validate each template explicitly; do not infer phase from translated section names.

Reuse existing UI primitives and services. Keep the composer responsible for input, the session/store layer responsible for lifecycle and persistence, and recap responsible for displaying saved outcomes.

Read the current working tree before implementation. There may be ongoing changes to the meeting step and shared styles; integrate with them rather than replacing them blindly.

## 15. Mobile accessibility and interaction requirements

- Support narrow Android screens, larger text, landscape interruptions, and safe areas.
- Use at least 44 × 44 px touch targets, preferably 48 × 48 px on Android.
- Keep the composer submit action reachable above the keyboard.
- Let a sheet expand to a full-height mobile composer when needed.
- Give every field a label; placeholders are examples, not labels.
- Trap focus in the active overlay and return it to the trigger or saved item.
- Respect the app's Android back priority: close the topmost overlay before route navigation.
- Prevent background scrolling and nested-sheet scroll traps.
- Give icon controls accessible names; do not rely on color or gestures alone.
- Announce save failures and completion without repeatedly interrupting screen-reader users during typing.
- Support reduced motion and locale-appropriate dates, pluralization, and longer translations.
- Verify keyboard and back behavior in the native WebView on a physical Android device.

## 16. Delivery scope

### First release: the complete core interaction

1. Shared conversation layout, direct contextual actions, and compact cards.
2. Short composers with optional task ownership/dates and recoverable drafts.
3. Shared-note attribution with compatible persistence and API behavior.
4. Reliable local autosave and truthful save/sync/error states.
5. Template-specific phases, prompts, examples, and creation rules.
6. Existing previous-task review retained in the Reflect phase.
7. Outcome-focused final review, explicit completion, and empty-meeting support.
8. Immediate recorded recap with optional AI work separated from completion.
9. Mobile accessibility, localization, and native interruption checks.

These may be implemented incrementally, but draft recovery, save feedback, and compatible validation must ship with the UI that depends on them.

### Later, after usability validation

- Dedicated follow-up topics with next-meeting resurfacing.
- Structured plans with date/time behavior.
- Cross-section links from tensions to outcomes.
- Optional agenda customization if repeated testing shows a need.

Exclude real-time co-editing, gamification, new reminders, new calendar workflows, and broad storage architecture changes from this redesign.

## 17. Acceptance scenarios

| Scenario                                | Expected outcome                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| First meeting, nothing recorded         | User can move through all discussion sections and finish; recap accurately says nothing was recorded |
| Returning meeting with unfinished tasks | Review appears once; proceeding without a decision leaves prior tasks unchanged                      |
| Add a good moment                       | One tap opens one text field; submitting shows a card and returns to the question                    |
| Add an unassigned task without a date   | Saves successfully; final review communicates missing ownership neutrally                            |
| Discuss money without agreement         | User can choose a note; no task or decision is forced                                                |
| Dismiss a partially written composer    | Draft returns when reopened and survives restart after confirmed local persistence                   |
| Edit then cancel                        | Saved item is unchanged; unfinished edit is retained separately until resumed or discarded           |
| Local storage fails                     | Content stays visible, failure persists with Retry, and the interface does not claim success         |
| Network drops after local save          | Local work remains usable; feedback distinguishes local save from cloud sync                         |
| Tap Add or Finish repeatedly            | Exactly one item or completion transition results                                                    |
| Finish with remaining composer drafts   | User reviews or explicitly discards them; drafts are never silently submitted                        |
| Edit an item from final review          | Its original record updates and no recap duplicate is created                                        |
| Existing attributed note                | Original attribution remains available; new shared notes do not require author selection             |
| Free or offline completion              | Recorded recap is usable without AI, upgrades, or integration setup                                  |
| Large text and keyboard open            | Prompt, fields, errors, and submit action remain usable without horizontal scrolling                 |
| Android back with composer open         | Composer closes safely before any meeting or app navigation                                          |

Implementation checks should cover meaningful behavior in session/store tests, route/schema tests for contract changes, and native manual QA. This document alone does not change runtime behavior.

## 18. How to judge improvement

Run a small formative usability round with approximately five households, including first-time and returning users. This is a design check, not statistical proof.

Ask people to use fictional or self-chosen non-sensitive examples to:

1. Start a meeting and explain what the current screen is asking.
2. Record a good moment and an unassigned task.
3. Discuss a money topic without turning it into an action.
4. Dismiss a draft, return to it, and resume the meeting.
5. Review outcomes and finish, including a separate empty-meeting scenario.

Initial targets:

- At least four of five households complete the core capture/review flow without moderator explanation.
- At least four of five correctly distinguish a note, task, and agreement.
- All tested save-failure and draft-recovery scenarios show accurate feedback without silently losing confirmed saved content.
- Participants can find what they agreed and what happens next in the recap.
- Feedback indicates the interface supports speaking together and permits moving on without recording.

Compare against the current flow where feasible: hesitation before adding, requests for help, accidental dismissal, perceived effort, and willingness to use it next week.

Do not optimize for item count or longer meeting duration. If existing privacy-approved analytics are available, use content-free completion/resume trends as supporting evidence; do not add tracking or collect household text for this redesign.
