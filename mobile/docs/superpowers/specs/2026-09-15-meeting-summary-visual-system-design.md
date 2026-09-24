# Meeting Summary Visual System Design

## Goal

Give both summary surfaces—the in-meeting Review and finish step and the
completed-meeting Summary page—a single calm mobile visual system based on the
approved reference.

## Scope

- `MeetingReviewCloseStep` is redesigned as the guided final meeting screen.
- `MeetingSummaryPage` receives the same content scale, padded-card hierarchy,
  and button language while retaining its AI insight, share, and navigation
  behaviour.
- The existing meeting disclosure style becomes a reusable feature component
  used by the Review screen notes area and existing meeting-step disclosures.

## Shared visual rules

- Keep the existing page padding; cards and interactive surfaces must not run
  edge-to-edge.
- Do not change top-bar heading size. Use smaller, calmer body copy, labels,
  metadata, and list text with consistent line-height.
- Use white outlined cards on the warm page background, a restrained shadow,
  20–24 px internal padding, and clear spacing between cards.
- Use green for affirmative/edit controls, red for delete controls, and warm
  peach for count badges or secondary emphasis.
- Preserve semantic controls, touch targets, focus styles, Android back
  behaviour, and the existing reduced-motion treatment.

## Reusable disclosure panel

- Extract the established `MeetingSectionStep` disclosure DOM and reveal
  behaviour into a feature-level reusable component.
- It owns one rounded warm outlined shell, the clickable header row, optional
  leading icon/status content, a white circular chevron, and a persistent
  zero-height reveal wrapper.
- Content is mounted while closed, inert while unavailable, and animates via
  clipped grid height plus opacity/transform. It must not reserve space while
  closed.
- Existing examples and alternate-capture panels keep their behaviour but move
  to this component. The Review notes disclosure uses the same component.

## Review and finish screen

- Retain its header and progress information; present progress as the compact
  label/value/track row in the reference.
- Use a centered completion hero with green check badge, display title, and
  short explanatory text.
- Tasks, agreements, and notes each become padded cards with a leading icon,
  title, and saved-count badge. Rows retain their own spacing and fixed
  right-side action column.
- Tasks show responsibility as a muted compact chip. Agreements show a small
  participant label and readable agreement copy. Notes begin collapsed behind
  the reusable disclosure and show individually separated note rows when open.
- The capture actions become a contained low-emphasis prompt card with three
  compact outlined pills. The bottom dock stays inset and contains Back to edit
  and Finish actions.

## Completed-meeting summary page

- Retain the data model, AI state/recovery UI, participant avatars, share
  action, and full-notes navigation.
- Reorganize the hero and information blocks into the same padded, card-based
  hierarchy and body-text scale as Review and finish.
- Decisions and actions use readable rows with compact icon/chip/avatar
  treatments rather than dense or full-width elements.
- The bottom share and full-notes actions remain inset in the existing floating
  action area.

## Non-goals

- Do not change meeting, task, agreement, note, AI summary, sharing, or
  navigation logic.
- Do not alter the top-header font size or remove current page padding.
