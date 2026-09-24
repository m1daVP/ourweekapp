# AI Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recap model selection deterministic and persist the effective model and prompt version for every newly claimed AI summary request.

**Architecture:** A code-owned configuration resolves a `{ model, promptVersion }` pair for every template. Known templates always win; `AI_MODEL` is only the unknown-template fallback. A new additive migration introduces audit columns and a versioned claim RPC, so current API instances keep working during rollout while the new repository persists the resolved pair before the provider call.

**Tech Stack:** Node.js 24, TypeScript 7, Fastify, Vitest, Supabase/PostgreSQL migrations, OpenAI Responses API.

## Global Constraints

- Known template configuration has priority over `AI_MODEL`; `AI_MODEL` is fallback-only for unknown templates.
- Keep the current mappings: four templates use `gpt-5.4-nano`; `couple-reset` and `conflict-cleanup` use `gpt-5-mini`.
- Keep `SUMMARY_MAX_OUTPUT_TOKENS` at `800`; the Responses API cap includes visible output and reasoning tokens.
- Persist audit data internally only; public request and recap response DTOs must not expose model or prompt-version data.
- Use an additive migration. Do not edit an existing migration or remove the existing claim RPC.
- Preserve workspace scoping, service-role-only RPC access, safe logs, and the existing provider-call-outside-transaction flow.
- Do not stage or commit changes unless the user separately supplies an approved numbered commit list.

---

## File Structure

- Modify `src/modules/ai/summary-prompts.ts`: represent each template's model and prompt version together and expose a single resolver.
- Create `tests/summary-prompts.test.ts`: test all six known template configurations and unknown-template fallback behavior.
- Create `supabase/migrations/20260905120000_add_ai_summary_request_model_audit.sql`: add nullable audit columns and `claim_ai_summary_generation_v2`.
- Create `tests/ai-summary-request-model-audit.migration.test.ts`: statically verify additive schema, v2 RPC isolation, validation, and grants.
- Modify `tests/ai-summary-generation-claim.integration.test.ts`: exercise the v2 claim RPC with a local service-role Supabase instance when configured.
- Modify `src/modules/ai/ai.repository.ts`: use the v2 claim RPC and map internal audit fields without exposing them in public DTOs.
- Modify `tests/ai.repository.test.ts`: assert v2 RPC parameters and internal/public mapping boundaries.
- Modify `src/modules/ai/ai.service.ts`: resolve the configuration once, include prompt version in the generation hash and safe logs, and pass both audit values to the claim.
- Modify `tests/ai.service.test.ts`: assert the service passes and logs the resolved pair, and that a prompt-version change changes the hash.
- Modify `.env.example` and `docs/deployment.md`: document precedence, model map, staged 800-token evaluation, and snapshot decision process.

## Task 1: Make model and prompt-version resolution explicit

**Files:**
- Create: `tests/summary-prompts.test.ts`
- Modify: `src/modules/ai/summary-prompts.ts`

**Interfaces:**
- Produces: `SummaryPromptConfiguration`, `{ model: string; promptVersion: string }`.
- Produces: `resolveSummaryPromptConfiguration(templateId: string, fallbackModel?: string): SummaryPromptConfiguration`.
- Compatibility: retain `resolveSummaryModel(templateId, fallbackModel?)`, implemented as `resolveSummaryPromptConfiguration(...).model`.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SUMMARY_MODEL,
  resolveSummaryPromptConfiguration,
} from '../src/modules/ai/summary-prompts.js';

