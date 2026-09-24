# Saved Meeting Summary Redesign Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a review checkpoint after each task. Do not create Git commits unless the user separately requests them.

**Goal:** Redesign the complete saved-meeting details page with shared section-item cards, a distinct final-agreements card, summary-style AI presentation, and explicit unlocked/locked export states.

**Architecture:** Keep `MeetingDetailsPage.vue` as the route and action owner. Add a pure presentation mapper plus focused saved-section and export components; both regular and final sections consume the same normalized item rows so their saved items cannot visually diverge. Existing AI, export, entitlement, persistence, and route services remain authoritative.

**Tech Stack:** Vue 3.5 Composition API, TypeScript 6, Pinia 4, Vue Router 5, vue-i18n 11, Vitest 4, scoped CSS using the existing design tokens.

## Global Constraints

- Mobile-only, Android-first, and iOS-ready; support safe areas and narrow widths.
- Use Vue 3 `<script setup lang="ts">`, typed props/emits, semantic HTML, and 44 px minimum touch targets.
- Use npm only and add no dependencies.
- Keep all new user-facing copy in English, Ukrainian, and Spanish locale catalogues.
- Preserve current meeting, AI recap, export, subscription, and persistence behavior.
- Do not unlock Premium from frontend state or add mock Premium behavior.
- Do not include private notes in export or alter export file content.
- Do not add editing, deletion, or completion controls to the saved record.
- Do not merge `/meeting/:meetingId` and `/meeting-summary/:meetingId`.
- Do not commit unless the user explicitly requests it.

---

## File Map

- Create `src/features/meeting/savedMeetingSummary.ts`: normalize saved meeting sections into display-only section/group/row view models and split the final section from regular sections.
- Create `src/features/meeting/__tests__/savedMeetingSummary.test.ts`: verify section splitting, status derivation, row normalization, and omission of empty groups.
- Create `src/features/meeting/components/SavedMeetingItemGroup.vue`: render the shared bordered group and rows used by every section variant.
- Create `src/features/meeting/components/SavedMeetingSectionCard.vue`: render regular and final card shells around the shared item groups.
- Create `src/features/meeting/components/SavedMeetingExportCard.vue`: render explicit unlocked and locked export presentations, including inline format and action controls for Premium.
- Create `src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts`: verify regular/final shells and identical row treatment.
- Create `src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts`: verify unlocked action and locked Premium prompt.
- Modify `src/pages/MeetingDetailsPage.vue`: compose the redesigned page and retain route-level AI/export actions.
- Modify `src/pages/__tests__/MeetingRecapPages.test.ts`: verify page integration, Premium state, AI behavior, final-section separation, and draft/missing states.
- Modify `src/features/localization/messages.ts`: add saved-summary labels in all supported locales.

---

### Task 1: Build and test the saved-section presentation model

**Files:**

- Create: `src/features/meeting/savedMeetingSummary.ts`
- Create: `src/features/meeting/__tests__/savedMeetingSummary.test.ts`

**Interfaces:**

- Consumes: `MeetingSection`, `MeetingTask`, and `MeetingSectionId` from `src/features/meeting/types.ts`.
- Produces:

```ts
export type SavedMeetingItemKind = 'notes' | 'tasks' | 'agreements';
export type SavedMeetingSectionStatus = 'filled' | 'empty';

export interface SavedMeetingItemRow {
  id: string;
  title: string;
  leadingMeta?: string;
  trailingMeta?: string;
  detail?: string;
  badge?: string;
}

export interface SavedMeetingItemGroup {
  kind: SavedMeetingItemKind;
  rows: SavedMeetingItemRow[];
}

export interface SavedMeetingSectionViewModel {
  id: MeetingSectionId;
  title: string;
  prompt: string;
  status: SavedMeetingSectionStatus;
  groups: SavedMeetingItemGroup[];
}

export interface SavedMeetingFormatters {
  formatNoteDate: (value: string) => string;
  getParticipantName: (participantId?: string) => string;
  getTaskStatusLabel: (status: MeetingTask['status']) => string;
  getTaskResponsibleLabel: (task: MeetingTask) => string;
  formatDueDate: (value: string) => string;
}

export function hasSavedSectionContent(section: MeetingSection): boolean;
export function splitSavedMeetingSections(sections: MeetingSection[]): {
  regularSections: MeetingSection[];
  finalSection: MeetingSection | null;
};
export function createSavedMeetingSectionViewModel(
  section: MeetingSection,
  formatters: SavedMeetingFormatters
): SavedMeetingSectionViewModel;
```

