// Simple PDF mock used for tests when a real browser is unavailable.
// Returns a minimal valid-ish PDF buffer that includes a /Font marker so
// basic heuristics and lightweight validators pass.
const DEFAULT_PDF = `
%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Mock PDF) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
`;

async function generatePdfBuffer({ title, body, browser, validate } = {}) {
  // ignore inputs for the mock; return a small PDF buffer. If the caller
  // requests validation, return an object matching the real generator
  // contract: { buffer, validation }
  const buffer = Buffer.from(DEFAULT_PDF, "utf8");
  if (validate) {
    const validation = await validatePdfBuffer(buffer);
    return { buffer, validation };
  }
  return buffer;
}

async function validatePdfBuffer(buffer) {
  // Basic validator used by tests: report ok and pageCount=1
  return { ok: true, errors: [], warnings: [], pageCount: 1 };
}

module.exports = { generatePdfBuffer, validatePdfBuffer };
