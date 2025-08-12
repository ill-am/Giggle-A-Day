import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

const baseUrl = "http://localhost:3000";

describe("API: /prompt (AI Processing Layer)", () => {
  let createdPromptIds = [];
  let createdResultIds = [];

  // Verify server is running before tests
  beforeAll(async () => {
    try {
      const res = await request(baseUrl).get("/health");
      expect(res.status).toBe(200);
    } catch (error) {
      throw new Error("Server must be running on " + baseUrl);
    }
  });

  // Cleanup test data
  afterAll(async () => {
    // Clean up AI results first (foreign key constraint)
    for (const id of createdResultIds) {
      try {
        await request(baseUrl).delete(`/api/ai_results/${id}`);
      } catch (error) {
        console.warn("Cleanup failed for AI result:", id);
      }
    }
    // Then clean up prompts
    for (const id of createdPromptIds) {
      try {
        await request(baseUrl).delete(`/api/prompts/${id}`);
      } catch (error) {
        console.warn("Cleanup failed for prompt:", id);
      }
    }
  });

  it("should return a structured AI response for a valid prompt", async () => {
    const testPrompt = "Write a poem about the sea.";
    const res = await request(baseUrl)
      .post("/prompt")
      .send({ prompt: testPrompt });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("data");

    const { data } = res.body;
    expect(data).toHaveProperty("content");
    expect(data).toHaveProperty("metadata");
    expect(data).toHaveProperty("promptId");
    expect(data).toHaveProperty("resultId");

    // Content validation
    expect(data.content).toHaveProperty("title");
    expect(data.content).toHaveProperty("body");
    expect(data.content).toHaveProperty("layout");
    expect(typeof data.content.body).toBe("string");
    expect(data.content.body.length).toBeGreaterThan(0);

    // Metadata validation
    expect(data.metadata).toHaveProperty("model", "mock-1");
    expect(data.metadata).toHaveProperty("tokens");

    // Store IDs for cleanup
    createdPromptIds.push(res.body.data.promptId);
    createdResultIds.push(res.body.data.resultId);

    // Verify prompt storage
    const storedPrompt = await request(baseUrl).get(
      `/api/prompts/${res.body.data.promptId}`
    );
    expect(storedPrompt.status).toBe(200);
    expect(storedPrompt.body).toHaveProperty("prompt", testPrompt);

    // Verify AI result storage
    const storedResult = await request(baseUrl).get(
      `/api/ai_results/${res.body.data.resultId}`
    );
    expect(storedResult.status).toBe(200);
    expect(storedResult.body).toHaveProperty("result");
    expect(storedResult.body.result).toEqual(res.body.data.content);
  });

  it("should return 400 for missing or empty prompt", async () => {
    const res = await request(baseUrl).post("/prompt").send({ prompt: "   " });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("status", 400);
    expect(res.body.error).toHaveProperty("timestamp");
    expect(res.body.error).toHaveProperty("requestId");
    expect(res.body.error).toHaveProperty("details");
  });

  it("should return 400 for missing prompt field", async () => {
    const res = await request(baseUrl).post("/prompt").send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("status", 400);
    expect(res.body.error.details).toHaveProperty("provided");
    expect(res.body.error.details).toHaveProperty("required");
  });

  it("should return 400 for invalid prompt type", async () => {
    const res = await request(baseUrl)
      .post("/prompt")
      .send({ prompt: { invalid: "object" } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error.details).toHaveProperty("provided", "object");
    expect(res.body.error.details).toHaveProperty(
      "required",
      "non-empty string"
    );
  });
});
