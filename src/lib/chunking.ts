import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import {
  DocumentChunk,
  ChunkMetadata,
  DocumentType,
  SectionType,
  ExtractedDocument,
} from "@/types/documents";
import { GrantRecord } from "@/types/grants";

// ============================================================
// Entry point: routes to the right chunking strategy
// ============================================================

export async function chunkDocument(
  doc: ExtractedDocument,
  grant: GrantRecord | null,
  options: { useClaudeChunking: boolean }
): Promise<DocumentChunk[]> {
  const baseMetadata = buildBaseMetadata(doc, grant);

  switch (doc.documentType) {
    case "grant_description":
      return chunkGrantDescription(doc.text, baseMetadata);

    case "midpoint_checkin_transcript":
    case "closeout_transcript":
      if (options.useClaudeChunking) {
        return chunkTranscriptWithClaude(
          doc.text,
          doc.documentType,
          baseMetadata
        );
      }
      return chunkTranscriptByParagraph(doc.text, baseMetadata);

    case "midpoint_survey":
      return chunkMidpointSurvey(doc.text, baseMetadata);

    case "impact_survey":
      return chunkImpactSurvey(doc.text, baseMetadata);

    default:
      return chunkBySize(doc.text, 1500, baseMetadata);
  }
}

// ============================================================
// Grant Description chunking — split by section headings
// ============================================================

const GRANT_DESC_SECTIONS: [RegExp, SectionType][] = [
  [/project\s+summary|executive\s+summary|overview/i, "project_summary"],
  [/scope\s+of\s+work|scope/i, "scope_of_work"],
  [/partner(ship)?s?|collaborat/i, "partnerships"],
  [/technolog|tech\s+|digital|ai\s+|software/i, "technology"],
  [/timeline|schedule|milestones|implementation\s+plan/i, "timeline"],
  [/outcome|impact|result|who\?|how\s+many|what\s+impact/i, "outcomes"],
  [/measur|evaluation|m&e|metrics|indicator/i, "measurement"],
  [/budget|financ|cost/i, "budget"],
];