- [ ] **Step 1: Write failing presentation-model tests**

Cover these exact cases:

```ts
const formatters: SavedMeetingFormatters = {
  formatNoteDate: () => 'Sep 16, 19:04',
  getParticipantName: (participantId) =>
    participantId === 'participant-rita' ? 'Rita' : 'Shared',
  getTaskStatusLabel: () => 'Open',
  getTaskResponsibleLabel: () => 'Needs discussion',
  formatDueDate: () => 'Sep 20',
};

function sectionFixture(id: MeetingSectionId): MeetingSection {
  return {
    id,
    title: id,
    prompt: `${id} prompt`,
    notes: [],
    tasks: [],
    agreements: [],
  };
}

function noteFixture(): MeetingNote {
  return {
    id: 'note-1',
    sectionId: 'finalAgreements',
    participantId: 'participant-rita',
    text: 'A saved note',
    createdAt: '2026-09-16T17:04:00.000Z',
  };
}

function taskFixture(): MeetingTask {
  return {
    id: 'task-1',
    sectionId: 'finalAgreements',
    title: 'Book the appointment',
    responsibilityType: 'needsDiscussion',
    responsibleParticipantIds: [],
    status: 'open',
    createdAt: '2026-09-16T17:04:00.000Z',
    updatedAt: '2026-09-16T17:04:00.000Z',
  };
}

it('separates final agreements from regular sections without changing order', () => {
  const result = splitSavedMeetingSections([
    sectionFixture('goodThings'),
    sectionFixture('finalAgreements'),
    sectionFixture('plans'),
  ]);

  expect(result.regularSections.map((section) => section.id)).toEqual([
    'goodThings',
    'plans',
  ]);
  expect(result.finalSection?.id).toBe('finalAgreements');
});

it('returns no final card when the template has no final agreements section', () => {
  const result = splitSavedMeetingSections([sectionFixture('goodThings')]);
  expect(result.finalSection).toBeNull();
});

it('marks an empty section empty and emits no item groups', () => {
  const viewModel = createSavedMeetingSectionViewModel(
    sectionFixture('goodThings'),
    formatters
  );
  expect(viewModel.status).toBe('empty');
  expect(viewModel.groups).toEqual([]);
});

it('normalizes notes, tasks, and agreements and omits empty categories', () => {
  const section = sectionFixture('finalAgreements');
  section.notes.push(noteFixture());
  section.tasks.push(taskFixture());

  const viewModel = createSavedMeetingSectionViewModel(section, formatters);

  expect(viewModel.status).toBe('filled');
  expect(viewModel.groups.map((group) => group.kind)).toEqual([
    'notes',
    'tasks',
  ]);
  expect(viewModel.groups[0]?.rows[0]).toMatchObject({
    leadingMeta: 'Rita',
    trailingMeta: 'Sep 16, 19:04',
    title: 'A saved note',
  });
  expect(viewModel.groups[1]?.rows[0]).toMatchObject({
    title: 'Book the appointment',
    badge: 'Open • Needs discussion',
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run:

```bash
npx vitest run src/features/meeting/__tests__/savedMeetingSummary.test.ts
```

Expected: FAIL with an unresolved `savedMeetingSummary` import.

- [ ] **Step 3: Implement the minimal pure mapper**

Use `finalAgreements` as the only special section ID. Preserve input order,
construct groups in Notes → Tasks → Agreements order, and omit groups with no
rows. Build task detail from description and a formatted due date without
inventing content:

```ts
const detailParts = [
  task.description?.trim(),
  task.dueDate ? formatters.formatDueDate(task.dueDate) : undefined,
].filter((value): value is string => Boolean(value));

