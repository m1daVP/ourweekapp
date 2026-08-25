# Adult Participant Invitations Design

**Date:** 2026-08-12

## Goal

Replace the inaccessible standalone workspace-members page with one calm flow
that first creates or edits a household person and then, when appropriate,
optionally gives that adult access to OurWeek.

The product continues to distinguish between:

- a participant profile used in meetings, tasks, and agreements; and
- an authenticated workspace member who can open and use the shared household.

The UI should no longer present those as two unrelated ways to add the same
human.

## Scope

This change will:

- remove the named workspace-members page route and the unused
  `WorkspaceSettingsPage.vue` page;
- keep `/settings/workspace` only as a legacy redirect to `/settings`, so an
  old bookmark cannot leave the user on an unmatched screen;
- keep participant creation and editing inside the existing Settings household
  section;
- offer a sequential, optional invitation step after creating an adult;
- let the owner open the same invitation step while editing an existing adult;
- send invitations with the fixed `adult_member` role;
- show whether an adult has no invitation, a pending invitation, or app access;
- retain the existing workspace API and permission model; and
- update English, Ukrainian, and Spanish copy.

This change will not add viewer selection, member removal, invitation
revocation, invitation acceptance UI, a new backend endpoint, or a general
workspace-management screen.

## User Experience

### Creating a person

The existing person form remains focused on the participant profile: name,
type, avatar color, and optional initials.

When the user saves a new person:

- `child` and `other` profiles save and close as they do now;
- an `adult` profile saves first, so invitation failure can never discard it;
- if the current user can invite workspace members, the same bottom sheet then
  advances to an optional invitation step; and
- if the current user cannot invite members, the sheet closes after saving.

The invitation step says, in product-aligned language, that inviting the adult
gives them access to the shared weekly check-in space. It contains:

- one labeled email field;
- a primary **Send invitation** action; and
- a secondary **Not now** action.

The role is not shown. Invitations from this flow always use `adult_member`.

### Editing an existing person

An existing adult with no linked invitation or membership shows a
**Give app access** action in the person editor. Tapping it opens the same email
step without requiring the profile to be saved again.

The editor instead shows a non-interactive status when the adult is already
linked:

- **Invitation pending** with the linked email; or
- **Has app access** with the linked email.

Children and `other` profiles never show invitation controls. If an existing
profile's type is changed to `adult` and saved, the optional invitation step is
offered just as it is for a newly created adult.

Changing an invited adult to another participant type does not revoke their
workspace access. The invitation status is hidden while that profile is not an
adult. Revocation and role changes remain outside this feature.

### Closing and navigation

**Not now**, bottom-sheet dismissal, backdrop dismissal, and Android back all
close the invitation step without affecting the saved participant. Returning
to edit that adult exposes **Give app access** again.

The former `/settings/workspace` URL redirects to `/settings`. No replacement
workspace-management page is added.

## Architecture

### Participant form state

`HouseholdMembersSettings.vue` will own a third sheet view in addition to its
current create and edit views. The views are:

- `create`: create a participant;
- `edit`: edit a participant; and
- `invite`: enter an email and send or skip an adult invitation.

The component will keep the invitation draft and field-level error separate
from participant-form messages. It will continue to use
`useParticipantsStore()` for participant changes and `useWorkspaceStore()` for
workspace access and invitations.

### Participant-to-member association

The backend invitation contract currently accepts an email and role but no
participant id. The frontend therefore stores a small, versioned local link
from participant id to invited email in the workspace settings state. This is
workspace UI/access metadata, not meeting data.

The link record contains:

```ts
interface ParticipantInvitationLink {
  participantId: string;
  email: string;
  invitationId?: string;
}
```

Invitation status is derived by normalizing the linked email and comparing it
with `workspace.members`:

- matching member with `status: 'invited'` -> `pending`;
- matching member with `status: 'active'` -> `active`;
- no link or no matching visible member -> `none`.

Matching by email lets the state continue to work when the backend replaces a
pending invitation id with the accepted member's user id. Email comparison is
trimmed and case-insensitive.

