import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { GrantRecord, GrantSummaryCard } from "@/types/grants";
import {
  searchChunks,
  fetchSummaryCard,
  upsertSummaryCard,
} from "./vector-store";

// In-memory guard to prevent duplicate Claude calls for the same grant
const inflightGenerations = new Map<string, Promise<GrantSummaryCard>>();

/**
 * Get or generate a summary card for a grant.
 * Checks Pinecone cache first, generates with Claude Haiku on cache miss.
 */
export async function getOrGenerateSummary(
  referenceNumber: string,
  grant: GrantRecord
): Promise<GrantSummaryCard> {
  // 1. Check Pinecone cache
  const cached = await fetchSummaryCard(referenceNumber);
  if (cached) {
    console.log(`Summary cache hit for ${referenceNumber}`);
    return cached;
  }

  // 2. Check if generation is already in flight (same serverless instance)
  const existing = inflightGenerations.get(referenceNumber);
  if (existing) {
    console.log(`Summary generation already in flight for ${referenceNumber}`);
    return existing;
  }

  // 3. Generate and cache
  console.log(`Generating summary for ${referenceNumber} (${grant.grantee_name})`);
  const promise = generateAndCache(referenceNumber, grant);
  inflightGenerations.set(referenceNumber, promise);

  try {
    return await promise;
  } finally {
    inflightGenerations.delete(referenceNumber);
  }
}

async function generateAndCache(
  referenceNumber: string,
  grant: GrantRecord
): Promise<GrantSummaryCard> {
  // Retrieve document chunks for this grant
  let chunks: { text: string; documentType: string; sectionType: string }[] = [];
  const documentTypesUsed = new Set<string>();

  try {
    const results = await searchChunks(
      "project summary outcomes challenges findings progress impact",
      { reference_number: referenceNumber },
      20
    );

    chunks = results.map((r) => {
      documentTypesUsed.add(r.chunk.metadata.document_type);
      return {
        text: r.chunk.text.slice(0, 2000),
        documentType: r.chunk.metadata.document_type,
        sectionType: r.chunk.metadata.section_type,
      };
    });
  } catch (error) {
    console.warn(`Failed to retrieve chunks for ${referenceNumber}:`, error);
    // Continue with spreadsheet data only
  }

  const hasDocuments = chunks.length > 0;

  // Build the prompt
  const summary = await callClaude(grant, chunks, hasDocuments);

  // Assemble the full card
  const card: GrantSummaryCard = {
    reference_number: referenceNumber,
    grantee_name: grant.grantee_name,
    one_liner: summary.one_liner,
    project_summary: summary.project_summary,
    key_findings: summary.key_findings,
    challenges: summary.challenges,
    outcomes_summary: summary.outcomes_summary,
    current_status: summary.current_status,
    follow_on_plans: summary.follow_on_plans,
    metrics: {
      grant_amount: grant.grant_amount,
      people_served: grant.estimated_total_people_served,
      roi: grant.roi_lifetime_income_gain,
      income_change_pct: grant.pct_change_in_annual_income,
      cost_per_person: grant.cost_per_person,
      co_investment: grant.additional_co_investment_amounts,
    },
    generated_at: new Date().toISOString(),
    has_documents: hasDocuments,
    document_types_used: Array.from(documentTypesUsed),
  };

  // Cache in Pinecone
  const textRepresentation = buildTextRepresentation(card);
  try {
    await upsertSummaryCard(card, textRepresentation);
    console.log(`Cached summary for ${referenceNumber}`);
  } catch (error) {
    console.warn(`Failed to cache summary for ${referenceNumber}:`, error);
    // Still return the card even if caching fails
  }

  return card;
}

interface ClaudeSummaryResult {
  one_liner: string;
  project_summary: string;
  key_findings: string[];
  challenges: string[];
  outcomes_summary: string;
  current_status: string;
  follow_on_plans: string;
}

