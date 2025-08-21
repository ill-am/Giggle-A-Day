/// <reference types="jest" />
import { exportCalendarToPDF, PDFExportOptions } from "@utils/pdfExport";
import { PDFDocument, PageSizes } from "pdf-lib";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

// Create a minimal valid PNG buffer (1x1 pixel, black)
const mockPngBuffer = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44,
  0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5, 0x27,
  0xde, 0x48, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
  0x82,
]);

describe("PDF Export Utils", () => {
  const mockOptions: PDFExportOptions = {
    year: 2025,
    selectedMonths: ["January", "February"],
    events: [
      { date: "2025-01-01", title: "New Year" },
      { date: "2025-02-14", title: "Valentine's Day" },
    ],
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a PDF document with correct size and structure", async () => {
    const result = await exportCalendarToPDF(mockOptions);
    const pdfDoc = await PDFDocument.load(result);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const [expectedWidth, expectedHeight] = PageSizes.A3;
    expect(Math.abs(width - expectedWidth)).toBeLessThan(0.5);
    expect(Math.abs(height - expectedHeight)).toBeLessThan(0.5);
    expect(pdfDoc.getPages()).toHaveLength(1);

    const pdfBytes = await pdfDoc.save();
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it("should handle background image loading by calling fetch", async () => {
    const options = {
      ...mockOptions,
      backgroundUrl: "data:image/png;base64,fake",
    };

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      Promise.resolve({
        arrayBuffer: () => Promise.resolve(mockPngBuffer.buffer),
      }) as unknown as Response
    );

    await exportCalendarToPDF(options);
    expect(fetchSpy).toHaveBeenCalledWith(options.backgroundUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should generate PDF with all required content", async () => {
    const result = await exportCalendarToPDF(mockOptions);
    // Write PDF to a temp file and extract text using the repository extractor script
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp-pdf-"));
    const tmpPdf = path.join(tmpDir, "out.pdf");
    fs.writeFileSync(tmpPdf, result);

    const extractor = path.resolve(
      __dirname,
      "../../server/scripts/extract-pdf-text.js"
    );
    const out = execFileSync(process.execPath, [extractor, tmpPdf], {
      encoding: "utf8",
    });

    // Basic assertions on extracted text
    expect(out).toContain("2025");
    mockOptions.selectedMonths.forEach((month: string) => {
      expect(out).toContain(month);
    });
    mockOptions.events.forEach((event: { date: string; title: string }) => {
      expect(out).toContain(event.title);
    });
  });

  it("should handle different month and event selections", async () => {
    const options = {
      ...mockOptions,
      selectedMonths: ["March"],
      events: [{ date: "2025-03-15", title: "Special Test Event" }],
    };

    const result = await exportCalendarToPDF(options);
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp-pdf-"));
    const tmpPdf = path.join(tmpDir, "out.pdf");
    fs.writeFileSync(tmpPdf, result);

    const extractor = path.resolve(
      __dirname,
      "../../server/scripts/extract-pdf-text.js"
    );
    const out = execFileSync(process.execPath, [extractor, tmpPdf], {
      encoding: "utf8",
    });

    // Check for included content
    expect(out).toContain("March");
    expect(out).toContain("Special Test Event");

    // Check for excluded content
    expect(out).not.toContain("January");
    expect(out).not.toContain("Valentine's Day");
  });
});
