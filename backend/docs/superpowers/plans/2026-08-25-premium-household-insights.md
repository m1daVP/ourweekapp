# Premium Household Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver adult-only Premium household insights with factual shared-history search, source-linked metrics, and recurring-topic cards.

**Architecture:** A new API `insights` module reads canonical, workspace-scoped rows in bounded pages and calculates all period metrics on demand. A typed Vue feature calls the two API endpoints and renders the approved card-based Insights page; access is controlled by the existing `advancedStatistics` feature both in routing and on the server.

**Tech Stack:** Node.js 24, Fastify 5, TypeScript 6, Zod 4, Supabase/PostgreSQL, Vitest 4, Vue 3, Pinia 4, Vue Router 5, vue-i18n 11.

## Global Constraints

- Keep `advancedStatistics` Premium-only and available only to `owner` and `adult_member`; enforce it server-side with the existing feature middleware.
- Query only canonical, workspace-scoped, non-deleted meetings, tasks, agreements, and assistant follow-ups; never read private notes, AI summaries, Calendar/provider data, or individual performance data.
- Search only completed meeting titles, task titles, and agreement titles/descriptions; require at least two trimmed query characters and preserve per-type pagination.
- Compute on demand in bounded database pages; do not add a background worker, cache, materialized view, LLM call, or new source-of-truth insight table.
- Use stable camelCase API DTOs, Zod request/response schemas, safe `ApiError` responses, and repository filtering rather than application-side workspace filtering.
- Add only forward-only, partial indexes justified by the selected-period queries; do not edit applied migrations or change RLS policies.
- Keep the compact card visual language and add English, Ukrainian, and Spanish copy; never provide a device-only aggregate fallback.
- Do not add dependencies. Preserve unrelated dirty worktree changes and commit only after explicit user approval during execution.

---

## File Structure

### API repository: `D:\Projects\myself\weekly-us-api`

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260825140000_add_household_insights_indexes.sql` | Adds the three narrow partial date indexes used by insight period queries. |
| `src/modules/billing/feature-access.ts` | Promotes `advancedStatistics` from `planned` to `available`. |
| `src/modules/insights/insights.schema.ts` | Defines request query, metric, source-card, search, and pagination Zod DTOs. |
| `src/modules/insights/insights.repository.ts` | Performs all workspace/date/deletion-scoped reads and separate paginated searches. |
| `src/modules/insights/insights.service.ts` | Enforces adult role, calculates metrics/recurrence, and maps repository rows to public DTOs. |
| `src/modules/insights/insights.routes.ts` | Wires authenticated Premium `GET /insights` and `GET /insights/search` endpoints. |
| `src/routes/v1.routes.ts` | Mounts the Insights module at `/v1/insights`. |
| `tests/household-insights.migration.test.ts` | Guards migration/index shape and RLS non-changes. |
| `tests/insights.repository.test.ts` | Verifies all repository query predicates and search isolation. |
| `tests/insights.service.test.ts` | Covers formulas, source exclusions, normalization, paging assembly, and role behavior. |
| `tests/insights.routes.test.ts` | Covers auth, entitlement, validation, and DTO route wiring. |
| `tests/feature-access.test.ts` | Updates the planned-feature assertion to the shipped Premium behavior. |

### Client repository: `D:\Projects\myself\weekly-us`

| File | Responsibility |
| --- | --- |
| `src/features/insights/types.ts` | Mirrors only the public Insights DTOs and UI period/result types. |
| `src/shared/api/insightsApi.ts` | Makes authenticated requests to `/insights` and `/insights/search`. |
| `src/features/insights/services/insightsService.ts` | Exposes typed feature-level `loadInsights` and `searchInsights` calls. |
| `src/app/stores/householdInsights.ts` | Owns selected period, loading/error state, insight response, and independently paginated search state. |
| `src/features/insights/presentation.ts` | Converts safe DTOs into card labels/tags and exact existing record routes without local aggregation. |
| `src/pages/InsightsPage.vue` | Renders the period control, factual cards, grouped search, and distinct unavailable states. |
| `src/app/router/index.ts` | Registers the guarded `/insights` route. |
| `src/pages/HomePage.vue` | Adds the clear adult-facing entry point to the new destination. |
| `src/features/access/legacyFeatureAccess.ts` | Marks the legacy Premium fallback for `advancedStatistics` as available. |
| `src/features/localization/messages.ts` | Adds complete English/Ukrainian/Spanish Insights copy. |
| `src/features/insights/__tests__/insightsService.test.ts` | Verifies client API wrapper paths, query serialization, and auth options. |
| `src/app/stores/__tests__/householdInsights.test.ts` | Verifies store loading, safe error, period, and search pagination behavior. |
| `src/features/insights/__tests__/presentation.test.ts` | Verifies card tags and source routing without requiring a device-local calculation. |

## Task 1: Promote Premium access and add query-supporting indexes

**Files:**
- Create: `supabase/migrations/20260825140000_add_household_insights_indexes.sql`
- Modify: `src/modules/billing/feature-access.ts`
- Modify: `tests/feature-access.test.ts`
- Create: `tests/household-insights.migration.test.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\access\legacyFeatureAccess.ts`
- Test: `D:\Projects\myself\weekly-us\src\features\subscription\services\__tests__\subscriptionService.test.ts`

**Interfaces:**
- Consumes: `featureCatalog.advancedStatistics` and `resolveFeatureAccess()` from `src/modules/billing/feature-access.ts`.
- Produces: an available, server-enforced Premium feature key and database indexes usable by `InsightsRepository` in Task 2.

- [ ] **Step 1: Write the failing feature and migration tests**

```ts
// tests/feature-access.test.ts
it('makes advanced statistics available to Premium adults and owners only', () => {
  expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
    planType: 'premium', role: 'adult_member',
  })).toMatchObject({ lifecycle: 'available', state: 'available' });
  expect(resolveFeatureAccess(featureCatalog.advancedStatistics, {
    planType: 'premium', role: 'viewer',
  })).toMatchObject({ lifecycle: 'available', state: 'roleRestricted' });
});