return {
  id: task.id,
  title: task.title,
  detail: detailParts.length ? detailParts.join(' · ') : undefined,
  badge: `${formatters.getTaskStatusLabel(task.status)} • ${formatters.getTaskResponsibleLabel(task)}`,
};
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
npx vitest run src/features/meeting/__tests__/savedMeetingSummary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Confirm the mapper contains no Vue, store, locale, persistence, or entitlement
imports and makes no mutation to the input sections.

---

### Task 2: Add shared saved-item and section-card components

**Files:**

- Create: `src/features/meeting/components/SavedMeetingItemGroup.vue`
- Create: `src/features/meeting/components/SavedMeetingSectionCard.vue`
- Create: `src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts`

**Interfaces:**

- `SavedMeetingItemGroup.vue` consumes `group: SavedMeetingItemGroup`.
- `SavedMeetingSectionCard.vue` consumes:

```ts
defineProps<{
  section: SavedMeetingSectionViewModel;
  variant: 'regular' | 'final';
}>();
```

- Neither component emits events; the saved record is read-only.

- [ ] **Step 1: Write failing component tests**

Mount the card with one row of every kind and assert:

```ts
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      meeting: {
        notes: 'Notes',
        tasks: 'Tasks',
        agreements: 'Agreements',
        savedSummary: {
          filled: 'Filled',
          empty: 'Empty',
          sectionEmpty: 'No entries were saved in this section.',
        },
      },
    },
  },
});

const filledSection: SavedMeetingSectionViewModel = {
  id: 'finalAgreements',
  title: 'Final agreements',
  prompt: 'What should we agree before finishing?',
  status: 'filled',
  groups: [
    {
      kind: 'notes',
      rows: [
        {
          id: 'note-1',
          leadingMeta: 'Rita',
          trailingMeta: 'Sep 16, 19:04',
          title: 'A saved note',
        },
      ],
    },
    {
      kind: 'tasks',
      rows: [
        {
          id: 'task-1',
          title: 'Book the appointment',
          badge: 'Open • Needs discussion',
        },
      ],
    },
    {
      kind: 'agreements',
      rows: [
        {
          id: 'agreement-1',
          leadingMeta: 'Vadym, Rita',
          title: 'Plan Sunday together',
        },
      ],
    },
  ],
};

function render(
  section: SavedMeetingSectionViewModel,
  variant: 'regular' | 'final'
) {
  return mount(SavedMeetingSectionCard, {
    props: { section, variant },
    global: { plugins: [i18n] },
  });
}

const wrapper = render(filledSection, 'regular');
expect(wrapper.get('[data-section-variant="regular"]').exists()).toBe(true);
expect(wrapper.get('[data-section-status="filled"]').text()).toBe('Filled');
expect(wrapper.findAll('.saved-meeting-item-row')).toHaveLength(3);
expect(wrapper.text()).toContain('Rita');
expect(wrapper.text()).toContain('Sep 16, 19:04');
expect(wrapper.text()).toContain('Open • Needs discussion');
```

Mount the same view model with `variant="final"` and assert the same
`.saved-meeting-item-row` selector and group markup are used. Mount an empty
view model and assert it shows one translated empty message and no group.

- [ ] **Step 2: Run the component test and confirm it fails because the components do not exist**

Run:

```bash
npx vitest run src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts
```

Expected: FAIL with unresolved component imports.

- [ ] **Step 3: Implement `SavedMeetingItemGroup.vue`**

Use a semantic heading and list. Map the group label with stable i18n keys:

```ts
const labelKey = computed(
  () =>
    ({
      notes: 'meeting.notes',
      tasks: 'meeting.tasks',
      agreements: 'meeting.agreements',
    })[props.group.kind]
);
```