After a successful workspace refresh, the store reconciles the local links
against the returned active and invited members. It removes an orphaned link
when its email is no longer present, allowing a revoked or expired invitation
to be offered again instead of displaying a stale pending state. A failed
workspace refresh does not change the locally persisted workspace or links.

The workspace storage version will be incremented. Existing stored workspaces
receive an empty link collection without altering household or participant
data.

### Store interface

The workspace store will provide focused operations for the component:

```ts
type ParticipantAccessStatus = 'none' | 'pending' | 'active';

interface ParticipantAccessState {
  status: ParticipantAccessStatus;
  email?: string;
}

inviteParticipant(
  participantId: string,
  displayName: string,
  email: string
): Promise<WorkspaceMember | null>;

getParticipantAccessState(
  participantId: string
): ParticipantAccessState;
```

`inviteParticipant` always submits `role: 'adult_member'`. On success it stores
the participant/email association and applies the pending workspace member.

If the entered email already belongs to a visible workspace member, the store
links that existing member to the participant without sending a duplicate API
request. If the email is already linked to a different participant, the action
fails with a user-friendly validation error rather than silently connecting
two profiles to one account.

The lower-level workspace API types and endpoints remain unchanged.

## Error Handling

The invitation step validates a non-empty, syntactically valid email before
calling the store.

While sending:

- the primary and secondary actions are disabled;
- duplicate taps cannot create parallel invitations; and
- the participant remains saved.

API, permission, conflict, and network failures appear as calm inline errors in
the invitation step. The email remains populated so the user can retry. The
user can still choose **Not now** after a failure.

Technical error details are not added to user-facing copy, exports, or logs.

## Removed Page and Retained Services

`WorkspaceSettingsPage.vue` and its router import/named page route are removed.
A path-only legacy redirect sends `/settings/workspace` to `/settings`. Styles
that are used only by the deleted page are removed when they can be identified
without affecting shared participant or bottom-sheet styles.

The following remain because the combined flow still needs them:

- `useWorkspaceStore`;
- workspace permissions;
- workspace member and invitation types;
- `workspaceApi.ts`; and
- invitation-related localization keys reused by the new step.

Unused page-specific localization keys may be removed, but shared error and
action copy should be retained or renamed rather than duplicated.

## Accessibility and Mobile Behavior

- The invitation email uses `type="email"`, `inputmode="email"`, and
  `autocomplete="email"`.
- The field has a visible label and an associated inline error.
- Actions meet the existing mobile tap-target rules.
- The existing `BaseBottomSheet` continues to provide focus trapping, focus
  restoration, backdrop dismissal, body scroll locking, and Android-back
  priority.
- Sending, disabled, status, and error states are communicated with text, not
  color alone.

## Localization

All new and changed user-facing copy will be added in English, Ukrainian, and
Spanish. Copy will use "person" for participant profiles and "app access" or
"invitation" for authenticated access. It will avoid workspace-administration
jargon in the participant flow.

## Testing and Verification

Focused tests will cover:

- a successful adult invitation stores the email link and pending member;
- invitations always use the `adult_member` role;
- matching an existing member by normalized email links without another POST;
- an email linked to another participant is rejected;
- stored invitation links migrate safely from the previous workspace storage
  shape;
- a successful workspace refresh removes links whose email is no longer an
  active member or pending invitation;
- `none`, `pending`, and `active` access states are derived correctly; and
- `/settings/workspace` redirects to `/settings` and no longer loads a page
  component.

Manual mobile verification will cover:

- creating a child closes without an invitation step;
- creating an adult advances to the optional step for an owner;
- **Not now** keeps the newly created adult;
- sending succeeds, shows pending status, and closes cleanly;
- a failed send preserves the adult, email, and retry path;
- editing an uninvited adult exposes **Give app access**;
- editing pending and active adults shows the correct status;
- a user without invite permission sees no invitation action; and
- bottom-sheet dismissal and Android back behave correctly in every view.

Final automated verification:

```bash
npm run build
npm run check
```

Because the worktree already contains unrelated user changes, implementation
must preserve them and review the final diff by file before handoff.
