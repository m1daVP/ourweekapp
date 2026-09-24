# Meeting Step Control Design

## Goal

Replace the raw browser controls visible during a meeting step with controls
that match the OurWeek mobile design system.

## Scope

The change is limited to `MeetingSectionStep.vue`, the component shown in the
provided screenshots. It covers the example trigger and the “Other ways to
add” disclosure with its note/agreement actions. It does not change capture
events, meeting content, permissions, navigation, or the add-item sheet.

## Design

- “Need an example?” becomes a compact secondary/outlined button with the
  existing accessible expanded state.
- “Other ways to add” becomes an explicit button with an expand/collapse icon,
  `aria-expanded`, and a labelled action group. It replaces native
  `<details>` and `<summary>` to avoid browser-default visuals.
- Alternative note and agreement actions become design-system secondary
  buttons sized for touch, with the primary add action remaining the visual
  priority.
- The existing `capture` events and localized labels remain unchanged.

## Testing

The component test will prove that the visible controls use their expected
classes, toggle their revealed content, emit the existing capture event, and
render no native `details` or `summary` element.

## Acceptance Criteria

1. Neither provided screen contains browser-default example, disclosure, or
   alternative-action controls.
2. The expanded/collapsed state remains accessible by keyboard and assistive
   technology.
3. Primary add and bottom navigation behavior remain unchanged.
4. Component regression tests and the production build pass.
