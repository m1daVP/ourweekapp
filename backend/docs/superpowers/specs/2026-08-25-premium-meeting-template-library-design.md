# Premium Meeting Template Library Design

## Goal

Make the existing Premium meeting formats easy to recognize and choose by the
household situation they help resolve, while keeping the default weekly
check-in Free and preserving meetings already in progress after Premium expiry.

## Scope

- Launch the existing Premium template IDs as the focused library: Couple
  reset, Family with kids, Money check-in, Conflict cleanup, and Busy week
  planning.
- Retain the existing content and section order for every format.
- Keep Weekly family check-in as the sole Free default template.
- Preserve the current mobile template-card pattern: name, short description,
  and a small set of outcome-focused tags.
- Make the selection and upgrade moment clear and owner-aware.
- Ensure server enforcement blocks new Free Premium-format meetings without
  trapping an in-progress Premium-format meeting after expiry.

## Out of Scope

- New template IDs, new sections, or rewriting the existing prompts.
- A database-backed template CMS, template customization, or saved household
  templates.
- A separate template-library navigation flow or long section-by-section
  previews.
- Calendar, AI, follow-up, private-note, insight, or billing-provider changes.

## Product Rules

### Template catalog

The client keeps the existing six template IDs and their current section
definitions:

| Template | Access | Outcome tags |
| --- | --- | --- |
| Weekly family check-in | Free | Weekly rhythm, Shared plan |
| Couple reset | Premium | Reconnect, Clear next step |
| Family with kids | Premium | Smoother routines, Share the load |
| Money check-in | Premium | Make a money decision, Plan ahead |
| Conflict cleanup | Premium | Talk it through, Agree what changes |
| Busy week planning | Premium | Make the week workable, Backup plan |

Tags are translation-ready, short, and describe a useful outcome rather than a
locked capability. The existing card layout remains the library interface; the
selected card and fixed bottom CTA remain the sole way to start a meeting.

### Access and roles

- The default Weekly family check-in remains available to all current roles
  according to existing meeting permissions.
- An owner or adult member with a trusted Premium household entitlement may
  start any Premium format.
- Free owners/adult members may browse and select a Premium card, but its CTA
  leads to the existing owner-aware purchase flow. Non-owner adults receive the
  existing owner-managed explanation.
- Viewers cannot start meetings regardless of plan.
- The API remains authoritative: a Free client cannot create a new Premium
  meeting by bypassing the client card lock and sending a Premium template ID
  through sync.

### Expiry and existing meetings

- Completed meetings remain readable for every household, regardless of the
  template used or current plan.
- A non-deleted Premium-format meeting that was created while Premium was
  active remains resumable and editable after expiry. This prevents a household
  from being stranded mid-conversation.
- After expiry, the household cannot create or duplicate a *new*
  Premium-format meeting. The server distinguishes an existing server meeting
  from a new insert when applying sync validation.
- The client presents a calm expired-Premium explanation for new selections;
  it never hides or invalidates the existing draft.

## Architecture

### Client-owned catalog metadata

Template definitions already live in the client and the API persists the chosen
`templateId` with each meeting. This milestone adds optional localized
outcome-tag metadata to the existing template model and changes the five
non-default definitions from their temporary Free state to Premium. No schema
migration is needed.

The library page uses the existing `TemplateCard` and selected-template state.
Cards display name, description, and tags. Selecting a locked card remains
allowed so a household can decide whether the format fits; starting it invokes
the established `additionalTemplates` access/purchase behavior.

### Backend validation

The backend already owns the canonical Free/Premium template ID sets. Refine
meeting sync validation to accept a Premium template when either:

1. the workspace has trusted Premium entitlement; or
2. the incoming meeting ID already identifies a non-deleted server meeting
   with the same Premium template ID.

The second rule is a narrow continuation exception. It must not allow a Free
client to change an existing Free meeting to a Premium template, resurrect a
deleted Premium meeting, or create a new Premium-template ID.

## Data Flow

### Starting a new meeting

1. An eligible adult opens the current template library.
2. The household selects a format based on its outcome tags and description.
3. Free/default selection starts the existing weekly meeting flow.
4. Premium selection starts the format only when `additionalTemplates` is
   available; otherwise the client shows the existing household-plan upgrade
   state.
5. Sync validates the template ID independently of the client UI.

### Resuming after expiry

1. A household with an existing Premium-format draft loses Premium access.
2. The library offers the existing draft's Resume action.
3. The client syncs the same meeting ID and same template ID.
4. The API accepts that continuation, preserving the meeting's data and normal
   revision-conflict behavior.
5. The expired household cannot start another Premium-format meeting.

## Error Handling and Security

- Keep the existing safe meeting sync conflict behavior for invalid template
  references. Do not expose entitlement internals or database errors.
- The continuation exception is scoped by `workspace_id`, meeting ID,
  non-deleted server row, and unchanged Premium template ID.
- Role checks remain centralized in the meetings service; client locks are only
  a usability aid.
- Do not log meeting prompts, notes, or agreement text as part of catalog or
  entitlement diagnostics.

## Testing Requirements

- Backend service tests cover all existing Premium IDs, Free default access,
  role restrictions, new Free Premium-template rejection, Premium creation,
  and expired-draft continuation.
- Backend tests prove a Free client cannot change a Free meeting into a Premium
  template, resurrect a deleted Premium meeting, or create a second Premium
  meeting by reusing a different ID.
- Client unit/component tests cover the existing card layout with tags,
  localized copy, default/Premium card states, selected locked CTA,
  owner/non-owner upgrade messaging, and Resume behavior after expiry.
- Regression tests cover the current template-selection and meeting-start flow.

## Rollout

1. Deploy the API continuation-validation change first.
2. Deploy the client catalog metadata, tags, and Premium card presentation.
3. On staging, verify Free owner/adult/viewer and Premium owner/adult/viewer
   behavior for each of the six existing template IDs.
4. Specifically verify a Premium draft created before expiry can be resumed
   after expiry, while a new Premium draft remains blocked.

No data migration is required. Existing meetings keep their stored template IDs
and remain readable under the Free family-record policy.