// tests/household-insights.migration.test.ts
expect(sql).toContain('create index insights_completed_meetings_workspace_completed_idx');
expect(sql).toContain("where deleted_at is null and status = 'completed'");
expect(sql).not.toContain('alter table public.');
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/feature-access.test.ts tests/household-insights.migration.test.ts`

Expected: FAIL because the feature remains `planned` and the migration does not exist.

- [ ] **Step 3: Add the minimal availability and index implementation**

```ts
// src/modules/billing/feature-access.ts
advancedStatistics: {
  key: 'advancedStatistics', tier: 'premium', lifecycle: 'available',
  eligibleRoles: adultRoles, enforcement: 'server',
},
```

```sql
-- supabase/migrations/20260825140000_add_household_insights_indexes.sql
create index insights_completed_meetings_workspace_completed_idx
  on public.meetings (workspace_id, completed_at desc)
  where deleted_at is null and status = 'completed';

create index insights_active_tasks_workspace_created_idx
  on public.tasks (workspace_id, created_at desc)
  where deleted_at is null;

create index insights_active_agreements_workspace_created_idx
  on public.agreements (workspace_id, created_at desc)
  where deleted_at is null;
```

Change the client fallback to use `const lifecycle = 'available';` for this key so an offline/legacy Premium snapshot does not falsely label a shipped feature as not-yet-available. Update the subscription-service expectation to assert the delivered lifecycle, not `planned`.

- [ ] **Step 4: Run focused API and client tests to verify they pass**

Run: `npm test -- tests/feature-access.test.ts tests/household-insights.migration.test.ts`

Run: `npm test -- src/features/subscription/services/__tests__/subscriptionService.test.ts`

Expected: PASS. The migration test confirms three additive indexes only; Premium adults see `available`, and viewers remain role-restricted.

- [ ] **Step 5: Commit the independently reviewable groundwork**

```bash
git add supabase/migrations/20260825140000_add_household_insights_indexes.sql src/modules/billing/feature-access.ts tests/feature-access.test.ts tests/household-insights.migration.test.ts
git commit -m "feat: enable premium household insights access"
```

Commit the matching client fallback change separately in the client repository:

```bash
git add src/features/access/legacyFeatureAccess.ts src/features/subscription/services/__tests__/subscriptionService.test.ts
git commit -m "feat: expose available household insights access"
```

## Task 2: Define Insights DTOs and workspace-scoped repository reads

**Files:**
- Create: `src/modules/insights/insights.schema.ts`
- Create: `src/modules/insights/insights.repository.ts`
- Create: `tests/insights.repository.test.ts`

**Interfaces:**
- Consumes: `SupabaseRepositoryClient`, `JsonValue`, date schemas, and canonical meeting/task/agreement/follow-up tables.
- Produces:

```ts
export type InsightsPeriodDto = '4w' | '12w' | 'all';
export type InsightsQueryDto = { period: InsightsPeriodDto };
export type InsightsSearchQueryDto = { q: string; limit: number; offset: number };
export class InsightsRepository {
  listCompletedMeetingsForPeriod(workspaceId: string, rangeStart: string | null, rangeEnd: string, limit: number, offset: number): Promise<InsightMeetingRecord[]>;
  listTasksCreatedInPeriod(workspaceId: string, rangeStart: string | null, rangeEnd: string, limit: number, offset: number): Promise<InsightTaskRecord[]>;
  listAgreementsCreatedInPeriod(workspaceId: string, rangeStart: string | null, rangeEnd: string, limit: number, offset: number): Promise<InsightAgreementRecord[]>;
  listAgreementFollowUps(workspaceId: string, agreementIds: string[]): Promise<InsightFollowUpRecord[]>;
  searchMeetings(workspaceId: string, q: string, limit: number, offset: number): Promise<InsightSearchPage<InsightMeetingSearchRecord>>;
  searchTasks(workspaceId: string, q: string, limit: number, offset: number): Promise<InsightSearchPage<InsightTaskSearchRecord>>;
  searchAgreements(workspaceId: string, q: string, limit: number, offset: number): Promise<InsightSearchPage<InsightAgreementSearchRecord>>;
}
```

- [ ] **Step 1: Write failing schema and repository-shape tests**

```ts
it('scopes completed meeting insight reads to one workspace, completed status, active rows, and a half-open range', async () => {
  await repository.listCompletedMeetingsForPeriod(workspaceId, '2026-08-01T00:00:00.000Z', '2026-08-29T00:00:00.000Z', 100, 0);
  expect(query.eq).toHaveBeenCalledWith('workspace_id', workspaceId);
  expect(query.eq).toHaveBeenCalledWith('status', 'completed');
  expect(query.is).toHaveBeenCalledWith('deleted_at', null);
  expect(query.gte).toHaveBeenCalledWith('completed_at', '2026-08-01T00:00:00.000Z');
  expect(query.lt).toHaveBeenCalledWith('completed_at', '2026-08-29T00:00:00.000Z');
});

