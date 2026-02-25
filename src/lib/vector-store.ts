import { Pinecone, type SearchRecordsResponse } from "@pinecone-database/pinecone";
import { DocumentChunk, ChunkMetadata } from "@/types/documents";

const INDEX_NAME = "gitlab-foundation-grants";

/**
 * This module uses Pinecone's integrated inference (llama-text-embed-v2).
 * Pinecone handles embedding generation automatically — we just send text.
 * The index was created with field_map: { text: "text" }.
 */

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY not configured");
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

function getIndex() {
  return getPinecone().index(INDEX_NAME);
}

// ============================================================
// Flatten metadata for Pinecone records
// ============================================================

function flattenMetadata(
  metadata: ChunkMetadata
): Record<string, string | number | boolean> {
  const flat: Record<string, string | number | boolean> = {};

  const stringFields: (keyof ChunkMetadata)[] = [
    "reference_number",
    "grantee_name",
    "grantee_country",
    "state",
    "program_officer",
    "rfp",
    "grant_portfolio_type",
    "intervention_area_primary",
    "intervention_area_secondary",
    "impact_pathway",
    "labor_market_sector",
    "project_mechanism",
    "primary_population_focus",
    "grant_title",
    "document_type",
    "document_date",
    "source_file",
    "drive_url",
    "chunk_uid",
    "section_type",
    "section_heading",
  ];
  for (const key of stringFields) {
    const val = metadata[key];
    if (typeof val === "string") {
      flat[key] = val;
    }
  }

  const numberFields: (keyof ChunkMetadata)[] = [
    "grantee_id",
    "grant_amount",
    "fiscal_year",
    "chunk_index",
    "roi",
    "people_served",
    "cost_per_person",
    "income_change_pct",
  ];
  for (const key of numberFields) {
    const val = metadata[key];
    if (typeof val === "number") {
      flat[key] = val;
    }
  }

  flat.active = metadata.active;
  return flat;
}

function unflattenMetadata(
  flat: Record<string, unknown>
): ChunkMetadata {
  return {
    reference_number: (flat.reference_number as string) ?? "",
    grantee_id: (flat.grantee_id as number) ?? 0,
    grantee_name: (flat.grantee_name as string) ?? "",
    grantee_country: (flat.grantee_country as string) ?? "",
    state: (flat.state as string) ?? "",
    program_officer: (flat.program_officer as string) ?? "",
    rfp: (flat.rfp as string) ?? "",
    grant_portfolio_type: (flat.grant_portfolio_type as string) ?? "",
    intervention_area_primary: (flat.intervention_area_primary as string) ?? "",
    intervention_area_secondary: (flat.intervention_area_secondary as string) ?? "",
    impact_pathway: (flat.impact_pathway as string) ?? "",
    labor_market_sector: (flat.labor_market_sector as string) ?? "",
    project_mechanism: (flat.project_mechanism as string) ?? "",
    primary_population_focus: (flat.primary_population_focus as string) ?? "",
    grant_amount: (flat.grant_amount as number) ?? null,
    grant_title: (flat.grant_title as string) ?? "",
    active: (flat.active as boolean) ?? false,
    fiscal_year: (flat.fiscal_year as number) ?? null,
    document_type: (flat.document_type as ChunkMetadata["document_type"]) ?? "grant_description",
    document_date: (flat.document_date as string) ?? "",
    source_file: (flat.source_file as string) ?? "",
    drive_url: (flat.drive_url as string) ?? "",
    chunk_index: (flat.chunk_index as number) ?? 0,
    chunk_uid: (flat.chunk_uid as string) ?? "",
    section_type: (flat.section_type as ChunkMetadata["section_type"]) ?? "full_document",
    section_heading: (flat.section_heading as string) ?? "",
    roi: (flat.roi as number) ?? null,
    people_served: (flat.people_served as number) ?? null,
    cost_per_person: (flat.cost_per_person as number) ?? null,
    income_change_pct: (flat.income_change_pct as number) ?? null,
  };
}

// ============================================================
// Upsert chunks — Pinecone handles embedding automatically
// ============================================================

/**
 * Upsert document chunks into Pinecone using integrated inference.
 * Pinecone automatically generates embeddings from the "text" field
 * using llama-text-embed-v2.
 */
export async function upsertChunks(chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) return;

  const index = getIndex();

  // Build records: { _id, text, ...metadata }
  const records = chunks.map((chunk) => ({
    _id: chunk.chunkUid,
    text: chunk.text.slice(0, 35000),
    ...flattenMetadata(chunk.metadata),
  }));

  // Upsert in batches of 96
  for (let i = 0; i < records.length; i += 96) {
    const batch = records.slice(i, i + 96);
    await index.upsertRecords({ records: batch });
  }
}

// ============================================================
// Semantic search — Pinecone handles query embedding automatically
// ============================================================

function buildPineconeFilter(
  filters: Record<string, string | string[] | number | boolean>
): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      conditions[key] = { $in: value };
    } else {
      conditions[key] = { $eq: value };
    }
  }
  return conditions;
}

/**
 * Search for relevant chunks using Pinecone's integrated inference.
 * Pinecone automatically embeds the query text using llama-text-embed-v2.
 */
export async function searchChunks(
  query: string,
  filters?: Record<string, string | string[] | number | boolean>,
  topK: number = 10
): Promise<{ chunk: DocumentChunk; score: number }[]> {
  const index = getIndex();

  const pineconeFilter = filters ? buildPineconeFilter(filters) : undefined;

  const response: SearchRecordsResponse = await index.searchRecords({
    query: {
      topK,
      inputs: { text: query },
      filter: pineconeFilter,
    },
    fields: ["text", "reference_number", "grantee_name", "grantee_country",
      "state", "program_officer", "rfp", "grant_portfolio_type",
      "intervention_area_primary", "intervention_area_secondary",
      "impact_pathway", "labor_market_sector", "project_mechanism",
      "primary_population_focus", "grant_title", "document_type",
      "document_date", "source_file", "drive_url", "chunk_uid",
      "section_type", "section_heading", "grantee_id", "grant_amount",
      "fiscal_year", "chunk_index", "roi", "people_served",
      "cost_per_person", "income_change_pct", "active"],
  });

  const hits = response.result?.hits ?? [];

  return hits.map((hit) => {
    const fields = (hit.fields ?? {}) as Record<string, unknown>;
    const text = (fields.text as string) ?? "";

    const { text: _text, ...metadataFields } = fields;

    return {
      chunk: {
        chunkUid: hit._id,
        text,
        metadata: unflattenMetadata(metadataFields),
      },
      score: hit._score,
    };
  });
}

// ============================================================
// Delete operations (for re-ingestion)
// ============================================================

export async function deleteChunksBySourceFile(
  sourceFile: string
): Promise<void> {
  const index = getIndex();
  try {
    await index.deleteMany({
      filter: { source_file: { $eq: sourceFile } },
    });
  } catch {
    console.warn(
      `Filter-based deletion failed for ${sourceFile}; may need manual cleanup`
    );
  }
}

export async function deleteChunksByGrantee(
  referenceNumber: string
): Promise<void> {
  const index = getIndex();
  try {
    await index.deleteMany({
      filter: { reference_number: { $eq: referenceNumber } },
    });
  } catch {
    console.warn(
      `Filter-based deletion failed for ${referenceNumber}; may need manual cleanup`
    );
  }
}
