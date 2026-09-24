# Predefined Participant Avatars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let household members use one of 20 bundled avatars or the existing color-and-initials fallback, with server-enforced ownership for avatar updates.

**Architecture:** A frontend catalog maps stable avatar IDs to bundled WebP imports and a single reusable component handles image rendering with a color fallback. `participants.avatar_type` persists the selected ID; the existing participant synchronization flow carries it while the API service authorizes every actual avatar change against the target participant’s `user_id`.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, vue-i18n, Vitest, Fastify, Zod, Supabase/PostgreSQL.

## Global Constraints

- Add no dependencies; use the supplied transparent square WebP assets only.
- Assets must be exactly `src/assets/avatars/group-01/avatar-01.webp` through `group-05/avatar-04.webp`.
- Persist only the 20 opaque IDs `group-01-avatar-01` through `group-05-avatar-04`, never paths, URLs, or binary image data.
- Keep `avatar_color` required as the fallback and color-mode value; selecting a color writes `avatarType: null`.
- Preserve old clients: an omitted `avatarType` in an existing participant sync payload must retain the server value.
- Enforce avatar-write authorization in the API, scoped by `workspace_id`; do not rely on disabled frontend controls.
- Do not stage or commit any files unless the user explicitly asks.

---

### Task 1: Add the frontend avatar catalog and one reusable renderer

**Files:**

- Create: `weekly-us/src/assets/avatars/group-01/avatar-01.webp` through `weekly-us/src/assets/avatars/group-05/avatar-04.webp` (user-supplied assets)
- Create: `weekly-us/src/features/participants/avatarCatalog.ts`
- Create: `weekly-us/src/features/participants/components/ParticipantAvatar.vue`
- Create: `weekly-us/src/features/participants/components/__tests__/ParticipantAvatar.test.ts`

**Interfaces:**

- Produces `AvatarType`, `avatarCatalog`, `avatarGroups`, and `getAvatarAsset(avatarType)`.
- Produces `ParticipantAvatar` with props `participant: Pick<Participant, 'name' | 'initials' | 'avatarColor' | 'avatarType'>`, `size?: 'small' | 'medium' | 'large'`, and `decorative?: boolean`.

- [ ] **Step 1: Place and verify the supplied source assets**

Create five folders, each with four supplied 1:1 transparent WebPs. Verify all twenty paths before proceeding:

```powershell
Get-ChildItem src/assets/avatars -Recurse -Filter '*.webp' | Select-Object -ExpandProperty FullName
```

Expected: exactly 20 files at `group-01` … `group-05`, each named `avatar-01.webp` … `avatar-04.webp`.

- [ ] **Step 2: Write the failing catalog and component tests**

Cover the complete 20-item catalog, resolution of `group-03-avatar-02`, image rendering for a valid ID, and color/initial fallback for `null`, `undefined`, and an unknown persisted value:

```ts
expect(avatarCatalog).toHaveLength(20);
expect(getAvatarAsset('group-03-avatar-02')).toBeTruthy();
expect(wrapper.get('img').attributes('src')).toContain('avatar-02');
expect(wrapper.text()).toContain('RS');
```

- [ ] **Step 3: Run the component test to verify it fails**

Run: `npm test -- ParticipantAvatar.test.ts`

Expected: FAIL because the catalog and component do not exist.

- [ ] **Step 4: Implement the catalog with explicit imports**

Use a union derived from a readonly catalog, rather than accepting arbitrary strings:

