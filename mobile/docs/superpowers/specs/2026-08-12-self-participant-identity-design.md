# Self Participant Identity Design

**Date:** 2026-08-12

## Goal

Prevent OurWeek from offering to invite the participant profile that represents
the signed-in user, including after that profile is renamed.

## Problem

Participant profiles and authenticated workspace members are intentionally
separate records. The adult invitation flow currently knows whether an adult
has a linked invitation, but it does not know which participant represents the
current user. As a result, the user's own adult profile can show **Give app
access**.

Name comparison is not a safe identity mechanism because the default **Me**
profile and the account display name can both be edited.

## Data Model

The participants store will persist a stable optional id:

```ts
interface ParticipantsState {
  participants: Participant[];
  currentParticipantId: string | null;
}
```

This metadata belongs with participant state because it identifies one local
participant record. It is not sent as part of `ParticipantDto` and does not
change the backend participant sync contract.

The store will expose:

```ts
isCurrentParticipant(participantId: string): boolean;
```

Renaming, recoloring, enabling, or disabling a participant does not change
`currentParticipantId`.

## Initialization and Migration

For fresh state, default participant creation assigns `currentParticipantId`
to the id of the seeded **Me** participant.

For stored participant state:

1. Keep the stored `currentParticipantId` when it references a non-deleted
   participant.
2. Otherwise, prefer the first non-deleted adult whose normalized name matches
   the current locale's default **Me** label.
3. If the profile was already renamed, use the first active, non-deleted adult.
4. If there is no active adult, use the first non-deleted adult.
5. If there is no adult participant, store `null`.

The fallback is compatible with the existing data shape because OurWeek has
historically seeded **Me** as the first participant and **Partner** as the
second. Migration never renames, removes, or reorders participant records.

Legacy meeting-participant recovery uses the same selection rules after the
participants have been normalized.

## Invitation Eligibility

`HouseholdMembersSettings.vue` will extend its existing invitation eligibility
check. An invitation is available only when the participant:

- exists;
- is an adult;
- is not `participantsStore.isCurrentParticipant(participant.id)`;
- has no pending or active participant-access link; and
- the current workspace role has `inviteMembers` permission.

The same centralized check controls:

- the optional invitation step after creating or changing a profile to adult;
- the **Give app access** action while editing; and
- access-status display in the editor.

The user's own profile therefore shows neither invitation actions nor pending
or active invitation status.

New adults created later are never automatically treated as the current user.
This correction does not add a UI for changing which profile represents the
current user.

## Error Handling

If migrated data contains an invalid stored id, the store applies the fallback
selection rules without deleting participant data. An empty or child-only
participant collection produces `currentParticipantId: null` and no runtime
error.

## Testing and Verification

Focused participant-store tests will verify:

- fresh default state marks the seeded **Me** participant;
- a valid stored id survives hydration and renaming;
- invalid or missing stored ids select the first appropriate adult;
- child-only state produces `null`; and
- `isCurrentParticipant()` returns the expected result.

The invitation eligibility will be extracted into a small pure helper so tests
can verify that:

- the current participant is never inviteable;
- another adult remains inviteable when permissions and access state allow it;
- children, linked adults, and unauthorized users remain ineligible; and
- access status is hidden for the current participant.

Final verification:

```bash
npm test
npm run build
```

Feature-touched files must pass focused ESLint and Prettier checks. The known
repository-wide generated iOS lint and unrelated formatting failures remain
outside this correction.
