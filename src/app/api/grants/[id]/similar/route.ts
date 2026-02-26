import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullGrantRecords } from "@/lib/google-sheets";
import { fetchSummaryCard, searchSimilarGrants } from "@/lib/vector-store";
import { buildTextRepresentation } from "@/lib/summary-generator";
import { GrantRecord, SimilarGrantsResponse } from "@/types/grants";

export const maxDuration = 30;

/**
 * Build a fallback query from spreadsheet fields when no summary card exists.
 */
function buildFallbackQuery(grant: GrantRecord): string {
  return [
    `${grant.grantee_name}: ${grant.grant_title}`,
    grant.intervention_area_primary && `Intervention: ${grant.intervention_area_primary}`,
    grant.primary_population_focus && `Population: ${grant.primary_population_focus}`,
    grant.grantee_country && `Country: ${grant.grantee_country}`,
    grant.impact_pathway && `Impact Pathway: ${grant.impact_pathway}`,
    grant.project_mechanism && `Mechanism: ${grant.project_mechanism}`,
    grant.labor_market_sector && `Sector: ${grant.labor_market_sector}`,
  ]
    .filter(Boolean)
    .join(". ");
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.PINECONE_API_KEY) {
    return NextResponse.json(
      { error: "Vector store not configured" },
      { status: 503 }
    );
  }

  try {
    const referenceNumber = params.id;

    // Look up the grant
    const grants = await getFullGrantRecords();
    const grant = grants.find((g) => g.reference_number === referenceNumber);
    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    // Try to get the summary card for a rich query text
    let queryText: string;
    try {
      const summaryCard = await fetchSummaryCard(referenceNumber);
      if (summaryCard) {
        queryText = buildTextRepresentation(summaryCard);
      } else {
        queryText = buildFallbackQuery(grant);
      }
    } catch {
      queryText = buildFallbackQuery(grant);
    }

    // Search for similar grants
    const results = await searchSimilarGrants(queryText, referenceNumber);

    const response: SimilarGrantsResponse = {
      source_reference: referenceNumber,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Similar grants search failed:", error);
    return NextResponse.json(
      { error: "Failed to find similar grants" },
      { status: 500 }
    );
  }
}
