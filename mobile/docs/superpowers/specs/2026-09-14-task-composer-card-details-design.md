# Task Composer Card Details Design

## Goal

Redesign the task creation bottom sheet so that its collapsed and expanded
states match the approved mobile visual direction while preserving the current
task draft and submit behaviour.

## Scope

This applies only when `MeetingItemComposer` is opened for a task. Note and
agreement composers retain their existing field structure.

## Sheet structure

- Use the existing bottom-sheet and its slow, transform-based transition.
- Present a grab handle, title, capsule close action, and divider in the task
  sheet header.
- Keep the task name as the primary labelled field in a soft warm surface.
- Keep cancel and submit actions pinned at the bottom. Cancel uses the warm
  peach treatment; submit uses the green treatment and includes a check icon.

## Additional details disclosure

- Replace the plain optional-details button with a warm, outlined disclosure
  row: peach circular plus icon, title, green `Expanded` status badge, and a
  white circular chevron control.
- Keep expanded content mounted and animate the disclosure through a clipped
  grid row plus opacity and transform, rather than conditionally rendering the
  fields. This prevents controls from changing the opening height mid-motion.
- The expanded area is a separate warm outlined inner section.

## Expanded fields

- Description has a strong label, optional hint, and a white outlined text
  area.
- Responsibility is a horizontally scrollable, touch-friendly list of cards.
  It retains all supported values: unassigned, shared, and every active
  participant. Participant cards use `ParticipantAvatar` so image avatars or
  coloured initials remain consistent with Settings. The selected card has a
  green border and pale-green background.
- Due date is shown as one calendar summary row. It includes a calendar icon
  inside a pale-green square, localized selected-date text, and a compact
  `Change` action. Tapping any part of the row uses the existing accessible
  date-picker dialog and retains staged confirm/cancel behaviour.

## Accessibility and motion

- All controls remain semantic buttons, expose the disclosure expanded state,
  and retain clear accessible labels.
- Horizontal cards remain keyboard reachable and preserve visible selection
  beyond colour.
- Reduced-motion preferences continue to remove transitions through the
  existing global override.

## Non-goals

- Do not change task persistence, validation, responsibility meanings, or the
  date picker calendar logic.
- Do not modify note/agreement creation flows beyond shared sheet styles that
  are already in scope.
