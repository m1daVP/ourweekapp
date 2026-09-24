# AI Canonical Commitments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure stored meeting tasks and agreements, rather than model output,
are the only commitments shown and shared in a meeting recap.

**Architecture:** Keep the existing `SummaryViewModel` as the single source for
both page rendering and share text. Change its projection so canonical meeting
sections supply decisions and open action items; retain only `shortSummary`
from the AI recap for the separate narrative card.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest,
Vue Test Utils.

## Global Constraints

- Add no dependencies and make no backend, provider, prompt, schema, migration,
  allowance, entitlement, authorization, or export-feature changes.
- Keep AI narratives explicitly supplemental and retain the existing AI
  inaccuracy disclaimer.
- Do not create a flow that applies AI task/agreement suggestions; a future
  flow requires explicit user confirmation before changing canonical records.
- Preserve mobile-first, accessible existing markup and share behavior.
- Do not stage or commit files without the user's explicit authorization.

---

### Task 1: Lock canonical commitment display and sharing with regression tests

**Files:**

- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes: `setupRecapTest()`, `savedRecap`, and the existing mounted
  `MeetingSummaryPage` test harness.
- Produces: regression coverage proving that canonical `MeetingSection.tasks`
  and `MeetingSection.agreements` take precedence over divergent
  `MeetingSummary.tasks` and `MeetingSummary.agreements` in both rendered and
  shared recaps.

- [ ] **Step 1: Add a conflicting canonical/AI fixture helper in the page test**

Add a local helper that replaces the first fixture section's commitments and
the saved AI recap's arrays with distinct values. Its exact contract is:

```ts
function addConflictingCommitments() {
  const meeting = context.meetings.meetings[0]!;
  const section = meeting.sections[0]!;

  section.tasks = [
    {
      id: 'canonical-task-1',
      sectionId: 'goodThings',
      title: 'Book the dentist appointment',
      responsibilityType: 'shared',
      responsibleParticipantIds: [],
      status: 'open',
      createdAt: '2026-09-04T10:00:00.000Z',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
  ];
  section.agreements = [
    {
      id: 'canonical-agreement-1',
      sectionId: 'goodThings',
      text: 'We will plan Sunday together after breakfast.',
      participantIds: [],
      createdAt: '2026-09-04T10:00:00.000Z',
    },
  ];
  meeting.aiSummary = {
    ...savedRecap,
    agreements: ['AI rewrite: plan Sunday only if convenient.'],
    tasks: [
      {
        title: 'AI-invented task',
        responsibilityType: 'shared',
        responsibleParticipantIds: [],
        status: 'open',
      },
    ],
  };
}
```

- [ ] **Step 2: Add failing display and native-share regression tests**

Mount `MeetingSummaryPage` after `addConflictingCommitments()` and assert the
canonical task, canonical agreement, and `savedRecap.shortSummary` are visible;
assert neither AI commitment is present. In a separate test, stub
`navigator.share`, trigger `[data-testid="share-meeting-summary"]`, and assert
the captured `text` contains canonical commitments plus the AI narrative while
excluding both AI commitment strings:

```ts
expect(wrapper.text()).toContain('Book the dentist appointment');
expect(wrapper.text()).toContain(
  'We will plan Sunday together after breakfast.'
);
expect(wrapper.text()).toContain(savedRecap.shortSummary);
expect(wrapper.text()).not.toContain('AI-invented task');
expect(wrapper.text()).not.toContain(
  'AI rewrite: plan Sunday only if convenient.'
);

const text = share.mock.calls[0]?.[0].text as string;
expect(text).toContain('Book the dentist appointment');
expect(text).toContain('We will plan Sunday together after breakfast.');
expect(text).toContain(savedRecap.shortSummary);
expect(text).not.toContain('AI-invented task');
expect(text).not.toContain('AI rewrite: plan Sunday only if convenient.');
```

- [ ] **Step 3: Run the focused test to demonstrate the existing regression**

Run:

```powershell
npm test -- MeetingRecapPages.test.ts
```

Expected: the new display/share assertions fail because the current view model
prefers nonempty `aiSummary.tasks` and `aiSummary.agreements`.

- [ ] **Step 4: Retain existing allowance/read-access coverage**

Keep the existing test proving a saved AI narrative remains readable and
shareable after allowance exhaustion. Do not make the new canonical-content
test depend on generation entitlement or a premium feature flag.

### Task 2: Make the recap view model canonical-only for commitments

**Files:**

