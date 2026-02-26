import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { GrantRecord, GrantSummaryCard, IntroductionRationale } from "@/types/grants";

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

  try {
    const body = await req.json();
    const { sourceGrant, sourceSummary, targetGrant, targetSummary } = body as {
      sourceGrant: GrantRecord;
      sourceSummary: GrantSummaryCard | null;
      targetGrant: GrantRecord;
      targetSummary: GrantSummaryCard | null;
    };

    if (!sourceGrant || !targetGrant) {
      return NextResponse.json(
        { error: "Both source and target grants are required" },
        { status: 400 }
      );
    }

    const anthropic = createAnthropic({
      baseURL: "https://api.anthropic.com/v1",
      apiKey,
      headers: { "x-api-key": apiKey },
    });

    const buildProfile = (g: GrantRecord, s: GrantSummaryCard | null) => ({
      name: g.grantee_name,
      country: g.grantee_country,
      intervention: g.intervention_area_primary,
      population: g.primary_population_focus,
      impact_pathway: g.impact_pathway,
      project_mechanism: g.project_mechanism,
      labor_market_sector: g.labor_market_sector,
      portfolio_type: g.grant_portfolio_type,
      active: g.active,
      one_liner: s?.one_liner || null,
      project_summary: s?.project_summary || null,
      key_findings: s?.key_findings || [],
      challenges: s?.challenges || [],
      outcomes_summary: s?.outcomes_summary || null,
      follow_on_plans: s?.follow_on_plans || null,
    });

    const prompt = `You are a grants portfolio advisor for the GitLab Foundation. A program officer wants to introduce two grantees to each other so they can learn from each other.

## Source Grantee:
${JSON.stringify(buildProfile(sourceGrant, sourceSummary), null, 2)}

## Target Grantee:
${JSON.stringify(buildProfile(targetGrant, targetSummary), null, 2)}

Analyze these two grants and generate a JSON introduction rationale. Focus on PRACTICAL, ACTIONABLE connections — not just surface-level overlap like "both work in the same sector." Look for:
- Shared challenges they could troubleshoot together
- Complementary strengths (one solved a problem the other still faces)
- Similar target populations or contexts where approaches could transfer
- Opportunities for knowledge sharing or potential collaboration

Generate:
- commonalities: Array of 3-5 concise bullet points about what they meaningfully share
- learning_opportunities: {
    source_can_learn: "1-2 sentences about what ${sourceGrant.grantee_name} could learn from ${targetGrant.grantee_name}",
    target_can_learn: "1-2 sentences about what ${targetGrant.grantee_name} could learn from ${sourceGrant.grantee_name}"
  }
- introduction_message: A 2-3 sentence message the program officer could send to introduce these two grantees. Write it as if the PO is emailing one of them. Be warm, specific, and actionable.

Return ONLY valid JSON (no markdown code fences, no commentary):
{
  "commonalities": ["...", "..."],
  "learning_opportunities": {
    "source_can_learn": "...",
    "target_can_learn": "..."
  },
  "introduction_message": "..."
}`;

    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxOutputTokens: 1500,
    });

    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text) as IntroductionRationale;

    const rationale: IntroductionRationale = {
      commonalities: Array.isArray(parsed.commonalities)
        ? parsed.commonalities
        : [],
      learning_opportunities: {
        source_can_learn: parsed.learning_opportunities?.source_can_learn || "",
        target_can_learn: parsed.learning_opportunities?.target_can_learn || "",
      },
      introduction_message: parsed.introduction_message || "",
    };

    return NextResponse.json(rationale);
  } catch (error) {
    console.error("Introduction rationale generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate introduction rationale" },
      { status: 500 }
    );
  }
}
