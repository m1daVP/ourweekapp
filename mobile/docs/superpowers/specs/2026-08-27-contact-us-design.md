# Contact Us Settings Link Design

## Goal

Add a direct way to contact OurWeek support from the Settings page's existing
Support & Legal section. The destination email address is supplied through the
public Vite environment variable `VITE_CONTACT_EMAIL`.

## Design

Extend the existing app configuration boundary with an optional normalized
`contactEmail` value. The value is read from `VITE_CONTACT_EMAIL` and trimmed
like the other optional environment values. It is also declared in the Vite
environment types and documented in both environment example files.

Settings will render a localized `Contact us` row only when `contactEmail` is
configured. The row will be a semantic anchor using a `mailto:` URL, retain the
existing mobile settings-row styling, and show the configured email as its
supporting text. No contact address will be persisted in local app state.

Translations will be added for the supported English, Ukrainian, and Spanish
locales. The link will rely on the operating system/browser mail handler and
will not attempt to send mail, validate the address, or add a backend API.

## Error and fallback behavior

If `VITE_CONTACT_EMAIL` is absent or blank, the row is omitted. This keeps local
and development builds usable without producing a non-functional `mailto:`
link. No startup failure is introduced for this optional support configuration.

## Testing and verification

- Extend environment configuration tests to verify trimming and missing-value
  behavior for `VITE_CONTACT_EMAIL`.
- Run `npm run build`.
- Run `npm run check`.

## Scope boundaries

This change does not add contact forms, in-app messaging, backend support
endpoints, analytics, or local persistence. It does not change subscription,
authentication, or legal-document behavior.
