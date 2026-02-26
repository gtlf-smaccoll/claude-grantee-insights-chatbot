import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { GrantRecord, GrantSummaryCard, GrantComparisonAnalysis } from "@/types/grants";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { grants, summaries } = body as {
      grants: GrantRecord[];
      summaries: (GrantSummaryCard | null)[];
    };

    if (!grants || grants.length < 2 || grants.length > 3) {
      return NextResponse.json(
        { error: "Provide 2-3 grants for comparison" },
        { status: 400 }
      );
    }

    const anthropic = createAnthropic({
      baseURL: "https://api.anthropic.com/v1",
      apiKey,
      headers: { "x-api-key": apiKey },
    });

    // Build compact grant profiles for the prompt
    const grantProfiles = grants.map((g, i) => {
      const s = summaries[i];
      return {
        name: g.grantee_name,
        ref: g.reference_number,
        country: g.grantee_country,
        intervention: g.intervention_area_primary,
        population: g.primary_population_focus,
        portfolio_type: g.grant_portfolio_type,
        active: g.active,
        grant_amount: g.grant_amount,
        people_served: g.estimated_total_people_served,
        roi: g.roi_lifetime_income_gain,
        income_change_pct: g.pct_change_in_annual_income,
        cost_per_person: g.cost_per_person,
        co_investment: g.additional_co_investment_amounts,
        evidence_quality: g.evidence_quality_assessment,
        execution_risk: g.execution_risk,
        impact_pathway: g.impact_pathway,
        project_mechanism: g.project_mechanism,
        // AI summary data (if available)
        one_liner: s?.one_liner || null,
        project_summary: s?.project_summary || null,
        key_findings: s?.key_findings || [],
        challenges: s?.challenges || [],
        outcomes_summary: s?.outcomes_summary || null,
        current_status: s?.current_status || (g.active ? "Active" : "Completed"),
        follow_on_plans: s?.follow_on_plans || null,
        has_documents: s?.has_documents ?? false,
      };
    });

    const grantNames = grants.map((g) => g.grantee_name);

    const prompt = `You are a grants portfolio analyst for the GitLab Foundation. Compare the following ${grants.length} grants and provide a structured comparative analysis.

## Grant Profiles:
${grantProfiles.map((gp, i) => `### Grant ${i + 1}: ${gp.name} (${gp.ref})
${JSON.stringify(gp, null, 2)}`).join("\n\n")}

Generate a JSON comparative analysis with these fields:

- overall_assessment: 2-3 sentences providing a high-level comparative overview of these grants. Highlight what they have in common and what differentiates them.

- goal_completion: { leader: "<grantee name that best completed its project goals>", analysis: "2-3 sentences explaining why, citing specific outcomes, findings, or evidence quality" }

- roi_performance: { leader: "<grantee name with strongest ROI/financial performance>", analysis: "2-3 sentences comparing ROI, cost per person, income change, and financial efficiency. Use specific numbers." }

- challenges_comparison: { hardest: "<grantee name that faced the most difficult challenges>", analysis: "2-3 sentences comparing the challenges each grant faced and how they were handled" }

- key_differences: Array of 3-4 concise bullet points (one sentence each) highlighting the most important differences between these grants that a portfolio manager should know

- recommendation: 1-2 sentences with an actionable insight for the portfolio team — what can be learned from comparing these grants?

IMPORTANT: For the "leader" and "hardest" fields, use the EXACT grantee name from the data. The names are: ${grantNames.map((n) => `"${n}"`).join(", ")}.

If data is insufficient to determine a leader, say so honestly rather than guessing.

Return ONLY valid JSON (no markdown code fences, no commentary):
{
  "overall_assessment": "...",
  "goal_completion": { "leader": "...", "analysis": "..." },
  "roi_performance": { "leader": "...", "analysis": "..." },
  "challenges_comparison": { "hardest": "...", "analysis": "..." },
  "key_differences": ["...", "...", "..."],
  "recommendation": "..."
}`;

    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxOutputTokens: 2000,
    });

    // Clean up response
    let text = result.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(text) as GrantComparisonAnalysis;

    // Validate shape
    const analysis: GrantComparisonAnalysis = {
      overall_assessment: parsed.overall_assessment || "",
      goal_completion: {
        leader: parsed.goal_completion?.leader || "",
        analysis: parsed.goal_completion?.analysis || "",
      },
      roi_performance: {
        leader: parsed.roi_performance?.leader || "",
        analysis: parsed.roi_performance?.analysis || "",
      },
      challenges_comparison: {
        hardest: parsed.challenges_comparison?.hardest || "",
        analysis: parsed.challenges_comparison?.analysis || "",
      },
      key_differences: Array.isArray(parsed.key_differences)
        ? parsed.key_differences
        : [],
      recommendation: parsed.recommendation || "",
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Comparison analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to generate comparison analysis" },
      { status: 500 }
    );
  }
}
