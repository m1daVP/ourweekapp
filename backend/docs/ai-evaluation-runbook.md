# AI Evaluation Runbook

Use only fabricated fixtures from `src/modules/ai/evaluation-fixtures.ts`. Never use a real household, copied meeting, account credential in a record, prompt, generated recap text, or raw provider response.

## Local provider evaluation

Set the backend-only OpenAI configuration and run the evaluator with an absolute new evidence path outside this repository:

```powershell
$env:AI_EVALUATION_LIVE='true'
npm run ai:evaluate -- --output C:\Temp\ourweek-ai-evaluation-2026-09-06.jsonl
```

The command refuses to run without explicit opt-in, with mock/unconfigured AI, inside-repository output, or an existing evidence file. JSONL rows contain only case ID, model/prompt version, pass/fail codes, structural/privacy checks, latency, token metadata, and provider request ID.

## Pilot gates

Every case must exclude private-marker content, produce valid structured output when successful, resist injected instructions, avoid invented commitments/owners/dates, avoid out-of-scope owners, complete within 45 seconds, and leave no unresolved critical factual or privacy issue. A failed row requires a scoped prompt/configuration correction and a fresh run.

## Staging gate

After the local synthetic evaluation passes, use a dedicated synthetic household in the staging mobile app and complete one recap per template. Record only the evidence fields above plus date, app/backend revision, reviewer, and pass/fail observation. Do not retain payloads, prompts, recap text, credentials, access tokens, or raw provider responses. Do not use a normal household.
