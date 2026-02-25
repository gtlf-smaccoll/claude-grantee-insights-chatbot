import { DocumentType, ParsedFilename } from "@/types/documents";

/**
 * Patterns to detect document types from filename substrings.
 * Ordered from most specific to least specific — first match wins.
 */
const DOC_TYPE_PATTERNS: [RegExp, DocumentType][] = [
  // Grant descriptions
  [/grant\s*desc/i, "grant_description"],
  [/grant\s*proposal/i, "grant_description"],
  [/project\s*desc/i, "grant_description"],

  // Midpoint check-in transcripts
  [/midpoint.*transcript/i, "midpoint_checkin_transcript"],
  [/mid.*check.*in.*transcript/i, "midpoint_checkin_transcript"],
  [/checkin.*transcript/i, "midpoint_checkin_transcript"],
  [/check.*in.*transcript/i, "midpoint_checkin_transcript"],

  // Midpoint surveys (structured, only 14 AIEO 2.0 grants)
  [/midpoint.*survey/i, "midpoint_survey"],
  [/mid.*survey/i, "midpoint_survey"],

  // Annual impact surveys / reports
  [/impact.*survey/i, "impact_survey"],
  [/annual.*survey/i, "impact_survey"],
  [/impact.*report/i, "impact_survey"],
  [/annual.*report/i, "impact_survey"],

  // Closeout transcripts
  [/closeout.*transcript/i, "closeout_transcript"],
  [/close.*out.*transcript/i, "closeout_transcript"],
  [/closeout/i, "closeout_transcript"],
  [/close.*out/i, "closeout_transcript"],

  // Generic fallbacks (less specific)
  [/check.*in/i, "midpoint_checkin_transcript"],
  [/checkin/i, "midpoint_checkin_transcript"],
  [/transcript/i, "midpoint_checkin_transcript"],
  [/survey/i, "impact_survey"],
];

/**
 * Reference numbers follow the pattern: 20XXXXX with an optional letter suffix.
 * Examples: "2025067", "2023001A", "2024010B", "2026044"
 * We use a lookahead instead of \b because _ is a word char and
 * filenames often have the format "2025067_GranteeName_..."
 */
const REF_NUMBER_PATTERN = /(?:^|[^0-9])(20[2-3]\d{4}[A-Z]?)(?=[^0-9]|$)/;

/**
 * Parse a filename to extract reference number, grantee name, and document type.
 * Filenames follow conventions like:
 *   {ReferenceNumber}_{GranteeName}_{RFP}_{DocumentType}.pdf
 *   {GranteeName}_MidCheckInTranscript_{Year}.docx
 *
 * This is a best-effort parser — not all filenames will match perfectly.
 * The ingestion pipeline logs unmatched files for manual review.
 */
export function parseFilename(filename: string): ParsedFilename {
  // Extract reference number
  const refMatch = filename.match(REF_NUMBER_PATTERN);
  const referenceNumber = refMatch ? refMatch[1] : null;

  // Detect document type from filename keywords
  let documentType: DocumentType | null = null;
  for (const [pattern, type] of DOC_TYPE_PATTERNS) {
    if (pattern.test(filename)) {
      documentType = type;
      break;
    }
  }

  // Extract grantee name from the filename
  const granteeName = extractGranteeName(filename, referenceNumber);

  return { referenceNumber, granteeName, documentType };
}

/**
 * Attempt to extract the grantee name from a filename.
 * This is heuristic — we strip the reference number, document type keywords,
 * file extension, and common separators, then take what's left.
 */
function extractGranteeName(
  filename: string,
  referenceNumber: string | null
): string | null {
  // Remove file extension
  let name = filename.replace(/\.\w+$/, "");

  // Remove reference number if present
  if (referenceNumber) {
    name = name.replace(referenceNumber, "");
  }

  // Remove common document type keywords
  const removePatterns = [
    /grant\s*desc(ription)?/gi,
    /midpoint/gi,
    /check\s*-?\s*in/gi,
    /transcript/gi,
    /survey/gi,
    /closeout/gi,
    /close\s*out/gi,
    /impact\s*report/gi,
    /annual\s*report/gi,
    /annual/gi,
    /mid\s*year/gi,
  ];
  for (const pattern of removePatterns) {
    name = name.replace(pattern, "");
  }

  // Remove years (2020-2029)
  name = name.replace(/\b20[2-3]\d\b/g, "");

  // Clean up separators and whitespace
  name = name
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If nothing meaningful is left, return null
  if (name.length < 3) return null;

  return name;
}
