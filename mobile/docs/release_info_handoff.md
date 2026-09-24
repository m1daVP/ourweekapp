# OurWeek Google Play Release Handoff

Date: 2026-06-24

Workspace: `D:\Projects\myself\weekly-us`

## Current objective

Continue preparing OurWeek for its first public Google Play release. The latest
assessment is a **no-go for public production**, but the project is suitable for
internal or closed testing after a release artifact can be built.

## Primary references

Do not recreate the completed audit or responsibility breakdown. Read these
workspace documents first:

- `docs/google-play-publication-readiness-audit-2026-06-24.md` — detailed
  findings, evidence, passed checks, blockers, policy links, and recommended
  release sequence.
- `docs/google-play-release-work-responsibilities.md` — categorizes work Codex
  can perform directly, work requiring external inputs, and owner-only actions.
- `docs/android-mvp-release-readiness.md` — pre-existing project release gates;
  some metadata is stale and should be reconciled.
- `docs/public-v1-feature-scope.md` — current declared public v1 scope.
- `docs/privacy-data-map.md` and `docs/google-play-data-safety.md` — draft
  privacy and Play disclosure inputs.
- `AGENTS.md` — mandatory project engineering and product rules.

## Work completed in this session

- Audited project structure, Android configuration, production feature paths,
  subscription logic, AI summary selection, Calendar gating, auth/token
  storage, account deletion, legal copy, privacy documentation, and release
  configuration.
- Verified current Google Play target SDK, payments, account deletion, Data
  Safety, and new-personal-account testing requirements from official sources.
- Performed mobile browser smoke tests at 390 x 844 and 320 x 568. Welcome and
  sign-up pages had no horizontal overflow; primary controls were appropriately
  sized.
- Created the two documentation files listed above.
- No application source changes or commits were made.

## Verification results

- `npm run build`: passed. Vite warned about a JavaScript chunk over 500 kB.
- `npm run check`: passed.
- `npm test`: passed, 22 files and 130 tests.
- `npm audit --omit=dev`: 0 production vulnerabilities.
- Full `npm audit`: 6 high and 2 moderate development-tooling findings,
  primarily under Capacitor asset tooling. See the audit document.
- Android target and compile SDK: 36; current Play minimum is satisfied.
- Native Gradle verification was blocked because JDK/JAVA_HOME was unavailable.
- A read-only health request to the backend configured in the ignored local
  `.env` was unreachable. The endpoint and all configuration values are
  intentionally omitted from this handoff.

## Important current state

- The ignored local `.env` represents a local/incomplete release configuration:
  backend mode and Calendar are enabled, an Android RevenueCat public SDK key
  is configured, and trusted RevenueCat validation is disabled. Never copy its
  values into documentation or output.
- Production billing is still incomplete. Plans can show `Price pending`, and
  `subscriptionService.ts` contains production TODOs.
- In-app Privacy Policy and Terms explicitly identify themselves as drafts.
- No signed AAB, release signing configuration, real-device QA evidence, final
  Play Console declarations, or external account-deletion web resource was
  verified.
- `android:allowBackup="true"` is enabled while sensitive household records and
  private notes are stored locally. Backup behavior needs a deliberate product
  and privacy decision.
- `src/styles/main.css` imports Google Fonts and Material Symbols remotely.
- Branded Android icon/splash assets exist, but project release documentation
  still calls them temporary, so final approval remains open.
- Release documentation says version 0.1.0, while package and Android version
  name are 0.3.0.
- Git worktree was otherwise unchanged by the audit. `supabase/` was already
  untracked and contains only local CLI branch-state metadata; preserve it and
  do not commit or delete it without user direction. The two new audit docs are
  also untracked. Do not commit unless explicitly requested.

## Recommended next implementation batch

Ask the user which item to begin, unless they give a direct implementation
request. The recommended order is already documented in
`docs/google-play-release-work-responsibilities.md`:

1. Production configuration validation.
2. Android backup/privacy hardening.
3. Local font bundling.
4. Version and release-document reconciliation.
5. A repeatable release-check command.

After any significant code changes, follow `AGENTS.md`: run `npm run format` as
needed, then `npm run build` and `npm run check`; run the relevant tests as
well.

## Constraints and cautions

- Use npm only.
- Preserve the mobile-only Vue 3/TypeScript/Capacitor architecture.
- Do not expose or log `.env` values, tokens, RevenueCat keys, keystore data, or
  backend credentials.
- Do not unlock Premium from frontend-only or mock state in production.
- Do not call an AI provider directly from the mobile app.
- Do not enable Calendar production exposure without verified backend OAuth,
  token handling, revoke/disconnect behavior, and disclosure review.
- Legal text may be drafted and integrated, but final legal approval belongs to
  the owner and qualified counsel.
- Play Console submissions, signing enrollment, tester recruitment, and final
  rollout require owner participation or explicit authorization.

## Suggested skills

- `browser:control-in-app-browser` for mobile responsive smoke testing and UI
  verification after implementation changes.
- `imagegen` only if the owner asks to replace or create raster store, launcher,
  or splash artwork.
- `propose-commits` if the owner asks to organize completed changes into a
  reviewed commit plan.
- `commit-approved` only after the owner explicitly approves a numbered commit
  list and requests commits.
- `handoff` again when transferring a later implementation session.
