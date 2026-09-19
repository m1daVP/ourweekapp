# AI recap allowance states design

## Goal

Show accurate, plan-aware AI recap allowance states inside the shared AI summary card on the meeting summary and saved meeting detail screens. The four attached screenshots are visual references for Free and Premium examples; they are not additional product instructions, and their exact colors must not replace OurWeek design tokens.

## Scope

- Extend the shared AI summary card with a dedicated allowance panel.
- Render Free and Premium allowance variants from the live subscription snapshot.
- Display every remaining count dynamically from `remaining` and `limit`; do not hardcode only the example values 0, 1, 3, 5, or 20.
- Preserve existing AI generation, entitlement validation, refresh, viewer/restricted, loading, retry, and saved-summary behavior.
- Route exhausted Free and Premium actions to the existing named `upgrade` route.
- Update supported localization messages for dynamic counters and exhausted explanations.
- Keep the top-level `/history` list unchanged; only the shared AI cards are in scope.

## Allowance state model

The allowance view is derived from the subscription store's `currentPlan`, `assistantRecap.remaining`, `assistantRecap.limit`, `assistantRecap.used`, and `assistantRecap.canGenerate`, plus the current workspace role.

- Free accounts use the configured allowance limit, normally 3.
- Premium accounts use the configured allowance limit, normally 20.
- Numeric counters always use the actual `remaining` and `limit` values.
- Premium progress is `remaining / limit * 100`, clamped to 0–100%.
- Free visual indicators are decorative; the numeric counter is authoritative.
- The “Last” badge appears only when `remaining === 1`.
- `remaining === 0` is an exhausted state.
- Viewer/restricted accounts keep the current restricted message and do not receive an upgrade action unless existing access rules permit it.
- Null or checking allowance data keeps the current unavailable/checking and refresh behavior.

## Visual states

The allowance panel remains inside the shared AI card and uses existing OurWeek tokens.

- **Free with remaining allowance:** show the free counter, dynamic visual indicators, and the green Create action.
- **Free with one remaining:** show the amber Last badge and a counter such as `1 of 3`.
- **Free exhausted:** show `0 of 3`, a localized explanation, and a green Upgrade to Premium action.
- **Premium with remaining allowance:** show the plan icon, `remaining / limit`, a token-based progress bar, and a localized label such as `7 summaries remaining` or `20 summaries`.
- **Premium exhausted:** show `0 / 20`, a localized limit-reached label, an explanation, and a green Update plan action.

The card's existing icon, typography, cream/amber/green palette, rounded surfaces, touch targets, and mobile layout remain the source of truth. The action button changes from Generate to an upgrade action only for an eligible exhausted account.

## Data flow and actions

The allowance panel reads the existing Pinia subscription/workspace stores through the current allowance component boundary. It does not call billing providers, APIs, or native purchase methods directly. Upgrade actions navigate to the existing named `upgrade` route. Positive-allowance Create actions continue to emit the existing generate event and retain low-content confirmation.

Unknown, checking, unavailable, and restricted states continue to use current safe messaging and refresh behavior. No frontend-only entitlement override is introduced.

## Localization

Add or revise translation-ready keys for:

- free remaining count with `{remaining}` and `{limit}`;
- the Last badge;
- free exhausted explanation;
- Premium available count with `{remaining}` and `{limit}`;
- Premium full/remaining label;
- Premium exhausted label and explanation;
- upgrade-to-Premium and update-plan action labels.

English, Ukrainian, and Spanish catalogs must remain structurally aligned.

## Verification

- Add focused allowance-panel tests for Free and Premium full, last, intermediate, and exhausted values.
- Verify arbitrary counts render from data rather than example-specific branches.
- Preserve existing tests for viewer/restricted, unknown allowance, refresh, generation, retry, and saved recaps.
- Verify both meeting summary consumers render the same allowance component.
- Run `npm test`, `npm run build`, and `npm run check`.

## Out of scope

- Changing the allowance limits or backend contract.
- Implementing billing or entitlement validation.
- Adding a new payment flow.
- Adding AI content to the top-level meeting history list.
- Redesigning unrelated meeting summary sections.
