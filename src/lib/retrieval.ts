import { searchChunks } from "./vector-store";
import { DocumentChunk } from "@/types/documents";

export interface RetrievalResult {
  chunks: DocumentChunk[];
  formattedContext: string;
}

/**
 * Retrieve relevant document chunks for a user query.
 *
 * Searches the Pinecone vector store using semantic similarity,
 * with optional metadata filters, and formats the results for
 * inclusion in the Claude system prompt.
 *
 * @param query - The user's question
 * @param options - Optional filters to narrow the search
 * @returns Retrieved chunks and a formatted context string
 */
export async function retrieveContext(
  query: string,
  options?: {
    referenceNumber?: string;
    country?: string;
    rfp?: string;
    documentType?: string;
    sectionType?: string;
    topK?: number;
  }
): Promise<RetrievalResult> {
  // Build metadata filters from options
  const filters: Record<string, string> = {};
  if (options?.referenceNumber) filters.reference_number = options.referenceNumber;
  if (options?.country) filters.grantee_country = options.country;
  if (options?.rfp) filters.rfp = options.rfp;
  if (options?.documentType) filters.document_type = options.documentType;
  if (options?.sectionType) filters.section_type = options.sectionType;

  const hasFilters = Object.keys(filters).length > 0;

  const results = await searchChunks(
    query,
    hasFilters ? filters : undefined,
    options?.topK ?? 10
  );

  const chunks = results.map((r) => r.chunk);

  // Format retrieved chunks for inclusion in the system prompt
  const formattedContext = chunks
    .map((chunk, i) => {
      const m = chunk.metadata;
      return `--- Document ${i + 1} ---
Source: ${m.source_file}
Grantee: ${m.grantee_name}${m.reference_number ? ` (${m.reference_number})` : ""}
Type: ${m.document_type} | Section: ${m.section_type}${m.section_heading ? ` — ${m.section_heading}` : ""}
Country: ${m.grantee_country}${m.rfp ? ` | RFP: ${m.rfp}` : ""}

${chunk.text}`;
    })
    .join("\n\n");

  return { chunks, formattedContext };
}
