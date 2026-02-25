// Document types matching the 5 folder categories
export type DocumentType =
  | "grant_description"
  | "midpoint_checkin_transcript"
  | "midpoint_survey"
  | "impact_survey"
  | "closeout_transcript";

// Section types for chunk-level tagging
export type SectionType =
  | "project_summary"
  | "scope_of_work"
  | "partnerships"
  | "technology"
  | "timeline"
  | "outcomes"
  | "measurement"
  | "budget"
  | "progress"
  | "challenges"
  | "pivots"
  | "data_measurement"
  | "org_changes"
  | "future_plans"
  | "support_requests"
  | "notable_quotes"
  | "transcript_summary"
  | "stage"
  | "early_signals"
  | "breadth_scale"
  | "depth_outcomes"
  | "learnings"
  | "feedback"
  | "financial"
  | "current_status"
  | "full_document";

// Google Drive file metadata
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

// A document after text extraction but before chunking
export interface ExtractedDocument {
  file: DriveFileInfo;
  text: string;
  documentType: DocumentType;
  referenceNumber: string | null;
  granteeName: string | null;
}

// A single chunk ready for embedding and storage
export interface DocumentChunk {
  chunkUid: string;
  text: string;
  metadata: ChunkMetadata;
}

// Rich metadata stored with each vector in Pinecone
export interface ChunkMetadata {
  // Grant identity (populated from GrantRecord lookup)
  reference_number: string;
  grantee_id: number;
  grantee_name: string;
  grantee_country: string;
  state: string;
  program_officer: string;
  rfp: string;
  grant_portfolio_type: string;
  intervention_area_primary: string;
  intervention_area_secondary: string;
  impact_pathway: string;
  labor_market_sector: string;
  project_mechanism: string;
  primary_population_focus: string;
  grant_amount: number | null;
  grant_title: string;
  active: boolean;
  fiscal_year: number | null;

  // Document-level metadata
  document_type: DocumentType;
  document_date: string;
  source_file: string;
  drive_url: string;

  // Chunk-level metadata
  chunk_index: number;
  chunk_uid: string;
  section_type: SectionType;
  section_heading: string;

  // Pre-computed impact metrics
  roi: number | null;
  people_served: number | null;
  cost_per_person: number | null;
  income_change_pct: number | null;
}

// Folder configuration for Drive ingestion
export interface DriveFolderConfig {
  folderId: string;
  label: string;
  documentType: DocumentType;
}

// Parsed result from a filename
export interface ParsedFilename {
  referenceNumber: string | null;
  granteeName: string | null;
  documentType: DocumentType | null;
}

// Results from the ingestion pipeline
export interface IngestionResult {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  errors: { file: string; error: string }[];
  unmatchedGrants: { file: string; referenceNumber: string | null }[];
}

// Options for the ingestion pipeline
export interface IngestionOptions {
  useClaudeChunking: boolean;
  dryRun: boolean;
  folderIds?: string[];
  forceReprocess?: boolean;
}
