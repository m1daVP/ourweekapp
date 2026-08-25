# Premium Meeting Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch the existing five non-default meeting formats as a clear Premium template library without blocking an in-progress Premium meeting after expiry.

**Architecture:** Keep template definitions client-owned and preserve their IDs/sections. Update the Fastify sync validator with a narrow continuation exception for an existing same-template server meeting; update the Vue cards with localized outcome tags and correct Premium metadata.

**Tech Stack:** Node.js, Fastify, TypeScript, Vitest; Vue 3, Pinia, vue-i18n, Vue Router.

## Global Constraints

- The default `weekly-family-check-in` template remains Free.
- `couple-reset`, `family-with-kids`, `money-check-in`, `conflict-cleanup`, and `busy-week-planning` are Premium.
- Do not change existing template IDs, sections, prompts, or stored meeting data.
- Free clients may not create or duplicate new Premium-template meetings through sync.
- An existing non-deleted Premium-template draft remains resumable after expiry only when its template ID is unchanged.
- Completed Premium-format meetings remain readable after expiry.
- Keep the existing mobile card layout; tags must be localized, short, and outcome-oriented.
- Do not stage or commit without explicit user authorization.

---

### Task 1: Enforce new-Premium vs existing-draft template validation

**Files:**
- Modify: `src/modules/meetings/meetings.service.ts`
- Modify: `tests/meetings.service.test.ts`

**Interfaces:**
- Replace `validateTemplateId(meeting, access)` with `validateTemplateAccess(meeting, serverMeeting, access): boolean`.
- A continuation is valid only when `serverMeeting` exists, is not deleted, and `serverMeeting.templateId === meeting.templateId`.

- [ ] **Step 1: Write failing service tests**

```ts
it('allows an expired workspace to update its existing Premium draft', async () => {
  repository.findMeetingByIdForWorkspace.mockResolvedValue(
    meeting({ id: 'premium-draft', templateId: 'couple-reset', status: 'draft' }),
  );

  const response = await service.syncMeetings(freeAuth, syncRequest([
    meeting({ id: 'premium-draft', templateId: 'couple-reset', status: 'in_progress' }),
  ]));

  expect(response.conflicts).toEqual([]);
});

it('rejects a new Free Premium-template meeting', async () => {
  repository.findMeetingByIdForWorkspace.mockResolvedValue(null);

  const response = await service.syncMeetings(freeAuth, syncRequest([
    meeting({ id: 'new-premium', templateId: 'couple-reset' }),
  ]));

  expect(response.conflicts).toEqual([
    expect.objectContaining({ resourceId: 'new-premium', reason: 'invalid_reference' }),
  ]);
});
```

Add tests for all five existing Premium IDs, Free default creation, Premium new creation, changed Free-to-Premium template ID rejection, and deleted Premium-row resurrection rejection.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- tests/meetings.service.test.ts`

Expected: FAIL because validation happens before the service looks up the server meeting.

- [ ] **Step 3: Implement narrow continuation validation**

Move template validation into `applyMeetingSync`, immediately after loading `serverMeeting`:

```ts
function canUseTemplate(input: {
  meeting: MeetingDto;
  serverMeeting: MeetingRepositoryDto | null;
  access: FeatureAccessMap;
}) {
  if (FREE_TEMPLATE_IDS.has(input.meeting.templateId)) return true;
  if (!PREMIUM_TEMPLATE_IDS.has(input.meeting.templateId)) return false;
  if (input.access.additionalTemplates.state === 'available') return true;
  return Boolean(
    input.serverMeeting &&
      !input.serverMeeting.deletedAt &&
      input.serverMeeting.templateId === input.meeting.templateId,
  );
}
```

Pass `access` into `applyMeetingSync`; reject invalid templates before insert/update, yielding the existing `invalid_reference` conflict shape.

- [ ] **Step 4: Verify server behavior**

Run: `npm test -- tests/meetings.service.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Review that continuation never bypasses `workspace_id`, deletion, revision-conflict, or role checks. Do not stage or commit.

