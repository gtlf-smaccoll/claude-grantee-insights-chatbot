import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { exportGoogleDoc, downloadFile } from "./google-drive";
import { DriveFileInfo } from "@/types/documents";

/**
 * Extract plain text from a PDF buffer using pdf-parse v2.
 * The v2 API uses a class-based approach with PDFParse.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Extract plain text from a Google Drive file.
 * Routes to the appropriate extraction method based on MIME type.
 */
export async function extractText(file: DriveFileInfo): Promise<string> {
  const mimeType = file.mimeType;

  // Google Docs — export as plain text via the Drive API
  if (mimeType === "application/vnd.google-apps.document") {
    return exportGoogleDoc(file.id);
  }

  // Download the file for binary formats
  const buffer = await downloadFile(file.id);

  // PDF
  if (mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  // DOCX (Microsoft Word)
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // DOC (older Word format) — mammoth can handle some of these
  if (mimeType === "application/msword") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch {
      console.warn(`Could not extract text from .doc file: ${file.name}`);
      return "";
    }
  }

  // Plain text
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf-8");
  }

  // Google Sheets — skip (we read these via the Sheets API)
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    console.warn(`Skipping spreadsheet: ${file.name}`);
    return "";
  }

  // Google Slides — skip
  if (mimeType === "application/vnd.google-apps.presentation") {
    console.warn(`Skipping presentation: ${file.name}`);
    return "";
  }

  // Images — skip
  if (mimeType.startsWith("image/")) {
    console.warn(`Skipping image: ${file.name}`);
    return "";
  }

  console.warn(`Unsupported MIME type ${mimeType} for file: ${file.name}`);
  return "";
}
