# AI summary card consistency design

## Goal

Give the AI summary card the same calm, compact visual treatment on the meeting summary screen and the saved meeting detail screen at `/history/:meetingId`. The attached screenshot is a visual reference for structure and hierarchy; its exact colors are not product instructions. OurWeek design-system tokens remain the source of truth for color, typography, spacing, and accessibility.

## Scope

- Create a shared `src/features/meeting/components/AiSummaryCard.vue` presentation component.
- Use it from `src/pages/MeetingSummaryPage.vue` and `src/pages/MeetingDetailsPage.vue`.
- Apply the shared visual shell to empty, loading, generated, and error/retry states, plus Premium/access-limited states.
- Keep the top-level meeting list at `/history` unchanged because it does not render an AI summary card.
- Preserve existing AI generation, regeneration, retry, allowance refresh, subscription, persistence, localization, and legacy-summary behavior.

## Component architecture

`AiSummaryCard.vue` owns the shared card markup and visual state layout. The two page consumers retain business logic and pass the current meeting context, AI state, loading state, generation permissions, allowance state, and recovery data. Page callbacks remain responsible for generation, regeneration, and retry actions.

The component composes the existing `MeetingFollowThrough`, `RecapAllowanceStatus`, and `AiRecapRecoveryPanel` components. It does not call stores, APIs, or native services directly. Existing legacy AI summary data without `followThrough` remains rendered through the saved-meeting detail flow.

## Visual design

The card uses one shared shell on both pages:

- a `surface-lowest` card with a subtle amber border and the existing card shadow;
- a small rounded icon tile using the secondary/amber design-system tokens;
- the existing display/serif summary title style;
- concise explanatory and disclaimer text;
- a muted rounded allowance/status strip;
- a full-width primary green action button with a preferred 48px touch target;
- mobile-first spacing, safe-area-compatible sizing, and no reliance on hover.

The screenshot's green, amber, cream, and neutral tones should be mapped to existing CSS variables such as `--color-primary`, `--color-secondary-container`, `--color-surface-lowest`, and related tokens. No screenshot hex values should be introduced as new design colors.

## State behavior

- **Empty/generate:** show the explanatory copy, allowance strip, and full-width Generate action when generation is allowed.
- **Loading:** retain the same header and shell, show the existing calm loading message, and prevent duplicate generation.
- **Generated:** retain the shared header and disclaimer, render the existing follow-through content, and expose regeneration only when the existing permission rules allow it.
- **Error:** render the safe recovery or quota message inside the same shell; show Retry only for retryable failures.
- **Locked/unavailable:** preserve the existing Premium and access messaging and upgrade/refresh paths inside the shared layout.

## Data flow and error handling

The pages continue to derive AI state from the meeting, subscription store, route status, content readiness, and recovery state. The shared component receives already-derived values and emits only presentation actions. Technical provider errors remain translated through the existing recovery service and are not exposed in the UI.

Allowance status and refresh behavior remain available for restricted or exhausted states. Existing disabled/loading guards remain in place. No API, AI provider, entitlement, storage, or sync behavior changes are part of this redesign.

## Verification

- Add or update focused component/page tests to confirm both pages render the shared card.
- Cover empty, loading, generated, error/retry, allowance, Premium lock, and legacy-summary paths.
- Confirm generate, regenerate, retry, and allowance refresh actions retain their existing behavior.
- Run the focused recap tests.
- Run `npm run build` and `npm run check`.
- Verify the card at narrow mobile widths and confirm localized strings remain usable.

## Out of scope

- Changing the AI summary data model or backend contract.
- Changing subscription entitlement rules or quota semantics.
- Adding AI content to the top-level `/history` meeting list.
- Replacing reviewed legal copy, adding new dependencies, or redesigning unrelated summary sections.