function chunkGrantDescription(
  text: string,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Try to split by headings (lines that look like section headers)
  const lines = text.split("\n");
  const sections: { heading: string; sectionType: SectionType; body: string }[] = [];
  let currentHeading = "";
  let currentType: SectionType = "project_summary";
  let currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headings: short lines that are all caps, or start with #, or match known patterns
    const isHeading =
      (trimmed.length > 0 &&
        trimmed.length < 100 &&
        (trimmed === trimmed.toUpperCase() ||
          trimmed.startsWith("#") ||
          /^\d+\.\s/.test(trimmed))) &&
      trimmed.length > 2;

    if (isHeading) {
      // Save previous section
      if (currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          sectionType: currentType,
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = trimmed.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
      currentType = detectSectionType(currentHeading);
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Push the last section
  if (currentBody.length > 0) {
    sections.push({
      heading: currentHeading,
      sectionType: currentType,
      body: currentBody.join("\n").trim(),
    });
  }

  // If we found meaningful sections, use them
  if (sections.length > 1) {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (section.body.length < 20) continue; // Skip empty sections

      chunks.push(
        makeChunk(section.body, {
          ...base,
          chunk_index: i,
          section_type: section.sectionType,
          section_heading: section.heading,
        })
      );
    }
  } else {
    // Fallback: treat entire document as one chunk or split by size
    return chunkBySize(text, 2000, base);
  }

  return chunks;
}

function detectSectionType(heading: string): SectionType {
  for (const [pattern, type] of GRANT_DESC_SECTIONS) {
    if (pattern.test(heading)) return type;
  }
  return "project_summary"; // default
}

// ============================================================
// Impact Survey chunking — split by Q&A pair
// ============================================================

const IMPACT_SURVEY_SECTIONS: [RegExp, SectionType][] = [
  [/breadth|scale|reach|how\s+many|users|participants/i, "breadth_scale"],
  [/depth|outcome|impact|change|benefit|income/i, "depth_outcomes"],
  [/learn(ing)?|lesson|insight|takeaway/i, "learnings"],
  [/challeng|obstacle|barrier|difficult/i, "challenges"],
  [/future|plan|next|forward/i, "future_plans"],
  [/feedback|experience|cohort|relationship/i, "feedback"],
  [/financ|fund|invest|co-invest|budget|revenue/i, "financial"],
];

function chunkImpactSurvey(
  text: string,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Try to split by Q&A pairs (questions often start with "Q:" or a number)
  const qaPairs = splitByQuestions(text);

  if (qaPairs.length > 1) {
    for (let i = 0; i < qaPairs.length; i++) {
      const qa = qaPairs[i];
      if (qa.text.length < 20) continue;

      const sectionType = detectImpactSurveySection(qa.question);
      chunks.push(
        makeChunk(qa.text, {
          ...base,
          chunk_index: i,
          section_type: sectionType,
          section_heading: qa.question.slice(0, 200),
        })
      );
    }
  } else {
    // Fallback: split by size
    return chunkBySize(text, 1500, base);
  }

  return chunks;
}

function splitByQuestions(
  text: string
): { question: string; text: string }[] {
  // Split on patterns like "Q:", "Question X:", numbered questions, or bold question patterns
  const parts = text.split(
    /(?=^Q\d*[:.]|^Question\s+\d|^\d+[.)]\s|^#+\s)/im
  );

  return parts
    .filter((p) => p.trim().length > 0)
    .map((p) => {
      const firstNewline = p.indexOf("\n");
      const question = firstNewline > 0 ? p.slice(0, firstNewline).trim() : p.slice(0, 100).trim();
      return { question, text: p.trim() };
    });
}

function detectImpactSurveySection(question: string): SectionType {
  for (const [pattern, type] of IMPACT_SURVEY_SECTIONS) {
    if (pattern.test(question)) return type;
  }
  return "depth_outcomes"; // default
}

// ============================================================
// Midpoint Survey chunking — short docs, 4 questions
// ============================================================

const MIDPOINT_SURVEY_TYPES: SectionType[] = [
  "stage",
  "progress",
  "early_signals",
  "challenges",
];

function chunkMidpointSurvey(
  text: string,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): DocumentChunk[] {
  const qaPairs = splitByQuestions(text);

  // If 4 or fewer Q&A pairs, one chunk per question
  if (qaPairs.length > 1 && qaPairs.length <= 6) {
    return qaPairs.map((qa, i) =>
      makeChunk(qa.text, {
        ...base,
        chunk_index: i,
        section_type: MIDPOINT_SURVEY_TYPES[i] ?? "full_document",
        section_heading: qa.question.slice(0, 200),
      })
    );
  }

  // Otherwise store as a single chunk
  return [
    makeChunk(text, {
      ...base,
      chunk_index: 0,
      section_type: "full_document",
      section_heading: "Midpoint Survey",
    }),
  ];
}

// ============================================================
// Transcript chunking — pattern-based fallback (no Claude)
// ============================================================

function chunkTranscriptByParagraph(
  text: string,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): DocumentChunk[] {
  // Split into paragraphs, then group into chunks of ~1500 chars
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20);

  const chunks: DocumentChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;
  const TARGET_SIZE = 1500;

  for (const para of paragraphs) {
    if (currentLength + para.length > TARGET_SIZE && currentChunk.length > 0) {
      chunks.push(
        makeChunk(currentChunk.join("\n\n"), {
          ...base,
          chunk_index: chunkIndex,
          section_type: "progress", // generic for non-Claude chunking
          section_heading: `Transcript segment ${chunkIndex + 1}`,
        })
      );
      chunkIndex++;
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(para);
    currentLength += para.length;
  }

  // Push remaining
  if (currentChunk.length > 0) {
    chunks.push(
      makeChunk(currentChunk.join("\n\n"), {
        ...base,
        chunk_index: chunkIndex,
        section_type: "progress",
        section_heading: `Transcript segment ${chunkIndex + 1}`,
      })
    );
  }

  return chunks;
}

// ============================================================
// Transcript chunking — Claude-assisted (Haiku)
// ============================================================

interface TranscriptSegment {
  topic_label: string;
  heading: string;
  text: string;
}

interface ClaudeTranscriptResult {
  segments: TranscriptSegment[];
  summary: string;
}

async function chunkTranscriptWithClaude(
  text: string,
  documentType: DocumentType,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): Promise<DocumentChunk[]> {
  const isCloseout = documentType === "closeout_transcript";
  const summaryLength = isCloseout ? "500-1000" : "300-500";

  // Truncate very long transcripts to avoid token limits
  const maxChars = 100000;
  const truncatedText =
    text.length > maxChars ? text.slice(0, maxChars) + "\n\n[TRUNCATED]" : text;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("No ANTHROPIC_API_KEY — falling back to paragraph chunking");
    return chunkTranscriptByParagraph(text, base);
  }

  const anthropic = createAnthropic({
    baseURL: "https://api.anthropic.com/v1",
    apiKey,
    headers: { "x-api-key": apiKey },
  });

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt: `You are processing a ${isCloseout ? "closeout" : "midpoint check-in"} transcript between GitLab Foundation program officers and a grantee organization.

Your tasks:
1. Identify where the substantive discussion begins (skip greetings, small talk, scheduling, weather, personal catch-up).
2. Identify where substantive discussion ends (skip goodbyes, scheduling next call).
3. Segment the substantive middle into topic blocks. For each block, provide:
   - topic_label: one of ["progress", "challenges", "pivots", "data_measurement", "org_changes", "future_plans", "support_requests", "notable_quotes"]
   - heading: a descriptive 5-10 word heading summarizing the topic
   - text: the full text of that segment (preserve speaker names/attribution)
4. Generate a ${summaryLength} word summary of the key takeaways.

Return ONLY valid JSON (no markdown code fences, no other text):
{
  "segments": [
    { "topic_label": "...", "heading": "...", "text": "..." }
  ],
  "summary": "..."
}

TRANSCRIPT:
${truncatedText}`,
      maxOutputTokens: 8000,
    });

    const parsed = JSON.parse(result.text) as ClaudeTranscriptResult;
    const chunks: DocumentChunk[] = [];

    // Create a chunk for each topic segment
    for (let i = 0; i < parsed.segments.length; i++) {
      const segment = parsed.segments[i];
      const sectionType = mapTopicLabel(segment.topic_label);

      chunks.push(
        makeChunk(segment.text, {
          ...base,
          chunk_index: i,
          section_type: sectionType,
          section_heading: segment.heading,
        })
      );
    }

    // Add the summary as an additional chunk
    if (parsed.summary) {
      chunks.push(
        makeChunk(parsed.summary, {
          ...base,
          chunk_index: parsed.segments.length,
          section_type: "transcript_summary",
          section_heading: `${isCloseout ? "Closeout" : "Midpoint"} Transcript Summary`,
        })
      );
    }

    return chunks;
  } catch (error) {
    console.error("Claude chunking failed, falling back to paragraph chunking:", error);
    return chunkTranscriptByParagraph(text, base);
  }
}

