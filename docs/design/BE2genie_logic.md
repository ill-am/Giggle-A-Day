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

- Add DB migration: unique index on normalized prompt text.
- Implement upsert behavior in `crud.createPrompt` to return existing record on conflict.
  Acceptance: duplicates are deduped at DB level.

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