Each row renders optional leading/trailing metadata in one wrapping metadata
line, the title below it, optional detail, and an optional trailing status pill.
The DOM class `.saved-meeting-item-row` must be identical for regular and final
cards.

- [ ] **Step 4: Implement `SavedMeetingSectionCard.vue`**

The header contains title/prompt and a status pill. Render groups through
`SavedMeetingItemGroup`; render one `meeting.savedSummary.sectionEmpty` message
when `section.groups` is empty:

```vue
<article
  :class="[
    'saved-meeting-section-card',
    `saved-meeting-section-card--${variant}`,
  ]"
  :data-section-variant="variant"
>
  <header class="saved-meeting-section-card__header">
    <div>
      <h2>{{ section.title }}</h2>
      <p>{{ section.prompt }}</p>
    </div>
    <span
      class="saved-meeting-section-card__status"
      :data-section-status="section.status"
    >
      {{ t(`meeting.savedSummary.${section.status}`) }}
    </span>
  </header>
  <div v-if="section.groups.length" class="saved-meeting-section-card__groups">
    <SavedMeetingItemGroup
      v-for="group in section.groups"
      :key="group.kind"
      :group="group"
    />
  </div>
  <p v-else class="saved-meeting-section-card__empty">
    {{ t('meeting.savedSummary.sectionEmpty') }}
  </p>
</article>
```

Use scoped styles for the approved rounded white card, warm border, restrained
shadow, serif title, muted prompt, compact filled/empty pills, inset group,
dividers, wrapping metadata, and the larger final-card spacing. At `360px` and
below, allow the task badge to occupy its own row.

- [ ] **Step 5: Add the required locale keys in all three catalogues**

**Files:**

- Modify: `src/features/localization/messages.ts`

Add under each `meeting` object:

```ts
savedSummary: {
  sectionsTitle: 'Meeting sections',
  sectionCount: '{count} sections',
  filled: 'Filled',
  empty: 'Empty',
  sectionEmpty: 'No entries were saved in this section.',
},
```

Ukrainian:

```ts
savedSummary: {
  sectionsTitle: 'Розділи зустрічі',
  sectionCount: '{count} розділів',
  filled: 'Заповнено',
  empty: 'Порожньо',
  sectionEmpty: 'У цьому розділі немає збережених записів.',
},
```

Spanish:

```ts
savedSummary: {
  sectionsTitle: 'Secciones de la reunión',
  sectionCount: '{count} secciones',
  filled: 'Completa',
  empty: 'Vacía',
  sectionEmpty: 'No se guardaron entradas en esta sección.',
},
```

- [ ] **Step 6: Run component and localization tests**

Run:

```bash
npx vitest run src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts src/features/localization/__tests__
```

Expected: PASS. If the localization test directory is not accepted as a Vitest
filter, run `npx vitest run src/features/localization` instead.

- [ ] **Step 7: Review checkpoint**

Inspect both variants at 320 px and 412 px widths. Confirm item rows share one
component, text wraps without horizontal scrolling, and color is not the only
status signal.

---

### Task 3: Add explicit unlocked and locked export presentations

**Files:**

- Create: `src/features/meeting/components/SavedMeetingExportCard.vue`
- Create: `src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts`

**Interfaces:**

```ts
defineProps<{
  available: boolean;
  format: MeetingExportFormat;
  exporting: boolean;
}>();

defineEmits<{
  'update:format': [format: MeetingExportFormat];
  copy: [];
  share: [];
  pdf: [];
}>();
```

- The unlocked branch displays format selection and emits the existing export
  actions directly from the card.
- The locked state uses `UpgradePrompt` with `feature="export"`,
  `meeting.exportPremiumTitle`, and `meeting.exportPremiumMessage`.

- [ ] **Step 1: Write failing export-card tests**

