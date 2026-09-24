# Household Name Drawer Design

## Goal

Let people rename their household from the Household card in Settings without
navigating to the household members page.

## User flow

1. The edit icon beside the household name is a button, not a link.
2. Tapping it opens a `BaseBottomSheet` titled with the existing localized
   household-name label.
3. The sheet contains one text field pre-filled with the current household
   name, plus Save and Cancel actions.
4. Save trims the name. An empty result remains in the sheet and shows the
   existing save-error copy near the input.
5. A valid value calls the existing `workspaceStore.saveWorkspaceName` action.
   On success, the sheet closes and the Settings card immediately reflects the
   saved name. On failure, the sheet stays open and shows the store's friendly
   error message.
6. Closing by Cancel, the backdrop, or Android back discards the draft and
   returns focus to the edit button through the shared bottom-sheet behavior.

## Boundaries

- The workspace members page remains available for its existing member and
  invitation management; it is no longer part of this rename interaction.
- No workspace API or store contract changes are required.
- Reuse existing i18n keys where their meaning fits; add focused keys only if
  the sheet needs a distinct title or validation message.

## Verification

- Confirm the edit icon no longer navigates.
- Confirm saving a valid name updates the visible card.
- Confirm whitespace-only input does not submit and produces an accessible
  error state.
- Confirm backend save failure keeps the sheet open and leaves the existing
  name unchanged.
- Run `npm run build` and `npm run check`.
