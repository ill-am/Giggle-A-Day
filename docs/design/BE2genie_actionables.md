# BE2genie — Actionables & Implementation Plan

Last updated: 2025-10-27

Purpose

- Provide a concrete, trackable set of actionables for finishing verification and safe rollout of the BE2genie persistence features.
- Anything estimated above ~2 hours is expanded with clear steps, acceptance criteria, files to change, and estimated effort so follow-up work can be delegated and tracked.

Highlights / Findings (concise)

- The code implements the read-first -> generate -> best-effort persist flow described by `BE2genie_logic.md`.
  - Evidence: `server/genieService.js` implements read-only lookup via `dbUtils.getPrompts()`/`crud`, falls back to generation (`sampleService`), and performs best-effort persistence with `dbUtils.createPrompt`/`createAIResult`.
- Feature flags and test hooks exist and are wired in code:
  - `GENIE_PERSISTENCE_ENABLED` controls persistence; default stays enabled for backwards compatibility.
  - `GENIE_PERSISTENCE_AWAIT` and `genieService._lastPersistencePromise` are present to allow deterministic tests.
- Tests and scaffolding:
  - Unit tests cover the mocked persistence flows and await behavior (`server/__tests__/genieService.persistence.*.mjs`).
  - There is a concurrency integration test file (`server/__tests__/concurrency.integration.test.mjs`) but it contains TODO/placeholder logic and skips when `DATABASE_URL` is not set.
- CI infra exists for Postgres-backed tests:
  - There are GitHub Actions workflow files `.github/workflows/ci-postgres.yml` and `.github/workflows/ci-postgres-concurrency.yml` which bring up Postgres and set `DATABASE_URL` for the job.
  - However, the concurrency test itself is not implemented end-to-end (test scaffold incomplete).
- Export enforcement gap remains:
  - Design calls for exports to derive from persisted canonical content; repo contains documentation and export endpoints, but there's no enforced `genieService.getPersistedContent(promptId)` or ExportService that guarantees export paths read persisted content.

Scope & Goals for this plan

- Implement the missing Postgres-backed concurrency verification test and wire it into CI (use existing workflow scaffolding).
- Implement a minimal ExportService or `genieService.getPersistedContent(promptId)` and update export/preview paths to use it (or document a clear migration plan if immediate code change is not desired).
- Provide docs, run commands and acceptance criteria so any task >2 hours is followable and verifiable by reviewers.

Prioritized Actionables (with detail when >2 hours)

1) Implement Postgres concurrency integration test (4–8 hours)

- Goal: Verify dedupe/upsert behavior under concurrency so we can safely enable `GENIE_PERSISTENCE_ENABLED` in staging/production.
- Estimate: 4–8 hours (dev + local iteration + CI stabilization).
- Acceptance criteria:
  - A Vitest integration test runs against a real Postgres instance (uses `DATABASE_URL` or `POSTGRES_URL`), launches N parallel requests (or performs parallel Prisma upserts), and asserts that at-most-one `prompt` row exists per normalized hash for the tested prompt(s).
  - The test reliably passes on local dev (when connected to a Postgres dev DB) and in CI workflow `.github/workflows/ci-postgres-concurrency.yml`.
  - Test artifacts (logs, any exported PDFs if used as part of flow) are uploaded by CI on failure.
- Files to add/modify:
  - `server/__tests__/concurrency.integration.test.mjs` — implement the test body (replace TODOs).
  - Optionally, add `server/scripts/concurrency_test_helper.js` — helper to fire parallel POST /genie requests (or a Prisma harness that performs parallel createPrompt attempts).
  - Ensure `WORKFLOWS.md` and `server/README.md` include the exact env vars to run the test locally.
- Implementation steps:
  1. Copy/extend the scaffold in `server/__tests__/concurrency.integration.test.mjs` and implement two variants:
     - Prisma upsert path: directly exercise `dbUtils.createPrompt`/Prisma upsert concurrently.
     - HTTP path: start the server programmatically (test harness already supports this) and fire N parallel POST `/genie` requests with identical prompt payload.
  2. Use a deterministic prompt string and `normalizePrompt` so the normalized hash is constant.
  3. After parallel operations complete, query `dbUtils.getPrompts()` or direct Prisma client to assert only one canonical prompt row exists for the normalized text.
  4. Add retries/timeouts and diagnostic logging to help investigate flakiness. Prefer to make the test idempotent: clean up rows created during the test (or use a transient DB created per run).
  5. Run locally with a Postgres dev DB; iterate until stable.
  6. Commit and enable the test in `.github/workflows/ci-postgres-concurrency.yml` (it already runs `npm --prefix server run test:run` when `DATABASE_URL` is set), ensure the workflow uploads artifacts on PR failures.
- Risks and mitigations:
  - Risk: Flaky parallel tests due to timing; mitigate with backoff, short random jitter, and using transactions where needed to make failure deterministic.
  - Risk: CI runner resource limits (parallelism or timeouts); reduce concurrency count in CI (e.g. N=6–10) vs ad-hoc local runs (N=50).


2) Add Export API / enforce persisted reads (3–6 hours)

- Goal: Guarantee exports are derived from persisted canonical content so dedupe/auditability guarantees are preserved.
- Estimate: 3–6 hours (implementation, tests, docs).
- Acceptance criteria:
  - Provide `genieService.getPersistedContent(promptId)` that returns canonical persisted content for a prompt id (reads latest AI result or the canonical stored `result` envelope and returns content + metadata).
  - Update export handlers (e.g., `server/index.js` `/export` and `/api/export` flows, or the export helper used by the UI) to prefer `getPersistedContent(promptId)` when `promptId` or `resultId` is supplied, and to document the required behavior for unedited vs edited flows.
  - Unit tests that assert export endpoints call `getPersistedContent` when `promptId` is provided (use test injection helpers in `genieService` to verify).
