# Settings Account Consolidation Design

## Goal

Remove the separate account screen and make the main Settings screen the single place for account, subscription, and sign-out controls. The retired account URL must not redirect or remain registered.

## Settings layout

The existing Subscription section remains the only subscription surface. It continues to provide the current-plan state, upgrade or management action, restore purchases, and purchase feedback. Its duplicated account-page subscription card is not migrated.

Settings gains an Account section for authenticated users, placed after Subscription and before Support & legal. It contains:

- account summary information (email, current plan, and account-created date);
- sign-in method status and the existing Google-link action and feedback;
- profile display-name editing and save feedback;
- account-data export;
- account deletion, confirmation dialog, public web deletion link, and all existing cleanup/retry handling;
- sign-out.

Account deletion remains deliberately separated as a destructive action. If post-delete local cleanup fails, Settings shows the existing recovery state and its retry/continue actions, preserving the current cleanup semantics.

For signed-out state, Settings continues to lead people to the welcome flow and does not expose authenticated account controls.

## Architecture and routing

Move the account-page state, handlers, and dependencies into `SettingsPage.vue` (or a focused account-settings child component if needed to keep the page readable). Reuse the existing authentication, account API, local cleanup, reminder cancellation, storage, haptics, and file-delivery services; do not change their contracts.

Remove `AccountPage.vue`, its unit test file, the `account` route record, and the `AccountPage` router import. Remove every remaining RouterLink or navigation target that references the removed route, including the Settings account teaser and the logout cancellation destination. The route `/settings/account` has no legacy redirect.

## Validation

Update Settings tests to cover the migrated Google linking, connected Google state, public deletion fallback, profile/export/delete flows as applicable, and deletion recovery state. Keep existing subscription coverage in the Settings test suite and remove duplicate AccountPage subscription coverage.

Run targeted page/router tests, then `npm run build` and `npm run check`. Search the source tree to confirm no `AccountPage`, `name: 'account'`, or `/settings/account` references remain.

## Scope boundaries

This is a navigation and UI consolidation only. It does not change account APIs, deletion behavior, subscription policy, authentication rules, translations, or the visual design of unrelated Settings sections.
