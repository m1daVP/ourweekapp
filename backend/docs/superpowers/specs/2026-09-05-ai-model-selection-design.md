# AI Model Selection and Audit Design

**Status:** Implemented; local database and funded staging verification pending

## Goal

Make AI recap model selection predictable and auditable without changing the
mobile API contract or exposing provider configuration to clients.

## Scope

This design covers AI-10 only:

- explicit selection precedence for recap models;
- versioning of the prompt configuration used for each request;
- durable internal audit fields for the effective model and prompt version;
- operator documentation and regression coverage;
- a funded-staging evaluation procedure for the 800-token output budget.

It does not change prompt wording, model assignments, recap allowance,
authorization, provider retry behavior, or the public recap DTO.

## Model Selection

`summary-prompts.ts` owns known-template configuration. Each of the six
supported template IDs has a record containing its current model and an
explicit prompt version:

| Template | Model |
| --- | --- |
| `weekly-family-check-in` | `gpt-5.4-nano` |
| `family-with-kids` | `gpt-5.4-nano` |
| `money-check-in` | `gpt-5.4-nano` |
| `busy-week-planning` | `gpt-5.4-nano` |
| `couple-reset` | `gpt-5-mini` |
| `conflict-cleanup` | `gpt-5-mini` |

The effective-model precedence is fixed:

1. Known template configuration.
2. `AI_MODEL`, only for an unknown template.
3. `DEFAULT_SUMMARY_MODEL`, only when the template is unknown and `AI_MODEL`
   is unset.

An unknown template receives the unknown-template prompt and a separately
named prompt version. The resolver returns model and prompt version together,
so the service cannot accidentally persist a version for a different
configuration. Prompt version is also part of the request input hash. A
model, prompt-text, or prompt-version change therefore cannot use a cached
summary generated under the earlier configuration.

## Request Audit Data and Migration

Add nullable `effective_model text` and `prompt_version text` columns to
`public.ai_summary_requests`. Each column accepts either `NULL` for records
created before this change or a nonblank value. Existing history is not
rewritten.

Introduce a new, versioned claim RPC that takes the effective model and prompt
version and writes them when it creates the pending request. Keep the existing
claim RPC intact so an older API instance remains functional while the
migration is rolled out. The updated repository uses the versioned RPC and
includes the two fields in its internal request record. Public request DTOs
continue to omit them.

The provider call happens only after the claim succeeds, so each new request
has an audit record even if the provider rejects, times out, or returns
incomplete output. The existing finalization transaction remains responsible
for output and token accounting; it does not need the model/version arguments
because the claim already persisted them.

## Snapshot Policy and Output-Budget Evaluation

Use the current model aliases for now. Snapshot pinning is deferred until a
funded staging evaluation verifies quality, latency, incomplete-response rate,
and token usage for the exact recap prompts. This is an explicit pilot
limitation, not an assertion that aliases are permanently suitable. The
evaluation record must state the final decision to retain aliases or replace
them with the evaluated snapshots.

The provider uses `max_output_tokens: 800`. For the Responses API this limit
includes visible output and reasoning tokens. The staged evaluation therefore
uses synthetic data for every supported template and records the effective
model, prompt version, response status, incomplete reason, input tokens,
output tokens, total tokens, and latency. A result that is incomplete because
of the cap is a failed evaluation case; increasing the cap or changing the
model/prompt requires another recorded evaluation before deployment.

## Operator Documentation

`.env.example` and `docs/deployment.md` will state that `AI_MODEL` is not a
global override. Operators can predict the known-template assignments from
the documented table; they may set `AI_MODEL` only to choose the fallback for
an unknown template. The deployment procedure will require verifying the
effective model and prompt version in safe server-side logs or request audit
data after staging generation, without logging prompts, meeting content, or
credentials.

## Tests and Acceptance

Automated coverage will verify:

- all six known-template model resolutions and the unknown-template fallback;
- prompt-version selection is paired with the corresponding model;
- a configuration version changes the claim input hash;
- the repository calls the versioned claim RPC with the effective model and
  prompt version;
- public request DTOs do not expose internal audit fields;
- new migration/RPC result mapping tolerates older rows with `NULL` audit
  fields.

The implementation is accepted when logs and audit rows identify the model
and prompt version used for every new recap, and operator configuration follows
the documented precedence. Funded staging evaluation remains required before
snapshot pinning or production release sign-off.

## Risks and Rollout

The migration is additive, has no backfill, and keeps the existing RPC for
older API instances. Apply it before deploying the updated API. If the new
API must be rolled back, the old API can continue to use the original RPC and
ignore the new nullable columns. A later, separately reviewed migration may
retire the old RPC only after every deployed API version has moved off it.

## Implementation Result

Implemented on 2026-09-05:

- Known-template model resolution now returns a model/prompt-version pair;
  template-specific configuration remains higher priority than `AI_MODEL`.
- New requests persist `effective_model` and `prompt_version` through the
  additive `claim_ai_summary_generation_v2` RPC. The original claim RPC is
  unchanged for rolling-deployment compatibility.
- Prompt version is part of the request cache identity, internal request audit
  mapping, and safe generation logs. It is not exposed by public DTOs.
- Operator documentation now explains the exact precedence, aliases, and
  synthetic staging evaluation required before snapshot pinning.

Verification passed: focused AI regression coverage (94 tests), typecheck,
build, and OpenAPI validation. The full backend suite had unrelated hook/test
timeouts in existing app, OpenAPI, auth, password-reset, and API-contract
suites. Local database integration coverage remains skipped without local
Supabase credentials; the local migration dry run could not connect to
PostgreSQL at `127.0.0.1:54322`.