### Task 2: Correct client template metadata and add localized outcome tags

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/meetingTemplates.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/components/TemplateCard.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Test: `D:/Projects/myself/weekly-us/src/features/meeting/**/__tests__/*` and a new TemplateCard test if none exists

**Interfaces:**
- Add `outcomeTagKeys: readonly string[]` to `MeetingTemplate`.
- Add `getMeetingTemplateOutcomeTags(templateId): string[]` returning translated tag text.

- [ ] **Step 1: Write failing metadata/component tests**

```ts
expect(getMeetingTemplate('couple-reset')).toMatchObject({
  access: 'premium',
  outcomeTagKeys: ['reconnect', 'clearNextStep'],
});
expect(wrapper.text()).toContain('Reconnect');
expect(wrapper.text()).toContain('Clear next step');
```

Cover the Free badge for the default template, a locked Premium card, and all ten approved Premium tags.

- [ ] **Step 2: Run the focused client test**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting`

Expected: FAIL because templates have no tags and the five formats are temporarily Free.

- [ ] **Step 3: Implement metadata and card rendering**

Set all five existing non-default templates to `access: 'premium'`. Add localized tag arrays using these exact keys:

```ts
coupleReset: ['reconnect', 'clearNextStep'],
familyWithKids: ['smootherRoutines', 'shareTheLoad'],
moneyCheckIn: ['makeMoneyDecision', 'planAhead'],
conflictCleanup: ['talkItThrough', 'agreeWhatChanges'],
busyWeekPlanning: ['makeWeekWorkable', 'backupPlan'],
```

Render tags in `TemplateCard` below the short description as a compact semantic list. Do not expose full section previews beyond the existing selected-card behavior.

- [ ] **Step 4: Verify client metadata**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/features/meeting && npm run build`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Review the cards at narrow mobile width and ensure tags wrap without hiding the locked state. Do not stage or commit.

### Task 3: Align template selection, expiry copy, and Premium presentation

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingTemplatesPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/subscriptionPlans.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/UpgradePage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Test: existing template-page, subscription, and router tests; add focused page tests if absent

**Interfaces:**
- `selectedTemplateLocked` stays based on `additionalTemplates`.
- `activeDraft` Resume remains available before card lock/CTA decisions.

- [ ] **Step 1: Write failing selection/expiry tests**

```ts
expect(getByRole('button', { name: /get premium/i })).toBeVisible();
await user.click(getByRole('button', { name: /get premium/i }));
expect(push).toHaveBeenCalledWith({
  name: 'upgrade', query: { lockedFeature: 'additionalTemplates' },
});

expect(getByRole('button', { name: /resume/i })).toBeVisible();
expect(getByText(/finish the meeting you already started/i)).toBeVisible();
```

Cover owner vs adult-member messaging, viewer non-creation behavior, and default-template start behavior.

- [ ] **Step 2: Run focused client tests**

Run from `D:/Projects/myself/weekly-us`: `npm test -- src/pages src/features/subscription`

Expected: FAIL until the outcome-led copy and expiry explanation exist.

- [ ] **Step 3: Implement outcome-led copy**

Keep the current selection flow and fixed CTA. Add concise localized wording that describes Premium templates as guided formats for a household situation, not “extra forms.” When `activeDraft` is Premium and entitlement is unavailable, show the existing Resume control plus the message “Finish the meeting you already started”; do not block it or redirect it to Upgrade. Update the Premium benefit label to “Guided meeting formats” and retain the owner-managed household-plan language.

- [ ] **Step 4: Run release checks**

Run from `D:/Projects/myself/weekly-us`:

```bash
npm test
npm run check
npm run build
```

Run from `D:/Projects/myself/weekly-us-api`:

```bash
npm run typecheck
npm test -- tests/meetings.service.test.ts
```

Expected: PASS. Note pre-existing Vite warnings only if they recur.

- [ ] **Step 5: Checkpoint**

Deploy API first, then client. Manually verify all six formats for Free owner/adult/viewer and Premium owner/adult/viewer, including expired Premium-draft resume. Do not stage or commit.
