# Settings Premium Benefit State Design

## Goal

Prevent Free households from seeing Premium benefits as already enabled in the Settings subscription card.

## Interaction

- The Premium benefit list remains visible for both Free and Premium households.
- A Free household sees a muted lock icon before every Premium benefit.
- An active Premium household sees the existing green check icon before every Premium benefit.
- Icon selection derives exclusively from the trusted `hasPremiumEntitlement` state already used by the card title and actions.
- The icons remain decorative to screen readers because each benefit’s text is already present.

## Boundaries

- Do not change subscription state, entitlement resolution, upgrade actions, or feature access.
- Do not hide benefits or change their localized text.
- Add a Settings-page regression test for Free and Premium icon states.
