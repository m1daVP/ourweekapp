# Google Play Data Safety Evidence Checklist

Use this document to prepare the authenticated Google Play Data Safety
submission for the released OurWeek Android build. It is an evidence checklist,
not a completed Play Console submission and not legal advice.

Do not copy a conditional answer into Play Console until the release owner has
confirmed whether the relevant provider or feature is enabled in the production
build and production environment. The final Play Console answers must describe
the released build, not planned functionality.

## Release facts to verify before submission

| Area                                         | Implementation evidence or current design                                                                                                                  | Release-owner action before Play submission                                                                                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend sync / Supabase                      | Account, household, participant, meeting, task, agreement, export, and entitlement data can be processed through the backend when account sync is enabled. | - [ ] Confirm whether production backend sync and Supabase are enabled. If enabled, mark the applicable account, user-generated-content, and purchase/entitlement categories as collected; identify backend processors and purposes.                   |
| Google Play billing and RevenueCat           | Premium purchase and entitlement validation are optional and store-backed; the app does not collect payment-card details directly.                         | - [ ] Confirm whether Google Play Billing and RevenueCat are enabled for this release. If enabled, disclose applicable purchase history / subscription-status data, its sharing with the store and RevenueCat, and the entitlement-validation purpose. |
| Sentry diagnostics                           | Diagnostics are optional; no Data Safety answer may assume Sentry is active.                                                                               | - [ ] Confirm whether Sentry is enabled. If enabled, identify the exact diagnostic, device, or other identifier data emitted by the release and complete its collected/shared/purpose fields.                                                          |
| OpenAI summaries                             | AI summaries are optional and backend-mediated.                                                                                                            | - [ ] Confirm whether OpenAI summaries are enabled. If enabled, disclose the user-generated content sent to OpenAI, the sharing, and the summary-generation purpose.                                                                                   |
| Google Calendar                              | Calendar sync is optional and uses a backend-supported OAuth flow only when enabled.                                                                       | - [ ] Confirm whether Google Calendar integration is enabled. If enabled, disclose the selected calendar/reminder, task-due-date, and follow-up data shared with Google and the calendar-sync purpose.                                                 |
| Local notifications                          | The app includes local reminder scheduling through Capacitor Local Notifications.                                                                          | - [ ] Confirm the released build requests or uses notification permission. Describe notifications as device-local unless another configured provider receives notification data.                                                                       |
| Local device storage                         | Private notes and reminder settings are intended to stay on the device; local storage is not a cloud provider.                                             | - [ ] Confirm the released build keeps private notes and reminder settings local-only. Do not mark local-only storage as shared unless a separate service receives it.                                                                                 |
| Contacts, location, media, and payment cards | The public v1 design does not use the device address book, location, or user media files, and does not collect payment-card details directly.              | - [ ] Inspect the final Android manifest, SDKs, and release build. Confirm these remain absent before marking the corresponding Play categories as not collected/shared.                                                                               |

## Data categories to carry into Play Console

The table below preserves the proposed category map. Each `Yes only if ...`
answer must be replaced with the confirmed production answer from the checklist
above. “Shared” means disclosed to a third party or service provider under the
Play Console definition; verify the current Play Console wording before filing.