```ts
import group01Avatar01 from '@/assets/avatars/group-01/avatar-01.webp';
import group01Avatar02 from '@/assets/avatars/group-01/avatar-02.webp';
import group01Avatar03 from '@/assets/avatars/group-01/avatar-03.webp';
import group01Avatar04 from '@/assets/avatars/group-01/avatar-04.webp';
import group02Avatar01 from '@/assets/avatars/group-02/avatar-01.webp';
import group02Avatar02 from '@/assets/avatars/group-02/avatar-02.webp';
import group02Avatar03 from '@/assets/avatars/group-02/avatar-03.webp';
import group02Avatar04 from '@/assets/avatars/group-02/avatar-04.webp';
import group03Avatar01 from '@/assets/avatars/group-03/avatar-01.webp';
import group03Avatar02 from '@/assets/avatars/group-03/avatar-02.webp';
import group03Avatar03 from '@/assets/avatars/group-03/avatar-03.webp';
import group03Avatar04 from '@/assets/avatars/group-03/avatar-04.webp';
import group04Avatar01 from '@/assets/avatars/group-04/avatar-01.webp';
import group04Avatar02 from '@/assets/avatars/group-04/avatar-02.webp';
import group04Avatar03 from '@/assets/avatars/group-04/avatar-03.webp';
import group04Avatar04 from '@/assets/avatars/group-04/avatar-04.webp';
import group05Avatar01 from '@/assets/avatars/group-05/avatar-01.webp';
import group05Avatar02 from '@/assets/avatars/group-05/avatar-02.webp';
import group05Avatar03 from '@/assets/avatars/group-05/avatar-03.webp';
import group05Avatar04 from '@/assets/avatars/group-05/avatar-04.webp';

export const avatarCatalog = [
  { id: 'group-01-avatar-01', groupId: 'group-01', asset: group01Avatar01 },
  { id: 'group-01-avatar-02', groupId: 'group-01', asset: group01Avatar02 },
  { id: 'group-01-avatar-03', groupId: 'group-01', asset: group01Avatar03 },
  { id: 'group-01-avatar-04', groupId: 'group-01', asset: group01Avatar04 },
  { id: 'group-02-avatar-01', groupId: 'group-02', asset: group02Avatar01 },
  { id: 'group-02-avatar-02', groupId: 'group-02', asset: group02Avatar02 },
  { id: 'group-02-avatar-03', groupId: 'group-02', asset: group02Avatar03 },
  { id: 'group-02-avatar-04', groupId: 'group-02', asset: group02Avatar04 },
  { id: 'group-03-avatar-01', groupId: 'group-03', asset: group03Avatar01 },
  { id: 'group-03-avatar-02', groupId: 'group-03', asset: group03Avatar02 },
  { id: 'group-03-avatar-03', groupId: 'group-03', asset: group03Avatar03 },
  { id: 'group-03-avatar-04', groupId: 'group-03', asset: group03Avatar04 },
  { id: 'group-04-avatar-01', groupId: 'group-04', asset: group04Avatar01 },
  { id: 'group-04-avatar-02', groupId: 'group-04', asset: group04Avatar02 },
  { id: 'group-04-avatar-03', groupId: 'group-04', asset: group04Avatar03 },
  { id: 'group-04-avatar-04', groupId: 'group-04', asset: group04Avatar04 },
  { id: 'group-05-avatar-01', groupId: 'group-05', asset: group05Avatar01 },
  { id: 'group-05-avatar-02', groupId: 'group-05', asset: group05Avatar02 },
  { id: 'group-05-avatar-03', groupId: 'group-05', asset: group05Avatar03 },
  { id: 'group-05-avatar-04', groupId: 'group-05', asset: group05Avatar04 },
] as const;

export type AvatarType = (typeof avatarCatalog)[number]['id'];

export function getAvatarAsset(value: string | null | undefined) {
  return avatarCatalog.find((avatar) => avatar.id === value)?.asset;
}
```

- [ ] **Step 5: Implement the renderer with accessible fallback behavior**

Render an `<img>` when `getAvatarAsset` resolves; otherwise retain the current visual semantics:

```vue
<img
  v-if="asset"
  class="participant-avatar__image"
  :src="asset"
  :alt="decorative ? '' : participant.name"
/>
<span
  v-else
  class="participant-avatar"
  :style="{ backgroundColor: participant.avatarColor }"
  :aria-label="decorative ? undefined : participant.name"
>
  {{ participant.initials }}
</span>
```

Use `alt=""` and `aria-hidden="true"` for decorative uses; preserve a visible accessible name for standalone profile use. Include all small/medium/large sizing styles in the component and retain a minimum 44px selector target where it is interactive.

- [ ] **Step 6: Run the focused tests**

Run: `npm test -- ParticipantAvatar.test.ts`

Expected: PASS with valid-image and fallback cases.

- [ ] **Step 7: Leave changes uncommitted**

Do not stage or commit. The project requires explicit user approval for commits.

### Task 2: Persist `avatarType` locally and carry it through app sync DTOs

**Files:**

