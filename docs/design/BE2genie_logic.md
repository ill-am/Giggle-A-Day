# Backend Logic Flow: /prompt to genieService — Consolidated (2025-10-23)

This document captures the current, actual implementation for the `/prompt` -> generation flow in the server. It summarizes the runtime wiring and the concrete modules in the codebase.

## High-level summary

- Controller: `POST /prompt` in `server/index.js` — validates input, delegates to `genieService.generate(prompt)`, attempts non-fatal DB persistence via `crud`, and returns a `{ success: true, data }` JSON payload.
- Service/Adapter: `server/genieService.js` — exposes `async generate(prompt)`, delegates to `sampleService.generateFromPrompt(prompt)` (awaits it), wraps result into `{ success: true, data: {...} }`, and provides helpers for file persistence.
- Business/Mock: `server/sampleService.js` — mock implementation; `async generateFromPrompt(prompt)` builds content (title/body), requests prompt save via `fileUtils.saveContentToFile(prompt)` (non-fatal), and returns `{ content, copies }`.
- Utilities: `server/utils/fileUtils.js` — async `saveContentToFile(content)` implemented with `fs.promises` and an atomic temp-write/rename helper; `readLatest()` remains available (sync) to load the latest saved prompt for legacy routes.

```
Client Request
   │
   ▼
┌────────────────────────────┐
│ POST /prompt               │
│ (Controller in server/)    │
└────────────────────────────┘
   │
   ▼
┌────────────────────────────┐        (optional, non-fatal)
│ genieService               │◀────────────────────────────────┐
│ (Service / Adapter)        │                                 │
└────────────────────────────┘                                 │
   │                                                           │
   │ calls/awaits                                             │
   ▼                                                          │
┌────────────────────────────┐                                │
│ sampleService              │                                │
│ (Business logic - async)   │── calls ──▶ fileUtils.saveContentToFile()
└────────────────────────────┘                                │
   │                                                          │
   ▼                                                          │
┌────────────────────────────┐                                │
│ server/utils/fileUtils.js  │                                │
│ (saveContentToFile / readLatest)                            │
└────────────────────────────┘                                │
```

## Implementation Progress

### Completed Phases

**Phase 0** — Prep & safety ✅ (20 OCT 2025)

- Feature flag implemented: `GENIE_PERSISTENCE_ENABLED`
- Normalization utility added
- Test infrastructure in place
- Verified no runtime changes when flag is false

**Phase 1** — Read-only DB lookup ✅ (21 OCT 2025)

- Implemented normalized DB lookup in genieService
- Cache hit returns existing content
- Verified no DB writes on lookup path

**Phase 2** — Persistence in genieService ✅ (21 OCT 2025)

- Added persist capability behind feature flag
- Implemented non-fatal error handling
- Maintained dual-write safety during rollout

**Phase 3** — Remove controller DB writes ✅ (22 OCT 2025)

- Successfully migrated persistence to genieService
- Removed DB writes from controller
- Validated end-to-end behavior unchanged

### Current Phase

**Phase 4** — DB dedupe (migration + upsert) (1–2 days)
**Phase 4** — DB dedupe (migration + upsert) (minimal plan)

Purpose: enforce DB-level uniqueness for the normalized prompt so identical prompts cannot create duplicate Prompt rows. This enables atomic upsert behavior and safer concurrency.

Minimal plan (safe, since current DB starts empty):

- Add a normalized unique column to the Prisma `Prompt` model. Recommended: add a `normalizedHash String @unique` (and optional `normalizedText String`). Storing a short SHA256/hex of the normalized text avoids indexing large text fields.
- Generate Prisma client and create/apply the migration.
- Implement atomic upsert in `server/utils/dbUtils.js` using the normalized hash as the unique key (Prisma `upsert` or equivalent). Ensure the function returns `{ id }`.
- Add unit tests that mock Prisma (use `_setPrisma`) to verify upsert behavior and basic dedupe semantics.
- Add a small concurrency/integration test (run against ephemeral Postgres in CI) to validate no duplicates under parallel requests.

Acceptance: identical normalized prompts return the same `promptId`; no duplicate Prompt rows are created; existing functionality remains unchanged.

Actionables (prioritized, with time estimates):

1. Create feature branch `feature/genie-phase4-dedupe` — 5–10 minutes
2. Edit Prisma schema to add `normalizedHash` (and optional `normalizedText`) — 15–30 minutes
3. Implement `upsert` in `server/utils/dbUtils.js` (use `normalizePrompt()` + SHA256) — 30–90 minutes
4. Add unit tests for `dbUtils.createPrompt` upsert behavior (mock Prisma) — 1–3 hours
5. Generate and apply Prisma migration in dev/staging (since DB is empty this can be applied directly) — 15–60 minutes
6. Add a concurrency/integration test in CI against ephemeral Postgres and ensure `prisma migrate` runs in CI — 1–2 hours
7. Open PR with schema change, shim update, and tests; run staging validation and merge when green — review + staging validation: ~1 day

Notes:

- Because the current DB contains zero prompt records, no dedupe script is required before applying the unique constraint. If that changes later, include a dedupe step before migration.
- Keep the `GENIE_PERSISTENCE_ENABLED` feature flag OFF until migration and tests are validated in staging.

Acceptance criteria (short): identical normalized prompts yield the same `promptId`; no DB duplicates; safe rollout behind the feature flag.

#### Technical Requirements:

1. Database Migration

   - Add unique index on normalized prompt text
   - Schema update:
     ```prisma
     model Prompt {
       normalizedText String @unique
       // existing fields remain unchanged
     }
     ```
   - Migration must handle existing data

2. Upsert Implementation

   - Modify crud.createPrompt for upsert behavior
   - Return existing record on conflict
   - Ensure atomic operations for concurrent requests

3. Integration Requirements

   - Leverage existing normalizePrompt utility
   - Work with GENIE_PERSISTENCE_ENABLED flag
   - Integrate through dbUtils layer

4. Testing Requirements

   - Concurrent submission validation
   - Duplicate detection verification
   - Normalized text variation testing
   - Edge case coverage (long prompts, special chars)

5. Success Criteria

   - Identical normalized prompts yield same promptId
   - No database duplicates
   - Maintained functionality
   - Acceptable performance under load

6. Risk Mitigation
   - Migration rollback plan
   - Error handling strategy
   - Performance monitoring approach
   - Concurrent operation safety

### Upcoming Phases

**Phase 5** — Optional in-process coalescing (0.5–1 day)

- Implement per-prompt Promise map in genieService
- Coalesce concurrent misses for same prompt
- Use DB unique constraint as safety net

**Phase 6** — Docs, monitoring, cleanup (0.5–1 day)

- Update design docs and README
- Add structured logs and metrics
- Document final flow and feature flags

---

Last updated: October 23, 2025