async function callClaude(
  grant: GrantRecord,
  chunks: { text: string; documentType: string; sectionType: string }[],
  hasDocuments: boolean
): Promise<ClaudeSummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const anthropic = createAnthropic({
    baseURL: "https://api.anthropic.com/v1",
    apiKey,
    headers: { "x-api-key": apiKey },
  });

  // Format grant data
  const grantData = {
    name: grant.grantee_name,
    title: grant.grant_title,
    country: grant.grantee_country,
    state: grant.state,
    rfp: grant.rfp,
    portfolio_type: grant.grant_portfolio_type,
    intervention: grant.intervention_area_primary,
    population: grant.primary_population_focus,
    amount: grant.grant_amount,
    people_served: grant.estimated_total_people_served,
    roi: grant.roi_lifetime_income_gain,
    income_change_pct: grant.pct_change_in_annual_income,
    cost_per_person: grant.cost_per_person,
    co_investment: grant.additional_co_investment_amounts,
    active: grant.active,
    start_date: grant.grant_start_date,
    close_date: grant.grant_close_date,
    impact_pathway: grant.impact_pathway,
    project_mechanism: grant.project_mechanism,
    evidence_quality: grant.evidence_quality_assessment,
    execution_risk: grant.execution_risk,
  };

  // Format document chunks
  const chunksText = hasDocuments
    ? chunks
        .map(
          (c, i) =>
            `--- Document ${i + 1} [${c.documentType} / ${c.sectionType}] ---\n${c.text}`
        )
        .join("\n\n")
    : "No documents available. Generate summary from structured data only.";

  const prompt = `You are synthesizing a grant summary card for the GitLab Foundation.

## Structured Grant Data (from spreadsheet):
${JSON.stringify(grantData, null, 2)}

## Retrieved Document Excerpts:
${chunksText}

Generate a JSON summary card with these fields:
- one_liner: Single sentence (max 20 words) capturing the project's essence and impact focus
- project_summary: 2-3 sentences describing the project approach, target population, and intended outcomes
- key_findings: Array of 3-5 key findings from documents. ${hasDocuments ? "Draw from actual document content." : "Use expected outcomes from the structured data."} Each finding should be a concise sentence.
- challenges: Array of top challenges encountered. ${hasDocuments ? "Draw from transcripts and surveys." : "Return empty array if no document data."} Each challenge should be a concise sentence.
- outcomes_summary: Plain-language paragraph (2-3 sentences) describing key metrics and outcomes. Include specific numbers where available.
- current_status: One of "Active", "Completed", or "Early Stage" — based on the active flag and dates.
- follow_on_plans: One sentence about what's next. ${hasDocuments ? "Draw from documents." : "Return empty string if unknown."}

Return ONLY valid JSON (no markdown code fences, no commentary):
{
  "one_liner": "...",
  "project_summary": "...",
  "key_findings": ["...", "..."],
  "challenges": ["...", "..."],
  "outcomes_summary": "...",
  "current_status": "...",
  "follow_on_plans": "..."
}`;

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxOutputTokens: 2000,
    });

    // Clean up response — sometimes Claude wraps in ```json
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text) as ClaudeSummaryResult;

    // Validate the shape
    return {
      one_liner: parsed.one_liner || "",
      project_summary: parsed.project_summary || "",
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      outcomes_summary: parsed.outcomes_summary || "",
      current_status: parsed.current_status || (grant.active ? "Active" : "Completed"),
      follow_on_plans: parsed.follow_on_plans || "",
    };
  } catch (error) {
    console.error(`Claude summary generation failed for ${grant.reference_number}:`, error);

    // Return a minimal fallback from spreadsheet data
    return {
      one_liner: `${grant.grantee_name} — ${grant.intervention_area_primary} in ${grant.grantee_country}`,
      project_summary: grant.grant_title || `Grant focused on ${grant.intervention_area_primary} for ${grant.primary_population_focus} populations.`,
      key_findings: [],
      challenges: [],
      outcomes_summary: grant.estimated_total_people_served
        ? `Estimated to serve ${grant.estimated_total_people_served.toLocaleString()} people.`
        : "Outcome data not yet available.",
      current_status: grant.active ? "Active" : "Completed",
      follow_on_plans: "",
    };
  }
}

export function buildTextRepresentation(card: GrantSummaryCard): string {
  const parts = [
    `Grant Summary: ${card.grantee_name} (${card.reference_number})`,
    card.one_liner,
    card.project_summary,
  ];

  if (card.key_findings.length > 0) {
    parts.push("Key Findings: " + card.key_findings.join(". "));
  }
  if (card.challenges.length > 0) {
    parts.push("Challenges: " + card.challenges.join(". "));
  }
  if (card.outcomes_summary) {
    parts.push("Outcomes: " + card.outcomes_summary);
  }
  if (card.follow_on_plans) {
    parts.push("Next Steps: " + card.follow_on_plans);
  }

  return parts.join("\n\n");
}
