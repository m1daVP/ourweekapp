# Mobile Quality Gate Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one truthful mobile quality gate pass locally and in GitHub Actions without adding deployment behavior.

**Architecture:** Explicit scripts compile the Vue application project and Node configuration project instead of relying on the empty solution file. Maintained source, tests, scripts, and configuration stay inside formatting and lint scope while generated native web bundles are excluded. A minimal GitHub Actions workflow installs Node 24 dependencies and runs the same local `npm run ci` command.

**Tech Stack:** Vue 3.5, TypeScript 6.0, vue-tsc 3.3, Vite 8.2, ESLint 10 flat config, Prettier 3.9, Vitest 4.1, npm, GitHub Actions

## Global Constraints

- Use npm only and keep Node at `>=24 <25`.
- Preserve existing API payloads, persisted-data compatibility, and user-visible behavior.
- Do not add dependencies or broad abstractions.
- Do not lint, format, or manually repair generated Android or iOS web bundles.
- The GitHub workflow performs quality checks only: no Render calls, deployment jobs, deployment secrets, or release-mode Sentry upload.
- The CI build uses ordinary Vite production mode, not `--mode release`.
- Preserve unrelated user work and commit only the files named by each task.

---

### Task 1: Expose the Real TypeScript Projects

**Files:**

- Modify: `tsconfig.app.json`
- Modify: `tsconfig.node.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: existing `tsconfig.json` references and the `@/*` import convention.
- Produces: `npm run typecheck:app`, `npm run typecheck:node`, and `npm run typecheck` scripts used by later tasks and CI.

- [ ] **Step 1: Record the false-green baseline**

Run:

```bash
npm run build
npx vue-tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
npx tsc --noEmit -p tsconfig.node.json --ignoreDeprecations 6.0
```

Expected: the build succeeds, while the explicit application check reports the known application diagnostics and the Node check reports that `src/shared/config/productionConfigValidation.ts` is outside the project file list.

- [ ] **Step 2: Remove the TypeScript 6 path deprecation**

Delete only `"baseUrl": "."` from `tsconfig.app.json`. Keep the alias mapping relative to the config:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

- [ ] **Step 3: Include the Node config dependency**

Change `tsconfig.node.json` to include the imported production validation module:

```json
"include": [
  "vite.config.ts",
  "vitest.config.ts",
  "capacitor.config.ts",
  "src/shared/config/productionConfigValidation.ts"
]
```

- [ ] **Step 4: Add explicit typecheck scripts**

Add these scripts to `package.json` without changing `build` yet:

```json
"typecheck:app": "vue-tsc --noEmit -p tsconfig.app.json",
"typecheck:node": "tsc --noEmit -p tsconfig.node.json",
"typecheck": "npm run typecheck:app && npm run typecheck:node"
```

- [ ] **Step 5: Verify the configuration change**

Run:

```bash
npm run typecheck:node
npm run typecheck:app
```

Expected: the Node check passes. The app check reaches the substantive diagnostics without a `baseUrl` deprecation error.

- [ ] **Step 6: Commit the truthful project checks**

```bash
git add tsconfig.app.json tsconfig.node.json package.json
git commit -m "build(quality): typecheck mobile projects explicitly"
```

---

### Task 2: Repair Store, API, Localization, and Storage Types

**Files:**

- Modify: `src/app/stores/auth.ts`
- Modify: `src/app/stores/householdInsights.ts`
- Modify: `src/app/stores/localization.ts`
- Modify: `src/app/stores/workspace.ts`
- Modify: `src/features/localization/i18n.ts`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/features/meeting/aiSummaryService.ts`
- Modify: `src/shared/api/httpClient.ts`
- Modify: `src/shared/api/workspaceApi.ts`
- Modify: `src/shared/services/authTokenStorageService.ts`
- Modify: `src/shared/services/exportFileDeliveryService.ts`
- Modify: `src/shared/services/storageService.ts`
- Test: `src/app/stores/__tests__/workspace.test.ts`
- Test: `src/shared/api/__tests__/httpClient.test.ts`
- Test: `src/shared/services/__tests__/authTokenStorageService.test.ts`
- Test: `src/shared/services/__tests__/storageService.test.ts`

**Interfaces:**

- Consumes: `AuthTokens`, `WorkspaceMember`, `SupportedLocale`, `AppDataSettings`, and existing service APIs.
- Produces: complete token objects, non-null normalized workspace members, a typed composition-mode i18n global, and safe storage/share boundaries.

- [ ] **Step 1: Add regression assertions for corrected runtime boundaries**

Extend existing tests with behavior-level assertions:

```ts
expect(await readAuthTokens()).toEqual({
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
});
```

```ts
expect(normalizedWorkspace.members.every(Boolean)).toBe(true);
expect(normalizedWorkspace.members[0]?.role).toBe('owner');
```

```ts
expect(emptyEnvelope.settings.aiRecap).toBeNull();
```

Keep these assertions inside the nearest existing tests and use their public store/service entry points rather than exporting private helpers.

- [ ] **Step 2: Run focused tests before editing**

Run:

```bash
npm test -- src/app/stores/__tests__/workspace.test.ts src/shared/api/__tests__/httpClient.test.ts src/shared/services/__tests__/authTokenStorageService.test.ts src/shared/services/__tests__/storageService.test.ts
```

Expected: existing behavior passes; any newly added assertion that exposes an incomplete default fails before its correction.

- [ ] **Step 3: Complete every auth-token value**

In `auth.ts`, return and assign all three fields:

```ts
return { accessToken: null, refreshToken: null, expiresAt: null };
```

```ts
legacyTokensToMigrate = {
  accessToken: storedState.accessToken ?? legacyLocalStorageTokens.accessToken,
  refreshToken:
    storedState.refreshToken ?? legacyLocalStorageTokens.refreshToken,
  expiresAt: legacyLocalStorageTokens.expiresAt,
};
```

In `authTokenStorageService.ts`, pass a plain supported record to secure storage while retaining the public `AuthTokens` interface:

```ts
SecureStorage.set(
  SESSION_KEY,
  {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
  },
  false
);
```

- [ ] **Step 4: Make store narrowing explicit**

Change the insights default parameter so it does not reference an untyped `this` in the signature:

```ts
async load(period?: InsightsPeriod) {
  const selectedPeriod = period ?? this.selectedPeriod;
  // use selectedPeriod for the request and assignment
}
```

Give `normalizeMember` an explicit nullable result:

```ts
function normalizeMember(
  member: Partial<WorkspaceMember>
): WorkspaceMember | null {
```

Filter with a predicate whose input matches that result:

```ts
.filter((member): member is WorkspaceMember => member !== null)
```

- [ ] **Step 5: Correct i18n typing once at creation**

In `messages.ts`, replace the literal-only schema alias with a recursively widened string schema:

```ts
type WidenMessageStrings<T> = {
  [Key in keyof T]: T[Key] extends string
    ? string
    : WidenMessageStrings<T[Key]>;
};

export type MessageSchema = WidenMessageStrings<typeof messages.en>;
```

In `i18n.ts`, select the composition-mode overload explicitly:

```ts
export const i18n = createI18n<[MessageSchema], SupportedLocale, false>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
});
```

Use that same typed instance in `localization.ts` and `aiSummaryService.ts`; do not cast each call site to `any` or `unknown`.

The resulting public helper remains:

```ts
export function translate(
  key: string,
  params?: Record<string, unknown>
): string {
  return i18n.global.t(key, params ?? {});
}
```

- [ ] **Step 6: Narrow mutable auth handlers before awaiting**

Capture the handlers before the refresh branch so nullability cannot change across `await`:

```ts
const handlers = authHandlers;
const shouldRefresh =
  options.requiresAuth &&
  !options.skipAuthRefresh &&
  error instanceof ApiClientError &&
  error.status === 401 &&
  Boolean(handlers?.refreshSession);

if (!shouldRefresh || !handlers?.refreshSession) {
  throw error;
}

const refreshedToken = await handlers.refreshSession();
```

Use `handlers.onUnauthorized?.()` in the failure branch.

- [ ] **Step 7: Repair missing imports and browser capability refinement**

Import the existing role type in `workspaceApi.ts`:

```ts
import type { UserRole } from '@/features/access/types';
```

Replace the incompatible `Navigator` extension with an intersection at the use site:

```ts
type WebNavigatorWithShare = Navigator & {
  canShare?: Navigator['canShare'];
};
```

Call `webNavigator.share` and `webNavigator.canShare` only after both functions are present.

- [ ] **Step 8: Complete storage defaults and narrow migrated meetings**

Add the missing field to `createEmptySettingsData()`:

```ts
return {
  aiRecap: null,
  calendarSync: null,
  localization: null,
  reminders: null,
  workspace: null,
};
```

Before reading `meeting.id` in the legacy migration, convert the unknown meeting through `getRecord(meeting)` and read the identifier only after checking `typeof meetingItem.id === 'string'`. Preserve the original meeting value when the identifier or sections are invalid.

- [ ] **Step 9: Run focused tests and inspect the remaining compiler list**

Run:

```bash
npm test -- src/app/stores/__tests__/workspace.test.ts src/shared/api/__tests__/httpClient.test.ts src/shared/services/__tests__/authTokenStorageService.test.ts src/shared/services/__tests__/storageService.test.ts
npm run typecheck:app
```

Expected: focused tests pass. The remaining app diagnostics are limited to view/component and legacy-access files handled in Task 3.

- [ ] **Step 10: Commit the boundary corrections**

```bash
git add src/app/stores/auth.ts src/app/stores/householdInsights.ts src/app/stores/localization.ts src/app/stores/workspace.ts src/features/localization/i18n.ts src/features/localization/messages.ts src/features/meeting/aiSummaryService.ts src/shared/api/httpClient.ts src/shared/api/workspaceApi.ts src/shared/services/authTokenStorageService.ts src/shared/services/exportFileDeliveryService.ts src/shared/services/storageService.ts src/app/stores/__tests__/workspace.test.ts src/shared/api/__tests__/httpClient.test.ts src/shared/services/__tests__/authTokenStorageService.test.ts src/shared/services/__tests__/storageService.test.ts
git commit -m "fix(quality): align mobile data boundaries with types"
```

---

### Task 3: Repair Component and Page Diagnostics

**Files:**

- Modify: `src/features/access/legacyFeatureAccess.ts`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/pages/MeetingSummaryPage.vue`
- Modify: `src/pages/TasksPage.vue`
- Test: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`
- Test: `src/pages/__tests__/TasksPage.test.ts`

**Interfaces:**

- Consumes: `CreateParticipantPayload`, `Participant`, `SupportedLocale`, `MeetingExportContext`, and the local summary/task-card view models.
- Produces: compiler-safe page projections with unchanged rendered behavior.

- [ ] **Step 1: Add focused participant and task view assertions**

In the existing component/page tests, assert that:

```ts
expect(participantsStore.createParticipant).toHaveBeenCalledWith(
  expect.objectContaining({ name: 'Alex' })
);
```

For the task test, freeze the clock, give the fixture an earlier `dueDate`, and assert the existing child component prop:

```ts
vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
state.tasks[0].dueDate = '2026-09-07';
const wrapper = mountTasksPage();

expect(wrapper.findComponent(TaskSwipeActionCard).props('metadataTone')).toBe(
  'danger'
);
```

- [ ] **Step 2: Run the focused view tests**

Run:

```bash
npm test -- src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/pages/__tests__/TasksPage.test.ts
```

Expected: current behavior passes and establishes the behavior to preserve during narrowing.

- [ ] **Step 3: Split create and update participant payloads**

Inside `saveParticipantDraft`, construct the create payload only in create mode so `name` is always a string:

```ts
const participant = participantsStore.createParticipant({
  name: participantDraft.name,
  initials: participantDraft.initials,
  avatarColor: participantDraft.avatarColor,
  avatarType: participantDraft.avatarType,
  type: participantDraft.type,
});
```

Keep the optional-name payload for update mode. Before calling `canInviteParticipant`, guard the updated lookup:

```ts
if (
  shouldOfferInviteAfterSave &&
  updatedParticipant &&
  canInviteParticipant(updatedParticipant)
) {
```

- [ ] **Step 4: Preserve domain locale and view-model types**

In `MeetingDetailsPage.vue`, type the export context explicitly:

```ts
function getExportContext(): MeetingExportContext {
```

Import `MeetingExportContext` as a type and ensure the store locale remains `SupportedLocale`.

In `MeetingSummaryPage.vue`, add the property already projected by `toSummaryParticipant`:

```ts
avatarType: string | null;
```

Ensure the fallback participant includes `avatarType: null`. Make `getActionAssignee` always return `SummaryParticipant` by falling back after an unsuccessful ID lookup.

- [ ] **Step 5: Keep task metadata tones narrow**

Give `getTaskMetadata` an explicit return type:

```ts
function getTaskMetadata(task: Task): {
  icon: string;
  text: string;
  tone: TaskCardTone;
} {
```

Return plain `'default'` and `'danger'` values after adding the return type; remove scattered `as const` expressions.

- [ ] **Step 6: Remove dead legacy and page values**

In `legacyFeatureAccess.ts`, remove the impossible `lifecycle === 'planned'` branch because every legacy entry is explicitly `available`. Derive state only from `enabled` and tier.

Remove the unused `meetingPreview` computed value and its now-unused import from `MeetingDetailsPage.vue`.

- [ ] **Step 7: Verify every application diagnostic is gone**

Run:

```bash
npm test -- src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/pages/__tests__/TasksPage.test.ts
npm run typecheck:app
npm run typecheck
```

Expected: all commands pass with no TypeScript diagnostics.

- [ ] **Step 8: Make the ordinary build truthful**

Update `package.json`:

```json
"build": "npm run typecheck && vite build",
"build:prod": "npm run typecheck && vite build --mode release",
"build:staging": "npm run typecheck && vite build --mode staging"
```

Run `npm run build` and expect success.

- [ ] **Step 9: Commit the view corrections and truthful build**

```bash
git add package.json src/features/access/legacyFeatureAccess.ts src/features/participants/components/HouseholdMembersSettings.vue src/pages/MeetingDetailsPage.vue src/pages/MeetingSummaryPage.vue src/pages/TasksPage.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/pages/__tests__/TasksPage.test.ts
git commit -m "fix(quality): clear mobile application diagnostics"
```

---

### Task 4: Make Formatting and Lint Scope Useful

**Files:**

- Modify: `eslint.config.js`
- Modify: `.prettierignore`
- Modify: `src/features/participants/__tests__/avatarCatalog.test.ts`
- Format: the files reported by `npm run format:check`

**Interfaces:**

- Consumes: ESLint flat config and repository-wide Prettier command.
- Produces: zero-error, zero-warning `npm run lint` and a green repository-wide `npm run format:check` without scanning generated native web output.

- [ ] **Step 1: Add generated-output and environment-specific lint configuration**

Expand the global ignore list:

```js
ignores: [
  'android/**',
  'dist/**',
  'ios/App/App/public/**',
  'ios/App/CapApp-SPM/**',
  'node_modules/**',
],
```

Add a Node-script block:

```js
{
  files: ['scripts/**/*.{js,mjs,cjs}', '*.config.{js,mjs,ts}'],
  languageOptions: {
    globals: {
      console: 'readonly',
      process: 'readonly',
    },
  },
},
```

Add a test-only rule override:

```js
{
  files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
  rules: {
    'vue/one-component-per-file': 'off',
  },
},
```

Add the synchronized native web output to `.prettierignore`:

```text
ios/App/App/public
ios/App/CapApp-SPM
```

- [ ] **Step 2: Remove the real unused test import**

Delete the unused `avatarCatalog` import from `src/features/participants/__tests__/avatarCatalog.test.ts`. Keep any types or functions the assertions actually use.

- [ ] **Step 3: Verify lint is clean before formatting**

Run:

```bash
npm run lint
```

Expected: zero errors and zero warnings. Do not add broad rule suppressions to make this pass.

- [ ] **Step 4: Format only the reported maintained files**

Run Prettier with `--write` on the exact files printed by the baseline `npm run format:check`. This includes the 14 documentation/plan files and these source files:

```bash
npx prettier --write src/features/meeting/aiRecapDisclosure.ts src/features/meeting/composables/useMeetingSession.ts
```

Pass the 14 reported documentation paths in the same command or a second explicit command. Do not run Prettier over generated native directories.

- [ ] **Step 5: Verify the local style gate**

Run:

```bash
npm run format:check
npm run lint
npm run check
```

Expected: all three commands pass with no warnings.

- [ ] **Step 6: Commit lint scope and formatting**

```bash
git add eslint.config.js .prettierignore src/features/participants/__tests__/avatarCatalog.test.ts docs src/features/meeting/aiRecapDisclosure.ts src/features/meeting/composables/useMeetingSession.ts
git commit -m "chore(quality): enforce maintained mobile sources"
```

Before committing, inspect `git diff --name-only` and remove any generated or unrelated path from the staged set.

---

### Task 5: Add the Shared Local and GitHub Quality Gate

**Files:**

- Modify: `package.json`
- Create: `.github/workflows/quality.yml`

**Interfaces:**

- Consumes: `npm run typecheck`, `npm run format:check`, `npm run lint`, `npm test`, and ordinary Vite build.
- Produces: `npm run ci` and a quality-only GitHub Actions workflow.

- [ ] **Step 1: Add the authoritative CI script**

Add to `package.json`:

```json
"ci": "npm run typecheck && npm run format:check && npm run lint && npm test && vite build"
```

This intentionally calls `vite build` directly after the explicit typecheck to avoid compiling twice while keeping the same ordinary bundle mode as `npm run build`.

- [ ] **Step 2: Create the GitHub Actions workflow**

Create `.github/workflows/quality.yml`:

```yaml
name: Quality

