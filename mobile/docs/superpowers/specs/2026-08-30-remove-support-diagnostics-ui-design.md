# Remove support diagnostics UI design

## Goal

Remove the Support diagnostics entry and page from the customer-facing app while
preserving the diagnostics service and tests for developer use.

## Scope

- Remove the Support diagnostics Settings row.
- Remove the `support-diagnostics` router entry and its lazy page import.
- Remove the associated AppShell route-title mapping.
- Delete `SupportDiagnosticsPage.vue`.
- Remove UI-only i18n strings that have no remaining callers.

## Retained developer tooling

Keep `supportDiagnosticsService.ts`, its tests, vConsole diagnostics tooling,
and all non-UI diagnostics behavior unchanged. This task does not change Sentry,
debug logging, diagnostics data collection, or release/privacy documentation.

## Navigation behavior

The `/settings/support` route is removed without a redirect. There are no users
or bookmarks to preserve at this stage.

## Verification

- Ensure no production source references the deleted page or route name.
- Run targeted routing tests, `npm run build`, and `npm run check`.
- Confirm the Settings support section still presents Contact us, Privacy Policy,
  and Terms without an empty gap.