```ts
it('shows inline format and export actions for an unlocked account', async () => {
  const wrapper = render({
    available: true,
    format: 'text',
    exporting: false,
  });
  await wrapper.get('[data-testid="saved-export-copy"]').trigger('click');
  expect(wrapper.emitted('copy')).toHaveLength(1);
  expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
  expect(wrapper.find('.upgrade-prompt').exists()).toBe(false);
});

it('shows the Premium prompt without inactive format controls when locked', () => {
  const wrapper = render({
    available: false,
    format: 'text',
    exporting: false,
  });
  expect(wrapper.get('.upgrade-prompt').exists()).toBe(true);
  expect(wrapper.text()).toContain('Export is premium');
  expect(wrapper.find('[data-testid="saved-export-copy"]').exists()).toBe(
    false
  );
  expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
});
```

Use a focused `UpgradePrompt` stub for the component unit test; preserve one
page-level integration assertion for the real upgrade action in Task 4.

The test helper uses this complete minimal catalogue and typed prop baseline:

```ts
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      common: {
        copy: 'Copy',
        shareOrSave: 'Share or save',
        pdf: 'PDF',
        markdown: 'Markdown',
      },
      meeting: {
        exportMeeting: 'Export meeting',
        exportHelp: 'Save a clean copy. Private notes are not included.',
        exportPremiumTitle: 'Export is premium',
        exportPremiumMessage: 'Upgrade to export this meeting.',
        format: 'Format',
        plainText: 'Plain text',
        plainTextHelp: 'Best for messages and notes.',
        markdownHelp: 'Best for Markdown apps.',
      },
    },
  },
});

function render(
  overrides: Partial<InstanceType<typeof SavedMeetingExportCard>['$props']>
) {
  return mount(SavedMeetingExportCard, {
    props: {
      available: true,
      format: 'text',
      exporting: false,
      ...overrides,
    },
    global: {
      plugins: [i18n],
      stubs: {
        UpgradePrompt: {
          template: '<div class="upgrade-prompt">Export is premium</div>',
        },
      },
    },
  });
}
```

- [ ] **Step 2: Run the focused test and confirm it fails because the component does not exist**

Run:

```bash
npx vitest run src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts
```

Expected: FAIL with an unresolved component import.

- [ ] **Step 3: Implement the two-state export card**

The unlocked branch is a rounded card with icon, title, help copy, the existing
plain-text/Markdown choice, and Copy, Share or save, and PDF actions. The locked
branch uses the same outer card class but renders the Premium prompt instead of
format or action controls:

```vue
<section
  :class="['saved-meeting-export-card', { 'is-locked': !available }]"
  :aria-labelledby="titleId"
>
  <template v-if="available">
    <div class="saved-meeting-export-card__copy">
      <span class="material-symbols-outlined" aria-hidden="true">ios_share</span>
      <div>
        <h2 :id="titleId">{{ t('meeting.exportMeeting') }}</h2>
        <p>{{ t('meeting.exportHelp') }}</p>
      </div>
    </div>
    <fieldset class="saved-meeting-export-card__formats">
      <legend>{{ t('meeting.format') }}</legend>
      <label v-for="option in formatOptions" :key="option.value">
        <input
          :checked="format === option.value"
          type="radio"
          name="saved-meeting-export-format"
          :value="option.value"
          @change="emit('update:format', option.value)"
        />
        <span>
          <strong>{{ option.label }}</strong>
          <small>{{ option.help }}</small>
        </span>
      </label>
    </fieldset>
    <div class="saved-meeting-export-card__actions">
      <button
        data-testid="saved-export-copy"
        class="meeting-primary"
        type="button"
        :disabled="exporting"
        @click="emit('copy')"
      >
        {{ t('common.copy') }}
      </button>
      <button type="button" :disabled="exporting" @click="emit('share')">
        {{ t('common.shareOrSave') }}
      </button>
      <button type="button" :disabled="exporting" @click="emit('pdf')">
        {{ t('common.pdf') }}
      </button>
    </div>
  </template>
  <UpgradePrompt
    v-else
    feature="export"
    :title="t('meeting.exportPremiumTitle')"
    :message="t('meeting.exportPremiumMessage')"
  />
</section>
```

