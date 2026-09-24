# Time Picker Haptic Gesture Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make native hour/minute picker haptics work consistently for both wheel drags and changed option taps.

**Architecture:** Keep the existing wheel selection session inside `TimePickerField.vue`. Start that session for every pointer-down in a wheel, including option buttons, and send exactly one `wheelChange()` call when a tap or scroll changes the selected value. The existing delayed end continues to support inertial scrolling.

**Tech Stack:** Vue 3 Composition API, TypeScript, Capacitor Haptics 8, Vitest, Vue Test Utils.

## Global Constraints

- Keep `src/shared/services/hapticsService.ts` as the only module importing Capacitor Haptics.
- Use the existing `haptics.wheelStart()`, `haptics.wheelChange()`, and `haptics.wheelEnd()` methods.
- A changed option tap and a changed wheel scroll each produce exactly one selection haptic.
- Opening the picker, initial programmatic positioning, and selecting the active option remain silent.
- Keep the delayed selection-session end for momentum scrolling.
- Do not add dependencies, native configuration, user-facing copy, or settings.
- Preserve unrelated worktree changes and do not commit unless explicitly requested.

---

### Task 1: Unify time-picker tap and drag haptics

**Files:**

- Modify: `src/shared/components/TimePickerField.vue:80-177`
- Modify: `src/shared/components/__tests__/TimePickerField.test.ts:31-94`

**Interfaces:**

- Consumes `haptics.wheelStart(): Promise<void>`, `haptics.wheelChange(): Promise<void>`, and `haptics.wheelEnd(): Promise<void>`.
- Preserves `TimePickerField` props (`modelValue`, `label`, `stepMinutes`, `disabled`) and its `update:modelValue` emit.
- Produces one selection tick per changed tapped or dragged value.

- [x] **Step 1: Write failing regression tests for option-origin drag and option taps.**

  In `TimePickerField.test.ts`, dispatch `pointerdown` from a rendered `.reminder-time-picker__option`, scroll its containing wheel to a different value, and assert:

  ```ts
  expect(haptics.wheelStart).toHaveBeenCalledOnce();
  expect(haptics.wheelChange).toHaveBeenCalledOnce();
  expect(haptics.wheelEnd).toHaveBeenCalledOnce();
  ```

  Add tap tests that click a non-selected hour and minute option, then assert each click adds one `wheelChange()` call. Click the newly selected option again and assert the call count does not increase.

- [x] **Step 2: Run the focused test to confirm the regression.**

  Run:

  ```bash
  npx vitest run src/shared/components/__tests__/TimePickerField.test.ts
  ```

  Expected: FAIL because option-origin pointer-down events currently return before calling `wheelStart()`, and changed option clicks do not directly call `wheelChange()`.

- [x] **Step 3: Remove the option-target suppression and tick changed option selections.**

  Remove the `closest('button')` early return from `startWheelInteraction` so all wheel pointer-down events start the native selection session:

  ```ts
  function startWheelInteraction(wheel: 'hour' | 'minute') {
    if (activeWheel.value === wheel) return;

    activeWheel.value = wheel;
    void haptics.wheelStart();
  }
  ```

  Update the template to pass only the wheel name. In each option-selection function, guard unchanged values and call the semantic tick after the value changes:

  ```ts
  function selectHour(hour: number) {
    if (hour === selectedHour.value) return;

    selectedHour.value = hour;
    void haptics.wheelChange();
    scheduleWheelEnd('hour');
    scrollWheel(hourWheelElement.value, hour);
  }
  ```

  Apply the equivalent minute behavior using `minuteOptions.value.indexOf(minute)`. Keep the scroll handlers' existing equality checks so a programmatic scroll caused by a tap cannot send a second tick.

- [x] **Step 4: Run the focused component test.**

  Run:

  ```bash
  npx vitest run src/shared/components/__tests__/TimePickerField.test.ts
  ```

  Expected: PASS.

### Task 2: Verify the native-safe UI change

**Files:**

- No source changes planned unless a verification failure identifies a defect in Task 1.

**Interfaces:**

- Verifies the component remains type-safe and the haptic regression is isolated to the time picker.

- [x] **Step 1: Run the production build.**

  Run:

  ```bash
  npm run build
  ```

  Expected: PASS with no TypeScript or Vite errors.

- [x] **Step 2: Run formatting and lint checks.**

  Run:

  ```bash
  npm run check
  ```

  Expected: PASS for Prettier and ESLint.

- [x] **Step 3: Review the scoped diff.**

  Run:

  ```bash
  git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/shared/components/TimePickerField.vue src/shared/components/__tests__/TimePickerField.test.ts
  ```

  Confirm the diff only removes the button-origin gesture block and adds one-tick-per-changed-tap behavior with regression coverage.

**Verification note:** `npm run check` was run, but its repository-wide Prettier and ESLint scans are currently blocked by pre-existing untracked `.agents/` and `.github/` tooling files. The changed source and test files pass scoped Prettier and ESLint checks.
