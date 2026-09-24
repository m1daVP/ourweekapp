# Participant Custom Color Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow people to pick and persist any participant avatar color from the add/edit participant bottom sheet, while retaining every existing preset swatch.

**Architecture:** Keep the change local to `HouseholdMembersSettings.vue`. The existing `participantDraft.avatarColor` remains the single source of truth: preset radio inputs and the native color input both update it, then the existing participant-store create/update paths persist it. Extend the existing global color-selector CSS with a visibly distinct custom-color trigger and readable selected hex value.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue I18n, Pinia, native HTML `<input type="color">`, CSS, Vitest verification, Vite.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">`, typed local UI state, and semantic controls.
- Keep all six existing `participantColors` preset values and their order unchanged.
- Add the custom option only to the add/edit participant sheet; do not change the participant data model or storage version.
- Use the native HTML color picker; do not add a dependency or create a custom color-wheel implementation.
- Keep the flow mobile-first, accessible, and compatible with Android WebView; expose the current hex value as text.
- Add new user-facing copy through vue-i18n in English, Ukrainian, and Spanish.
- Do not stage or commit changes unless the user explicitly requests a commit.
- Before handoff, run `npm run build` and `npm run check`.

---

### Task 1: Add localized custom-color labels

**Files:**

- Modify: `src/features/localization/messages.ts` in each locale's `settings` object.
- Test: `src/features/localization/messages.ts` through TypeScript compilation.

**Interfaces:**

- Consumes: `t(key)` from `useI18n()` in `HouseholdMembersSettings.vue`.
- Produces: `settings.customAvatarColor` and `settings.selectedAvatarColor` in every supported locale.

- [ ] **Step 1: Add the English `settings` labels beside `avatarColor`**

```ts
avatarColor: 'Avatar color',
customAvatarColor: 'Choose a custom avatar color',
selectedAvatarColor: 'Selected color: {color}',
```

- [ ] **Step 2: Add matching Ukrainian labels to the Ukrainian `settings` object**

```ts
customAvatarColor: 'Вибрати власний колір аватара',
selectedAvatarColor: 'Вибраний колір: {color}',
```

- [ ] **Step 3: Add matching Spanish labels to the Spanish `settings` object**

```ts
customAvatarColor: 'Elegir un color de avatar personalizado',
selectedAvatarColor: 'Color seleccionado: {color}',
```

- [ ] **Step 4: Verify locale-object typing**

Run: `npm run build`

Expected: PASS; all locale objects remain compatible with the inferred message schema.

### Task 2: Connect the native picker to the participant color draft

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:1-10`, `37-44`, `713-727`.
- Test: manual component verification; this repository's Vitest configuration uses the Node environment and has no Vue component-test renderer installed.

**Interfaces:**

- Consumes: `participantColors: string[]`, `participantDraft.avatarColor: string`, and the existing `createParticipant` / `updateParticipant` payloads.
- Produces: `customAvatarColorInput` element ref, `isCustomAvatarColor` computed state, `openCustomAvatarColorPicker()` and `setCustomAvatarColor(event: Event)` handlers.

- [ ] **Step 1: Add the custom-selection state and event handler in the component script**

```ts
const customAvatarColorInput = ref<HTMLInputElement | null>(null);
const isCustomAvatarColor = computed(
  () => !participantColors.includes(participantDraft.avatarColor)
);

function openCustomAvatarColorPicker() {
  customAvatarColorInput.value?.click();
}

function setCustomAvatarColor(event: Event) {
  const input = event.target as HTMLInputElement;

  if (input.value) {
    participantDraft.avatarColor = input.value.toUpperCase();
  }
}
```

- [ ] **Step 2: Preserve the existing preset radio loop and append the custom control**

```vue
<label v-for="color in participantColors" :key="color">
  <input v-model="participantDraft.avatarColor" type="radio" :value="color" />
  <span :style="{ backgroundColor: color }" />
</label>

<div class="color-selector__custom">
  <input
    ref="customAvatarColorInput"
    class="color-selector__native-input"
    :value="participantDraft.avatarColor"
    tabindex="-1"
    type="color"
    aria-hidden="true"
    @input="setCustomAvatarColor"
  />
  <button
    class="color-selector__custom-trigger"
    type="button"
    :class="{ 'is-selected': isCustomAvatarColor }"
    :aria-label="t('settings.customAvatarColor')"
    @click="openCustomAvatarColorPicker"
  >
    <span aria-hidden="true" />
  </button>
