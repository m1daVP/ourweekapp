# Generated Avatar Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the frontend avatar catalog from local WebP assets and use filename-only IDs with safe fallback for unknown IDs.

**Architecture:** One frontend script scans the asset tree and writes a committed JSON manifest. The app loads that manifest and Vite-discovered assets; the API accepts a safe identifier format instead of duplicating the manifest.

**Tech Stack:** Node.js scripts, JSON, Vue 3, Vite, TypeScript, Fastify, Zod, Supabase/PostgreSQL.

## Global Constraints

- The asset tree contains exactly five folders with four `.webp` files each.
- Each filename stem is lowercase kebab case and globally unique; it is the persisted avatar ID.
- Group folders organize the picker only and are not persisted.
- Unknown frontend IDs render the existing color-and-initials fallback.
- Do not stage or commit files unless the user explicitly asks.

---

### Task 1: Generate and validate the frontend catalog manifest

**Files:**
- Create: `weekly-us/scripts/generate-avatar-catalog.mjs`
- Create: `weekly-us/src/features/participants/avatar-catalog.json`
- Modify: `weekly-us/package.json`
- Create: `weekly-us/src/features/participants/__tests__/avatarCatalogGeneration.test.ts`

**Interfaces:**
- Produces `npm run avatars:generate`.
- Produces JSON shaped as `{ "groups": [{ "id": "animals", "avatars": [{ "id": "fox", "path": "/src/assets/avatars/animals/fox.webp" }] }] }`.

- [ ] **Step 1: Write generator validation tests**

Test five groups of four valid files, duplicate stems across groups, invalid uppercase stems, and an incorrect group/file count. Expect the generator to fail with an actionable error before it writes JSON.

- [ ] **Step 2: Implement the scanner and generator**

Use Node `fs/promises` to read `src/assets/avatars`, sort directories/files deterministically, validate `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, and write formatted JSON. Register:

```json
"avatars:generate": "node scripts/generate-avatar-catalog.mjs"
```

- [ ] **Step 3: Generate the real manifest and verify it**

Run: `npm run avatars:generate`

Expected: manifest includes groups `abstract`, `animals`, `cosmic`, `cozy`, and `flowers`, with IDs such as `fox`, `moon`, and `coffee`.

- [ ] **Step 4: Run focused generator tests**

Run: `npm test -- avatarCatalogGeneration.test.ts`

Expected: PASS.

### Task 2: Load generated catalog assets and preserve fallback behavior

**Files:**
- Modify: `weekly-us/src/features/participants/avatarCatalog.ts`
- Modify: `weekly-us/src/features/participants/__tests__/avatarCatalog.test.ts`
- Modify: `weekly-us/src/features/participants/components/__tests__/ParticipantAvatar.test.ts`

**Interfaces:**
- Consumes generated manifest group and asset records.
- Produces `AvatarType` as a manifest ID union, `avatarGroups`, `avatarCatalog`, `getAvatarAsset`, and `isAvatarType`.

- [ ] **Step 1: Write failing catalog tests**

Assert `getAvatarAsset('fox')` resolves the bundled asset, `isAvatarType('fox')` is true, and `getAvatarAsset('removed-avatar')` is undefined. Mount `ParticipantAvatar` with `avatarType: 'removed-avatar'` and assert it renders color initials.

- [ ] **Step 2: Implement JSON-backed mapping**

Import the JSON manifest and match each `path` against Vite assets discovered by `import.meta.glob('/src/assets/avatars/**/*.webp', { eager: true, import: 'default', query: '?url' })`. Do not build an asset URL from an ID; only JSON paths resolve assets.

- [ ] **Step 3: Run focused component tests**

Run: `npm test -- avatarCatalog.test.ts ParticipantAvatar.test.ts`

Expected: PASS for real and unknown asset IDs.

### Task 3: Replace API catalog allow-list with safe identifier validation

**Files:**
- Modify: `weekly-us-api/src/modules/participants/participants.schema.ts`
- Modify: `weekly-us-api/supabase/migrations/20260904130000_add_participant_avatar_type.sql`
- Modify: `weekly-us-api/tests/participants.service.test.ts`
- Create: `weekly-us-api/tests/participant-avatar-type.schema.test.ts`

**Interfaces:**
- Produces `avatarTypeSchema: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80)`.
- Keeps `avatarType` nullable/optional as required by existing sync compatibility.

- [ ] **Step 1: Add failing API schema tests**

Accept `fox` and `my-avatar`; reject uppercase, path separators, whitespace, empty strings, and values over 80 characters. Verify a legacy omitted field remains accepted.

- [ ] **Step 2: Implement the generic validator and migration constraint**

Replace the 20-item Zod enum and SQL `IN (...)` constraint with the safe identifier rule. The SQL check permits null or `avatar_type ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`.

- [ ] **Step 3: Update authorization fixtures and run tests**

Use `fox` in self/other-user authorization cases. Run: `npm run typecheck` and `npm test -- participants.service.test.ts participant-avatar-type.schema.test.ts`.

Expected: PASS.

### Task 4: Regenerate contracts and verify both projects

**Files:**
- Modify if generated: `weekly-us-api/docs/openapi.json`

- [ ] **Step 1: Regenerate catalog and OpenAPI outputs**

Run: `npm run avatars:generate` in `weekly-us`; run `npm run openapi:generate` in `weekly-us-api`.

- [ ] **Step 2: Run checks**

Run in `weekly-us`: `npm test`, `npm run build`, and `npm run check`.

Run in `weekly-us-api`: `npm run typecheck`, focused participant tests, and `npm run openapi:check`.

- [ ] **Step 3: Leave changes uncommitted**

Do not stage or commit. Report any full-suite environmental timeout separately from feature failures.
