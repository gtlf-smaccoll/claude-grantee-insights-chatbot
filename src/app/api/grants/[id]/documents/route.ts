import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIndex } from "@/lib/vector-store";
import { DocumentType } from "@/types/documents";

export interface GrantDocument {
  source_file: string;
  drive_url: string;
  document_type: DocumentType;
}

// Map document types to user-friendly labels
const documentTypeLabels: Record<DocumentType, string> = {
  grant_description: "Grant Description",
  midpoint_checkin_transcript: "Midpoint Check-in Transcript",
  midpoint_survey: "Midpoint Survey",
  impact_survey: "Annual Impact Survey",
  closeout_transcript: "Closeout Transcript",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.PINECONE_API_KEY) {
      // If Pinecone is not configured, return empty list
      return NextResponse.json({ documents: [] });
    }

    const index = getIndex();

    // Query for all chunks from this grant
    // We use a simple metadata filter to get all chunks from the reference number
    const response = await index.query({
      vector: Array(1024).fill(0), // Dummy vector for metadata-only query
      topK: 1000, // Get many results to ensure we capture all documents
      filter: {
        reference_number: { $eq: params.id },
      },
      includeMetadata: true,
      includeValues: false,
    });

    // Extract unique documents from the results
    const documentMap = new Map<string, GrantDocument>();

    const matches = response.matches || [];
    for (const match of matches) {
      const metadata = match.metadata as Record<string, unknown>;
      const source_file = metadata.source_file as string | undefined;
      const drive_url = metadata.drive_url as string | undefined;
      const document_type = metadata.document_type as DocumentType | undefined;

      // Only include if we have all required fields
      if (source_file && drive_url && document_type) {
        // Use source_file as the unique key
        if (!documentMap.has(source_file)) {
          documentMap.set(source_file, {
            source_file,
            drive_url,
            document_type,
          });
        }
      }
    }

    // Convert to array and sort by document type order
    const documents = Array.from(documentMap.values()).sort((a, b) => {
      const typeOrder = [
        "grant_description",
        "midpoint_checkin_transcript",
        "midpoint_survey",
        "impact_survey",
        "closeout_transcript",
      ];
      return typeOrder.indexOf(a.document_type) - typeOrder.indexOf(b.document_type);
    });

    return NextResponse.json({ documents, labels: documentTypeLabels });
  } catch (error) {
    console.error("Failed to fetch grant documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch grant documents" },
      { status: 500 }
    );
  }
}
