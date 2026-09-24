# Account Settings Hierarchy Design

## Goal

Make the consolidated Account controls visually consistent with the main Settings screen and remove the redundant online-deletion fallback.

## Layout

Account retains one section-level heading outside its cards. Each card uses the existing lightweight Settings row/title treatment rather than a bold `h3` heading inside the card. The account summary remains a title-free information card. This keeps the hierarchy calm and aligned with the existing Settings panels.

## Deletion action

Remove the `Delete account online` link and its external legal URL dependency from the Account section. The in-app Delete account action and its confirmation, backend deletion, local cleanup, retry, and recovery behavior remain unchanged.

## Validation

Update the account-section test to assert the online deletion link is absent while the in-app delete action remains. Run the focused test, build, lint, and formatting checks for changed files.
