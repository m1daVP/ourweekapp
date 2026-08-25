# Adult Participant Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone workspace-members page and let owners optionally give adult participant profiles app access from the existing Settings person flow.

**Architecture:** Keep participants and authenticated workspace members as separate domain records, while adding a versioned local workspace mapping from participant id to member email. `HouseholdMembersSettings.vue` becomes a three-view bottom-sheet flow (`create`, `edit`, `invite`) and delegates invitation persistence, member matching, and status derivation to `useWorkspaceStore`.

**Tech Stack:** Vue 3.5, TypeScript 6, Pinia 3, Vue Router 5, vue-i18n 11, Vitest, Vite 8, npm

## Global Constraints

- Mobile-only, Android-first, and iOS-ready; retain `BaseBottomSheet` safe-area, focus, and Android-back behavior.
- Invitations are optional, adult-only, owner-authorized, and always use `role: 'adult_member'`.
- Saving or editing a participant must succeed independently of invitation sending.
- Do not add a dependency or change the backend API contract.
- Keep new copy calm and available in English, Ukrainian, and Spanish.
- Preserve all unrelated uncommitted changes, especially the existing edits in `src/features/participants/components/HouseholdMembersSettings.vue`, `src/features/localization/messages.ts`, and `src/styles/main.css`.
- Do not stage or commit without a separately pasted, explicitly approved commit list.
- Run `npm run build` and `npm run check` before handoff.

---

## File Structure

- `src/features/workspace/types.ts`: owns participant-access link and status types because they connect a participant profile to workspace access.
- `src/app/stores/workspace.ts`: owns link migration, persistence, invitation sending, existing-member matching, reconciliation, and access-state derivation.
- `src/app/stores/__tests__/workspace.test.ts`: tests the workspace invitation/link behavior without mounting Vue components.
- `src/app/router/legacySettingsRoutes.ts`: contains the path-only redirect for the removed page.
- `src/app/router/__tests__/legacySettingsRoutes.test.ts`: verifies the legacy URL redirects to Settings and has no page component.
- `src/app/router/index.ts`: removes the workspace page import and named page route, then includes the legacy redirect.
- `src/pages/WorkspaceSettingsPage.vue`: deleted because its invitation UI moves into participant settings.
- `src/features/participants/components/HouseholdMembersSettings.vue`: owns the create/edit/invite bottom-sheet views and their form-level state.
- `src/features/localization/messages.ts`: supplies the new access and invitation copy in all supported locales and removes page-only copy.
- `src/styles/main.css`: styles the compact invitation view/status and removes selectors used only by the deleted page.

---

### Task 1: Add participant-to-workspace invitation state

**Files:**

- Modify: `src/features/workspace/types.ts:1-32`
- Modify: `src/app/stores/workspace.ts:12-411`
- Create: `src/app/stores/__tests__/workspace.test.ts`

**Interfaces:**

- Consumes: `createWorkspaceInvitation(payload)`, `WorkspaceMember`, `readSettingsStorage()`, `writeSettingsStorage()`.
- Produces: `ParticipantInvitationLink`, `ParticipantAccessStatus`, `ParticipantAccessState`, `useWorkspaceStore().inviteParticipant(participantId, displayName, email)`, and `useWorkspaceStore().getParticipantAccessState(participantId)`.

- [ ] **Step 1: Write failing workspace-store tests**

Create `src/app/stores/__tests__/workspace.test.ts` with hoisted storage and API mocks. The test setup must be able to provide a stored version-1 workspace before each fresh Pinia store is created.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { createWorkspaceInvitation } from '@/shared/api/workspaceApi';

const mocks = vi.hoisted(() => ({
  storedWorkspace: null as unknown,
  writeSettingsStorage: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readSettingsStorage: (_key: string, fallback: unknown) =>
    mocks.storedWorkspace ?? fallback,
  writeSettingsStorage: mocks.writeSettingsStorage,
}));

vi.mock('@/shared/api/workspaceApi', () => ({
  createWorkspaceInvitation: vi.fn(),
  getWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  updateWorkspace: vi.fn(),
  updateWorkspaceMember: vi.fn(),
}));

const createInvitationMock = vi.mocked(createWorkspaceInvitation);