function mapTopicLabel(label: string): SectionType {
  const mapping: Record<string, SectionType> = {
    progress: "progress",
    challenges: "challenges",
    pivots: "pivots",
    data_measurement: "data_measurement",
    org_changes: "org_changes",
    future_plans: "future_plans",
    support_requests: "support_requests",
    notable_quotes: "notable_quotes",
  };
  return mapping[label] ?? "progress";
}

// ============================================================
// Generic size-based chunking (fallback)
// ============================================================

function chunkBySize(
  text: string,
  maxChars: number,
  base: Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading">
): DocumentChunk[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: DocumentChunk[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (currentLength + para.length > maxChars && currentChunk.length > 0) {
      chunks.push(
        makeChunk(currentChunk.join("\n\n"), {
          ...base,
          chunk_index: chunkIndex,
          section_type: "full_document",
          section_heading: `Section ${chunkIndex + 1}`,
        })
      );
      chunkIndex++;
      currentChunk = [];
      currentLength = 0;
    }
    currentChunk.push(para);
    currentLength += para.length;
  }

  if (currentChunk.length > 0) {
    chunks.push(
      makeChunk(currentChunk.join("\n\n"), {
        ...base,
        chunk_index: chunkIndex,
        section_type: "full_document",
        section_heading: `Section ${chunkIndex + 1}`,
      })
    );
  }

  // If no paragraphs were found, store the whole thing
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(
      makeChunk(text, {
        ...base,
        chunk_index: 0,
        section_type: "full_document",
        section_heading: "Full Document",
      })
    );
  }

  return chunks;
}

// ============================================================
// Helper: build base metadata from document + grant
// ============================================================

function buildBaseMetadata(
  doc: ExtractedDocument,
  grant: GrantRecord | null
): Omit<ChunkMetadata, "chunk_index" | "chunk_uid" | "section_type" | "section_heading"> {
  return {
    reference_number: doc.referenceNumber ?? grant?.reference_number ?? "",
    grantee_id: grant?.grantee_id ?? 0,
    grantee_name: doc.granteeName ?? grant?.grantee_name ?? "",
    grantee_country: grant?.grantee_country ?? "",
    state: grant?.state ?? "",
    program_officer: grant?.program_officer ?? "",
    rfp: grant?.rfp ?? "",
    grant_portfolio_type: grant?.grant_portfolio_type ?? "",
    intervention_area_primary: grant?.intervention_area_primary ?? "",
    intervention_area_secondary: grant?.intervention_area_secondary ?? "",
    impact_pathway: grant?.impact_pathway ?? "",
    labor_market_sector: grant?.labor_market_sector ?? "",
    project_mechanism: grant?.project_mechanism ?? "",
    primary_population_focus: grant?.primary_population_focus ?? "",
    grant_amount: grant?.grant_amount ?? null,
    grant_title: grant?.grant_title ?? "",
    active: grant?.active ?? false,
    fiscal_year: grant?.fiscal_year ?? null,

    document_type: doc.documentType,
    document_date: doc.file.modifiedTime,
    source_file: doc.file.name,
    drive_url: doc.file.webViewLink ?? "",

    roi: grant?.roi_lifetime_income_gain ?? null,
    people_served: grant?.estimated_total_people_served ?? null,
    cost_per_person: grant?.cost_per_person ?? null,
    income_change_pct: grant?.pct_change_in_annual_income ?? null,
  };
}

// ============================================================
// Helper: create a DocumentChunk with a unique ID
// ============================================================

let chunkCounter = 0;

function makeChunk(
  text: string,
  metadata: Omit<ChunkMetadata, "chunk_uid"> & { chunk_index: number; section_type: SectionType; section_heading: string }
): DocumentChunk {
  chunkCounter++;
  const uid = `chunk_${Date.now()}_${chunkCounter}`;

  return {
    chunkUid: uid,
    text,
    metadata: {
      ...metadata,
      chunk_uid: uid,
    },
  };
}