Generate `titleId` with `useId()` so repeated test mounts and accessibility
associations remain safe. Define typed `formatOptions` from
`MeetingExportFormat` and existing translation keys; do not duplicate file
generation in this component.

- [ ] **Step 4: Run the focused export-card test**

Run:

```bash
npx vitest run src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Confirm locked markup contains no active or disabled export controls, unlocked
format labels are fully tappable, and the eligible owner upgrade button retains
a 44 px target through `UpgradePrompt`.

---

### Task 4: Compose the redesigned saved-meeting page

**Files:**

- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes the Task 1 mapper and all three Task 2/3 components.
- Preserves existing `copySelectedExport`, `shareOrSaveSelectedExport`,
  `printPdfExport`, `generateSummary`, `resumeDraft`, and low-content
  confirmation functions.
- Adds computed `regularSectionCards`, `finalSectionCard`,
  `visibleParticipants`, and `hiddenParticipantCount` presentation values.

- [ ] **Step 1: Add failing page-integration tests**

Extend the details-page branch with these assertions:

```ts
function finalAgreementsSectionFixture(): MeetingSection {
  return {
    id: 'finalAgreements',
    title: 'Final agreements',
    prompt: 'What should we agree before finishing?',
    notes: [],
    tasks: [],
    agreements: [],
  };
}

it('renders regular sections separately from final agreements', () => {
  const meeting = context.meetings.meetings[0]!;
  meeting.sections.push(finalAgreementsSectionFixture());
  render();

  expect(wrapper.findAll('[data-section-variant="regular"]')).toHaveLength(
    meeting.sections.length - 1
  );
  expect(wrapper.findAll('[data-section-variant="final"]')).toHaveLength(1);
  expect(wrapper.get('[data-testid="saved-section-count"]').text()).toContain(
    String(meeting.sections.length - 1)
  );
});

it('shows the unlocked export card for Premium export access', () => {
  context.subscription.currentPlan = 'premium';
  context.subscription.featureAccess = createLegacyFeatureAccessMap({
    planType: 'premium',
  });
  render();
  expect(wrapper.get('[data-testid="saved-export-copy"]').exists()).toBe(true);
  expect(
    wrapper.findAll('.saved-meeting-export-card input[type="radio"]')
  ).toHaveLength(2);
  expect(wrapper.find('.saved-meeting-export-card.is-locked').exists()).toBe(
    false
  );
});

it('shows the locked export card and upgrade action for Free access', () => {
  render();
  expect(wrapper.get('.saved-meeting-export-card.is-locked').exists()).toBe(
    true
  );
  expect(wrapper.find('[data-testid="saved-export-copy"]').exists()).toBe(
    false
  );
  expect(
    wrapper.find('.saved-meeting-export-card input[type="radio"]').exists()
  ).toBe(false);
  expect(wrapper.get('.upgrade-prompt .secondary-button').exists()).toBe(true);
  expect(wrapper.text()).toContain('Export is premium');
});
```

Retain existing shared AI tests. Add a draft assertion that Resume remains
visible and a no-final-section assertion that no final card is invented.

- [ ] **Step 2: Run the page test and confirm the new assertions fail**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: FAIL because the new card selectors and page composition are absent.

- [ ] **Step 3: Add computed page presentation data**

Use the pure mapper without persisting derived state:

```ts
const savedSections = computed(() =>
  splitSavedMeetingSections(meeting.value?.sections ?? [])
);

const savedSectionFormatters = computed<SavedMeetingFormatters>(() => ({
  formatNoteDate: formatDateTime,
  getParticipantName,
  getTaskStatusLabel: (status) => getTaskStatusLabel(status),
  getTaskResponsibleLabel: (task) => getTaskResponsibleLabel(task),
  formatDueDate: (value) =>
    new Intl.DateTimeFormat(locale.value, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value)),
}));

const regularSectionCards = computed(() =>
  savedSections.value.regularSections.map((section) =>
    createSavedMeetingSectionViewModel(section, savedSectionFormatters.value)
  )
);

