process.env.PDF_GENERATOR_IMPL = "mock";
const { describe, it, expect } = require("vitest");
const genieService = require("../genieService");
const envelope = require("./fixtures/canonical-envelope.json");

describe("genieService.export (envelope)", () => {
  it("forwards canonical envelope to pdfGenerator and returns buffer+validation", async () => {
    const res = await genieService.export({ envelope, validate: true });
    expect(res).toBeDefined();
    expect(res.buffer || res).toBeDefined();
    // When validate=true mock returns { buffer, validation }
    const validation = res.validation || (res.buffer && res.validation);
    expect(res.validation).toBeDefined();
    expect(res.validation.ok).toBe(true);
  });
});
