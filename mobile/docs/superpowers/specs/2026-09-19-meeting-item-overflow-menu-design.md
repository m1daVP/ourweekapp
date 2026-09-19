# Meeting item overflow menu design

## Goal

Replace the always-visible Edit and Delete controls on editable meeting items with a single three-dots overflow trigger. The menu keeps the guided meeting surface calm while retaining quick, accessible item management.

## Scope

The change applies to both editable item presentations in the live meeting flow:

- `MeetingItemCard` in the active conversation sections.
- Task, agreement, and note rows inside the three Review & Close cards.

It does not change the page-level meeting header menu, item-editor dialogs, deletion confirmation, or permissions.

## Interaction

- Each editable item exposes one 48px `more_vert` button with an item-specific accessible label.
- Tapping the trigger opens an anchored, compact popup immediately beside or below that item. It contains labelled Edit and Delete actions; Delete keeps its destructive styling.
- Only one item menu can be open at a time. Selecting an action closes its menu and sends the existing edit/delete event.
- Tapping outside the popup, pressing Escape, or pressing Android Back closes the popup and restores focus to its trigger.
- The popup has no scrim, blur, or page-wide visual treatment. It is positioned within the viewport and may flip above the trigger when space below is limited.
- Existing completed/permission states remain unchanged: no trigger is shown when an item cannot be edited.

## Architecture

Create one shared anchored item-action popup component in `src/shared/components`. It owns open state, positioning, outside-click handling, focus restoration, Escape, and Android Back behavior. It receives the trigger element and an action list, then emits the selected action ID.

`MeetingItemCard` and `MeetingReviewCloseStep` use this component. Their existing edit/delete events and parent handlers remain intact; only presentation and local menu state move into the popup pattern.

## Accessibility and visual language

The trigger uses a descriptive `aria-label` rather than relying on the dots icon. The popup uses `role=menu` with labelled `menuitem` buttons, supports keyboard focus, and meets the existing 48px mobile touch-target preference. It uses the incumbent warm elevated-surface styling, 16px radius, soft shadow, and visible focus rings, without adding a modal overlay.

## Verification

Update component tests to cover trigger rendering, action selection, and menu closing. Run the project build and checks, then run the design detector against changed UI components.