- Modify: `weekly-us/src/features/participants/types.ts`
- Modify: `weekly-us/src/app/stores/participants.ts`
- Modify: `weekly-us/src/shared/api/syncDtos.ts`
- Modify: `weekly-us/src/app/stores/__tests__/participants.test.ts`
- Modify: `weekly-us/src/shared/api/__tests__/syncDtos.test.ts`

**Interfaces:**

- Consumes: `AvatarType` from `avatarCatalog.ts`.
- Produces `Participant.avatarType?: AvatarType | null` and create/update payload fields with the same type.
- Produces sync records that include `avatarType` when defined and preserve null to select color mode.

- [ ] **Step 1: Add failing local-state and DTO tests**

Add cases verifying that a new participant defaults to `avatarType: null`, `updateParticipant(id, { avatarType: 'group-01-avatar-01' })` persists the ID, `updateParticipant(id, { avatarType: null })` returns to color mode, and DTO conversion retains both a catalog ID and null:

```ts
expect(
  store.createParticipant({ name: 'Rita', type: 'adult' })?.avatarType
).toBeNull();
expect(toParticipantDto(participant).avatarType).toBe('group-01-avatar-01');
expect(fromParticipantDto({ ...dto, avatarType: null }).avatarType).toBeNull();
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `npm test -- participants.test.ts syncDtos.test.ts`

Expected: FAIL because `avatarType` is not part of the participant type or mapper.

- [ ] **Step 3: Extend the types, normalizer, and store payloads**

Import `AvatarType` as a type. Normalize persisted legacy values to `null` only when absent; reject unknown values via `getAvatarAsset` before placing them in state:

```ts
avatarType: getAvatarAsset(participant.avatarType) ? participant.avatarType : null,
```

Add `avatarType` to `CreateParticipantPayload`, `UpdateParticipantPayload`, `LegacyParticipant`, `normalizeParticipant`, creation defaults, and the targeted update action. Include it in the participant display key so profiles with the same name and color but distinct selected images are not deduplicated.

- [ ] **Step 4: Extend sync mapping without leaking identity fields**

Include `avatarType` in `toParticipantDto` and preserve it in `fromParticipantDto` alongside the existing `email` exclusion rules:

```ts
avatarType: participant.avatarType ?? null,
```

Keep `userId`, provider data, and other identity fields out of the mobile sync DTO.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- participants.test.ts syncDtos.test.ts`

Run: `npm run build`

Expected: PASS; TypeScript accepts legacy local records and modern avatar records.

- [ ] **Step 6: Leave changes uncommitted**

Do not stage or commit.

### Task 3: Add the safe database and API DTO foundation

**Files:**

- Create: `weekly-us-api/supabase/migrations/20260904130000_add_participant_avatar_type.sql`
- Modify: `weekly-us-api/src/modules/participants/participants.schema.ts`
- Modify: `weekly-us-api/src/modules/participants/participants.repository.ts`
- Create: `weekly-us-api/tests/participant-avatars.migration.test.ts`
- Modify: `weekly-us-api/tests/participants.service.test.ts`
- Modify: `weekly-us-api/tests/repository-mappers.test.ts`

**Interfaces:**

- Produces `avatarTypeSchema` as the exact 20-value Zod enum.
- Produces response `ParticipantDto.avatarType: AvatarType | null` and input `ParticipantSyncProfileDto.avatarType?: AvatarType | null`.
- Produces repository rows and inputs with `avatarType: string | null` plus internal `userId: string | null`.

- [ ] **Step 1: Write failing migration, schema, and mapper assertions**

Test the migration file for a nullable `avatar_type`, the twenty-value check constraint, and a migration name later than existing migrations. Add schema tests for an allowed ID, `null`, rejection of `group-06-avatar-01`, and acceptance of an omitted legacy sync field. Add mapper tests for `avatar_type: 'group-02-avatar-03'` and `avatar_type: null`.

```ts
expect(
  syncParticipantsRequestSchema.safeParse({
    participants: [legacy],
    clientUpdatedAt: now,
  }).success
).toBe(true);
expect(avatarTypeSchema.safeParse('group-06-avatar-01').success).toBe(false);
```

- [ ] **Step 2: Run the backend tests to verify failure**

Run: `npm test -- participant-avatars.migration.test.ts participants.service.test.ts repository-mappers.test.ts`

Expected: FAIL because no migration, Zod schema, or repository field exists.

- [ ] **Step 3: Write the migration**

Add a new migration only. Use a nullable column and allow-list constraint:

```sql
alter table public.participants add column avatar_type text;
alter table public.participants add constraint participants_avatar_type_check check (
  avatar_type is null or avatar_type in (
    'group-01-avatar-01', 'group-01-avatar-02', 'group-01-avatar-03', 'group-01-avatar-04',
    'group-02-avatar-01', 'group-02-avatar-02', 'group-02-avatar-03', 'group-02-avatar-04',
    'group-03-avatar-01', 'group-03-avatar-02', 'group-03-avatar-03', 'group-03-avatar-04',
    'group-04-avatar-01', 'group-04-avatar-02', 'group-04-avatar-03', 'group-04-avatar-04',
    'group-05-avatar-01', 'group-05-avatar-02', 'group-05-avatar-03', 'group-05-avatar-04'
  )
);
```

Do not backfill; null intentionally preserves the established color/avatar fallback. Do not alter RLS policies because the backend service role continues to authorize writes in application code.

- [ ] **Step 4: Implement API schema and repository mapping**

Add the exact Zod enum and distinguish response and sync-input field requirements:

```ts
export const avatarTypeSchema = z.enum([...avatarIds] as const);
// response: avatarType: avatarTypeSchema.nullable()
// sync write: avatarType: avatarTypeSchema.nullable().optional()
```

Select `avatar_type,user_id` in `PARTICIPANT_COLUMNS`, map both to camel case, and write `avatar_type` on create/upsert/update. Keep `userId` repository-only; never add it to public response schemas.

- [ ] **Step 5: Run migration/schema/mapper tests**

Run: `npm test -- participant-avatars.migration.test.ts participants.service.test.ts repository-mappers.test.ts`

Expected: PASS for valid, null, invalid, and legacy-omitted values.

- [ ] **Step 6: Leave changes uncommitted**

Do not stage or commit.

### Task 4: Enforce avatar-update ownership during participant synchronization

**Files:**

- Modify: `weekly-us-api/src/modules/participants/participants.service.ts`
- Modify: `weekly-us-api/src/modules/participants/participants.routes.ts`
- Modify: `weekly-us-api/tests/participants.service.test.ts`
- Modify: `weekly-us-api/tests/api-contract.routes.test.ts`
- Modify: `weekly-us-api/docs/openapi.json` (regenerate)

**Interfaces:**

- Consumes `AuthContext.userId`, `AuthContext.role`, repository `ParticipantDto.userId`, and optional input `avatarType`.
- Produces `syncParticipants(..., { actor: { userId, role } })` and public responses containing nullable `avatarType`.
- Rejects a changed avatar with `ApiError(403, 'participant_avatar_forbidden', ...)` unless actor owns the linked participant or is an owner changing an unlinked participant.

- [ ] **Step 1: Add failing service authorization cases**

Extend the fake repository row fixture with `userId`. Add tests for:

```ts
// allowed: target.userId === actor.userId
// allowed: actor.role === 'owner' && target.userId === null
// rejected: target.userId === 'another-user' && actor.userId === 'current-user'
// preserved: client omits avatarType and server has group-04-avatar-01
```

Assert that the rejection writes nothing and has status 403/code `participant_avatar_forbidden`. Add a stale-revision test with a changed avatar confirming the existing typed conflict contains avatar data in both versions.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npm test -- participants.service.test.ts api-contract.routes.test.ts`

Expected: FAIL because sync does not receive an actor, preserve omitted values, or enforce avatar ownership.

- [ ] **Step 3: Add actor-aware effective avatar resolution**

Pass `auth.userId` and `auth.role` from the authenticated sync route. In the service, resolve an omitted input field to the server field before comparison and update:

```ts
const effectiveAvatarType =
  client.avatarType === undefined ? server.avatarType : client.avatarType;

