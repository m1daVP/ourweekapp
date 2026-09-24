# Review card action stack

## Goal

Place edit and delete controls in a right-side vertical column on every meeting review-and-close card, with edit above delete.

## Design

Wrap task edit and delete controls in the existing review item action container. Apply a column layout to that shared container, which is also used by agreement and note cards.

## Verification

Update the review component test to confirm the task controls are grouped, then run the focused test suite and build.
