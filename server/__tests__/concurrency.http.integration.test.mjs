import request from "supertest";
import { describe, it, beforeAll, afterAll, expect } from "vitest";

// Ensure test mode and skip Puppeteer heavy startup
process.env.SKIP_PUPPETEER = "true";
process.env.NODE_ENV = "test";

// Import server and helpers
let serverModule;
try {
  serverModule = await import("../index.js");
} catch (e) {
  serverModule = require("../index.js");
}

const app = serverModule.default || serverModule.app || serverModule;
const { startServer } = serverModule;

// dbUtils for direct DB inspection/cleanup
const dbUtilsModule = await import("../utils/dbUtils.js");
const dbUtils = dbUtilsModule.default || dbUtilsModule;

async function waitForHealth(req, timeout = 20000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await req.get("/health");
      if (res.status === 200 && res.body && res.body.status === "ok") return;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Health did not become ok in time");
}

describe("concurrency HTTP integration (Postgres)", () => {
  let req;
  let prisma;

  beforeAll(async () => {
    await startServer({ listen: false });
    req = request(app);
    await waitForHealth(req, 20000, 250);
    prisma = dbUtils._getPrisma();
    // ensure clean slate for prompts
    try {
      await prisma.aIResult.deleteMany();
      await prisma.prompt.deleteMany();
    } catch (e) {
      // ignore
    }
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {}
    if (typeof serverModule.stopServer === "function")
      await serverModule.stopServer();
    if (typeof dbUtils._resetPrisma === "function") dbUtils._resetPrisma();
  });

  it("POST /prompt concurrently should create at most one Prompt row", async () => {
    const N = 12;
    const promptText = `HTTP concurrency prompt ${Date.now()}`;

    // Fire parallel POST /prompt requests
    const calls = [];
    for (let i = 0; i < N; i++) {
      calls.push(
        req
          .post("/prompt")
          .send({ prompt: promptText })
          .set("Content-Type", "application/json")
          .timeout(15000)
          .then((r) => r)
          .catch((e) => e)
      );
    }

    const results = await Promise.all(calls);

    // Some requests may return 201 (created) or 200 with cached result; ensure none crashed
    const errored = results.filter((r) => r && r.name === "Error");
    expect(errored.length).toBe(0);

    // Verify DB only contains one prompt row with that text
    const count = await prisma.prompt.count({ where: { prompt: promptText } });
    expect(count).toBe(1);

    // Cleanup
    try {
      await prisma.prompt.deleteMany({ where: { prompt: promptText } });
    } catch (e) {}
  }, 120000);
});