| Google Play category            | OurWeek data                                                                       | Proposed collection answer                                       | Proposed sharing answer                                                                                                               | Purpose and final check                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Personal info: email address    | Account email; invitation email entered by a user                                  | Yes when accounts or workspace invitations are enabled           | Backend service providers when backend sync is enabled; an email provider only if one is enabled                                      | Account management, authentication, invitations, and support. - [ ] Confirm enabled providers and final answer.        |
| Personal info: name             | Display name; participant names                                                    | Yes when account/workspace sync is enabled                       | Backend service providers when backend sync is enabled                                                                                | Account profile, participants, and household records. - [ ] Confirm final answer.                                      |
| App activity: app interactions  | Feature-use events                                                                 | No unless analytics or diagnostics instrumentation collects them | No unless the enabled provider receives them                                                                                          | Do not mark collected or shared unless the release-owner provider audit supports it. - [ ] Confirm final answer.       |
| User-generated content          | Meeting notes, tasks, agreements, summaries, workspace records, and exports        | Yes when backend sync is enabled                                 | Backend service providers when sync is enabled; OpenAI only when optional AI summaries are enabled; user-controlled export recipients | Core functionality, sync, optional summaries, and export. - [ ] Confirm enabled providers and final answer.            |
| Financial info                  | Direct card or payment data                                                        | No direct collection by the mobile app                           | Store provider handles payments; do not report this as direct OurWeek payment-card collection                                         | Entitlement validation must not be described as direct payment-card collection. - [ ] Confirm final SDK/build audit.   |
| Purchase history                | Subscription product, status, receipt, or purchase-token metadata                  | Yes only if paid Premium ships                                   | Backend, Google Play, and RevenueCat only when the relevant billing integration is enabled                                            | Entitlement validation, restore, and subscription management. - [ ] Confirm final answer.                              |
| Calendar                        | Google Calendar connection and selected synced reminders, due dates, or follow-ups | Yes only if Calendar sync ships and is enabled                   | Google Calendar through backend-supported OAuth only when enabled                                                                     | Create or update selected calendar items. - [ ] Confirm final answer.                                                  |
| Contacts                        | Device address book                                                                | No                                                               | No                                                                                                                                    | Invitations use an email typed by the user, not address-book access. - [ ] Confirm final Android permission/SDK audit. |
| Location                        | Precise or approximate location                                                    | No                                                               | No                                                                                                                                    | Not part of public v1. - [ ] Confirm final Android permission/SDK audit.                                               |
| Photos, videos, audio, or files | User media files                                                                   | No                                                               | No                                                                                                                                    | Not part of public v1. - [ ] Confirm final Android permission/SDK audit.                                               |
| Device or other IDs             | Device identifiers                                                                 | No unless diagnostics or analytics is enabled                    | No unless the enabled provider receives them                                                                                          | Confirm Sentry/analytics SDK behavior before answering. - [ ] Confirm final answer.                                    |
| Diagnostics                     | Crash logs or performance diagnostics                                              | No unless a diagnostics provider such as Sentry is enabled       | No unless the enabled provider receives them                                                                                          | Confirm the provider and exact data before answering. - [ ] Confirm final answer.                                      |

## Security and local-data checks

- [ ] Confirm the deployed production API uses HTTPS before stating that data is
      encrypted in transit.
- [ ] Confirm sensitive authentication tokens use native secure storage on the
      final Android/iOS builds. Capacitor Preferences and ordinary local app storage
      are not secure storage and must only contain non-sensitive settings and app
      records.
- [ ] Confirm Google OAuth tokens are handled by the backend and are not stored
      in the mobile app when Calendar integration is enabled.
- [ ] Confirm private notes remain local-only unless a separately reviewed sync
      design changes that behavior.
- [ ] Confirm local notification data stays on the device unless an enabled
      provider receives it.

## Account deletion and export

The public Google Play account-deletion URL is:

```text
https://ourweekapp.com/delete-account
```

Before entering it in Play Console, the release owner must verify:

- [ ] The deployed route returns HTTP 200 in a private browser window with no
      login required.
- [ ] The page visibly offers an email deletion-request path to
      `ourweekapp@gmail.com` and does not put account data in its URL.
- [ ] The page and final Privacy Policy say a verified request results in
      deletion or anonymization within 30 days, and that backup copies expire
      within 90 days.
- [ ] The release still provides authenticated self-service deletion and export
      from Account settings. The existing backend interfaces are
      `DELETE /v1/account/` and `GET /v1/account/export`.
- [ ] Support can verify control of the account without requesting a password,
      token, or payment credential, then use the authenticated deletion workflow to
      fulfill the request.

## Manual Google Play submission record

- [ ] Production provider configuration was reviewed against this checklist.
- [ ] The released Android manifest and third-party SDK inventory were reviewed.
- [ ] The authenticated Data Safety form was completed with answers matching the
      released build.
- [ ] `https://ourweekapp.com/delete-account` was entered as the Google Play
      account-deletion URL.
- [ ] A release owner recorded the submission date, Play Console track, and
      reviewer name in the launch record.

## Store-listing copy guardrails

- Describe OurWeek as a guided weekly household check-in app for meetings,
  tasks, agreements, summaries, reminders, and follow-up.
- Do not claim therapy, relationship counselling, emergency support,
  encryption, cloud sync, Calendar sync, AI summaries, diagnostics, or billing
  unless the final released implementation and provider configuration support
  the claim.
- If AI summaries ship, disclose that they are optional, can be inaccurate, and
  should be reviewed.
- If Premium ships, disclose that paid access is validated through the backend
  and relevant store provider.
