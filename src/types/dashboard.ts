import { DocumentType } from "./documents";

// Map from document type to the set of reference numbers that have that type
export type DocumentCoverageMap = Record<DocumentType, string[]>;

// API response shape from /api/dashboard/coverage
export interface DocumentCoverageResponse {
  coverage: DocumentCoverageMap;
  lastUpdated: string;
}