if (
  effectiveAvatarType !== server.avatarType &&
  server.userId !== actor.userId &&
  !(actor.role === 'owner' && server.userId === null)
) {
  throw new ApiError(
    403,
    'participant_avatar_forbidden',
    'You cannot change this participant avatar.'
  );
}
```

Use the effective value in content-change comparison and the guarded repository update. New participant creates default an omitted value to null. Keep normal participant updates, deletion behavior, conflict semantics, and workspace filters intact.

- [ ] **Step 4: Keep the OpenAPI contract synchronized**

Update response/request tests for `avatarType`, then run the project generator:

```powershell
cmd /c npm run generate
```

Inspect the generated OpenAPI diff to confirm the public participant response shows nullable `avatarType` and sync input marks it optional.

- [ ] **Step 5: Run backend verification**

Run: `npm run typecheck`

Run: `npm test -- participants.service.test.ts api-contract.routes.test.ts`

Expected: PASS for allowed self/unlinked-owner updates, prohibited linked-member updates, legacy payloads, and conflict DTOs.

- [ ] **Step 6: Leave changes uncommitted**

Do not stage or commit.

### Task 5: Replace separate color controls with the unified mobile avatar picker

**Files:**

- Create: `weekly-us/src/features/participants/components/AvatarPickerSheet.vue`
- Delete: `weekly-us/src/features/participants/components/AvatarColorPickerSheet.vue`
- Modify: `weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `weekly-us/src/features/localization/messages.ts`
- Create: `weekly-us/src/features/participants/components/__tests__/AvatarPickerSheet.test.ts`
- Modify: `weekly-us/src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

**Interfaces:**

- Consumes `avatarGroups`, `ParticipantAvatar`, `participantColors`, and `normalizeOpaqueHexColor`.
- Produces `AvatarPickerSheet` props `open`, `avatarType`, `avatarColor`, and `initials`; emits `selectAvatar(AvatarType)` and `selectColor(string)` plus `close`.
- `HouseholdMembersSettings` drafts include `avatarType: AvatarType | null` and send it via `updateParticipant`.

- [ ] **Step 1: Write failing picker and settings tests**

Test that the sheet shows all five groups/four choices, exposes a selected image, selects a color by emitting the color path, selects an image by emitting its catalog ID, and has an accessible selected-state label. Add settings cases for a current linked participant editing their own avatar, an owner editing an unlinked participant, and the disabled/no-edit state for another linked participant.

```ts
await wrapper.get('[data-avatar-id="group-01-avatar-01"]').trigger('click');
expect(wrapper.emitted('selectAvatar')).toEqual([['group-01-avatar-01']]);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- AvatarPickerSheet.test.ts HouseholdMembersSettings.test.ts`

Expected: FAIL because the unified sheet and avatar authorization UI do not exist.

- [ ] **Step 3: Implement the one-sheet selection UI**

Use a single `BaseBottomSheet`, not stacked modals. Keep the presets and custom `iro` color control in its Colors section, and render grouped image buttons in its Avatar set section. Each control must be a 44px-or-larger button with a visually and programmatically selected state:

```vue
<button
  :aria-pressed="avatarType === avatar.id"
  :data-avatar-id="avatar.id"
  type="button"
  @click="emit('selectAvatar', avatar.id)"
>
  <img :src="avatar.asset" alt="" />
  <span class="sr-only">{{ t('settings.selectAvatar', { avatar: avatar.id }) }}</span>
</button>
```

Selecting a color emits only `selectColor`; its parent sets `avatarType = null`. Selecting an image emits only `selectAvatar`; its parent retains `avatarColor` unchanged for fallback. Move the existing custom-color validation and `iro` lifecycle cleanup into this component, then remove the old standalone color-sheet component and its test.

- [ ] **Step 4: Integrate draft and editability rules in Settings**

Replace inline color radios and the old sheet state with a preview plus `Change avatar` action. Include `avatarType` in draft reset, edit initialization, duplicate display key, and save payload. Use the current participant and workspace role to expose the action only when it is self-owned or owner/unlinked; do not permit a UI edit path for a linked participant belonging to someone else.

- [ ] **Step 5: Add translated UI copy**

Add equivalent English, Ukrainian, and Spanish entries under `settings` for: `avatar`, `changeAvatar`, `avatarColors`, `avatarSet`, `selectedAvatar`, `selectAvatar`, and five neutral group labels `avatarGroup01` through `avatarGroup05`. Do not add visible raw catalog IDs.

- [ ] **Step 6: Run focused frontend tests**

Run: `npm test -- AvatarPickerSheet.test.ts HouseholdMembersSettings.test.ts`

Expected: PASS for both selection modes, accessibility state, custom color validation, and editability paths.

- [ ] **Step 7: Leave changes uncommitted**

Do not stage or commit.

### Task 6: Render avatars consistently across the app

**Files:**

- Modify: `weekly-us/src/shared/components/AppShell.vue`
- Modify: `weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `weekly-us/src/features/meeting/components/MeetingCheckInStep.vue`
- Modify: `weekly-us/src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `weekly-us/src/pages/TasksPage.vue`
- Modify: `weekly-us/src/pages/HistoryPage.vue`
- Modify: `weekly-us/src/pages/MeetingSummaryPage.vue`
- Modify: `weekly-us/src/shared/components/__tests__/AppShell.test.ts`
- Create: `weekly-us/src/features/meeting/components/__tests__/MeetingCheckInStep.test.ts`
- Create: `weekly-us/src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`
- Create: `weekly-us/src/pages/__tests__/TasksPage.test.ts`
- Create: `weekly-us/src/pages/__tests__/HistoryPage.test.ts`
- Modify: `weekly-us/src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes `ParticipantAvatar` from Task 1 and participant records with optional `avatarType` from Task 2.
- Produces a single visual rule: a valid bundled image replaces initials; color initials remain for null, legacy, and unknown values.