function storedState() {
  return {
    version: 1,
    currentUserId: 'owner-1',
    workspace: {
      id: 'workspace-1',
      name: 'Our home',
      ownerId: 'owner-1',
      members: [
        {
          userId: 'owner-1',
          displayName: 'Rita',
          email: 'rita@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
      createdAt: '2026-08-12T08:00:00.000Z',
      updatedAt: '2026-08-12T08:00:00.000Z',
    },
  };
}

beforeEach(() => {
  mocks.storedWorkspace = storedState();
  mocks.writeSettingsStorage.mockReset();
  createInvitationMock.mockReset();
  setActivePinia(createPinia());
});
```

Add these behavioral cases:

```ts
it('migrates version-one workspace state with no invitation links', () => {
  const store = useWorkspaceStore();
  expect(store.participantInvitationLinks).toEqual({});
});

it('invites an adult member and stores a normalized participant link', async () => {
  createInvitationMock.mockResolvedValue({
    invitationId: 'invite-1',
    email: 'Alex@Example.com',
    displayName: 'Alex',
    role: 'adult_member',
    status: 'pending',
    createdAt: '2026-08-12T09:00:00.000Z',
    expiresAt: '2026-08-19T09:00:00.000Z',
  });
  const store = useWorkspaceStore();

  await store.inviteParticipant('participant-1', 'Alex', ' Alex@Example.com ');

  expect(createInvitationMock).toHaveBeenCalledWith({
    displayName: 'Alex',
    email: 'alex@example.com',
    role: 'adult_member',
  });
  expect(store.participantInvitationLinks['participant-1']).toEqual({
    participantId: 'participant-1',
    email: 'alex@example.com',
    invitationId: 'invite-1',
  });
  expect(store.getParticipantAccessState('participant-1')).toEqual({
    status: 'pending',
    email: 'alex@example.com',
  });
});

it('links an existing member by case-insensitive email without posting', async () => {
  const store = useWorkspaceStore();

  const member = await store.inviteParticipant(
    'participant-me',
    'Rita',
    ' RITA@example.com '
  );

  expect(member?.userId).toBe('owner-1');
  expect(createInvitationMock).not.toHaveBeenCalled();
  expect(store.getParticipantAccessState('participant-me')).toEqual({
    status: 'active',
    email: 'rita@example.com',
  });
});

it('rejects an email already connected to a different participant', async () => {
  const store = useWorkspaceStore();
  store.participantInvitationLinks = {
    'participant-1': {
      participantId: 'participant-1',
      email: 'alex@example.com',
    },
  };

  const member = await store.inviteParticipant(
    'participant-2',
    'Other Alex',
    'alex@example.com'
  );

  expect(member).toBeNull();
  expect(store.errorMessage).toBe('workspace.emailAlreadyLinked');
  expect(createInvitationMock).not.toHaveBeenCalled();
});

it('derives active and pending access and clears orphan links after refresh', () => {
  const store = useWorkspaceStore();
  store.participantInvitationLinks = {
    active: { participantId: 'active', email: 'rita@example.com' },
    missing: { participantId: 'missing', email: 'missing@example.com' },
  };

  store.applyWorkspace(store.workspace);

  expect(store.getParticipantAccessState('active').status).toBe('active');
  expect(store.getParticipantAccessState('missing').status).toBe('none');
  expect(store.participantInvitationLinks.missing).toBeUndefined();
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/workspace.test.ts
```

Expected: failure because the new types, state property, and store methods do not exist.

- [ ] **Step 3: Add workspace access types**

Add to `src/features/workspace/types.ts`:

```ts
export type ParticipantAccessStatus = 'none' | 'pending' | 'active';

export interface ParticipantInvitationLink {
  participantId: string;
  email: string;
  invitationId?: string;
}

export interface ParticipantAccessState {
  status: ParticipantAccessStatus;
  email?: string;
}
```

- [ ] **Step 4: Implement versioned link normalization and persistence**

In `src/app/stores/workspace.ts`, bump `STORAGE_VERSION` to `2`, add `participantInvitationLinks` to `WorkspaceState` and `StoredWorkspaceState`, and normalize stored values without deleting version-1 data.

```ts
function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

function normalizeParticipantInvitationLinks(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, ParticipantInvitationLink>;
  }

  return Object.values(value as Record<string, unknown>).reduce<
    Record<string, ParticipantInvitationLink>
  >((links, candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return links;
    }

    const link = candidate as Partial<ParticipantInvitationLink>;
    const participantId = link.participantId?.trim();
    const email = link.email ? normalizeEmail(link.email) : '';

    if (participantId && email) {
      links[participantId] = {
        participantId,
        email,
        invitationId: link.invitationId?.trim() || undefined,
      };
    }

    return links;
  }, {});
}
```

Initialize the property to `{}` for a new store, read it from stored state when present, and include it in `persist()`:

```ts
writeSettingsStorage('workspace', {
  version: STORAGE_VERSION,
  currentUserId: this.currentUserId,
  workspace: this.workspace,
  participantInvitationLinks: this.participantInvitationLinks,
});
```

- [ ] **Step 5: Implement reconciliation and access-state derivation**

Add a store action that derives status from the linked email and visible workspace members:

```ts
getParticipantAccessState(participantId: string): ParticipantAccessState {
  const link = this.participantInvitationLinks[participantId];

  if (!link) {
    return { status: 'none' };
  }

  const member = this.workspace.members.find(
    (candidate) =>
      candidate.status !== 'removed' &&
      candidate.email &&
      normalizeEmail(candidate.email) === link.email
  );

  if (!member) {
    return { status: 'none' };
  }

  return {
    status: member.status === 'active' ? 'active' : 'pending',
    email: link.email,
  };
}
```

After `applyWorkspace()` normalizes a successful backend response, retain only links whose normalized email exists on an active or invited member. Do not reconcile on a failed `loadWorkspace()` call.

- [ ] **Step 6: Replace the generic page invitation action with the participant-focused action**

Replace `inviteWorkspaceMember(payload)` with:

```ts
async inviteParticipant(
  participantId: string,
  displayName: string,
  emailValue: string
) {
  const normalizedParticipantId = participantId.trim();
  const normalizedDisplayName = displayName.trim();
  const email = normalizeEmail(emailValue);

  if (!normalizedParticipantId || !normalizedDisplayName || !email) {
    return null;
  }

  this.errorMessage = '';

  const conflictingLink = Object.values(
    this.participantInvitationLinks
  ).find(
    (link) =>
      link.participantId !== normalizedParticipantId && link.email === email
  );

  if (conflictingLink) {
    this.errorMessage = translate('workspace.emailAlreadyLinked');
    return null;
  }

  const existingMember = this.workspace.members.find(
    (member) =>
      member.status !== 'removed' &&
      member.email &&
      normalizeEmail(member.email) === email
  );

  if (existingMember) {
    this.participantInvitationLinks[normalizedParticipantId] = {
      participantId: normalizedParticipantId,
      email,
    };
    this.persist();
    return existingMember;
  }

  this.isSaving = true;
  this.errorMessage = '';

  try {
    const invitation = await createWorkspaceInvitation({
      displayName: normalizedDisplayName,
      email,
      role: 'adult_member',
    });
    const member: WorkspaceMember = {
      userId: invitation.invitationId,
      displayName: invitation.displayName?.trim() || normalizedDisplayName,
      email: normalizeEmail(invitation.email),
      role: 'adult_member',
      status: 'invited',
    };

    this.applyMember(member);
    this.participantInvitationLinks[normalizedParticipantId] = {
      participantId: normalizedParticipantId,
      email,
      invitationId: invitation.invitationId,
    };
    this.persist();
    return member;
  } catch (error) {
    this.errorMessage = getErrorMessage(
      error,
      translate('workspace.saveInviteFailed')
    );
    return null;
  } finally {
    this.isSaving = false;
  }
}
```

- [ ] **Step 7: Run focused tests and review persistence calls**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/workspace.test.ts
```

Expected: all workspace-store tests pass. Confirm the successful invitation persists after both `applyMember()` and link assignment, and that the final persisted state contains the link.

- [ ] **Step 8: Review checkpoint**

Review only the Task 1 diff for accidental changes. Do not stage or commit it without explicit approval.

---

### Task 2: Remove the workspace-members page and retain a safe legacy redirect

**Files:**

- Create: `src/app/router/legacySettingsRoutes.ts`
- Create: `src/app/router/__tests__/legacySettingsRoutes.test.ts`
- Modify: `src/app/router/index.ts:1-142`
- Delete: `src/pages/WorkspaceSettingsPage.vue`

**Interfaces:**

- Consumes: the existing named `settings` route.
- Produces: `legacySettingsRoutes`, containing a path-only `/settings/workspace` redirect with no component and no route name.

- [ ] **Step 1: Write the failing legacy-route test**

Create `src/app/router/__tests__/legacySettingsRoutes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { legacySettingsRoutes } from '@/app/router/legacySettingsRoutes';

describe('legacy settings routes', () => {
  it('redirects the removed workspace page to settings', () => {
    expect(legacySettingsRoutes).toEqual([
      {
        path: '/settings/workspace',
        redirect: { name: 'settings' },
      },
    ]);
    expect(legacySettingsRoutes[0]).not.toHaveProperty('component');
    expect(legacySettingsRoutes[0]).not.toHaveProperty('name');
  });
});
```

- [ ] **Step 2: Run the route test and confirm it fails**

Run:

```bash
npm exec vitest -- run src/app/router/__tests__/legacySettingsRoutes.test.ts
```

Expected: module-not-found failure for `legacySettingsRoutes`.

- [ ] **Step 3: Add the pure redirect manifest**

Create `src/app/router/legacySettingsRoutes.ts`:

```ts
import type { RouteRecordRaw } from 'vue-router';

export const legacySettingsRoutes: RouteRecordRaw[] = [
  {
    path: '/settings/workspace',
    redirect: { name: 'settings' },
  },
];
```

- [ ] **Step 4: Update the app router and delete the page**

In `src/app/router/index.ts`:

- remove the `WorkspaceSettingsPage` import;
- import `legacySettingsRoutes`;
- replace the named `workspace-settings` component route with `...legacySettingsRoutes` immediately after the main `/settings` route.

The relevant route sequence becomes:

```ts
{
  path: '/settings',
  name: 'settings',
  component: SettingsPage,
},
...legacySettingsRoutes,
{
  path: '/settings/privacy',
  name: 'privacy',
  component: PrivacyPolicyPage,
},
```

Delete `src/pages/WorkspaceSettingsPage.vue` with `apply_patch`. Do not alter workspace API or permission files.

- [ ] **Step 5: Run the route test and search for stale references**

Run:

```bash
npm exec vitest -- run src/app/router/__tests__/legacySettingsRoutes.test.ts
rg -n "WorkspaceSettingsPage|workspace-settings" src
```

Expected: test passes and `rg` returns no stale page import or named route.

- [ ] **Step 6: Review checkpoint**

Confirm `/settings/workspace` is redirect-only and no member-management page remains. Do not stage or commit without explicit approval.

---

### Task 3: Add the optional adult invitation view to participant settings

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:1-431`
- Modify: `src/features/localization/messages.ts:317-350,599-644,1724-1755,2010-2055,3168-3199,3461-3507`
- Modify: `src/styles/main.css:977-980,1185-1200,1447-1454,2269-2296,2599-2784`

**Interfaces:**

- Consumes: `useWorkspacePermissions().can('inviteMembers')`, `workspaceStore.inviteParticipant()`, `workspaceStore.getParticipantAccessState()`, and `workspaceStore.isSaving/errorMessage`.
- Produces: a three-view participant bottom sheet with adult-only optional access controls.

- [ ] **Step 1: Extend component state without changing the template**

Change the sheet mode and add invite state:

```ts
import { useWorkspacePermissions } from '@/shared/composables/useWorkspacePermissions';

type SheetMode = 'create' | 'edit' | 'invite';

const { can } = useWorkspacePermissions();
const inviteEmail = ref('');
const inviteError = ref('');

const sheetTitle = computed(() => {
  if (sheetMode.value === 'invite') {
    return t('settings.invitePerson', {
      name: selectedParticipant.value?.name ?? '',
    });
  }

  return sheetMode.value === 'create'
    ? t('settings.addPerson')
    : t('settings.editPerson');
});

const selectedParticipantAccess = computed(() =>
  selectedParticipantId.value
    ? workspaceStore.getParticipantAccessState(selectedParticipantId.value)
    : { status: 'none' as const }
);
```

Add the deleted page's email-validation rule locally:

```ts
function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
```

- [ ] **Step 2: Add invite-step transitions and submission**

Add these component methods:

```ts
function canInviteParticipant(participant: Participant | null) {
  return Boolean(
    participant &&
    participant.type === 'adult' &&
    can('inviteMembers') &&
    workspaceStore.getParticipantAccessState(participant.id).status === 'none'
  );
}

function openInviteStep(participant: Participant) {
  if (!canInviteParticipant(participant)) {
    return;
  }

  selectedParticipantId.value = participant.id;
  sheetMode.value = 'invite';
  inviteEmail.value = '';
  inviteError.value = '';
  isSheetOpen.value = true;
}

function skipInvite() {
  inviteError.value = '';
  closeSheet();
}

async function sendInvite() {
  const participant = selectedParticipant.value;
  const email = inviteEmail.value.trim();

  if (!participant) {
    inviteError.value = t('settings.invitePersonMissing');
    return;
  }

  if (!isEmail(email)) {
    inviteError.value = t('workspace.addEmailFirst');
    return;
  }

  inviteError.value = '';
  const member = await workspaceStore.inviteParticipant(
    participant.id,
    participant.name,
    email
  );

  if (!member) {
    inviteError.value =
      workspaceStore.errorMessage || t('workspace.saveInviteFailed');
    return;
  }

  setParticipantMessage(
    member.status === 'active'
      ? t('settings.appAccessLinked')
      : t('settings.invitationSent')
  );
  closeSheet();
}
```

Make `closeSheet()` ignore dismissal while an invitation request is active and clear invite-only errors on a completed dismissal:

```ts
function closeSheet() {
  if (sheetMode.value === 'invite' && workspaceStore.isSaving) {
    return;
  }

  inviteError.value = '';
  isSheetOpen.value = false;
}
```

- [ ] **Step 3: Advance newly created adults and newly adult profiles**

In the create branch of `saveParticipantDraft()`, replace the unconditional close with:

```ts
meetingsStore.syncActiveMeetingParticipants();
setParticipantMessage(t('settings.participantAdded'));

if (canInviteParticipant(participant)) {
  openInviteStep(participant);
} else {
  closeSheet();
}
return;
```

In the edit branch, capture whether the saved profile is changing into an adult before updating:

```ts
const shouldOfferInviteAfterSave =
  selectedParticipant.value?.type !== 'adult' &&
  participantDraft.type === 'adult';
```

After successful updates, get the updated selected participant. If `shouldOfferInviteAfterSave` and `canInviteParticipant(updatedParticipant)` are true, call `openInviteStep(updatedParticipant)`; otherwise close normally. Saving an already-adult profile must not force the invitation step.

- [ ] **Step 4: Render the invite view and existing-adult access state**

Inside the existing `BaseBottomSheet`, render the invitation form when `sheetMode === 'invite'` and the participant form otherwise:

```vue
<form
  v-if="sheetMode === 'invite'"
  class="participant-invite-form task-editor-form"
  @submit.prevent="sendInvite"
>
  <p class="meeting-help">
    {{
      t('settings.invitePersonHelp', {
        name: selectedParticipant?.name ?? '',
      })
    }}
  </p>

  <label>
    <span>{{ t('workspace.contact') }}</span>
    <input
      v-model="inviteEmail"
      autocomplete="email"
      inputmode="email"
      type="email"
      :aria-describedby="inviteError ? 'participant-invite-error' : undefined"
      :aria-invalid="Boolean(inviteError)"
      :placeholder="t('workspace.contactPlaceholder')"
    />
  </label>

  <p
    v-if="inviteError"
    id="participant-invite-error"
    class="meeting-error"
    role="alert"
  >
    {{ inviteError }}
  </p>

  <div class="participant-sheet-form__actions">
    <button
      class="meeting-primary"
      type="submit"
      :disabled="workspaceStore.isSaving"
    >
      {{
        workspaceStore.isSaving
          ? t('workspace.sendingInvitation')
          : t('workspace.sendInvitation')
      }}
    </button>
    <button
      class="secondary-button"
      type="button"
      :disabled="workspaceStore.isSaving"
      @click="skipInvite"
    >
      {{ t('settings.notNow') }}
    </button>
  </div>
</form>
```

In the edit form, above the hide/remove action, show one of:

```vue
<button
  v-if="canInviteParticipant(selectedParticipant)"
  class="participant-access-action"
  type="button"
  @click="selectedParticipant && openInviteStep(selectedParticipant)"
>
  <span class="material-symbols-outlined" aria-hidden="true">person_add</span>
  {{ t('settings.giveAppAccess') }}
</button>

<p
  v-else-if="
    selectedParticipant?.type === 'adult' &&
    can('inviteMembers') &&
    selectedParticipantAccess.status !== 'none'
  "
  class="participant-access-status"
  role="status"
>
  <strong>
    {{
      selectedParticipantAccess.status === 'active'
        ? t('settings.hasAppAccess')
        : t('settings.invitationPending')
    }}
  </strong>
  <span>{{ selectedParticipantAccess.email }}</span>
</p>
```

Do not render any access control or status for `child` or `other` profiles, or for users without `inviteMembers` permission.

- [ ] **Step 5: Add localized copy and remove page-only strings**

Add these English keys to the English `settings` object:

```ts
invitePerson: 'Invite {name}',
invitePersonHelp:
  'Give {name} access to your shared weekly check-in space. You can also do this later.',
invitePersonMissing: 'This person is no longer available.',
giveAppAccess: 'Give app access',
hasAppAccess: 'Has app access',
invitationPending: 'Invitation pending',
invitationSent: 'Invitation sent.',
appAccessLinked: 'App access connected.',
notNow: 'Not now',
```

Add the Ukrainian settings copy:

```ts
invitePerson: 'Запросити {name}',
invitePersonHelp:
  'Надайте {name} доступ до спільного простору щотижневих зустрічей. Це можна зробити й пізніше.',
invitePersonMissing: 'Ця людина більше недоступна.',
giveAppAccess: 'Надати доступ до застосунку',
hasAppAccess: 'Має доступ до застосунку',
invitationPending: 'Запрошення очікує на прийняття',
invitationSent: 'Запрошення надіслано.',
appAccessLinked: 'Доступ до застосунку підключено.',
notNow: 'Не зараз',
```

Add the Spanish settings copy:

```ts
invitePerson: 'Invitar a {name}',
invitePersonHelp:
  'Dale a {name} acceso al espacio compartido de reuniones semanales. También puedes hacerlo más tarde.',
invitePersonMissing: 'Esta persona ya no está disponible.',
giveAppAccess: 'Dar acceso a la app',
hasAppAccess: 'Tiene acceso a la app',
invitationPending: 'Invitación pendiente',
invitationSent: 'Invitación enviada.',
appAccessLinked: 'Acceso a la app vinculado.',
notNow: 'Ahora no',
```

Add `workspace.emailAlreadyLinked` in each locale:

```ts
// English
emailAlreadyLinked: 'This email is already connected to another person.',

// Ukrainian
emailAlreadyLinked:
  'Ця електронна адреса вже пов’язана з іншою людиною.',

// Spanish
emailAlreadyLinked: 'Este correo ya está vinculado a otra persona.',
```

Retain workspace keys used by the new form: `contact`, `contactPlaceholder`, `addEmailFirst`, `sendInvitation`, `sendingInvitation`, `saveInviteFailed`, and `emailAlreadyLinked`. Remove keys used only by the deleted page after confirming they have no remaining references with `rg`.

The exact page-only key list to remove from all three locale blocks is: `title`, `intro`, `currentMembersLabel`, `member`, `viewer`, `admin`, `removeMember`, `pendingInvites`, `invitationPending`, `resend`, `inviteReady`, `inviteNewMember`, `closeInviteForm`, `goBack`, `addMember`, `role`, `inviteHelp`, `ownerInviteOnly`, `addContactFirst`, `invitationSaved`, `ownerRemoveOnly`, and `memberRemoved`. Keep `loading`, `loadFailed`, `saveWorkspaceFailed`, `saveMemberFailed`, and `removeMemberFailed` because retained store actions still reference them.

- [ ] **Step 6: Add compact mobile styles and remove deleted-page selectors**

Add styles consistent with the existing participant sheet:

```css
.participant-invite-form,
.participant-access-status {
  display: grid;
  gap: var(--space-3);
}

.participant-access-action {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.participant-access-status {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-low);
}

.participant-access-status span {
  overflow-wrap: anywhere;
}
```

Remove `.workspace-members-page`, `.workspace-members-hero`, `.workspace-member-cards`, `.workspace-pending-invites`, `.workspace-member-card`, `.workspace-invite-card`, `.workspace-invite-dock`, and `.workspace-invite-form` selectors after the page is deleted. The new form uses `.participant-invite-form`; no workspace-page selector is retained.

- [ ] **Step 7: Format only the touched implementation files**

Run:

```bash
npm exec prettier -- --write src/features/workspace/types.ts src/app/stores/workspace.ts src/app/stores/__tests__/workspace.test.ts src/app/router/legacySettingsRoutes.ts src/app/router/__tests__/legacySettingsRoutes.test.ts src/app/router/index.ts src/features/participants/components/HouseholdMembersSettings.vue src/features/localization/messages.ts src/styles/main.css
```

Expected: touched files are formatted without rewriting unrelated documents or platform files.

- [ ] **Step 8: Review checkpoint**

Inspect the component, localization, and CSS diffs carefully against the pre-existing dirty changes. Do not stage or commit without explicit approval.

---

### Task 4: Verify the complete flow and protect the existing worktree

**Files:**

- Verify: all files changed in Tasks 1-3
- Verify: `docs/superpowers/specs/2026-08-12-adult-participant-invitations-design.md`

**Interfaces:**

- Consumes: completed store, router, and participant UI changes.
- Produces: a buildable, lint-clean implementation with a documented manual QA result.

- [ ] **Step 1: Run focused tests together**

Run:

```bash
npm exec vitest -- run src/app/stores/__tests__/workspace.test.ts src/app/router/__tests__/legacySettingsRoutes.test.ts
```

Expected: all new tests pass.

- [ ] **Step 2: Run the full automated test suite**

Run:

```bash
npm test
```

Expected: all existing source and API contract tests pass.

- [ ] **Step 3: Run required project verification**

Run:

```bash
npm run build
npm run check
```

Expected: TypeScript/Vite build, Prettier check, and ESLint all pass.

- [ ] **Step 4: Perform static cleanup checks**

Run:

```bash
rg -n "WorkspaceSettingsPage|workspace-settings|inviteWorkspaceMember" src
rg -n "workspace-members-page|workspace-member-card|workspace-invite-card" src
```

Expected: no stale page, named route, old store action, or deleted-page CSS references remain.

- [ ] **Step 5: Manually verify the mobile interaction**

Using the Vite mobile viewport or an Android debug build, verify each exact case:

1. Create `child` and `other` people: saving closes the sheet with no invite screen.
2. Create an adult as the owner: the sheet advances to email invitation.
3. Tap **Not now**: the adult remains in the household list.
4. Reopen that adult: **Give app access** is present.
5. Submit an invalid email: the field shows its associated inline error.
6. Submit a valid email: controls disable while sending, then pending status appears on edit.
7. Use an email already belonging to an active member: it links without a second invitation and displays **Has app access**.
8. Change a child to adult: saving offers the optional invitation step once.
9. Edit an already-adult profile: ordinary saving does not force the invite step.
10. Use a non-owner account: invitation actions and statuses are absent.
11. Dismiss the invite view using **Not now**, backdrop, and Android back: the saved participant remains intact.
12. Open `/settings/workspace`: it redirects to `/settings` without rendering the deleted page.

- [ ] **Step 6: Review the final diff without modifying unrelated files**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us status --short
git -c safe.directory=D:/Projects/myself/weekly-us diff --check
```

Separate the feature's files from the user's pre-existing changes in the handoff summary. Do not stage, commit, restore, or discard any file.
