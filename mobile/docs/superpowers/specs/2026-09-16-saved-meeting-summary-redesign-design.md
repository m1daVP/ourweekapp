# Saved Meeting Summary Redesign

## Goal

Redesign the complete saved-meeting details page as a calm, mobile-first
meeting record. The page must use the approved rounded-card references for
meeting sections and final agreements, reuse the completed-summary visual
language for AI content, and present export as clearly different Premium and
non-Premium states.

## Scope

- Redesign the full saved-meeting page rendered by
  `src/pages/MeetingDetailsPage.vue`.
- Preserve the current meeting, participant, AI recap, export, navigation, and
  subscription behavior.
- Keep `meeting-summary/:id` as a separate route. Its existing AI-card design is
  the visual source for the saved-meeting AI block; the routes are not merged.
- Support completed meetings and resumable drafts without changing persistence
  or meeting status rules.
- Keep all user-facing copy translation-ready in English, Ukrainian, and
  Spanish.

## Page hierarchy

The saved meeting page uses the existing mobile content width, safe-area
handling, and warm background. Its content order is:

1. Meeting header.
2. AI summary card.
3. Export card.
4. Regular meeting sections.
5. Final agreements card.

The meeting header shows the translated template title, date, meeting status,
participants, and compact totals. Draft meetings retain a visible Resume
action. Information is presented as short metadata rather than a dashboard.

Cards use white or lowest-surface backgrounds, thin warm neutral borders,
restrained shadows, rounded corners, and comfortable mobile padding. Typography
follows the approved summary system: serif display titles, readable sans-serif
body copy, muted metadata, and compact status pills. Touch targets remain at
least 44 pixels.

## AI summary block

The saved-meeting AI block adopts the visual hierarchy and card treatment from
`meeting-summary/:id` while continuing to use the existing AI recap behavior.
It retains:

- generated follow-through content;
- generate and regenerate actions;
- quota information;
- low-content confirmation;
- retry and recovery states;
- loading and empty states;
- the AI accuracy disclaimer;
- Premium entitlement checks.

No AI content is generated locally, and no changes are made to the backend AI
contract. The redesign may extract or share presentation components when that
reduces duplicate markup without coupling the two route pages.

## Export states

Export is one position in the page hierarchy but has two explicit visual
states.

### Premium account

The unlocked card clearly presents export as available. It includes the
existing format choices and existing copy, share, save, and PDF behavior. The
primary action must be obvious without presenting a dense tool panel. Existing
loading, failure, and fallback-download behavior is preserved.

### Account without Premium

The locked card uses the same outer dimensions and visual family, but replaces
inactive export controls with a concise Premium explanation, lock/Premium
indicator, and an upgrade action supplied by the existing feature-access
pattern. It must not show disabled format controls that imply export can be
used. Unlocking still depends on trusted entitlement state; the UI must not
create a frontend-only override.

## Regular meeting sections

The page introduces a translated "Meeting sections" heading with the number of
regular sections. The `finalAgreements` section is excluded from this count and
rendered separately.

Each regular section is one rounded card containing:

- the translated section title;
- the translated prompt;
- a compact `Filled` or `Empty` status pill derived from whether the section
  contains at least one note, task, or agreement;
- saved item groups when content exists;
- one calm italic empty message when no content exists.

Empty regular sections do not render three redundant Notes, Tasks, and
Agreements empty messages. Filled sections render only item categories that
contain content.

## Shared saved-item presentation

Regular sections and final agreements use the same saved-item group and row
components. Their surrounding section cards differ, but the content treatment
does not.

- A group has an uppercase translated category label and one inset bordered
  surface.
- Rows use internal padding and subtle dividers; the final row has no divider.
- A note row shows participant ownership and localized timestamp as muted
  metadata, followed by note text.
- A task row shows the task title and a calm trailing pill combining the
  translated status with the translated responsibility label. Description and
  due date remain visible when present without making the row dense.
- An agreement row shows translated participant names as muted metadata,
  followed by agreement text.
- Long content wraps naturally, and trailing pills may move below the title on
  narrow screens rather than causing horizontal overflow.

Items remain read-only on this saved record page. The redesign does not add
editing, deletion, completion toggles, or new task-management behavior.

## Final agreements card

The `finalAgreements` section is rendered after all regular sections as a
distinct, larger card based on the approved reference. It contains:

- the translated final-section title and prompt;
- a `Filled` or `Empty` status pill;
- separate Notes, Tasks, and Agreements category labels;
- the shared saved-item groups and rows for each non-empty category.

When the final section is completely empty, it shows one italic empty message
instead of three empty groups. If only some categories are empty, those
category blocks are omitted.

Templates without a `finalAgreements` section do not render an artificial final
card. All their sections remain regular cards.

## Component boundaries

`MeetingDetailsPage.vue` remains the route-level state and action owner. The
visual redesign should move repeated rendering into focused feature
components:

- a saved section card that selects regular or final presentation;
- a saved item group that renders one item category;
- small typed row components, or one typed row component with explicit note,
  task, and agreement variants;
- an export summary card with explicit unlocked and locked presentations.

Components receive formatted display values or typed meeting records through
props and emit only page-level actions. They must not read stores directly when
the page already owns the required state. Existing AI components remain the
behavior owners for recap generation and recovery.

## Data flow

The page continues to load the meeting by route parameter from
`useMeetingsStore` and participant names from `useParticipantsStore`.
Computed values split `meeting.sections` into regular sections and the optional
`finalAgreements` section. Section status is derived from the existing arrays;
no data is copied or persisted for presentation.

The subscription store and existing feature-access composable remain the
source of truth for the export state. Existing export service functions remain
the only implementation of export generation, sharing, clipboard copy,
download, and PDF output.

## Empty, error, and accessibility behavior

- A missing meeting retains a clear not-found state and route back to history.
- Empty sections retain their card so the saved meeting accurately reflects
  the meeting template.
- Export and AI failures use the current user-facing notification and recovery
  paths.
- Semantic headings preserve a logical hierarchy.
- Lists remain semantic lists, status text is not communicated by color alone,
  and controls retain accessible labels and focus-visible treatment.
- Layouts must not overflow at narrow Android widths or place primary controls
  under the system navigation area.
- Existing reduced-motion behavior remains effective.

## Verification

Focused tests cover:

- regular-section counting without `finalAgreements`;
- filled and empty status derivation;
- omission of empty item categories from filled sections;
- identical item-row presentation in regular and final cards;
- final-section separation and absence when the template does not provide it;
- Premium unlocked export controls;
- non-Premium locked export message and upgrade action;
- preserved AI loading, empty, generated, recovery, and generation actions;
- missing meeting and draft Resume behavior.

After focused tests, run `npm run build` and `npm run check`. Manually inspect a
narrow mobile viewport in Ukrainian because the supplied reference and several
status labels exercise longer wrapping combinations.

## Non-goals

- Do not merge the saved-details and completed-summary routes.
- Do not change meeting persistence, data types, storage migrations, or backend
  contracts.
- Do not add item editing or generic task-management controls.
- Do not change Premium entitlement logic or provide a mock unlock.
- Do not change export file contents or include private notes.
- Do not redesign other history, meeting, task, or settings pages.
