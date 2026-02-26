import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullGrantRecords } from "@/lib/google-sheets";
import { getOrGenerateSummary } from "@/lib/summary-generator";

// Allow up to 30s for first-time Claude generation
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if Pinecone + Anthropic are configured
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json(
        { error: "Vector store not configured" },
        { status: 503 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }

    // Look up the full grant record
    const grants = await getFullGrantRecords();
    const grant = grants.find((g) => g.reference_number === params.id);

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    const summary = await getOrGenerateSummary(params.id, grant);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to get grant summary:", error);
    return NextResponse.json(
      { error: "Failed to generate grant summary" },
      { status: 500 }
    );
  }
}
