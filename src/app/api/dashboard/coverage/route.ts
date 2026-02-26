import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIndex } from "@/lib/vector-store";
import { DocumentType } from "@/types/documents";
import { DocumentCoverageMap, DocumentCoverageResponse } from "@/types/dashboard";

const DOC_TYPES: DocumentType[] = [
  "grant_description",
  "midpoint_checkin_transcript",
  "midpoint_survey",
  "impact_survey",
  "closeout_transcript",
];

// 5-minute in-memory cache
let cachedCoverage: DocumentCoverageResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json(
        { error: "Vector store not configured" },
        { status: 503 }
      );
    }

    // Return cached if fresh
    if (cachedCoverage && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedCoverage);
    }

    const index = getIndex();

    // Run 5 parallel queries — one per document type
    const results = await Promise.all(
      DOC_TYPES.map(async (docType) => {
        const response = await index.query({
          vector: Array(1024).fill(0),
          topK: 10000,
          filter: { document_type: { $eq: docType } },
          includeMetadata: true,
          includeValues: false,
        });

        const refs = new Set<string>();
        for (const match of response.matches || []) {
          const ref = (match.metadata as Record<string, unknown>)
            ?.reference_number as string;
          if (ref) refs.add(ref);
        }
        return [docType, Array.from(refs)] as const;
      })
    );

    const coverage = Object.fromEntries(results) as DocumentCoverageMap;
    const responseData: DocumentCoverageResponse = {
      coverage,
      lastUpdated: new Date().toISOString(),
    };

    // Cache result
    cachedCoverage = responseData;
    cacheTimestamp = Date.now();

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Failed to fetch document coverage:", error);
    return NextResponse.json(
      { error: "Failed to fetch document coverage" },
      { status: 500 }
    );
  }
}
