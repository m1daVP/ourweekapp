# Household Name Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename a household from the Settings household card in a focused bottom drawer instead of navigating to the workspace members page.

**Architecture:** Keep the interaction local to `HouseholdMembersSettings.vue`. The component owns the open state, editable draft, and field-level validation, while `useWorkspaceStore().saveWorkspaceName(name)` remains the sole persistence and backend boundary. `BaseBottomSheet` supplies dismissal, Android-back handling, focus trapping, and focus restoration.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, existing CSS tokens.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">`, typed local UI state, and semantic `<button>` elements.
- Keep this mobile-only flow in a `BaseBottomSheet`; do not add a dependency or alter workspace member management.
- Use translation keys for all added user-visible copy in English, Ukrainian, and Spanish.
- Preserve `workspaceStore.saveWorkspaceName(name)` as the only save path and surface its friendly error without raw technical details.
- Saving whitespace-only input must not call the store; Android back, scrim, and Cancel must discard the draft.
- Do not stage or commit changes unless the user explicitly requests a commit.
- Before handoff, run `npm run build` and `npm run check`.

---

### Task 1: Add localized rename copy

**Files:**

- Modify: `src/features/localization/messages.ts:546-549`, `1955-1958`, `3401-3404`
- Test: `src/features/localization/messages.ts` through TypeScript compilation

**Interfaces:**

- Consumes: `t(key)` from vue-i18n.
- Produces: `settings.editHouseholdName` and `settings.addHouseholdName` in every locale.

- [ ] **Step 1: Add the two English keys beside the existing household labels**

```ts
householdName: 'Household name',
members: 'Members',
editHouseholdName: 'Edit household name',
addHouseholdName: 'Enter a household name.',
```

- [ ] **Step 2: Add the matching Ukrainian keys in the same `settings` object**

```ts
householdName: 'Назва дому',
members: 'Учасники',
editHouseholdName: 'Редагувати назву дому',
addHouseholdName: 'Введіть назву дому.',
```

- [ ] **Step 3: Add the matching Spanish keys in the same `settings` object**

```ts
householdName: 'Nombre del hogar',
members: 'Miembros',
editHouseholdName: 'Editar el nombre del hogar',
addHouseholdName: 'Escribe un nombre para el hogar.',
```

- [ ] **Step 4: Verify translation typing compiles**

Run: `npm run build`

Expected: PASS; all three locale objects still conform to the inferred message schema.

### Task 2: Replace the navigation edit affordance with a rename drawer

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:1-18`, `57-68`, `250-272`, `323-401`
- Modify: `src/styles/main.css:1901-1909`
- Test: manual mobile verification of `HouseholdMembersSettings.vue` because the repository has no Vue component-test renderer installed

**Interfaces:**

- Consumes: `workspaceStore.workspace.name`, `workspaceStore.isSaving`, `workspaceStore.errorMessage`, and `async workspaceStore.saveWorkspaceName(name: string): Promise<boolean>`.
- Consumes: `BaseBottomSheet` API: `open: boolean`, `title?: string`, and `@close`.
- Produces: a local `isHouseholdNameSheetOpen` ref, `householdNameDraft` ref, `householdNameError` ref, and `saveHouseholdName()` submit handler.

- [ ] **Step 1: Replace the `RouterLink` with a semantic button and open handler**

```vue
<button
  class="household-settings-edit"
  type="button"
  :aria-label="t('settings.editHouseholdName')"
  @click="openHouseholdNameSheet"
>
  <span class="material-symbols-outlined" aria-hidden="true">edit</span>
</button>
```

- [ ] **Step 2: Add focused local rename state and drawer functions**

```ts
const isHouseholdNameSheetOpen = ref(false);
const householdNameDraft = ref('');
const householdNameError = ref('');

function openHouseholdNameSheet() {
  householdNameDraft.value = workspaceStore.workspace.name;
  householdNameError.value = '';
  isHouseholdNameSheetOpen.value = true;
}

function closeHouseholdNameSheet() {
  isHouseholdNameSheetOpen.value = false;
  householdNameError.value = '';
}

async function saveHouseholdName() {
  if (!householdNameDraft.value.trim()) {
    householdNameError.value = t('settings.addHouseholdName');
    return;
  }

  const saved = await workspaceStore.saveWorkspaceName(
    householdNameDraft.value
  );

  if (!saved) {
    householdNameError.value = workspaceStore.errorMessage;
    return;
  }

  closeHouseholdNameSheet();
}
```

- [ ] **Step 3: Add the one-field `BaseBottomSheet` form below the existing participant sheet**

```vue
<BaseBottomSheet
  :open="isHouseholdNameSheetOpen"
  :title="t('settings.householdName')"
  @close="closeHouseholdNameSheet"
>
  <form class="task-editor-form" @submit.prevent="saveHouseholdName">
    <label>
      <span>{{ t('settings.householdName') }}</span>
      <input
        v-model="householdNameDraft"
        autocomplete="organization"
        type="text"
        :aria-invalid="Boolean(householdNameError)"
        :aria-describedby="
          householdNameError ? 'household-name-error' : undefined
        "
      />
    </label>
    <p v-if="householdNameError" id="household-name-error" class="meeting-error" role="alert">
      {{ householdNameError }}
    </p>
    <div class="participant-sheet-form__actions">
      <button class="meeting-primary" type="submit" :disabled="workspaceStore.isSaving">
        {{ t('common.save') }}
      </button>
      <button class="secondary-button" type="button" :disabled="workspaceStore.isSaving" @click="closeHouseholdNameSheet">
        {{ t('common.cancel') }}
      </button>
    </div>
  </form>
</BaseBottomSheet>
```

- [ ] **Step 4: Make the existing edit-button CSS explicitly button-safe**

```css
.household-settings-edit {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
}
```

- [ ] **Step 5: Run format, build, and static checks**

Run: `npm run format; npm run build; npm run check`

Expected: PASS; formatting, Vue type checking, Vite production build, and ESLint all succeed.

- [ ] **Step 6: Manually verify the mobile interaction**

1. Open Settings and tap the household-name edit icon: the current Settings page remains visible behind a bottom drawer; the workspace members route does not open.
2. Confirm the drawer is pre-filled. Change the name, save, and verify the Settings card updates after a successful response.
3. Enter only spaces and save: the drawer stays open, an accessible name-required error appears, and no request is sent.
4. Simulate a failed save or disconnect the configured API: the drawer stays open, the old name remains in the card, and the store's friendly error appears.
5. Reopen and dismiss using Cancel, scrim, and Android back: no edit persists; focus returns to the edit icon.
