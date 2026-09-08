# OurWeek Privacy Data Map

This document maps the public v1 production behavior to the disclosures needed
for the in-app Privacy Policy, Terms, Google Play Data Safety answers, and
release review.

This is a product and engineering source of truth. It is not legal advice and
must be reviewed before public release.

## Backend Contract Reference

The local backend OpenAPI document used for this map was available at:

```txt
http://localhost:3030/openapi.json
```

Relevant backend surfaces:

- Auth: register, sign in, refresh, sign out, current user, password reset.
- Subscriptions and billing: status, validate, restore, manage.
- AI: meeting summary generation.
- Calendar: Google connection, callback, disconnect, and selected sync actions.
- Exports: meeting export and account export.
- Account: account deletion.
- Workspace: household workspace, invitations, member updates, member removal.
- Sync: meetings, participants, tasks, agreements, and review decisions.

## Data Inventory

| Data area                | Examples                                                                                                       | Storage or processing                                                                | Disclosure notes                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account                  | Email, display name, user id, role, plan type, created/updated timestamps                                      | Backend account database; auth tokens on device                                      | Required for sign-in, sync, Premium checks, and workspace access.                                                                                                                                                       |
| Authentication           | Access token, refresh token, password reset token flow                                                         | Secure token storage on native platforms; backend session endpoints                  | Tokens must not be stored in localStorage, Capacitor Preferences, exports, logs, or user-visible errors.                                                                                                                |
| Workspace                | Household name, members, roles, invitations                                                                    | Backend when API mode is enabled; local settings for UI state                        | Roles are simple household roles, not enterprise RBAC.                                                                                                                                                                  |
| Participants             | Names, initials, participant type, avatar color, enabled state                                                 | Local app data and backend participant sync                                          | Participant data is user-created household context.                                                                                                                                                                     |
| Meetings                 | Meeting title, date, status, sections, notes, agreements, tasks, summary                                       | Local app data and backend meeting sync                                              | Meeting notes may include sensitive household information.                                                                                                                                                              |
| Tasks and agreements     | Titles, descriptions, responsible participant ids, due dates, status, related ids                              | Local app data and backend task/agreement sync                                       | Use neutral follow-up language. Avoid shame-oriented labels.                                                                                                                                                            |
| Review decisions         | Meeting id, source meeting id, decision timestamps                                                             | Local app data and backend sync                                                      | Used to carry unfinished follow-ups into later meetings.                                                                                                                                                                |
| Private notes            | Personal title, note body, related meeting id                                                                  | Local device data only unless a reviewed sync design is implemented                  | Excluded from exports and AI summaries by default. Do not imply encryption unless implemented.                                                                                                                          |
| Subscription entitlement | Plan, status, provider, expiration, product id, receipt/token metadata                                         | Backend or app store provider; local UI snapshot only                                | Frontend state is not the source of truth for paid access in production.                                                                                                                                                |
| AI summaries             | Shared meeting notes, tasks, agreements, participant names, generated summary, disclaimer, generated timestamp | Backend AI endpoint; OpenAI receives shared recap input after first-use confirmation | Private notes are excluded. AI summaries may be inaccurate and should be reviewed. `store: false` is used but does not by itself eliminate provider abuse-monitoring retention. No provider API keys in the mobile app. |
| Google Calendar          | Connection status, OAuth callback, selected reminder/task/follow-up sync payloads                              | Backend-supported OAuth and Calendar API calls                                       | Google access and refresh tokens must not be stored in the mobile app. Ship only after OAuth scope, retention, and revoke behavior are reviewed.                                                                        |
| Local reminders          | Reminder enabled state, day, time, notification permission state                                               | Device settings/preferences and local notification scheduling                        | Local notifications only. Ask permission at the right moment and handle denial gracefully.                                                                                                                              |
| Export/share             | Meeting export content, Markdown/text/PDF output where available                                               | Generated on device or backend export endpoint; then shared/saved by user            | Private notes excluded by default. Once shared outside OurWeek, destination controls the copy.                                                                                                                          |
| Account export           | Backend account export payload                                                                                 | Backend account export endpoint                                                      | Must be exposed clearly in Account settings before public release.                                                                                                                                                      |
| Account deletion         | Account and backend records according to retention policy                                                      | Backend account deletion endpoint; local cleanup decision required                   | Final retention and local cleanup behavior need legal/product signoff.                                                                                                                                                  |

## Open Decisions Before Public Release

- Legal entity, support contact, jurisdiction, and effective date.
- Production data retention period after account deletion.
- Whether local device data is removed during account deletion or offered as a
  separate local cleanup choice.
- Subscription provider, store product ids, refund/cancellation language, and
  entitlement validation policy.
- AI provider, provider data retention terms, and whether prompts/responses are
  logged on the backend.
- Google OAuth scopes, token storage, disconnect/revoke behavior, and consent
  screen copy.
- Whether any future release changes private notes from local-only behavior.
- Whether diagnostics, crash reporting, or analytics are added.

## Implementation Notes

- In-app legal screens must describe backend sync accurately while preserving
  the separate local-only policy for private notes.
- Production paid Premium must not be unlocked by local test subscription state.
- Production AI summaries must go through the backend.
- Calendar sync requires verified backend OAuth and accurate Data Safety
  disclosures.
- Private notes must stay out of exports and AI summaries by default.
