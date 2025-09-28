class PreviewService {
  constructor() {
    // Could add configuration options here
    this.defaultLayout = "poem-single-column";
  }

  /**
   * Generate HTML preview from content
   * @param {Object} content - Content to generate preview from
   * @param {string} content.title - Content title
   * @param {string} content.body - Content body
   * @param {string} [content.layout] - Optional layout template
   * @returns {Promise<string>} Generated HTML preview
   */
  async generateHtml(content) {
    if (!content || !content.title || !content.body) {
      throw new Error("Preview content must include title and body");
    }

    // Use provided layout or default
    const layout = content.layout || this.defaultLayout;

    // Basic validation of content
    const title = String(content.title).trim();
    const body = String(content.body).trim();
    if (!title || !body) {
      throw new Error("Title and body cannot be empty");
    }

    // Generate preview HTML based on layout
    switch (layout) {
      case "poem-single-column":
        return this.generatePoemLayout(title, body);
      case "dev":
        return this.generateDevLayout(title, body);
      default:
        return this.generateDefaultLayout(title, body);
    }
  }

  /**
   * Generate poem layout HTML
   * @private
   */
  generatePoemLayout(title, body) {
    return `
      <div class="poem-layout">
        <h1>${this.escapeHtml(title)}</h1>
        <div class="poem-content">
          ${this.formatPoemBody(body)}
        </div>
      </div>
    `.trim();
  }

  /**
   * Generate dev layout HTML
   * @private
   */
  generateDevLayout(title, body) {
    return `
      <div class="dev-layout">
        <h2>${this.escapeHtml(title)}</h2>
        <pre>${this.escapeHtml(body)}</pre>
      </div>
    `.trim();
  }

  /**
   * Generate default layout HTML
   * @private
   */
  generateDefaultLayout(title, body) {
    return `
      <div class="default-layout">
        <h1>${this.escapeHtml(title)}</h1>
        <div class="content">
          ${this.escapeHtml(body)}
        </div>
      </div>
    `.trim();
  }

  /**
   * Format poem body with proper line breaks
   * @private
   */
  formatPoemBody(body) {
    return body
      .split("\\n")
      .map((line) => `<p>${this.escapeHtml(line)}</p>`)
      .join("\\n");
  }

  /**
   * Basic HTML escaping
   * @private
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

module.exports = new PreviewService();
