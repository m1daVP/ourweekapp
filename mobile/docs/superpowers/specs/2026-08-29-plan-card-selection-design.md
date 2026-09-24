# Premium Plan Card Selection Design

## Goal

Make the Monthly and Yearly Premium cards on the upgrade screen functional choices, so the user can select a billing cadence before starting a purchase.

## Interaction

- The Yearly plan is selected initially when it is available, preserving the existing visual emphasis and best-value recommendation.
- Tapping or keyboard-activating a plan card selects that plan without opening the purchase flow.
- The cards expose radio-style selection semantics, including the selected state for assistive technology.
- The selected card receives the active border and check indicator. The yearly badge remains a recommendation, not a forced choice.
- Changing selection animates the border, background, and shadow over 220ms with a subtle 1% lift. The checkmark fades and scales in without bounce.
- The selection transition is disabled for users who request reduced motion.
- The Start Premium button purchases the selected plan through the existing `purchasePlan(planId)` path.
- The button remains disabled while billing is unavailable, no live plan is available, a purchase is in progress, or Premium is already active.

## Boundaries

- Do not change RevenueCat offering, product, entitlement, or backend synchronization behavior.
- Do not make plan-card taps initiate a purchase; the explicit primary button remains the confirmation step.
- Add focused page tests for initial selection, switching to Monthly, and purchasing the selected plan.

## Verification

- Run the Upgrade page test file.
- Run the mobile typecheck/build checks appropriate to the changed Vue and TypeScript code.