describe('summary prompt configuration', () => {
  it.each([
    ['weekly-family-check-in', 'gpt-5.4-nano', 'weekly-family-check-in-v1'],
    ['family-with-kids', 'gpt-5.4-nano', 'family-with-kids-v1'],
    ['money-check-in', 'gpt-5.4-nano', 'money-check-in-v1'],
    ['busy-week-planning', 'gpt-5.4-nano', 'busy-week-planning-v1'],
    ['couple-reset', 'gpt-5-mini', 'couple-reset-v1'],
    ['conflict-cleanup', 'gpt-5-mini', 'conflict-cleanup-v1'],
  ])('uses the configured pair for %s', (templateId, model, promptVersion) => {
    expect(resolveSummaryPromptConfiguration(templateId, 'operator-fallback')).toEqual({
      model,
      promptVersion,
    });
  });

  it('uses AI_MODEL only for unknown templates', () => {
    expect(resolveSummaryPromptConfiguration('custom-template', 'operator-fallback')).toEqual({
      model: 'operator-fallback',
      promptVersion: 'unknown-template-v1',
    });
  });

  it('uses the default only when an unknown template has no fallback', () => {
    expect(resolveSummaryPromptConfiguration('custom-template')).toEqual({
      model: DEFAULT_SUMMARY_MODEL,
      promptVersion: 'unknown-template-v1',
    });
  });
});
```

- [ ] **Step 2: Run the resolver test to verify it fails**

Run: `npm test -- tests/summary-prompts.test.ts`

Expected: FAIL because `resolveSummaryPromptConfiguration` is not exported.

- [ ] **Step 3: Implement the configuration resolver**

In `src/modules/ai/summary-prompts.ts`, replace the model-only template map with an `as const` configuration map. Keep the existing prompt text map keyed by the same known IDs. Add these exported declarations:

```ts
export type SummaryPromptConfiguration = {
  model: string;
  promptVersion: string;
};

export const DEFAULT_SUMMARY_MODEL = 'gpt-5.4-nano';
export const UNKNOWN_TEMPLATE_PROMPT_VERSION = 'unknown-template-v1';

export function resolveSummaryPromptConfiguration(
  templateId: string,
  fallbackModel?: string,
): SummaryPromptConfiguration {
  return summaryPromptConfigurationByTemplate[templateId] ?? {
    model: fallbackModel ?? DEFAULT_SUMMARY_MODEL,
    promptVersion: UNKNOWN_TEMPLATE_PROMPT_VERSION,
  };
}

export function resolveSummaryModel(templateId: string, fallbackModel?: string) {
  return resolveSummaryPromptConfiguration(templateId, fallbackModel).model;
}
```

Define the six initial versions exactly as tested. Increment the template's version whenever its base or template-specific system-prompt text changes.

- [ ] **Step 4: Run resolver tests and existing AI service tests**

Run: `npm test -- tests/summary-prompts.test.ts tests/ai.service.test.ts`

Expected: PASS. Existing service behavior continues to select the same two model IDs.

## Task 2: Add backward-compatible request audit storage and v2 claim RPC

**Files:**
- Create: `supabase/migrations/20260905120000_add_ai_summary_request_model_audit.sql`
- Create: `tests/ai-summary-request-model-audit.migration.test.ts`
- Modify: `tests/ai-summary-generation-claim.integration.test.ts`

**Interfaces:**
- Produces: nullable `ai_summary_requests.effective_model` and `.prompt_version` text columns.
- Produces: `public.claim_ai_summary_generation_v2(uuid, uuid, uuid, text, text, text, text)`.
- Consumes: the original `claim_ai_summary_generation` remains available for an older deployed API.
- Produces: v2 result columns: all original claim result columns plus `effective_model text` and `prompt_version text`.

- [ ] **Step 1: Write static migration tests before the migration**

```ts
expect(sql).toContain('add column if not exists effective_model text');
expect(sql).toContain('add column if not exists prompt_version text');
expect(sql).toContain('public.claim_ai_summary_generation_v2');
expect(sql).toContain('p_effective_model text');
expect(sql).toContain('p_prompt_version text');
expect(sql).toContain("set search_path = ''");
expect(sql).toContain('from public, anon, authenticated');
expect(sql).toContain('to service_role');
expect(sql).not.toContain('drop function public.claim_ai_summary_generation(');
```

- [ ] **Step 2: Run the static migration test to verify it fails**

Run: `npm test -- tests/ai-summary-request-model-audit.migration.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the additive migration**

Create the migration with these elements:

```sql
alter table public.ai_summary_requests
  add column if not exists effective_model text,
  add column if not exists prompt_version text,
  add constraint ai_summary_requests_effective_model_not_blank
    check (effective_model is null or btrim(effective_model) <> ''),
  add constraint ai_summary_requests_prompt_version_not_blank
    check (prompt_version is null or btrim(prompt_version) <> '');
```

Create `claim_ai_summary_generation_v2` by copying the original claim operation's advisory-lock, completed-cache, pending-duplicate, and insert flow. Require nonblank `p_effective_model` and `p_prompt_version`; include both values in its result table; include both values in every returned `select`; and insert both values only for the newly created pending request. Revoke all access from `public`, `anon`, and `authenticated`, then grant execute only to `service_role`. Do not replace or drop the original five-argument function.

- [ ] **Step 4: Extend the local integration fixture and test**