expect(insightsSearchQuerySchema.safeParse({ q: ' ', limit: 20, offset: 0 }).success).toBe(false);
expect(insightsSearchQuerySchema.parse({ q: 'Plan', limit: 20, offset: 0 })).toMatchObject({ q: 'Plan' });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/insights.repository.test.ts`

Expected: FAIL because the Insights schemas and repository do not exist.

- [ ] **Step 3: Implement public schemas and source-record mappings**

```ts
// src/modules/insights/insights.schema.ts
export const insightsPeriodSchema = z.enum(['4w', '12w', 'all']);
export const insightsQuerySchema = z.object({ period: insightsPeriodSchema.default('4w') });
export const insightsSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const insightSearchItemSchema = z.object({
  id: apiIdSchema,
  type: z.enum(['meeting', 'task', 'agreement']),
  title: z.string(),
  occurredAt: isoDateTimeStringSchema.nullable(),
  status: z.string().nullable(),
  sourceMeetingId: apiIdSchema.nullable(),
});
```

Implement repository column lists that select only calculation/card fields. Each period query must apply `workspace_id`, `deleted_at is null`, inclusive `gte` start when non-null, exclusive `lt` end, deterministic chronological order, and `range(offset, offset + limit - 1)`. The meeting query additionally filters `status = completed`. Follow-up reads must filter `workspace_id`, `source_type = agreement`, and `source_id in agreementIds`; return state and timestamps only. Search queries must use `ilike` only on the approved fields, apply the same active/completed filters, get `{ count: 'exact' }`, and return a page with `total` so each group has independent pagination.

- [ ] **Step 4: Run repository tests to verify they pass**

Run: `npm test -- tests/insights.repository.test.ts`

Expected: PASS. Query mocks prove workspace scoping happens before source data is returned and no prohibited field is selected.

- [ ] **Step 5: Commit repository contracts and tests**

```bash
git add src/modules/insights/insights.schema.ts src/modules/insights/insights.repository.ts tests/insights.repository.test.ts
git commit -m "feat: add household insights data queries"
```

## Task 3: Calculate factual metrics, recurrence, and grouped search responses

**Files:**
- Create: `src/modules/insights/insights.service.ts`
- Modify: `src/modules/insights/insights.schema.ts`
- Create: `tests/insights.service.test.ts`

**Interfaces:**
- Consumes: `InsightsRepository` from Task 2, `AuthContext`, `requireMinimumRole()`, period/query DTOs.
- Produces:

```ts
export class InsightsService {
  static fromSupabase(supabase: SupabaseRepositoryClient): InsightsService;
  getInsights(auth: AuthContext, query: InsightsQueryDto, now?: Date): Promise<InsightsResponseDto>;
  search(auth: AuthContext, query: InsightsSearchQueryDto): Promise<InsightsSearchResponseDto>;
}
export function normalizeRecurringTopic(value: unknown): string | null;
```

- [ ] **Step 1: Write failing calculation and privacy tests**

```ts
it('calculates completion as done divided by done plus open, excluding skipped', async () => {
  repository.listTasksCreatedInPeriod.mockResolvedValue([
    task({ status: 'done' }), task({ id: 'open', status: 'open' }), task({ id: 'skipped', status: 'skipped' }),
  ]);
  await expect(service.getInsights(adultAuth, { period: '4w' }, new Date('2026-08-25T12:00:00.000Z')))
    .resolves.toMatchObject({ tasks: { done: 1, open: 1, skipped: 1, completionRate: 0.5 } });
});