- Files to add/modify:
  - `server/genieService.js` — add/function export `getPersistedContent(promptId)`.
  - `server/index.js` — update the `/preview`, `/export`, and `/api/export` endpoints to use the new API when a `promptId`/`resultId` is provided; keep fallback behavior for backward compatibility but document the rule.
  - Tests: add `server/__tests__/export_persisted_content.test.mjs`.
- Implementation steps:
  1. Add the function to `genieService` that performs a robust read: prefer `dbUtils.getAIResultById(resultId)` then `dbUtils.getAIResults()` filtered by `promptId` and return canonical content.
  2. Unit test behaviors with injected mocks using `_setDbUtils` and `_setSampleService` helpers.
  3. Update export/preview paths to call `getPersistedContent` and adjust preview logic to prefer persisted content when `promptId`/`resultId` present.
  4. Document the runtime rule in `docs/design/BE2genie_export_objective.md` and link from `BE2genie_logic.md`.
- Risks and mitigations:
  - Risk: Some external callers depend on current behavior (passing raw content into `/export`), so maintain backward-compatible fallback while requiring canonical read for flows that provide a `promptId` or `resultId`.


3) Wire CI job to run concurrency test and upload artifacts (2–6 hours)

- Goal: Ensure the repository's existing CI workflows exercise the concurrency test reliably and fail PRs on regressions.
- Estimate: 2–6 hours (mostly stabilization & artifact wiring).
- Acceptance criteria:
  - `.github/workflows/ci-postgres-concurrency.yml` runs the concurrency integration test and uploads artifacts on failure.
  - The job configures `DATABASE_URL`, waits for Postgres health, runs `npm --prefix server run test:run`, and includes `GENIE_PERSISTENCE_ENABLED=1` and `GENIE_PERSISTENCE_AWAIT=1` when needed for deterministic checks (per the plan acceptance criteria).
- Files to modify:
  - `.github/workflows/ci-postgres-concurrency.yml` — ensure the test step runs and includes artifact upload.
  - `WORKFLOWS.md` — update with notes about this test.
- Implementation steps:
  1. Point the workflow to run the new test or run the full server test suite when `DATABASE_URL` is present.
  2. Add a step to collect `server/test-artifacts/` into the Actions artifacts on failure.
  3. Tune concurrency N for CI runs to balance run time vs test fidelity.


4) Docs & Runbook updates (1–2 hours)

- Goal: Make it easy for contributors to run the new tests locally and to understand rollout requirements.
- Estimate: 1–2 hours.
- Acceptance criteria:
  - `server/README.md` includes exact commands and env vars to run the concurrency test locally (examples with `JOBS_DB`, `DATABASE_URL`, and required Postgres env vars).
  - `WORKFLOWS.md` and `docs/design/BE2genie_logic.md` link to the test and describe gating rules (keep `GENIE_PERSISTENCE_ENABLED` off until concurrency tests pass in staging).
- Files to modify:
  - `server/README.md` (add section for running concurrency integration test locally).
  - `docs/design/BE2genie_logic.md` (update 'Pending Verification' checklist to reflect test added and CI job name).


5) Monitoring & rollback runbook (1–2 hours)

- Goal: Prepare a short runbook for enabling `GENIE_PERSISTENCE_ENABLED` in staging/production, monitoring for duplicates, and a rollback procedure.
- Estimate: 1–2 hours.
- Acceptance criteria:
  - A short doc in `docs/ops/genie_rollout.md` that includes:
    - Metrics to monitor (prompt row counts by normalizedHash, duplicate detection alerts).
    - Quick queries to detect duplicates (SQL example) and how to dedupe safely.
    - Rollback steps: unset `GENIE_PERSISTENCE_ENABLED`, identify orphaned AI results, and a plan to re-run dedupe script later.


Quick local verification commands (how to run the concurrency test locally)

- Spin up a local Postgres (devcontainer or Docker) and set `DATABASE_URL` accordingly. Example docker-run:

```bash
docker run --rm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dino_ci_test -p 5432:5432 -d postgres:16
# wait for pg_isready or use the db-health script
```

- Run the test (from repo root):

```bash
# run server tests once against the Postgres instance
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dino_ci_test npm --prefix server run test:run

# or run only the new concurrency test (after implementation)
npx vitest run server/__tests__/concurrency.integration.test.mjs --run
```

Notes & follow-ups

- The repo already contains the CI workflows to spin up a Postgres container. The remaining work is implementing the concurrency test and ensuring it is stable and reliable in CI.
- Anything estimated above ~2 hours (concurrency test, Export API, CI stabilization) is documented above with step-by-step tasks and acceptance criteria to make follow-up work straightforward.

Owners / Suggested assignees

- Implement concurrency test: (backend engineer familiar with Prisma/Prisma client) — suggested: @backend-owner
- Export API / preview changes: (backend engineer familiar with exports & sampleService) — suggested: @backend-owner or @exports-owner
- CI wiring and docs: (devops / CI engineer) — suggested: @devops

If you want, I can now:
- Implement the test scaffold (create the test file body and helper script) and run it locally against a dev Postgres (I will not edit production code except tests). OR
- Scaffold the `genieService.getPersistedContent` implementation with tests.

Ask before I implement any code changes; otherwise I will proceed with creating the test implementation scaffold next (confirm?).