- [ ] **Step 1: Write representative failing render tests**

Update `AppShell.test.ts` and page/component tests to include `avatarType: 'group-02-avatar-03'` and assert an image is rendered. Preserve one null-avatar fixture per test family and assert initials still appear.

```ts
expect(wrapper.find('img[alt="Rita"]').exists()).toBe(true);
expect(wrapper.text()).toContain('AL');
```

- [ ] **Step 2: Run representative tests to verify failure**

Run: `npm test -- AppShell.test.ts MeetingSummaryPage.test.ts SettingsPage.test.ts`

Expected: FAIL because the old views render their own color/initial markup.

- [ ] **Step 3: Replace every ad hoc avatar markup instance**

Import and use the shared component in each listed file. Preserve layout-specific sizing through the `size` prop and wrap a decorative participant marker with `decorative` only when adjacent text already exposes the participant name:

```vue
<ParticipantAvatar :participant="participant" size="small" decorative />
```

Remove inline `backgroundColor` and initials spans only where the shared component replaces them. Do not change meeting/task domain data or unrelated styles.

- [ ] **Step 4: Verify no old display path was missed**

Run: `rg -n "backgroundColor: participant\.avatarColor|\{\{ participant\.initials \}\}" src -g '*.vue'`

Expected: remaining matches are inside `ParticipantAvatar.vue` only, or are documented non-avatar content.

- [ ] **Step 5: Run frontend verification**

Run: `npm test -- AppShell.test.ts MeetingSummaryPage.test.ts SettingsPage.test.ts`

Run: `npm run build`

Run: `npm run check`

Expected: PASS with no type, lint, format, or asset-import errors.

- [ ] **Step 6: Leave changes uncommitted**

Do not stage or commit.

### Task 7: End-to-end contract verification and mobile QA

**Files:**

- Modify if generated: `weekly-us-api/docs/openapi.json`
- Modify if required by failed tests: only files named in Tasks 1–6

**Interfaces:**

- Consumes the fully updated API contract, bundled app assets, and participant sync implementation.
- Produces verified build artifacts; no new feature interfaces.

- [ ] **Step 1: Run the complete backend checks**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Expected: PASS. If a migration test assumes an old migration count or select list, update that assertion narrowly for `avatar_type` rather than weakening the test.

- [ ] **Step 2: Run the complete frontend checks**

Run: `npm test`

Run: `npm run build`

Run: `npm run check`

Expected: PASS with all twenty WebPs bundled successfully.

- [ ] **Step 3: Perform manual mobile QA**

On a narrow Android-sized viewport and a real Android build when available, verify:

1. Color selection—including custom color—still renders initials and closes the one Avatar sheet correctly.
2. Each of the twenty image selections renders with no opaque square background and remains selected after app restart.
3. A signed-in member can change their own image; an owner can change an unlinked/child profile; another linked adult is not editable and is rejected by the API if a crafted sync is attempted.
4. Member images appear in settings, app shell, check-in, meeting notes, task lists, history, and meeting summary.
5. Android Back closes the Avatar bottom sheet before navigating away.
6. A client with legacy local participant data shows color/initial fallback, and an old-style sync payload does not clear a server-selected image.

- [ ] **Step 4: Leave changes uncommitted and report results**

Do not stage or commit. Report the exact checks run, any environment-dependent checks skipped, and any manual QA result requiring user confirmation.
