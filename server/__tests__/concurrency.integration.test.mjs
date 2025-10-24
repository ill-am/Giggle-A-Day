import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dbUtils from "../utils/dbUtils.js";

// Small concurrency test: fire several parallel createPrompt calls with the
// exact same prompt text and assert that only one Prompt row exists in the DB.

describe("concurrency integration (Postgres)", () => {
  let prisma;

  beforeAll(async () => {
    // Initialize Prisma client via the dbUtils helper
    prisma = dbUtils._getPrisma();
    // Ensure a clean slate
    try {
      await prisma.aIResult.deleteMany();
    } catch (e) {}
    try {
      await prisma.prompt.deleteMany();
    } catch (e) {}
  });

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {}
    if (typeof dbUtils._resetPrisma === "function") dbUtils._resetPrisma();
  });

  it("creates only one Prompt row when many concurrent createPrompt() calls use the same text", async () => {
    const N = 6;
    const promptText = `Concurrency test prompt ${Date.now()}`;

    const calls = [];
    for (let i = 0; i < N; i++) {
      calls.push(dbUtils.createPrompt(promptText));
    }

    const results = await Promise.all(
      calls.map((p) => p.catch((e) => ({ error: e.message || String(e) })))
    );

    // Collect successful ids
    const ids = results.map((r) => (r && r.id ? r.id : null)).filter(Boolean);

    // Count prompt rows in DB; we cleaned the table in beforeAll so expect 1
    const count = await prisma.prompt.count();

    expect(count).toBe(1);

    // If any ids were returned, they should all be the same (single canonical id)
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length > 0) expect(uniqueIds.length).toBe(1);
  }, 120000);
});
import { describe, it } from "vitest";

// Concurrency integration scaffold
// This test is intentionally skipped unless POSTGRES_URL is provided in the
// environment (CI). It is a scaffold to implement parallel POST /prompt or
// direct Prisma upsert verification against a real Postgres instance.

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  // No Postgres configured — skip this integration test scaffold.
  describe("concurrency.integration (skipped)", () => {
    it("skipped: requires POSTGRES_URL or DATABASE_URL", () => {});
  });
} else {
  describe("concurrency.integration", () => {
    it("placeholder: parallel upsert test against Postgres (implement)", async () => {
      // TODO: Implement: start Postgres-backed test, run N parallel createPrompt
      // requests, and assert there are no duplicate Prompt rows.
      // This scaffold is intentionally minimal so CI can opt-in by setting
      // POSTGRES_URL/DATABASE_URL and enabling the test.
    });
  });
}
