# Meeting Step Card Dropdowns Design

## Goal

Redesign both optional controls in the guided meeting step so they use the
reference’s compact row and expanded card-panel interaction.

## Controls

### Other ways to add

Collapsed, it is a rounded outlined row with a sparkle icon, localized label,
and chevron. Expanded, it becomes a softly outlined panel with the same header
and two equally sized cards: Add note (edit icon) and Add agreement
(check-circle icon). Each card emits the existing `capture` event.

### Need an example?

It uses the same collapsed row and expanded bordered panel. The panel shows
the localized example strings as readable cards/list items. It remains a
content disclosure only and does not create meeting data.

## Interaction and Accessibility

Both controls start collapsed. Each toggle has `aria-expanded` and controls
its panel by ID. It supports tap, keyboard activation, and tap targets of at
least 44px. The chevron changes direction based on state. Expanding one does
not alter the other’s state.

## Scope

Only `MeetingSectionStep.vue`, its tests, and scoped styles change. The primary
task button, bottom navigation, capture payloads, localization keys, and
meeting data remain unchanged.

## Acceptance Criteria

1. Both optional controls match the supplied reference in collapsed and
   expanded state.
2. Alternative capture cards still emit `note` and `agreement` correctly.
3. Examples remain visible only after expanding their control.
4. Component tests and Android production build pass.