const finalSectionCard = computed(() =>
  savedSections.value.finalSection
    ? createSavedMeetingSectionViewModel(
        savedSections.value.finalSection,
        savedSectionFormatters.value
      )
    : null
);
```

Translate section titles and prompts before passing them to the mapper, or map
the returned `title` and `prompt` through the existing `sectionTitle` and
`sectionPrompt` helpers. Do not write translated strings back into the meeting.

- [ ] **Step 4: Replace the page template hierarchy**

Keep the missing-meeting state. For a found meeting, render:

1. A redesigned header with title/date/status/totals, participant avatar stack,
   and draft Resume button.
2. The current AI behavior inside a card that combines
   `.meeting-summary-ai-card` visual language with a page-specific
   `.saved-meeting-ai-card` class.
3. `SavedMeetingExportCard` with
   `:available="canUseFeature('export')"`, `v-model:format="exportFormat"`,
   `:exporting="isExporting"`, `@copy="copySelectedExport"`,
   `@share="shareOrSaveSelectedExport"`, and `@pdf="printPdfExport"`.
4. A heading row with `meeting.savedSummary.sectionsTitle` and
   `meeting.savedSummary.sectionCount`; add
   `data-testid="saved-section-count"` to the count.
5. One `SavedMeetingSectionCard variant="regular"` for every regular section.
6. One `SavedMeetingSectionCard variant="final"` only when
   `finalSectionCard` exists.
7. The existing low-content confirmation dialog unchanged in behavior.

Remove the old repeated per-section Notes/Tasks/Agreements template and the old
`PremiumLock` export preview. Remove the export modal, `isExportModalOpen`,
`openExportModal`, and `closeExportModal` because Premium export controls now
live in the redesigned unlocked card. Remove imports that become unused.

- [ ] **Step 5: Add page-scoped layout styles**

Use a scoped style block for header metadata, participant avatar stack, section
heading/count, vertical rhythm, and narrow-screen behavior. Reuse existing
tokens and existing summary classes; do not duplicate the full
`meeting-summary/:id` stylesheet. Ensure the page retains bottom safe-area
spacing.

- [ ] **Step 6: Run focused page and component tests**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingRecapPages.test.ts src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts src/features/meeting/__tests__/savedMeetingSummary.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run formatting if the touched files are not already compliant**

Run:

```bash
npx prettier --write src/pages/MeetingDetailsPage.vue src/pages/__tests__/MeetingRecapPages.test.ts src/features/meeting/savedMeetingSummary.ts src/features/meeting/__tests__/savedMeetingSummary.test.ts src/features/meeting/components/SavedMeetingItemGroup.vue src/features/meeting/components/SavedMeetingSectionCard.vue src/features/meeting/components/SavedMeetingExportCard.vue src/features/meeting/components/__tests__/SavedMeetingSectionCard.test.ts src/features/meeting/components/__tests__/SavedMeetingExportCard.test.ts src/features/localization/messages.ts
```

Expected: all listed files format successfully.

- [ ] **Step 8: Run project verification**

Run:

```bash
npm run build
npm run check
```

Expected: both commands exit successfully.

- [ ] **Step 9: Perform mobile visual QA**

Inspect at 320 × 700, 360 × 800, and 412 × 915 in English and Ukrainian:

- header metadata and participant avatars wrap cleanly;
- the AI card matches the completed-summary visual family;
- Premium export shows the active card and Free export shows only the locked
  card with upgrade messaging;
- empty regular cards match the first approved reference;
- filled regular cards and final agreements share identical saved-item rows;
- the final card matches the larger grouped reference;
- long Ukrainian task badges wrap without clipping;
- inline export actions, draft Resume, AI generation/retry, and Android-safe
  bottom spacing remain functional.

- [ ] **Step 10: Final review checkpoint**

Inspect `git diff` only. Confirm no persistence, API, entitlement, export-file,
or unrelated page behavior changed and leave all work uncommitted unless the
user explicitly asks for commits.
