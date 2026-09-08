# Mobile Quality Gate Repair Design

**Date:** 2026-09-08
**Status:** Approved for implementation planning
**Readiness finding:** `weekly-us-api/docs/system-readiness-report-2026-09-07.md`, point 5

## Objective

Create one reliable mobile quality gate that checks the maintained application code locally and in GitHub Actions. The gate must compile the actual Vue application and Node configuration projects, enforce formatting and useful lint rules, run the existing tests, and produce an ordinary production bundle. GitHub Actions must perform quality checks only and must contain no Render deployment behavior or deployment credentials.

## Current Failure

The existing `npm run build` invokes `vue-tsc --noEmit` through a solution `tsconfig.json` whose own `files` list is empty. It succeeds even though an explicit application-project check reports substantive diagnostics. The Node project also omits a source file imported by `vite.config.ts`.

The formatting check currently fails in 16 maintained files. ESLint scans generated iOS web bundles and reports thousands of irrelevant failures. After excluding those generated bundles, nine maintained-code errors and two test warnings remain.

## Authoritative Local Gate

`package.json` will expose focused scripts for application typechecking and Node configuration typechecking. A single `npm run ci` script will run these checks in this order:

1. explicit application and Node typechecks;
2. Prettier verification;
3. ESLint verification;
4. unit and contract tests;
5. an ordinary Vite production build.

The build used by this gate will not use release mode. It therefore will not exercise the release Sentry source-map upload path or require release credentials. Release packaging remains a separate release-validation activity.

The ordinary `npm run build` command will also compile the explicit TypeScript projects before bundling so it cannot preserve the current false-green behavior.

## TypeScript Configuration

The application config will stop using the deprecated `baseUrl` option. Its existing `@/*` path mapping will remain relative to the configuration file.

The Node config will include every TypeScript source imported by the listed Vite, Vitest, and Capacitor configuration files, including production configuration validation. The gate will invoke the application and Node projects explicitly instead of depending on TypeScript solution-file inference.

## Diagnostic Repairs

Substantive TypeScript errors will be fixed at their existing boundaries without changing product behavior:

- Auth token clearing and mapping will always construct the complete `AuthTokens` shape, including `expiresAt`.
- Pinia store callbacks and workspace-member mapping will receive explicit, correctly narrowed types.
- The i18n instance and supported locale values will retain their domain types instead of widening to `unknown` or `string`.
- Participant creation, participant lookup, summary projection, task-card tone, and HTTP auth-handler access will handle nullable or narrowed values explicitly.
- Workspace API types will import their role dependency.
- Secure-storage serialization will pass a supported record shape.
- Browser share detection will refine the native `Navigator` capability without declaring an incompatible interface.
- Storage defaults and persisted meeting validation will include required settings and identify records safely.
- Dead comparisons and unused source/test variables will be removed.

Corrections that merely satisfy the compiler must preserve existing API payloads, persisted-data compatibility, and user-visible behavior. If inspection reveals a real behavior defect, it will receive a focused regression test before the correction.

## Formatting and Lint Scope

Prettier will format the 16 currently failing maintained files. The repository-wide format check will remain authoritative.

ESLint will exclude generated native web output, including the synchronized iOS public bundle, while continuing to inspect maintained Vue, TypeScript, JavaScript, scripts, tests, and configuration. Node scripts will use Node globals through a scoped configuration block. Test files may contain multiple local fixture components without generating `vue/one-component-per-file` warnings; the production Vue rule remains unchanged.

The two current maintained-code unused-variable errors will be corrected rather than suppressed.

## GitHub Actions

A quality-only workflow will run for pull requests and branch pushes. It will:

1. check out the repository;
2. install Node 24;
3. install the lockfile with `npm ci`;
4. run `npm run ci`.

The workflow will use read-only repository permissions. It will not deploy, call Render, require deployment secrets, or upload Sentry source maps. Concurrent obsolete runs for the same branch may be cancelled.

## Verification

The implementation is complete when all of these pass from a clean dependency install:

- explicit application typecheck;
- explicit Node configuration typecheck;
- `npm run format:check`;
- `npm run lint` with no errors or warnings;
- `npm test`;
- `npm run build`;
- `npm run ci`.

The GitHub workflow structure will be reviewed to confirm that it contains only checkout, Node setup, dependency installation, and quality checks. The readiness report will be updated with observed command results and will continue to distinguish this gate from signed native release verification.

## Boundaries

This work does not add deployment automation, Render integration, signed Android or iOS builds, Sentry release uploads, dependency upgrades, broad refactoring, or performance optimization. Existing generated native files will not be reformatted or manually repaired.
