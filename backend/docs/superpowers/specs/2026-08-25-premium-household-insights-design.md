# Premium Household Insights Design

## Goal

Help Premium households learn from their shared meeting history through
searchable records and factual, source-linked insights. The feature must make
patterns in meetings, tasks, and agreement follow-up easy to act on without
using private notes, AI-generated judgments, or member-by-member comparisons.

## Scope

- Add an adult-only, Premium Insights destination containing shared-history
  search and household insight cards.
- Search completed meetings, task titles, and agreement titles/descriptions.
- Show selectable periods of the last four weeks, last twelve weeks, and all
  completed history for household metrics.
- Show meeting consistency, task follow-through, agreement follow-up state,
  and recurring topic cards with links to their source records.
- Calculate results on demand in the backend from canonical workspace data.
- Use the existing compact mobile card pattern: name, short context, and a
  few meaningful tags.

## Out of Scope

- AI-generated household observations, recommendations, sentiment analysis,
  or inferred causes.
- Searching or analysing private notes, AI-summary text, Calendar data, or
  user/device analytics.
- Individual-adult scorecards, comparisons, rankings, or performance
  attribution.
- New source-of-truth insight, search-index, or reporting tables.
- Polished printable reports, which belong to the separate Premium reports
  and exports milestone.
- Private meeting-preparation notes, which remain a separate privacy-focused
  milestone.
- Changing Free raw-data export access. Premium improves interpretation and
  presentation; it does not lock households out of their data.

## Product Rules

### Access and privacy

- Insights are available only to the workspace owner and adult members when
  the household has trusted Premium access for `advancedStatistics`.
- Viewers cannot open the Insights destination or call the insight/search API,
  even if they can read the underlying shared meeting history.
- The backend is authoritative for both plan and role enforcement. The client
  lock screen is only explanatory and cannot become an alternate data source.
- Every query is scoped to the authenticated workspace and excludes
  soft-deleted source records.
- Private notes are never queried, transferred, indexed, counted, or used as
  a fallback. The same exclusion applies to AI summary text, Calendar data,
  provider data, and any personal member analytics.
- Cards report household-level facts only. No insight assigns success, failure,
  or responsibility to a particular person.

### Search history

- Search is a separate area of the Insights destination, not a replacement for
  the existing History and Tasks experiences.
- A query searches the title of completed meetings, task titles, and agreement
  titles and descriptions. It does not search meeting note bodies, section
  note bodies, private notes, AI summaries, participant names, or account
  details.
- Queries are trimmed, case-insensitive, and require at least two
  non-whitespace characters. Invalid/empty input does not issue a broad search
  request.
- Results are grouped by Meetings, Tasks, and Agreements, paginated, and show
  only the compact fields needed by their cards: title, source/date context,
  type, and status tags.
- Meeting results include only completed meetings. Task and agreement results
  include active (non-deleted) records. A card opens the existing meeting,
  task, or agreement destination rather than embedding full source content in
  the insight response.

### Insight periods and factual metric definitions

- Adults can choose `4w`, `12w`, or `all`. The four- and twelve-week periods
  are rolling windows ending at the server's current time; the response
  supplies the evaluated range so the client can label it accurately.
- `all` includes all non-deleted completed-meeting history and all active tasks
  and agreements. It is not an arbitrary client/device-history limit.
- A source-date boundary is inclusive at the start and exclusive at the end,
  preventing double counting when adjacent windows are compared.

#### Meeting consistency

- Count completed, non-deleted meetings by `completedAt` in the selected
  period.
- Show an average interval only when there are at least two completed meetings
  in the period. It is the arithmetic mean of elapsed time between adjacent
  completed meetings, ordered chronologically.
- Do not treat drafted, paused, incomplete, or deleted meetings as completed.

#### Task follow-through

- Count active tasks created in the selected period by their **current**
  status: `done`, `open`, and `skipped`.
- The task completion rate is `done / (done + open)`. Skipped tasks are shown
  separately and do not raise or lower the rate.
- An overdue task is an open task with a due date before the server's current
  calendar date. The card shows the count of currently overdue tasks among the
  selected-period tasks; it is not a historical claim about how many tasks
  were overdue at an earlier point in time.
