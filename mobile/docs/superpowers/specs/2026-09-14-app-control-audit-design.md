# App Control Audit Design

## Goal

Remove browser-default interactive controls across OurWeek and make every
user-visible control follow the existing Android-first mobile design system.

## Scope

The audit includes all application routes and feature components. It covers
buttons, action links, native disclosures, select/date/time inputs,
checkboxes/radios, text fields, textareas, and icon-only controls. It excludes
non-interactive text and intentional semantic form controls that already use a
shared styled component.

## Approach

Each control will be classified as primary, secondary, destructive,
compact/icon, toggle, picker, or disclosure. Ordinary actions will receive the
appropriate shared class. Native disclosures and platform-variable select,
date, and time widgets will be replaced with existing mobile picker or
button-controlled components. Native fields that already receive complete
shared styling will retain their semantics and receive only focused fixes where
their appearance is inconsistent.

Work proceeds by route/feature batch: meeting flow, tasks/history, household
and settings, Premium/private tools, then auth/legal/onboarding. Every batch
gets focused visual-structure tests, followed by a mobile viewport review and
build validation.

## Constraints

- No behavior, feature access, localization key, data model, or backend API
  change is included.
- Reuse existing shared controls before adding any component or dependency.
- Preserve semantic HTML, accessible labels, keyboard access, focus behavior,
  and minimum mobile tap targets.
- Keep primary actions visually singular; use secondary or compact variants for
  supporting actions.
- Do not apply a global rule that flattens meaningful control variants.

## Acceptance Criteria

1. No user-visible browser-default action, disclosure, select, date/time
   picker, checkbox, or radio control remains on an app route.
2. Every control has an intentional design-system treatment appropriate to its
   action and context.
3. Android WebView control appearance no longer depends on browser defaults.
4. Existing behavior and accessible interaction are preserved.
5. Each batch has regression coverage and the final full build/check passes.