- Modify: `src/pages/MeetingSummaryPage.vue`
- Test: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes: `Meeting.sections`, where each section owns canonical `tasks` and
  `agreements`; optional `Meeting.aiSummary.shortSummary` remains the AI
  narrative input.
- Produces: `SummaryViewModel.keyDecisions` from canonical agreements and
  `SummaryViewModel.actionItems` from canonical open tasks. `getShareText()`
  continues to consume this shared view model.

- [ ] **Step 1: Replace AI-preferred task and agreement selection**

In `createSummaryViewModel`, remove the `summaryTasks` and `visibleTasks`
fallback/preference logic. Keep the existing canonical flattening and
open-task filtering, and pass those values directly into the view model:

```ts
const agreements = item.sections.flatMap((section) =>
  section.agreements.map((agreement) => agreement.text)
);
const tasks = item.sections
  .flatMap((section) => section.tasks)
  .filter(isOpenTask);

return {
  id: item.aiSummary?.id ?? item.id,
  title: getMeetingTemplateName(item.templateId, item.title),
  date: formatDate(getMeetingDate(item)),
  participants,
  aiInsight: item.aiSummary?.shortSummary ?? null,
  keyDecisions: agreements,
  actionItems: tasks.map((task, index) =>
    createActionItem(task, participants, index)
  ),
};
```

Do not read `item.aiSummary.agreements` or `item.aiSummary.tasks` anywhere in
this page. Do not modify `getShareText`; it already shares `keyDecisions` and
`actionItems` from the corrected view model, and places `aiInsight` in its own
disclaimed section.

- [ ] **Step 2: Run the focused regression suite**

Run:

```powershell
npm test -- MeetingRecapPages.test.ts
```

Expected: PASS. The new tests prove model omissions, inventions, and agreement
rewrites cannot replace canonical display or share text. Existing tests prove
the supplemental narrative still survives exhausted allowance state.

- [ ] **Step 3: Inspect the narrow diff for scope adherence**

Run:

```powershell
git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/pages/MeetingSummaryPage.vue src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: only canonical commitment projection and its focused regression
tests changed; no generated suggestion UI, mutation flow, entitlement logic,
or unrelated page behavior appears in the diff.

- [ ] **Step 4: Leave the implementation uncommitted**

Do not run `git add` or `git commit`. Report the changed files and test result
for user review; the project requires explicit authorization before committing.

### Task 3: Run project-level verification and perform the manual acceptance check

**Files:**

- Modify only if a failed check identifies a direct issue in:
  `src/pages/MeetingSummaryPage.vue` or
  `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes: the canonical-only view model from Task 2.
- Produces: validated mobile build/check output and a documented manual
  confirmation of the AI-09 acceptance criterion.

- [ ] **Step 1: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vue TypeScript checking and Vite production bundling succeed without
new template or type errors.

- [ ] **Step 2: Run project style and lint checks**

Run:

```powershell
npm run check
```

Expected: formatting and lint checks pass. If an existing baseline failure is
reported outside the two scoped files, record its exact path and message;
do not reformat or suppress unrelated work.

- [ ] **Step 3: Perform the manual acceptance scenario**

In a completed meeting, create one saved open task and one saved agreement,
then use an AI recap fixture/response whose `tasks` omits or invents a task and
whose `agreements` changes the saved wording. Confirm:

1. The Key decisions section shows the saved agreement, not the AI rewrite.
2. The Action items section shows the saved open task, not the AI task.
3. The AI card shows only the short narrative and the inaccuracy disclaimer.
4. Share text includes the saved task and agreement plus the supplemental
   narrative, and excludes the AI task/agreement arrays.

- [ ] **Step 4: Leave changes uncommitted and report verification**

Do not stage or commit. Report focused-test, build, and check results, state
whether manual validation was performed, and note that no backend, provider,
database, deployment, or device mutation was needed for AI-09.

## Plan self-review

**Spec coverage:** Task 1 covers the required conflicting-output display and
share regressions. Task 2 makes meeting sections authoritative while preserving
the narrative/disclaimer boundary. Task 3 covers build, style, and the manual
AI-09 acceptance scenario. No AI suggestion application flow is included.

**Placeholder scan:** No incomplete tasks, deferred implementation markers, or
generic test instructions remain; every code/test action names concrete files,
values, commands, and expected outcomes.

**Type consistency:** The plan uses the existing `Meeting`, `MeetingTask`,
`MeetingSummary`, `MeetingSummaryTask`, `SummaryViewModel`, and
`createSummaryViewModel` contracts. It introduces no public interface, schema,
or persistence type.
