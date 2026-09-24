# Meeting Sync Preservation Implementation Plan

**Goal:** Fix revision loss and destructive meeting hydration while preserving both sides of unresolved conflicts.

**Architecture:** A focused meeting merge module compares canonical content against durable acknowledged bases. Sync orchestration queues hydration with uploads and saves merged meetings and sync metadata atomically.

**Tech Stack:** Vue, Pinia, TypeScript, Vitest, existing local storage.

## Constraints

No new dependencies, migrations, commits, or changes to unrelated work. Keep existing API contracts and backend authorization.

## Tasks

- [x] Add regression tests to `src/shared/services/__tests__/syncService.test.ts`: delayed response advances the acknowledged revision but preserves edits; next AI upload succeeds; hydration of a newer-timestamp draft preserves completed notes/tasks/agreements.
- [x] Add `src/features/meeting/meetingSyncMerge.ts` for acknowledged bases and conservative hydration. Tests cover clean updates, stale responses, unknown bases, and conflicts.
- [x] Extend `src/shared/services/storageService.ts` with atomic meeting/sync metadata persistence. Preserve existing resource metadata and settings.
- [x] Update `src/shared/services/syncService.ts`: use the merge rules, serialize hydration, reject stale session results, and retry AI preflight only for acknowledged concurrent edits.
- [x] Update `src/shared/services/syncRuntimeService.ts` with a generation counter invalidated on session reset.
- [x] Run focused tests until passing, then `npm test`, `npm run build`, and `npm run check`. Format only changed files. Document any unrelated check failures and Android follow-up.

Execution is inline in this task, using the user's approval of the investigation's proposed fixes. Test-first sequence: assert preserved content and acknowledged revision, observe existing failure, implement, rerun. No delegated agents or commits.
