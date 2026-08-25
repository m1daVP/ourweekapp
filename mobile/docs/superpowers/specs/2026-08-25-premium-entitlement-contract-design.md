# Premium Entitlement Contract — Milestone 0

## Purpose

Create one authoritative contract for which household features are available, planned, Premium-only, or role-restricted. The contract must give the API and client the same answer for the same workspace member.

This is a contract-only milestone. It must preserve the current user-visible Free/Premium boundary. In particular, the existing three-completed-meeting history limit remains in place; moving full history to Free is Milestone 1.

## Product decisions

- A subscription belongs to a workspace (household), not an individual member. The owner manages billing; eligible adult members use shared Premium features.
- Features are not merely Free or Premium. Each has a tier, lifecycle, role policy, and enforcement designation.
- The app must only offer an upgrade for a feature that is both shipped and Premium. A planned feature is not purchasable and may only be presented as “Coming soon”.
- A server-reachable Premium feature is enforced by the server. The client uses the same access result for its UI, navigation, and prompts.
- The backend owns the catalog and resolves effective feature access. The frontend does not independently decide a catalogued feature’s tier.
- Existing product access stays unchanged during this milestone.

## Terminology

### Catalog fields

Every stable feature key has one catalog entry with:

| Field | Meaning |
| --- | --- |
| `key` | Stable API/client identifier; never rename after release. |
| `tier` | `free` or `premium`. |
| `lifecycle` | `available`, `planned`, or `retired`. |
| `eligibleRoles` | Workspace roles allowed to use the feature. |
| `enforcement` | `server`, `client`, or `both`, indicating where use is protected. |

`client` enforcement is allowed only for a feature that has no server-side operation, such as a purely local experience. It does not make the client authoritative: the client still derives its access state from the API response.

### Effective access states

For an authenticated workspace member, each catalog entry resolves to exactly one state:

| State | Meaning | Client behavior |
| --- | --- | --- |
| `available` | Shipped and allowed by plan and role. | Render and allow use. |
| `upgradeRequired` | Shipped Premium feature; current workspace lacks a trusted Premium entitlement. | Show an upgrade path. |
| `roleRestricted` | Shipped and plan-eligible, but this member lacks the required workspace role. | Explain the role requirement; do not show an upgrade CTA. |
| `notYetAvailable` | Planned, regardless of tier. | Optional “Coming soon”; never promote purchase. |
| `unavailable` | Retired or disabled. | Hide or give a neutral unavailable message. |

The resolver evaluates these states in this order: non-available lifecycle first, then role eligibility, then Premium entitlement, then available. This means a viewer never receives an upgrade prompt for an adult-only Premium feature; they receive `roleRestricted` instead.

## Initial catalog policy

Milestone 0 records the live policy as it exists today, including the intended Free reminder behavior that currently differs between API and client configuration.

| Feature group | Tier | Lifecycle | Notes |
| --- | --- | --- |
| Basic meetings, default template, tasks and agreements, manual responsibility | Free | Available | Core meeting workflow. |
| Limited history | Free | Available | Current limit remains unchanged in this milestone. |
| Local reminders and agreement reminders | Free | Available | Explicitly reconcile the current API/client discrepancy. |
| Unlimited history | Premium | Available | Becomes Free only in Milestone 1. |
| AI summaries | Premium | Available | Adult-member role required; server enforced. |
| Additional templates | Premium | Available | Current template library behavior remains unchanged. |
| Private notes | Premium | Available | Client-gated today; a later privacy specification can add server storage/enforcement. |
| Google Calendar sync | Premium | Available | Adult-member role required; server enforced. |
| Meeting export | Premium | Available | Adult-member role required when using the server export path. |
| Advanced statistics | Premium | Planned | Never presented as an active Premium benefit until delivered. |

Each named feature in a grouped row is an individual catalog entry; grouping is only for readability in this specification.

No speculative keys for later milestones are added now. A future feature receives its stable key when its own approved specification defines its product behavior. This keeps the contract useful without advertising vague future work.

## Architecture and data flow