Add `p_effective_model: 'gpt-5.4-nano'` and `p_prompt_version: 'weekly-family-check-in-v1'` to the fixture. Add a test that calls `claim_ai_summary_generation_v2` twice concurrently and expects one `created` and one `pending` result, with both audit fields present on both returned rows. Complete the owner request with synthetic JSON, call the v2 function once more, and assert the cached row retains the same audit fields.

- [ ] **Step 5: Run migration and integration checks**

Run: `npm test -- tests/ai-summary-request-model-audit.migration.test.ts tests/ai-summary-generation-claim.migration.test.ts tests/ai-summary-generation-claim.integration.test.ts`

Expected: static tests PASS; integration test PASS when `SUPABASE_LOCAL_URL` and `SUPABASE_LOCAL_SERVICE_ROLE_KEY` target localhost, otherwise it remains intentionally skipped.

## Task 3: Persist and use the resolved configuration in repository and service code

**Files:**
- Modify: `src/modules/ai/ai.repository.ts`
- Modify: `src/modules/ai/ai.service.ts`
- Modify: `tests/ai.repository.test.ts`
- Modify: `tests/ai.service.test.ts`

**Interfaces:**
- Consumes: `resolveSummaryPromptConfiguration(templateId, fallbackModel)` from Task 1.
- Consumes: `claim_ai_summary_generation_v2` from Task 2.
- Modifies: `ClaimAiSummaryGenerationInput` to require `effectiveModel: string` and `promptVersion: string`.
- Produces: `AiSummaryRequestRecord.effectiveModel: string | null` and `.promptVersion: string | null` for internal code only.
- Produces: `buildSummaryGenerationInputHash(systemPrompt: string, promptPayload: string, model: string, promptVersion: string): string` exported from `ai.service.ts` for direct unit testing.

- [ ] **Step 1: Write failing repository tests**

Update `requestRow` to include `effective_model` and `prompt_version`. Update the claim input and expected RPC call:

```ts
await repository.claimSummaryGeneration({
  workspaceId,
  meetingId,
  userId,
  provider: 'openai',
  inputHash: 'hash_1',
  effectiveModel: 'gpt-5.4-nano',
  promptVersion: 'weekly-family-check-in-v1',
});

expect(rpc).toHaveBeenCalledWith('claim_ai_summary_generation_v2', {
  p_workspace_id: workspaceId,
  p_meeting_id: meetingId,
  p_user_id: userId,
  p_provider: 'openai',
  p_input_hash: 'hash_1',
  p_effective_model: 'gpt-5.4-nano',
  p_prompt_version: 'weekly-family-check-in-v1',
});
```

Add assertions that `AiSummaryRequestRecord` maps the two values, while `mapAiSummaryRequestRowToDto(...)` contains neither `effectiveModel` nor `promptVersion`. Add a mapping case for an old row with both database values `null`.

- [ ] **Step 2: Write failing service tests**

Add a generation assertion:

```ts
expect(ai.claimSummaryGeneration).toHaveBeenCalledWith(expect.objectContaining({
  effectiveModel: 'gpt-5.4-nano',
  promptVersion: 'weekly-family-check-in-v1',
}));
```

Add a safe-log assertion for `ai_summary_generation_started` that includes the same `promptVersion`. Add a hash test:

