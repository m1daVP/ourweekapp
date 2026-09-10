# AI summary output language

## Goal

Every user-visible value generated for a meeting recap must use the language
selected in the mobile app. This applies even when meeting notes use a
different language.

## Scope

The app supports `en`, `uk`, and `es`. The frontend already sends its active
locale with each recap request. The backend will make that locale an explicit,
unambiguous output-language instruction to the AI provider.

## Request and prompt flow

1. The frontend sends the current app locale with `POST /v1/ai/meeting-summary`.
2. The API validates the locale against the supported app locales.
3. The AI service maps the locale code to a human-readable language name.
4. The generated system prompt explicitly requires every user-visible
   structured-output field to be written in that language. It names the recap,
   all lists, agreement text, task titles, and next-meeting focus.
5. The existing serialized prompt payload retains the locale. Because that
   payload contributes to the generation input hash, equivalent meeting content
   requested in different app languages has distinct cache identities.

## Compatibility and error handling

The response DTO and stored summary schema stay unchanged. No database
migration is required. Unsupported locales are rejected by the request schema
with the existing safe validation-error behavior. The client always sends a
supported locale, so normal app behavior remains compatible.

## Testing

- Frontend regression test: summary generation sends the active i18n locale.
- Backend schema test: only the app-supported locales are accepted.
- Backend prompt/service tests: each locale produces an explicit instruction
  covering all user-visible summary fields.
- Existing cache-identity coverage remains valid; locale differences must
  continue to produce distinct input hashes.

## Non-goals

- Detecting or translating the meeting notes before generation.
- Persisting the output locale alongside a summary.
- Adding locales beyond the app's existing English, Ukrainian, and Spanish
  selection.
