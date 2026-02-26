import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { searchChunks } from "@/lib/vector-store";
import { GrantRecord, GrantSummaryCard, PeerInsights } from "@/types/grants";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  if (!process.env.PINECONE_API_KEY) {
    return NextResponse.json(
      { error: "Vector store not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { sourceGrant, sourceSummary, similarRefs } = body as {
      sourceGrant: GrantRecord;
      sourceSummary: GrantSummaryCard | null;
      similarRefs: string[];
    };

    if (!sourceGrant || !similarRefs || similarRefs.length === 0) {
      return NextResponse.json(
        { error: "Source grant and similar grant references are required" },
        { status: 400 }
      );
    }

    // Limit to top 5 similar grants
    const refs = similarRefs.slice(0, 5);

    // Retrieve document chunks from similar grants focused on challenges, outcomes, and learnings
    const chunks = await searchChunks(
      "challenges outcomes learnings progress what worked what didn't succeed fail pivots recommendations",
      { reference_number: refs },
      25
    );

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No document content found for similar grants" },
        { status: 404 }
      );
    }

    // Format chunks for the prompt
    const chunksText = chunks
      .map((r, i) => {
        const m = r.chunk.metadata;
        return `--- Excerpt ${i + 1} [${m.grantee_name} | ${m.document_type} / ${m.section_type}] ---\n${r.chunk.text.slice(0, 2000)}`;
      })
      .join("\n\n");

    // Collect source grant names from chunks
    const sourceGrantNames = [
      ...new Set(chunks.map((r) => r.chunk.metadata.grantee_name)),
    ];

    const anthropic = createAnthropic({
      baseURL: "https://api.anthropic.com/v1",
      apiKey,
      headers: { "x-api-key": apiKey },
    });

    const sourceProfile = {
      name: sourceGrant.grantee_name,
      country: sourceGrant.grantee_country,
      intervention: sourceGrant.intervention_area_primary,
      population: sourceGrant.primary_population_focus,
      impact_pathway: sourceGrant.impact_pathway,
      project_mechanism: sourceGrant.project_mechanism,
      one_liner: sourceSummary?.one_liner || null,
      project_summary: sourceSummary?.project_summary || null,
    };

    const prompt = `You are advising a program officer at the GitLab Foundation. They manage **${sourceGrant.grantee_name}**, which works on ${sourceGrant.intervention_area_primary} for ${sourceGrant.primary_population_focus} populations in ${sourceGrant.grantee_country}.

## Current Grantee Profile:
${JSON.stringify(sourceProfile, null, 2)}

## Document Excerpts from Similar Grants:
These are excerpts from midpoint check-ins, closeout transcripts, and impact surveys of grants with similar interventions, populations, or approaches.

${chunksText}

Based on what these similar grantees experienced, synthesize practical guidance for the program officer. Focus on REAL, SPECIFIC insights drawn from the documents above — not generic advice.

Generate a JSON response:
- challenges_faced: Array of 3-5 key challenges that similar grantees encountered. Be specific — cite the type of challenge and which grantee(s) faced it.
- what_worked: Array of 3-5 approaches or strategies that led to success for similar grantees. Reference specific tactics from the documents.
- practical_advice: Array of 3-5 actionable recommendations the program officer can share with ${sourceGrant.grantee_name}. Each should be concrete and informed by what similar grantees learned.
- source_grants: Array of grantee names whose documents you drew from.

Return ONLY valid JSON (no markdown code fences, no commentary):
{
  "challenges_faced": ["...", "..."],
  "what_worked": ["...", "..."],
  "practical_advice": ["...", "..."],
  "source_grants": ["...", "..."]
}`;

    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxOutputTokens: 2000,
    });

    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text) as PeerInsights;

    const insights: PeerInsights = {
      challenges_faced: Array.isArray(parsed.challenges_faced)
        ? parsed.challenges_faced
        : [],
      what_worked: Array.isArray(parsed.what_worked)
        ? parsed.what_worked
        : [],
      practical_advice: Array.isArray(parsed.practical_advice)
        ? parsed.practical_advice
        : [],
      source_grants: Array.isArray(parsed.source_grants)
        ? parsed.source_grants
        : sourceGrantNames,
    };

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Peer insights generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate peer insights" },
      { status: 500 }
    );
  }
}