it('labels an agreement without a follow-up as not tracked instead of resolved', async () => {
  repository.listAgreementsCreatedInPeriod.mockResolvedValue([agreement({ id: 'a1' })]);
  repository.listAgreementFollowUps.mockResolvedValue([]);
  await expect(service.getInsights(adultAuth, { period: '12w' }, now))
    .resolves.toMatchObject({ agreements: { resolved: 0, unresolved: 0, notTrackedYet: 1 } });
});

it('uses section titles only and counts a recurring topic once per meeting', async () => {
  repository.listCompletedMeetingsForPeriod.mockResolvedValue([
    meeting({ id: 'm1', sections: [{ title: '  Weekly   plans ' }, { title: 'weekly plans' }, { notes: ['private text'] }] }),
    meeting({ id: 'm2', sections: [{ title: 'Weekly plans' }] }),
  ]);
  await expect(service.getInsights(adultAuth, { period: 'all' }, now))
    .resolves.toMatchObject({ recurringTopics: [{ title: 'Weekly plans', meetingCount: 2, meetingIds: ['m1', 'm2'] }] });
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `npm test -- tests/insights.service.test.ts`

Expected: FAIL because the service and result DTOs do not exist.

- [ ] **Step 3: Implement the deterministic service**

```ts
function getPeriodRange(period: InsightsPeriodDto, now: Date) {
  const rangeEnd = now.toISOString();
  if (period === 'all') return { rangeStart: null, rangeEnd };
  const days = period === '4w' ? 28 : 84;
  return { rangeStart: new Date(now.getTime() - days * 86_400_000).toISOString(), rangeEnd };
}

function currentAgreementState(followUps: InsightFollowUpRecord[]) {
  const latest = [...followUps].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (!latest) return 'notTrackedYet' as const;
  return latest.state === 'resolved' ? 'resolved' as const : 'unresolved' as const;
}
```

Call `requireMinimumRole(auth, 'adult_member')` before any repository read. Fetch each metric record class in pages of 100 until the page is short, then calculate:

- completed meeting count and mean interval in milliseconds only when two or more chronologically sorted `completedAt` values exist;
- current task `done`, `open`, `skipped`, optional `completionRate`, and open/past-date overdue count using a UTC `YYYY-MM-DD` representation of `now`;
- agreement buckets using the latest follow-up state per agreement; and
- normalized section-title recurrence using a `Set` per meeting, thresholded at two distinct meeting IDs.

Map search repository pages into the grouped response without reading sections, notes, summaries, or private fields. Extend the response schemas with explicit `available: false`/`reason: 'insufficient_data'` for metrics that cannot honestly report a value, instead of overloading zero.

- [ ] **Step 4: Run the full service test file to verify it passes**

Run: `npm test -- tests/insights.service.test.ts`

Expected: PASS. Include tests for 4w/12w/all half-open boundaries, one-meeting average absence, `open`/`snoozed`/`carry_to_next_meeting` agreement states, overdue dates, duplicate section titles, viewer rejection before a repository call, and grouped search passthrough.

- [ ] **Step 5: Commit calculation logic and tests**

```bash
git add src/modules/insights/insights.schema.ts src/modules/insights/insights.service.ts tests/insights.service.test.ts
git commit -m "feat: calculate premium household insights"
```

## Task 4: Expose the authenticated Premium Insights API

**Files:**
- Create: `src/modules/insights/insights.routes.ts`
- Modify: `src/routes/v1.routes.ts`
- Create: `tests/insights.routes.test.ts`

**Interfaces:**
- Consumes: `InsightsService.getInsights()`, `InsightsService.search()`, `requireAuth()`, and `requireFeature(subscriptionsRepository, 'advancedStatistics')`.
- Produces:

```text
GET /v1/insights?period=4w|12w|all
GET /v1/insights/search?q=<two-or-more-chars>&limit=1..50&offset=0..
```

- [ ] **Step 1: Write failing route tests**

```ts
it('rejects a viewer before calling the Insights service', async () => {
  const response = await app.inject({ method: 'GET', url: '/v1/insights?period=4w', headers: { authorization: 'Bearer viewer-token' } });
  expect(response.statusCode).toBe(403);
  expect(getInsights).not.toHaveBeenCalled();
});

it('returns validated grouped search data for a Premium adult', async () => {
  searchInsights.mockResolvedValueOnce(searchResponse);
  const response = await app.inject({ method: 'GET', url: '/v1/insights/search?q=Plan&limit=20&offset=0', headers: { authorization: 'Bearer premium-token' } });
  expect(response.statusCode).toBe(200);
  expect(searchInsights).toHaveBeenCalledWith(expect.objectContaining({ role: 'adult_member' }), { q: 'Plan', limit: 20, offset: 0 });
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- tests/insights.routes.test.ts`

Expected: FAIL because the route module is not registered.

- [ ] **Step 3: Implement route registration and typed response schemas**

```ts
export const insightsRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = InsightsService.fromSupabase(app.supabase);
  const subscriptions = new SubscriptionsRepository(app.supabase);
  const preHandler = [requireAuth(app), requireFeature(subscriptions, 'advancedStatistics')];

  app.get('/', { config: { authRequired: true }, preHandler, schema: { querystring: insightsQuerySchema, response: { 200: insightsResponseSchema, ...errorResponses } } },
    async (request) => service.getInsights(request.auth, request.query));
  app.get('/search', { config: { authRequired: true }, preHandler, schema: { querystring: insightsSearchQuerySchema, response: { 200: insightsSearchResponseSchema, ...errorResponses } } },
    async (request) => service.search(request.auth, request.query));
};
```

Add `import { insightsRoutes } from '../modules/insights/insights.routes.js';` and `await app.register(insightsRoutes, { prefix: '/insights' });` to `v1.routes.ts`. Include `401`, `403`, `422`, and `500` error response schemas. Do not expose `404` for role or entitlement states, and do not return raw source rows.

- [ ] **Step 4: Run routes and API contract checks**

Run: `npm test -- tests/insights.routes.test.ts tests/insights.service.test.ts tests/insights.repository.test.ts tests/feature-access.test.ts`

Run: `npm run typecheck`

Expected: PASS. Confirm unauthenticated, viewer, Free adult, invalid period, short query, negative offset, successful owner/adult metric load, and successful search all have the intended status/DTO.

- [ ] **Step 5: Commit the public API**

```bash
git add src/modules/insights/insights.routes.ts src/routes/v1.routes.ts tests/insights.routes.test.ts
git commit -m "feat: add premium household insights API"
```

## Task 5: Add typed client API and reactive Insights state

**Files:**
- Create: `D:\Projects\myself\weekly-us\src\features\insights\types.ts`
- Create: `D:\Projects\myself\weekly-us\src\shared\api\insightsApi.ts`
- Create: `D:\Projects\myself\weekly-us\src\features\insights\services\insightsService.ts`
- Create: `D:\Projects\myself\weekly-us\src\app\stores\householdInsights.ts`
- Create: `D:\Projects\myself\weekly-us\src\features\insights\__tests__\insightsService.test.ts`
- Create: `D:\Projects\myself\weekly-us\src\app\stores\__tests__\householdInsights.test.ts`

**Interfaces:**
- Consumes: public DTOs from Task 4, `apiRequest`, Pinia, and `translate()`.
- Produces:

```ts
export type InsightsPeriod = '4w' | '12w' | 'all';
export async function getHouseholdInsights(period: InsightsPeriod): Promise<HouseholdInsightsResponse>;
export async function searchHouseholdInsights(query: InsightsSearchRequest): Promise<HouseholdInsightsSearchResponse>;
export interface HouseholdInsightsState {
  selectedPeriod: InsightsPeriod;
  insights: HouseholdInsightsResponse | null;
  isLoading: boolean;
  errorMessage: string;
  searchQuery: string;
  searchResults: HouseholdInsightsSearchResponse | null;
  isSearching: boolean;
  searchErrorMessage: string;
}
export const useHouseholdInsightsStore = defineStore('householdInsights', {
  state: (): HouseholdInsightsState => ({
    selectedPeriod: '4w', insights: null, isLoading: false, errorMessage: '',
    searchQuery: '', searchResults: null, isSearching: false, searchErrorMessage: '',
  }),
});
```

- [ ] **Step 1: Write failing client service and store tests**

```ts
it('requests authenticated household insights for the selected period', async () => {
  await getHouseholdInsights('12w');
  expect(apiRequest).toHaveBeenCalledWith('/insights?period=12w', { requiresAuth: true });
});

it('keeps grouped search pagination and an API error separate from loaded cards', async () => {
  service.searchHouseholdInsights.mockRejectedValueOnce(new Error('Network unavailable'));
  await store.search('plans');
  expect(store.searchErrorMessage).toBe('Network unavailable');
  expect(store.insights).toBeNull();
});
```

- [ ] **Step 2: Run the focused client tests to verify they fail**

Run: `npm test -- src/features/insights/__tests__/insightsService.test.ts src/app/stores/__tests__/householdInsights.test.ts`

Expected: FAIL because the Insights client modules do not exist.

- [ ] **Step 3: Implement API/types/service/store without local aggregation**

```ts
// src/shared/api/insightsApi.ts
export function getHouseholdInsights(period: InsightsPeriod) {
  return apiRequest<HouseholdInsightsResponse>(`/insights?period=${encodeURIComponent(period)}`, { requiresAuth: true });
}
export function searchHouseholdInsights({ q, limit, offset }: InsightsSearchRequest) {
  const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
  return apiRequest<HouseholdInsightsSearchResponse>(`/insights/search?${params.toString()}`, { requiresAuth: true });
}
```

The Pinia store must retain `selectedPeriod`, `insights`, `isLoading`, `errorMessage`, `searchQuery`, `searchResults`, `isSearching`, and `searchErrorMessage`. `load(period)` clears only the insight request error, calls the server, and records the selected period after success. `search(query, offset = 0)` trims input locally, refuses fewer than two characters without a network request, and replaces/appends per-group pages deterministically. API errors become translated safe messages; they never trigger a scan of meetings/tasks already stored on the device.

- [ ] **Step 4: Run client service/store tests to verify they pass**

Run: `npm test -- src/features/insights/__tests__/insightsService.test.ts src/app/stores/__tests__/householdInsights.test.ts`

Expected: PASS. Verify authenticated paths, encoded search, no request for a one-character query, selected-period reload, loading reset, safe error state, and independent group pagination.

- [ ] **Step 5: Commit typed client data flow**

```bash
git add src/features/insights/types.ts src/shared/api/insightsApi.ts src/features/insights/services/insightsService.ts src/app/stores/householdInsights.ts src/features/insights/__tests__/insightsService.test.ts src/app/stores/__tests__/householdInsights.test.ts
git commit -m "feat: add household insights client data flow"
```

## Task 6: Build the guarded Insights page, card presentation, navigation, and translations

**Files:**
- Create: `D:\Projects\myself\weekly-us\src\features\insights\presentation.ts`
- Create: `D:\Projects\myself\weekly-us\src\features\insights\__tests__\presentation.test.ts`
- Create: `D:\Projects\myself\weekly-us\src\pages\InsightsPage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\app\router\index.ts`
- Modify: `D:\Projects\myself\weekly-us\src\pages\HomePage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\features\localization\messages.ts`

**Interfaces:**
- Consumes: `useHouseholdInsightsStore()` from Task 5, `advancedStatistics` route meta, safe insight/search DTOs, `useI18n()`, and existing `meeting-summary`/`tasks` routes.
- Produces: `/insights` route with `meta: { requiresFeature: 'advancedStatistics' }`, card-ready presentation objects, and source links.

- [ ] **Step 1: Write failing presentation tests for tags and record routes**

```ts
it('uses factual tags and sends agreement results to their source meeting', () => {
  expect(toInsightTags({ done: 3, open: 1, skipped: 2, overdue: 1 })).toEqual(['3 done', '1 open', '1 overdue']);
  expect(getInsightResultRoute({ id: 'agreement-1', type: 'agreement', sourceMeetingId: 'meeting-1' }))
    .toEqual({ name: 'meeting-summary', params: { meetingId: 'meeting-1' } });
});

it('routes task results to the existing task destination and completed meetings to their summary', () => {
  expect(getInsightResultRoute({ id: 'task-1', type: 'task', sourceMeetingId: null })).toEqual({ name: 'tasks' });
  expect(getInsightResultRoute({ id: 'meeting-1', type: 'meeting', sourceMeetingId: null })).toEqual({ name: 'meeting-summary', params: { meetingId: 'meeting-1' } });
});
```

- [ ] **Step 2: Run the presentation test to verify it fails**

Run: `npm test -- src/features/insights/__tests__/presentation.test.ts`

Expected: FAIL because the presentation module is not implemented.

- [ ] **Step 3: Implement presentation helpers, page, access route, and copy**

```ts
// src/features/insights/presentation.ts
export function getInsightResultRoute(item: InsightSearchItem) {
  if (item.type === 'task') return { name: 'tasks' as const };
  const meetingId = item.type === 'meeting' ? item.id : item.sourceMeetingId;
  return meetingId ? { name: 'meeting-summary' as const, params: { meetingId } } : { name: 'history' as const };
}
```

```ts
// src/app/router/index.ts
import InsightsPage from '@/pages/InsightsPage.vue';
// add beside history routes
{ path: '/insights', name: 'insights', component: InsightsPage, meta: { requiresFeature: 'advancedStatistics' } },
```

`InsightsPage.vue` must load `4w` on mount, offer `4w`/`12w`/`all` controls, and render four compact sections: Meeting consistency, Task follow-through, Agreement follow-through, and Recurring topics. Display source-linked topics as buttons/links to their completed meetings. Include a debounced or explicit-submit search input with separate grouped meeting/task/agreement result lists and per-group “load more” controls. The page must visibly distinguish loading, safe retryable API errors, no matching results, metric insufficient history, role restriction, and Premium lock.

Add the Home entry only when `subscriptionStore.getFeatureAccess('advancedStatistics').state === 'available'`; use the translation key `home.householdInsights` and route `{ name: 'insights' }`. Add the same exact key hierarchy in all three locales:

```ts
insights: {
  title: 'Household insights',
  searchLabel: 'Search shared history', searchPlaceholder: 'Search meetings, tasks, and agreements',
  periods: { fourWeeks: 'Last 4 weeks', twelveWeeks: 'Last 12 weeks', all: 'All history' },
  meetingConsistency: 'Meeting consistency', taskFollowThrough: 'Task follow-through',
  agreementFollowThrough: 'Agreement follow-through', recurringTopics: 'Recurring topics',
  notTrackedYet: 'Not tracked yet', insufficientData: 'Add more shared history to see this insight.',
  noResults: 'No shared records matched that search.', loadMore: 'Load more', retry: 'Try again',
}
```

Translate every string in this object into Ukrainian and Spanish in the matching locale blocks; do not leave English fallbacks. Use the existing compact card CSS tokens/classes and add page-local scoped styles only for the Insights layout.

Use these approved localized values for the visible core copy:

```ts
// uk
insights: {
  title: 'Статистика домогосподарства',
  searchLabel: 'Пошук у спільній історії', searchPlaceholder: 'Шукайте зустрічі, завдання та домовленості',
  periods: { fourWeeks: 'Останні 4 тижні', twelveWeeks: 'Останні 12 тижнів', all: 'Уся історія' },
  meetingConsistency: 'Регулярність зустрічей', taskFollowThrough: 'Виконання завдань',
  agreementFollowThrough: 'Виконання домовленостей', recurringTopics: 'Повторювані теми',
  notTrackedYet: 'Ще не відстежується', insufficientData: 'Додайте більше спільної історії, щоб побачити цю статистику.',
  noResults: 'У спільній історії немає записів за цим запитом.', loadMore: 'Завантажити ще', retry: 'Спробувати знову',
}

// es
insights: {
  title: 'Información del hogar',
  searchLabel: 'Buscar en el historial compartido', searchPlaceholder: 'Busca reuniones, tareas y acuerdos',
  periods: { fourWeeks: 'Últimas 4 semanas', twelveWeeks: 'Últimas 12 semanas', all: 'Todo el historial' },
  meetingConsistency: 'Regularidad de las reuniones', taskFollowThrough: 'Seguimiento de tareas',
  agreementFollowThrough: 'Seguimiento de acuerdos', recurringTopics: 'Temas recurrentes',
  notTrackedYet: 'Aún sin seguimiento', insufficientData: 'Añade más historial compartido para ver esta información.',
  noResults: 'Ningún registro compartido coincide con la búsqueda.', loadMore: 'Cargar más', retry: 'Intentar de nuevo',
}
```

- [ ] **Step 4: Run focused client tests and build**

Run: `npm test -- src/features/insights/__tests__/presentation.test.ts src/features/insights/__tests__/insightsService.test.ts src/app/stores/__tests__/householdInsights.test.ts`

Run: `npm run build`

Expected: PASS. Type checking confirms translated keys, route types, card source routes, and no accidental client-side data aggregation.

- [ ] **Step 5: Commit the user-facing Insights experience**

```bash
git add src/features/insights/presentation.ts src/features/insights/__tests__/presentation.test.ts src/pages/InsightsPage.vue src/app/router/index.ts src/pages/HomePage.vue src/features/localization/messages.ts
git commit -m "feat: add premium household insights page"
```

## Task 7: Run end-to-end verification and review deploy safety

**Files:**
- Modify: `docs/superpowers/specs/2026-08-25-premium-household-insights-design.md` only if implementation reveals a necessary, approved contract correction.

**Interfaces:**
- Consumes: all API/client tasks above.
- Produces: verified builds and a deploy-ready checklist without broadening the approved scope.

- [ ] **Step 1: Run the complete API quality suite**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Expected: PASS. If an unrelated pre-existing failure occurs, record its exact test/file and do not weaken or skip the new insight coverage.

- [ ] **Step 2: Run the complete client quality suite**

Run: `npm test`

Run: `npm run build`

Expected: PASS. Run `npm run lint` only after confirming generated mobile assets are excluded or document pre-existing generated-file failures separately.

- [ ] **Step 3: Validate the migration in a local/staging-safe order**

Run: `npm run db:migrate:local:dry-run`

Expected: the forward-only migration contains only the three new indexes and no table rewrite, RLS change, or data update. Apply/test it locally or in staging before production according to the repository migration rules.

- [ ] **Step 4: Manually exercise the privacy and product matrix**

```text
Premium owner: opens Insights, searches approved fields, changes all periods, follows source links.
Premium adult: receives the same shared household payload and no personal performance score.
Viewer: is route- and API-blocked before any insight data is returned.
Free/expired Premium adult: sees the owner-aware upgrade state and receives API 403.
Two-workspace adult: cannot see another workspace's meetings, tasks, agreements, or follow-up state.
Sparse/old history: sees accurate insufficient/not-tracked states, never fabricated completion.
```

- [ ] **Step 5: Record the verification outcome without creating a verification-only commit**

Run: `git status --short`

Expected: only the reviewed Insights files remain changed. If verification reveals a real defect, return to its originating task, add a focused regression test there, and use that task's explicit commit group after user approval. Do not stage unrelated working-tree files.

## Plan Self-Review

### Spec coverage

- Adult-only Premium access and server enforcement: Tasks 1 and 4.
- Workspace scoping, soft-deletion, safe DTOs, and private-data exclusion: Tasks 2–4.
- Completed-meeting search, tasks/agreements search, two-character validation, and per-group pagination: Tasks 2, 3, 4, and 5.
- Rolling four/twelve-week/all periods and half-open boundaries: Task 3.
- Meeting cadence, current task status/rate/overdue definition, follow-up state coverage, and recurring section-title normalization: Task 3.
- Narrow partial indexes and migration safety: Task 1 and Task 7.
- Card-based Vue experience, existing source destinations, translation, locks, and unavailable states: Tasks 5 and 6.
- API/client tests, full checks, migration validation, and manual privacy matrix: Tasks 2–7.

No approved requirement is unassigned.

### Placeholder scan

No prohibited placeholders were found. Every task names exact files, named
interfaces, a focused failing test, an execution command, and an expected
outcome.

### Type consistency

`InsightsPeriodDto` is the API domain period consumed by `InsightsQueryDto`; the client mirrors it as `InsightsPeriod`. `InsightsRepository` produces source records for `InsightsService`, which produces `InsightsResponseDto`/`InsightsSearchResponseDto` for the route and the client. `getHouseholdInsights`, `searchHouseholdInsights`, and `useHouseholdInsightsStore` use those same response names; `getInsightResultRoute` accepts the public `InsightSearchItem` only.