- The product labels these as current statuses so later task edits do not
  masquerade as immutable historical events.

#### Agreement follow-through

- Count active agreements created in the selected period only when they have
  an associated assistant follow-up.
- An agreement is `resolved` when its latest follow-up is resolved. It is
  `unresolved` when the active follow-up is open, snoozed, or carried to the
  next meeting.
- Agreements without a follow-up are counted and explicitly labelled “not
  tracked yet.” They are never silently classified as resolved or unresolved.
- This metric reflects the existing follow-up lifecycle, not an invented
  agreement-level completion field. It therefore remains accurate for older
  agreements created before follow-up automation existed.

#### Recurring topics

- Derive topics only from section titles on completed, non-deleted meetings in
  the selected period.
- Normalize a title by trimming outer whitespace, converting it to lowercase,
  and collapsing internal whitespace before comparing it. Preserve a readable
  source title for display.
- A recurring-topic card requires the normalized title to appear in at least
  two distinct meetings. The card returns its count and matching meeting IDs;
  it never infers a topic from note text.

### Empty and unavailable states

- If there is insufficient history, explain which records will make the card
  available rather than showing a zero-value claim. For example, average
  meeting interval requires two completed meetings.
- Empty search results state that no shared meeting, task, or agreement
  matched the query. They do not expose the types or count of excluded data.
- A Free household sees the existing owner-aware Premium upgrade state.
  An adult who cannot purchase sees the existing owner-managed explanation.
- A viewer gets the ordinary role-restricted state and no insight payload.
- Loading and safe API-error states are distinct from data-empty states. The
  client never falls back to local-device aggregation.

## Architecture

### Backend ownership

Add an `insights` domain module with its own route, Zod schemas, repository,
and service. It owns the public DTOs and aggregation rules, while reusing the
existing meetings, tasks, assistant-follow-up, auth, and billing foundations.

Route handlers remain thin: read validated query parameters and authenticated
context, call the service, and return the typed response. The service requires
the existing `advancedStatistics` feature before any source query, then
enforces the owner/adult role boundary. Repositories always apply
`workspace_id`, deletion, status, date, and pagination predicates in the
database rather than filtering an unscoped data set in memory.

The service reads metric source data in bounded pages until the relevant period
is exhausted. This preserves true all-history calculations without a broad
single database response. Search remains database-paginated end to end.

No provider call, background worker, cache, materialized view, or LLM is part
of the first implementation. A later cache or snapshot layer may sit behind
the same DTOs only after household data size demonstrates a need.

### Feature availability

Promote the existing `advancedStatistics` catalog entry from `planned` to
`available` in the API and client feature-access configurations. Its existing
Premium tier, owner/adult eligibility, and server enforcement remain unchanged.
There is no new billing product or entitlement.

### Indexes and migration safety

Create one forward-only migration for only the query-supporting indexes below:

- completed, active meetings by `workspace_id` and `completed_at`;
- active tasks by `workspace_id` and `created_at`; and
- active agreements by `workspace_id` and `created_at`.

Use partial indexes that exclude soft-deleted rows; the meeting index also
limits to `status = 'completed'`. These indexes directly support the selected
period predicates. Review the current schema and query plans locally before
finalizing index definitions; do not add broad text-search indexes without
evidence from real household query volume. The existing follow-up indexes
continue to serve source/state lookup.

The migration adds indexes only: no existing migration is edited, no source
data is rewritten, and no RLS policy changes are needed. The service remains
compatible during a rolling deployment because the relevant source tables and
columns already exist.

## API Contract

### `GET /v1/insights`

Authenticated owner/adult endpoint with a required/validated period query:

`period=4w|12w|all`

The response contains:

- evaluated `period`, `rangeStart`, and `rangeEnd`;
- meeting-consistency count and optional average interval;
- task counts, optional completion rate, and currently-overdue count;
- agreement resolved, unresolved, and not-tracked-yet counts; and
- recurring-topic cards with an ID-safe display title, meeting count, and
  matching source meeting IDs.

