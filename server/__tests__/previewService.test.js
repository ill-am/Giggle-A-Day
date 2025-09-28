const { describe, it, expect } = require("vitest");
const previewService = require("../previewService");

describe("PreviewService", () => {
  describe("generateHtml", () => {
    it("generates HTML preview for poem layout", async () => {
      const content = {
        title: "Test Poem",
        body: "Line 1\\nLine 2\\nLine 3",
        layout: "poem-single-column",
      };

      const html = await previewService.generateHtml(content);

      // Should create proper poem structure
      expect(html).toContain('<div class="poem-layout">');
      expect(html).toContain("<h1>Test Poem</h1>");
      expect(html).toMatch(/<p>Line 1<\/p>/);
      expect(html).toMatch(/<p>Line 2<\/p>/);
      expect(html).toMatch(/<p>Line 3<\/p>/);
    });

    it("generates HTML preview for dev layout", async () => {
      const content = {
        title: "Dev Test",
        body: "Test content",
        layout: "dev",
      };

      const html = await previewService.generateHtml(content);

      expect(html).toContain('<div class="dev-layout">');
      expect(html).toContain("<h2>Dev Test</h2>");
      expect(html).toContain("<pre>Test content</pre>");
    });

    it("generates HTML preview for default layout", async () => {
      const content = {
        title: "Default Test",
        body: "Test content",
      };

      const html = await previewService.generateHtml(content);

      expect(html).toContain('<div class="default-layout">');
      expect(html).toContain("<h1>Default Test</h1>");
      expect(html).toContain("Test content");
    });

    it("escapes HTML in content", async () => {
      const content = {
        title: '<script>alert("xss")</script>',
        body: '<img src="x" onerror="alert(1)">',
        layout: "default",
      };

      const html = await previewService.generateHtml(content);

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("onerror=");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&lt;img");
    });

    it("throws error for missing content", async () => {
      await expect(previewService.generateHtml(undefined)).rejects.toThrow(
        "Preview content must include title and body"
      );
    });

    it("throws error for empty content", async () => {
      const content = {
        title: "",
        body: "",
      };

      await expect(previewService.generateHtml(content)).rejects.toThrow(
        "Title and body cannot be empty"
      );
    });
  });
});