```ts
expect(buildSummaryGenerationInputHash('system', 'payload', 'model', 'v1'))
  .not.toBe(buildSummaryGenerationInputHash('system', 'payload', 'model', 'v2'));
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `npm test -- tests/ai.repository.test.ts tests/ai.service.test.ts`

Expected: FAIL because the input types, RPC name, mapping fields, logs, and hash helper have not been updated.

- [ ] **Step 4: Update repository mapping and RPC invocation**

Add `effective_model` and `prompt_version` to `AiSummaryRequestRow`. Map them only in `mapAiSummaryRequestRowToRecord`. Keep `PUBLIC_AI_SUMMARY_REQUEST_COLUMNS` and `AiSummaryRequestDto` unchanged. Change `claimSummaryGeneration` to call `claim_ai_summary_generation_v2` with the two new parameters and map the v2 result.

- [ ] **Step 5: Update service configuration, hash, and safe logs**

Replace the model-only resolver call with:

```ts
const promptConfiguration = resolveSummaryPromptConfiguration(
  meeting.templateId,
  this.options.model,
);
const { model, promptVersion } = promptConfiguration;
```

Use `buildSummaryGenerationInputHash(systemPrompt, promptPayload, model, promptVersion)` for the claim identity. Its implementation must hash the four values in that order using the existing SHA-256 helper. Pass `effectiveModel: model` and `promptVersion` to `claimSummaryGeneration`. Include `promptVersion` beside the already safe model value in every generation log event that already includes `model`: completion rejection, input-too-large rejection, duplicate, cache hit, started, completed, and provider failure. Do not add prompt text, meeting data, or raw provider fields to logs.

- [ ] **Step 6: Run focused service and repository coverage**

Run: `npm test -- tests/summary-prompts.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts`

Expected: PASS with the public DTO boundary and version-sensitive cache identity covered.

## Task 4: Document operator behavior and staging evaluation

**Files:**
- Modify: `.env.example`
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: Task 1's exact model map, fallback precedence, and prompt-version names.
- Consumes: Task 3's safe log/audit fields.
- Produces: a deployment procedure that records the outcome of staged 800-token evaluations before any snapshot pinning.

- [ ] **Step 1: Update the environment example**

Replace the bare `AI_MODEL=` description with text stating that it is optional and used only when a meeting has an unknown template ID. List the six code-owned template assignments and state that it cannot override them. Keep `AI_API_KEY` and all secrets empty.

- [ ] **Step 2: Add the deployment preflight procedure**

Add an `AI recap model configuration` section to `docs/deployment.md` that contains:

1. the same precedence and six-model table;
2. a staging check that verifies only the effective model, prompt version, safe provider request ID, status, duration, and token counts from logs/audit data;
3. a prohibition on logging or using real meeting data, prompts, or credentials in the smoke test;
4. a synthetic evaluation for each template using `max_output_tokens: 800`, recording model, prompt version, latency, usage, response status, and incomplete reason;
5. the rule that any incomplete response caused by `max_output_tokens` fails evaluation;
6. the decision record: aliases remain active until this evaluation is funded and approved; after evaluation, record the exact alias-or-snapshot decision and deployed revision before release.

- [ ] **Step 3: Review documentation against the source configuration**

Run: `rg -n "AI_MODEL|gpt-5\.4-nano|gpt-5-mini|prompt version|800" .env.example docs/deployment.md src/modules/ai/summary-prompts.ts`

Expected: the two operator-facing files agree with the source map and do not contain an instruction that `AI_MODEL` overrides known templates.

## Task 5: Verify the complete change and prepare review

**Files:**
- Verify: all files from Tasks 1-4

**Interfaces:**
- Produces: migration-safe implementation evidence for AI-10's automated scope.
- Leaves open: funded staging evaluation and the alias-versus-snapshot decision, which cannot be faked without provider access.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- tests/summary-prompts.test.ts tests/ai.repository.test.ts tests/ai.service.test.ts tests/ai-summary-request-model-audit.migration.test.ts tests/ai-summary-generation-claim.migration.test.ts tests/ai-summary-generation-claim.integration.test.ts
```

Expected: all runnable tests PASS; the local-Supabase test is skipped only when its two localhost credentials are absent.

- [ ] **Step 2: Run backend verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
npm run openapi:check
```

Expected: PASS. No OpenAPI change is expected because the public DTO remains unchanged.

- [ ] **Step 3: Review migration and working-tree scope**

Run:

```powershell
git -c safe.directory='D:/Projects/myself/weekly-us-api' diff --check
git -c safe.directory='D:/Projects/myself/weekly-us-api' diff -- supabase/migrations/20260905120000_add_ai_summary_request_model_audit.sql src/modules/ai tests .env.example docs/deployment.md
git -c safe.directory='D:/Projects/myself/weekly-us-api' status --short
```

Expected: only intended AI-10 files are reviewed. Preserve unrelated user changes, including pre-existing readiness/checklist and prompt artifacts.

- [ ] **Step 4: Obtain release evidence outside local development**

Apply the additive migration to isolated local Supabase, then staging, before deploying the API version that calls v2. Execute the documented synthetic evaluation in funded staging for all six templates. Record the alias-or-snapshot decision, results, and effective configuration in the release checklist; do not mark snapshot pinning or production readiness complete when the evaluation was skipped.

- [ ] **Step 5: Request explicit commit authorization if a commit is desired**

Do not stage or commit. Provide the reviewed file list and verification results, then wait for the user to supply an approved numbered commit list as required by this repository.