</div>
<output class="color-selector__selected-value" aria-live="polite">
  {{ t('settings.selectedAvatarColor', { color: participantDraft.avatarColor }) }}
</output>
```

- [ ] **Step 3: Confirm the existing open/reset code gives the custom control correct state**

Keep `resetDraftForCreate()` assigning a preset. Keep `openEditSheet()` assigning `participant.avatarColor` directly. Do not add a separate custom-color field; the computed state must recognize an existing non-preset saved color.

- [ ] **Step 4: Run the production build after the component change**

Run: `npm run build`

Expected: PASS; Vue's template type check recognizes the new event handler and computed value.

### Task 3: Style the multicolor trigger and selected value for touch and focus

**Files:**

- Modify: `src/styles/main.css:1739-1781`, `2683-2691`.
- Test: manual mobile verification in the participant bottom sheet.

**Interfaces:**

- Consumes: `.color-selector`, `.participant-sheet-form .color-selector`, `.color-selector__native-input`, `.color-selector__custom-trigger`, and `.color-selector__selected-value` markup from Task 2.
- Produces: a 38px multicolor circle with visible focus/selected treatment and a full-width readable hex label.

- [ ] **Step 1: Add the custom-trigger layout and multicolor circle styles**

```css
.color-selector__custom {
  position: relative;
  width: 38px;
  height: 38px;
}

.color-selector__native-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.color-selector__custom-trigger {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  cursor: pointer;
}

.color-selector__custom-trigger span {
  display: block;
  width: 100%;
  height: 100%;
  border: 2px solid transparent;
  border-radius: var(--radius-pill);
  background: conic-gradient(
    #ea5c5c,
    #e4cf4a,
    #6ead63,
    #42a8b7,
    #6366c8,
    #bc5aa0,
    #ea5c5c
  );
  box-shadow: inset 0 0 0 1px rgba(47, 42, 38, 0.14);
}
```

- [ ] **Step 2: Add selected and keyboard-focus indicators without relying only on color**

```css
.color-selector__custom-trigger.is-selected span {
  box-shadow:
    inset 0 0 5px #fff,
    0 0 0 2px var(--color-primary);
}

.color-selector__custom-trigger:focus-visible span {
  outline: 3px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  outline-offset: 2px;
}

.color-selector__selected-value {
  width: 100%;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
}
```

- [ ] **Step 3: Ensure the visual selector has a 44px touch target in the participant sheet**

```css
.participant-sheet-form .color-selector__custom {
  width: 44px;
  height: 44px;
}

.participant-sheet-form .color-selector__custom-trigger {
  display: block;
  padding: 3px;
}
```

- [ ] **Step 4: Run formatting and static checks**

Run: `npm run format; npm run check`

Expected: PASS; Prettier writes consistent formatting and ESLint reports no errors.

### Task 4: Verify persistence and mobile behavior end-to-end

**Files:**

- Test: manual verification of `src/features/participants/components/HouseholdMembersSettings.vue` in browser development and Android WebView when available.

**Interfaces:**

- Consumes: Tasks 1-3 and existing participant-store persistence.
- Produces: confidence that both preset and custom colors are preserved through create, edit, cancel, and reload flows.

- [ ] **Step 1: Verify preset compatibility**

1. Open Add person and choose each existing solid-color swatch.
2. Save a participant and reopen it.
3. Confirm the matching preset remains selected and its avatar color is unchanged.

- [ ] **Step 2: Verify custom selection during creation**

1. Open Add person and tap the multicolor circle.
2. Choose a visually distinct color in the native picker.
3. Confirm the selected-color text updates to its `#RRGGBB` value.
4. Save, reopen the participant, and confirm the multicolor option is selected and the avatar retains that color.

- [ ] **Step 3: Verify editing and dismissal behavior**

1. Edit an existing participant, set a custom color, and save; confirm the household list avatar updates immediately.
2. Open the picker again, choose a different color, then use Cancel or Android back to close the sheet; confirm no draft color persists.
3. Reopen the editor and dismiss the native picker without selecting a value; confirm the existing draft color remains unchanged.

- [ ] **Step 4: Run final verification**

Run: `npm run build; npm run check`

Expected: PASS; Vue type checking, production bundling, Prettier validation, and ESLint all succeed.