on:
  push:
  pull_request:

permissions:
  contents: read

concurrency:
  group: quality-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run quality gate
        run: npm run ci
```

- [ ] **Step 3: Verify the workflow has no deployment behavior**

Run:

```bash
rg -n "render|deploy|SENTRY_AUTH_TOKEN|secrets\." .github package.json
```

Expected: no matches in `.github/workflows/quality.yml`. Existing package script names containing release behavior may appear, but the workflow must reference only `npm ci` and `npm run ci`.

- [ ] **Step 4: Run the complete local gate**

Run:

```bash
npm run ci
npm run build
```

Expected: both pass. Record test counts and bundle warnings for the readiness report.

- [ ] **Step 5: Commit the quality gate**

```bash
git add package.json .github/workflows/quality.yml
git commit -m "ci: add mobile quality checks"
```

---

### Task 6: Record Point 5 Verification

**Files:**

- Modify in API repository: `D:/Projects/myself/weekly-us-api/docs/system-readiness-report-2026-09-07.md`
- Modify: `docs/superpowers/specs/2026-09-08-mobile-quality-gate-design.md`
- Modify: `docs/superpowers/plans/2026-09-08-mobile-quality-gate-repair.md`

**Interfaces:**

- Consumes: observed command results from Tasks 1–5.
- Produces: an accurate readiness finding that distinguishes a green source gate from untested signed native release behavior.

- [ ] **Step 1: Update the readiness finding with observed evidence**

Change point 5 to state that the mobile gate explicitly compiles both projects, checks maintained source, runs tests, and builds locally. Include exact observed test counts and link to `.github/workflows/quality.yml`.

Keep this release boundary explicit:

```markdown
The green source gate does not establish signed Android/iOS package behavior, release-mode Sentry upload, store installation, or physical-device quality.
```

- [ ] **Step 2: Record implementation status in the design and plan**

Set the design status to `Implemented and locally verified`. Add a short verification section to both documents with the exact commands and results. Do not claim GitHub-hosted success until a real Actions run passes.

- [ ] **Step 3: Run final repository checks**

In the mobile repository, run:

```bash
npm run ci
npm run build
git diff --check
git status --short
```

In the API repository, run:

```bash
git diff --check -- docs/system-readiness-report-2026-09-07.md
git status --short
```

Expected: quality commands and whitespace checks pass. Status contains only intended documentation changes or previously identified unrelated user work.

- [ ] **Step 4: Commit documentation in each owning repository after explicit approval**

Mobile repository:

```bash
git add docs/superpowers/specs/2026-09-08-mobile-quality-gate-design.md docs/superpowers/plans/2026-09-08-mobile-quality-gate-repair.md
git commit -m "docs(quality): record mobile gate verification"
```

API repository:

```bash
git add docs/system-readiness-report-2026-09-07.md
git commit -m "docs(readiness): record mobile quality gate repair"
```

Do not combine changes across repositories and do not include unrelated files.

## Implementation Results

Implemented inline on 8 September 2026 without committing implementation files. The final local `npm run ci` passed explicit application and Node typechecks, repository formatting, zero-warning lint, all 74 test files and 592 tests, and the ordinary Vite bundle. A separate `npm run build` also passed. The GitHub workflow is ready for a hosted run after push and contains no deployment behavior.