It returns stable camelCase DTOs only. It does not return raw sections, note
text, private content, provider identifiers, user performance data, or database
rows. A missing metric is represented explicitly as unavailable/insufficient
data rather than an ambiguous numeric zero.

### `GET /v1/insights/search`

Authenticated owner/adult endpoint with validated query parameters:

- `q`: trimmed search text, two or more characters;
- `limit`: bounded page size; and
- `offset`: non-negative page offset.

The response returns independently paginated meeting, task, and agreement
groups, each with compact card DTOs and standard pagination metadata. Each
source item includes its type and ID for navigation, title, safe date/source
context, and existing status tags. The endpoint does not make its match field
or excluded-content rules observable beyond the approved result shape.

Expected safe errors follow existing conventions:

- `401` for missing/invalid authentication;
- `403` for an authenticated viewer or missing Premium entitlement;
- `422` for an invalid period, query, limit, or offset; and
- a generic `500` API error for unexpected repository failures.

## Client Experience

Add an Insights page and route using a dedicated client service, typed DTOs,
and store/composable state. The destination is exposed only when the feature
access response says `advancedStatistics` is available to the current adult.
The server remains authoritative if plan or role changes after the UI renders.

The page starts with the period control and a concise household-insights card
stack:

- Meeting consistency;
- Task follow-through;
- Agreement follow-through; and
- Recurring topics.

Each card uses the current visual language: a clear name, short factual
explanation, and small tags such as `Completed`, `Open`, `Overdue`,
`Resolved`, or `2 meetings`. A recurring-topic card opens/filter-navigates to
its source meetings. Search appears as a separate focused area with grouped
result cards and links to existing records.

Add translation-ready copy in English, Ukrainian, and Spanish for labels,
metric explanations, periods, status tags, no-data state, role restriction,
Premium lock, input validation, and safe error/retry states. Do not introduce
a local insight calculator or store private data in the new page state.

## Testing Requirements

### API

- Route tests cover valid responses; invalid period/query/pagination; missing
  authentication; viewer access; Free/expired-Premium access; and safe errors.
- Service/repository tests prove workspace isolation, owner/adult eligibility,
  soft-delete exclusion, and no access to another workspace's source IDs.
- Metric tests cover period boundaries, no/one/multiple completed meetings,
  correct chronological average interval, all current task statuses, skipped
  denominator exclusion, overdue-date behavior, and absent due dates.
- Agreement tests cover resolved, open, snoozed, carry-to-next-meeting, and
  untracked agreements without misclassification.
- Topic tests cover title normalization, distinct-meeting counting, duplicate
  sections within one meeting, two-meeting threshold, and no note-text
  analysis.
- Search tests cover case-insensitive matching, allowed fields only,
  completed-meeting-only results, deleted-source exclusion, grouping, and
  independent pagination.
- Migration tests assert the forward-only partial indexes and no unintended
  RLS/data changes.

### Client

- Test feature visibility/lock states, period changes, loading, safe error,
  and each insufficient-data state.
- Test deterministic card rendering, status labels, and links to the existing
  meeting/task/agreement destinations.
- Test search validation, grouped pagination, no-result state, and API error
  retry behavior.
- Test English, Ukrainian, and Spanish copy coverage for the new keys.

## Rollout

1. Add and locally validate the narrow index migration and query plans.
2. Ship the backend `insights` module, typed contracts, Premium/role checks,
   source-scoped pagination, and focused API tests.
3. Promote `advancedStatistics` to available in the shared feature catalogs.
4. Ship the mobile Insights route, compact cards, search, translated states,
   and client tests.
5. Test Premium owner, Premium adult, viewer, Free household, expired Premium,
   multi-workspace membership, sparse history, old agreements without
   follow-ups, and a household with recurring section titles in staging.
6. Monitor safe endpoint latency and error rates. Consider caching only if
   measured all-history aggregation warrants it, preserving this response
   contract and privacy boundary.

This first Milestone 5 release deliberately makes history more useful without
turning household records into behavioral judgments. Its factual, source-linked
contract leaves room for later reports and separately designed private
preparation tools.
