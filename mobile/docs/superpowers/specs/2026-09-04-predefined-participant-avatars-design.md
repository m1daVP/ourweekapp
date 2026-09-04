# Predefined Participant Avatars Design

## Goal

Let household members choose either a bundled predefined avatar or the existing
solid-color initials avatar. Display that choice consistently wherever a
participant appears, while allowing a signed-in member to change only their
own linked participant avatar and allowing workspace owners to choose avatars
for unlinked participants.

## Scope

This feature spans the mobile app in `weekly-us` and the Fastify API in
`weekly-us-api`. It does not add user image uploads, remote image hosting, or
custom image URLs.

## Asset contract

The app bundles twenty square, transparent-background WebP files supplied by
the product owner. They are stored at:

```
src/assets/avatars/
  animals/{bear,bunny,cat,fox}.webp
  cosmic/{moon,saturn,star,sun}.webp
  abstract/{blob,circles,rainbow,spiral}.webp
  cozy/{book,candle,coffee,headphones}.webp
  flowers/{daisy,monstera,sunflower,tulip}.webp
```

The stable saved value is the globally unique WebP filename stem—`fox`,
`moon`, or `coffee`, for example—never a file path, folder name, or bundler
URL. Moving `fox.webp` between groups therefore does not change stored user
data.

`scripts/generate-avatar-catalog.mjs` scans the asset folders, requires five
groups of four files and unique valid filename stems, then writes
`src/features/participants/avatar-catalog.json`. The frontend imports that
generated manifest and discovers bundled WebPs through Vite. Group membership
is picker-only metadata, not part of an avatar ID.

## Data model and API contract

Add nullable `participants.avatar_type` in a new Supabase migration. Its check
constraint permits a normalized safe identifier format rather than a snapshot
of the frontend catalog. No existing migration is edited. Existing records
remain null and therefore continue to use their saved `avatar_color` and
initials.

Expose `avatarType` in participant read DTOs as one catalog ID or `null`. New
app writes include `avatarType`; selecting a color sends `null`. To support
older installed clients during the rollout, an omitted `avatarType` in an
existing participant sync write preserves the server value rather than clearing
it. API responses always return the resolved nullable field.

The client participant type gains `avatarType?: string | null` so stored legacy
participant state remains readable before its next successful sync. The client
sync mapper includes the value for modern writes. Repository mapping,
content-change comparison, optimistic revisions, response mapping, conflict
DTOs, and test fixtures all include the new field.

`avatar_color` remains required and is not removed. It is retained as both the
color-mode value and the visual fallback for unavailable, missing, or legacy
avatar data.

## Authorization

`participants.user_id` is the established link between an authenticated user
and their participant profile. `avatar_type` is intentionally stored on
`participants`, not `users`, because every UI avatar belongs to a participant
and child/unlinked household profiles have no auth-user row.

The participant sync service receives the authenticated user ID and role when
evaluating an `avatarType` change. It permits the change only when:

1. the target participant's `user_id` equals the authenticated user ID; or
2. the authenticated user has the `owner` role and the target participant is
   unlinked (`user_id is null`).

The service rejects an avatar change to a linked participant owned by another
user. This check is server-side and does not depend on which settings controls
the UI exposes. Normal unchanged participant sync records continue to work.

## App interaction

Replace the standalone color picker entry point with one Avatar bottom sheet.
The sheet has two choices:

- **Colors:** the existing preset colors and custom-color picker. Selecting a
  color sets `avatarType` to `null`.
- **Avatar set:** five named visual groups containing the four supplied image
  choices each. Selecting an image stores its catalog ID and retains the
  existing color as a fallback.

The participant edit form displays the selected visual and offers a `Change
avatar` action rather than inline color choices. New participants begin in
color mode. A signed-in linked member can change their own avatar. Workspace
owners may change avatars for unlinked profiles, including child profiles. A
linked member’s avatar is shown but not editable by another household member.

The edit-form trigger is a full-width settings field row, not an unstyled
button: it presents the current avatar preview, an `Avatar` label, a concise
current-selection value, and a chevron. The custom color wheel and its text
validation render inline within the same Avatar bottom sheet beneath the color
swatches. The standalone custom-color bottom sheet is removed, so no sheet can
open behind another sheet.

The Avatar sheet keeps a local draft selection: choosing a swatch, image, or
wheel value never closes or persists the sheet. The custom-color button toggles
an inline wheel with a reduced-motion-aware expand/collapse transition. One
sticky `Select avatar` action at the bottom confirms the current draft and
closes the sheet; Back, Cancel, and the close affordance discard it.
That confirmation action spans the available sheet width, uses the existing
green primary-button treatment, and has a minimum 48px touch target.

A focused `ParticipantAvatar` component receives a participant and size/style
variant. It renders the locally bundled image when its `avatarType` resolves in
the catalog; otherwise it renders the existing color-and-initials avatar. It
replaces each current ad hoc avatar implementation in the app shell, household
settings, meeting check-in, meeting section notes, task assignees, history,
and meeting summary. This creates identical behavior for the current user and
other members.

## Error handling and compatibility

The API validates the identifier format at the HTTP boundary and returns the
existing safe validation-error shape for unsafe values. An unavailable ID is
not an API error: an app version that does not contain that asset renders its
saved color and initials instead. An unauthorized avatar change returns the
project-standard authorization response without exposing another member's
data. Existing sync conflict behavior is retained: concurrent changes produce
the established typed conflict DTO, including `avatarType` in both versions.

No image binary data, local image path, provider avatar URL, or Supabase service
key is sent to or stored in the database. Because images are bundled, the app
works offline after installation; persisted avatar changes synchronize with the
next normal participant sync.

## Verification

Frontend tests cover generated-catalog completeness and validation,
image/color fallback for unknown IDs, picker selection and clearing behavior,
self versus linked-member editability, sync DTO mapping, and representative
screens using `ParticipantAvatar`.

Backend tests cover schema validation, migration shape, repository mapping,
sync persistence and no-op handling for an omitted legacy field, revision
conflicts, self updates, owner updates for unlinked participants, and rejection
of an attempt to modify another linked member's avatar. Run frontend unit tests
and typecheck, plus backend `npm run typecheck` and `npm test`; run builds once
the WebP assets are present.
