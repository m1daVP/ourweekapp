# Google Play Data Safety Draft

This draft records the Google Play Data Safety answers implied by the current
public v1 production design. Confirm against the final production backend,
billing, AI, Calendar, analytics, crash reporting, and notification behavior
before publishing.

This is not legal advice.

## Data Collected

| Google Play category           | OurWeek data                                                                  | Collected?                                        | Shared?                                                                           | Purpose                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Personal info: email address   | Account email, invitation email entered by a user                             | Yes, when accounts/workspace invitations are used | With backend service providers; with app store or email provider where applicable | Account management, authentication, workspace invitations, support.                                    |
| Personal info: name            | Display name, participant names                                               | Yes                                               | With backend service providers when sync is enabled                               | Account profile, meeting participants, household records.                                              |
| App activity: app interactions | Feature use events                                                            | No unless analytics are added                     | No unless analytics are added                                                     | Do not mark collected unless instrumentation is added.                                                 |
| User-generated content         | Meeting notes, tasks, agreements, summaries, workspace records, exports       | Yes                                               | With backend service providers; user-controlled sharing for exports               | Core app functionality, sync, summaries, export.                                                       |
| Financial info                 | Direct card/payment data                                                      | No in mobile app                                  | Store provider handles payments                                                   | OurWeek should validate subscription entitlement but should not collect payment card details directly. |
| Purchase history               | Subscription product/status/receipt or purchase token metadata                | Yes if paid Premium ships                         | Backend and app store provider                                                    | Entitlement validation, restore, manage subscription.                                                  |
| Calendar                       | Google Calendar connection and selected synced reminders/due dates/follow-ups | Yes only if Calendar sync ships                   | Google Calendar through backend-supported OAuth                                   | Create or update selected calendar items.                                                              |
| Contacts                       | Device address book                                                           | No                                                | No                                                                                | Workspace invitations use email typed by the user, not address book access.                            |
| Location                       | Precise or approximate location                                               | No                                                | No                                                                                | Not part of public v1.                                                                                 |
| Photos/videos/audio/files      | User media files                                                              | No                                                | No                                                                                | Not part of public v1.                                                                                 |
| Device or other ids            | Device identifiers                                                            | No unless diagnostics/analytics are added         | No unless diagnostics/analytics are added                                         | Confirm before release.                                                                                |
| Diagnostics                    | Crash logs/performance diagnostics                                            | No unless a provider is added                     | No unless a provider is added                                                     | Confirm before release.                                                                                |

## Security Practices

- Data is encrypted in transit when production API URLs use HTTPS.
- Sensitive auth tokens must use native secure storage on Android/iOS.
- Capacitor Preferences and local app data are not secure storage and must only
  be used for non-sensitive settings and app records.
- Payment card details are not collected directly by the mobile app.
- Google OAuth tokens must be handled by the backend, not stored in the mobile
  app.
- Private notes are local-only unless a reviewed sync design changes that
  behavior.

## Deletion And Export

- Backend exposes account export: `GET /v1/account/export`.
- Backend exposes account deletion: `DELETE /v1/account/`.
- The final app must make account export and deletion available from Account
  settings before public release.
- Final release copy must explain whether local device data is kept, deleted, or
  offered as a separate cleanup choice after account deletion.

## Store Listing Notes

- Mention that OurWeek is a guided weekly household check-in app for meetings,
  tasks, agreements, summaries, reminders, and follow-up.
- Do not claim therapy, relationship counseling, emergency support, encryption,
  cloud sync, or Calendar sync unless the final implementation supports it.
- If AI summaries ship, disclose that they are optional, may be inaccurate, and
  should be reviewed.
- If Premium ships, disclose that paid access is validated through the backend
  and store provider.
- If Google Calendar sync does not ship, hide or omit Calendar sync claims.
