# Premium Entitlement — Milestone 1: Free Meeting History

## Purpose

Make the complete meeting record a core Free experience. Every authenticated
workspace member can browse and open every completed meeting and its saved
summary. Premium becomes a value proposition for reducing meeting effort,
rather than a gate on the household's history.

This milestone follows the approved Milestone 0 entitlement contract. It
changes the live Free/Premium policy, but does not add a new Premium capability
or change subscription pricing.

## Product decisions

- Full meeting history is Free for the owner, adult members, and viewers.
- The three-completed-meeting Free limit is removed from both API behavior and
  client presentation.
- History no longer displays an upgrade CTA, lock state, or Premium-related
  copy anywhere in the product.
- Premium is positioned around active, already-shipped capabilities: AI
  summaries, Google Calendar sync, exports, additional templates, and private
  notes.
- A workspace subscription is owned and managed by the workspace owner. The
  owner receives purchase and subscription-management actions. Adult members
  who otherwise qualify for a Premium feature see a neutral owner-managed
  message; viewers keep role-restriction messaging.
- Advanced statistics remains planned and must never become a purchasable
  Premium benefit in this milestone.

## Feature-access contract

### New canonical feature

Add `meetingHistory` to the backend catalog as:

| Field | Value |
| --- | --- |
| Tier | `free` |
| Lifecycle | `available` |
| Eligible roles | `owner`, `adult_member`, `viewer` |
| Enforcement | `server` |

The API access map makes `meetingHistory.state` `available` for every
authenticated member, irrespective of the workspace's subscription, provider
state, grace period, or cached entitlement.

### Compatibility aliases

Milestone 0 clients read `limitedHistory` and `unlimitedHistory` directly.
Removing either key during an API-first deployment would make those clients
mistakenly lock history. Therefore, the API catalog and `features` map retain
both keys as temporary compatibility aliases during this milestone. Each alias
also resolves to `free` / `available` for all roles.

New clients use only `meetingHistory`. A later compatibility-cleanup milestone
may remove the aliases after all supported client versions have adopted the new
key. `enabledFeatures` also remains until that later milestone.

## Backend behavior

`MeetingsService.listMeetings` resolves `meetingHistory` from the shared
feature-access resolver. An available result always queries the full completed
meeting history. Remove the `FREE_COMPLETED_MEETING_LIMIT` path and the
Premium/stale-entitlement branch used solely for history.

The removal applies to list and detail use cases: the API must not block an
older completed meeting or its summary after it has been returned to a Free
member. Existing authorization and workspace-scoping rules remain unchanged.

No database migration is required. The existing generic feature resolver
continues to enforce actual Premium functions:

- AI summaries: eligible adults with trusted Premium.
- Additional templates: eligible adults with trusted Premium.
- Google Calendar sync: eligible adults with trusted Premium.
- Export: eligible adults with trusted Premium.
- Private notes: current client-only Premium policy, until its storage/privacy
  contract is separately specified.

History must never return `premium_required`. Subscription outages, expiry, or
stale Premium state have no effect on history access.

## Client experience

The subscription store and access composable use `meetingHistory` as the
canonical history feature. Remove Free-limit calculations and history-specific
access checks from:

- History list and completed-meeting cards.
- Home history shortcut and history-related Premium lock.
- Meeting details and saved-summary views.
- History route metadata, route guards, and upgrade redirects.

The app renders every completed card as available. It removes lock icons,
locked-item click behavior, full-history upgrade panels, and any copy that
claims Free access is limited to the latest meetings.

The plan comparison, Upgrade page, Settings subscription section, and
feature-lock messaging remove history as a Premium benefit. Their Premium
content emphasizes the active tools named above. Upgrade is contextual: it is
shown only when the user initiates a shipped Premium capability that their
workspace lacks.

For a workspace without Premium, only an owner sees purchase or management
actions. An eligible adult member sees an explanation that the owner manages
the workspace subscription. A viewer sees the existing role-restricted state;
neither receives an upgrade CTA.

## API and rollout

The subscription status response remains additive and contains:

- `features.meetingHistory` as the canonical Free feature.
- Free/available `limitedHistory` and `unlimitedHistory` aliases during the
  compatibility window.
- The existing `enabledFeatures` field during the compatibility window.

Deploy the API first. It is backward-compatible because older clients continue
to receive their expected keys, now unlocked. Deploy the client second. If the
client presentation needs rollback, roll back the client first; the API's
free aliases are safe for both versions. Do not remove aliases or
`enabledFeatures` in this milestone.

## Testing and acceptance criteria

Backend coverage must prove:

- Free, Premium, expired, and stale-entitlement workspaces receive every
  completed meeting.
- Owner, adult, and viewer access resolves `meetingHistory` as available.
- Compatibility aliases remain present and available in subscription status.
- Old history access paths never produce `premium_required`.
- Existing Premium tools retain their entitlement and role enforcement.

Client coverage must prove:

- All completed cards and detail/summary navigation are available to Free
  users.
- No history screen or redirect produces an upgrade path.
- New clients use `meetingHistory`; the compatibility aliases only serve older
  clients.
- Owner, adult, and viewer Premium messaging gives the correct purchase,
  owner-managed, or role-restricted outcome.
- Plan, Upgrade, and Settings surfaces no longer name unlimited history as a
  Premium benefit.

Release is complete when API typechecking, API tests, OpenAPI generation/check,
client tests, and the client production build pass, followed by manual checks
for a Free owner, adult, and viewer plus a Premium owner and viewer.

## Out of scope

- New Premium capabilities or price changes.
- Removing `enabledFeatures` or the legacy history aliases.
- Persisting or server-enforcing private notes.
- Changing ownership, roles, subscription-provider behavior, or workspace
  authorization outside the owner-managed purchase presentation.
