# AI Agent Behavior Rules

## General Behavior

- Follow the most specific applicable project rule when rule files overlap.
- Follow explicit user instructions unless they conflict with safety, security, or data-loss rules.
- Read relevant files before editing.
- Do not guess project structure. Inspect it first.
- Prefer small, targeted changes.
- Do not rewrite unrelated code.
- Do not change formatting across large files unless requested.
- Do not introduce new dependencies without a clear reason.
- Do not remove existing behavior without confirming it is obsolete.
- Preserve existing conventions unless they are clearly harmful.
- Preserve user work. If unrelated files are modified, do not revert, reformat, or clean them up.

## Planning

Before large changes:

1. inspect current implementation
2. identify affected files
3. explain intended approach briefly
4. make small changes
5. run available checks if possible

## Code Changes

- Keep changes minimal and reviewable.
- Follow existing naming conventions.
- Follow existing folder structure.
- Keep route handlers thin.
- Keep business logic in services.
- Keep database logic in repositories.
- Add or update tests for meaningful behavior changes.
- Update docs when behavior changes.
- Edit source files in `agents/*.md`; do not hand-edit generated `AGENTS.md`.
- After changing `agents/*.md`, run `npm run build:agents` so `AGENTS.md` stays synchronized.

## Safety Rules

Never do these unless explicitly requested:

- delete large parts of code
- rewrite the whole architecture
- stage, commit, rebase, reset, or push Git changes
- change database schema casually
- edit old applied migrations
- remove auth/authorization checks
- expose secrets
- disable tests
- silence errors without fixing them
- add broad `any` types to bypass TypeScript problems

## When Unsure

If the intent is unclear:

- make the smallest reasonable assumption
- avoid risky changes
- leave a short note explaining the assumption
- prefer asking for clarification before destructive changes

## Output Expectations

When finishing work, summarize:

- what changed
- which files changed
- what checks were run
- what was not run and why, especially for docs-only changes
- what should be tested manually, if relevant
- any risks or follow-up tasks

## Verification Expectations

- For TypeScript code changes, run `npm run typecheck` when practical.
- For behavior changes, run relevant tests or explain why they were not run.
- For deployment-oriented changes, run `npm run build` when practical.
- For docs-only changes, do not run the full test suite unless requested; state that tests were skipped because no runtime code changed.

## Project-Specific Priority

For this project, prioritize:

1. auth correctness
2. data privacy
3. migration safety
4. API stability
5. mobile client compatibility
6. readable maintainable code