The backend maintains the catalog in one billing-domain location and exposes an access resolver. The resolver takes the catalog entry, the member’s workspace role, and the workspace’s trusted subscription state.

```text
catalog + workspace role + trusted subscription state
                         |
                         v
                feature-access resolver
                  /                    \
                 v                      v
       server route authorization   subscription status response
                                            |
                                            v
                                 client subscription store
                                            |
                                            v
                          UI, route guards, locks, and prompts
```

The subscription status response evolves from a plan with `enabledFeatures` to a per-feature access map. During rollout, it returns the richer map alongside `enabledFeatures` for compatibility with already-released clients.

Each returned feature entry contains its key, tier, lifecycle, effective access state, role eligibility, and whether an upgrade is meaningful. The client may retain local labels and descriptions for localization, but it must not decide availability from a duplicate plan list.

New server guards use a generic `requireFeature(featureKey)` policy helper. Existing Premium guards are migrated progressively to the helper without altering which requests are permitted. The guard and the status endpoint use the same resolver.

## Client behavior

- The subscription store persists the latest server access map with the current plan and entitlement verification information.
- Feature composables, Premium locks, router guards, and upgrade prompts consult that map rather than local plan membership rules.
- The app renders an upgrade prompt only for `upgradeRequired`.
- A planned feature never appears as unlocked due to a purchase. If exposed in a future UI, it uses a non-purchasing “Coming soon” state.
- The client refreshes status at app startup, after a purchase or restore, and after a workspace change. Existing safe behavior for a failed provider refresh remains intact.

## API errors

Existing successful and failure behavior remains stable unless a new generic guard is used.

| Condition | API result |
| --- | --- |
| Available feature | Continue to the route handler. |
| Shipped Premium feature without entitlement | `403 premium_required`. |
| Role-restricted feature | `403 feature_role_restricted`. |
| Planned, retired, or disabled server feature | `404 feature_not_available`. |
| Subscription-provider outage | Use only the existing trusted cached entitlement; never grant Premium merely because verification failed. |

The UI should make planned and role-restricted states unreachable or self-explanatory, so these errors are safe fallbacks rather than ordinary navigation outcomes.

## Rollout sequence

1. Add the backend catalog and resolver representing the current policy exactly.
2. Extend subscription status with the access map while retaining `enabledFeatures`.
3. Move client access decisions, route guards, locks, and prompts to the map with a temporary legacy-response fallback.
4. Migrate AI, Calendar, exports, meeting templates, history, and other existing guards to the generic server helper.
5. Add contract tests, then remove duplicate client entitlement decisions and the legacy response field after supported clients have adopted the map.

No database schema change is required unless implementation needs persisted catalog versioning; the initial catalog may be application configuration. Subscription entitlement records and RevenueCat integration remain the authority for whether the workspace has Premium.

## Verification and acceptance criteria

### Automated coverage

- Catalog validation: every key is unique; every entry has a valid tier, lifecycle, role policy, and enforcement designation.
- Resolver matrix: Free/Premium subscription state, every workspace role, and every lifecycle state resolve deterministically.
- API status tests: returned per-feature states match the resolver, including stale-entitlement behavior.
- Route tests: AI, Calendar, export, meeting template, and history gates agree with the resolver.
- Client tests: routes, locks, and prompts distinguish available, upgrade-required, planned, and role-restricted states.
- Compatibility tests: the client handles an old status response during staged rollout.

### Done criteria

- Each existing feature key has one backend catalog entry.
- The API status endpoint and server route guard give the same decision for the same role, workspace, and entitlement.
- The client has no independent entitlement decision for a catalogued feature.
- Only shipped, eligible Premium features can produce an upgrade CTA.
- Planned features cannot be advertised as unlockable by Premium.
- Current Free/Premium behavior, including limited history, remains unchanged.

## Explicit non-goals

- Changing the history limit or making full history Free.
- Adding trials, credits, AI quotas, smart follow-ups, new templates, search, reports, or insights.
- Changing prices, RevenueCat products, or purchase flow.
- Migrating private notes to backend storage.
- Removing existing subscription verification safeguards.
