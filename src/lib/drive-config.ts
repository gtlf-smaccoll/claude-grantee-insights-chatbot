import { DriveFolderConfig } from "@/types/documents";

/**
 * Configuration for the 5 Google Drive folders containing grant documents.
 * Folder IDs extracted from the Drive URLs.
 *
 * Note: Colombia and Kenya folders contain a mix of document types
 * (grant descriptions, transcripts, surveys). The documentType here is
 * the default; the filename parser will override per-file when it can
 * detect a more specific type from the filename.
 */
export const DRIVE_FOLDERS: DriveFolderConfig[] = [
  {
    folderId: "1KtimzlEqcEllzHALi7d8lIqktL1ny-AD",
    label: "Annual Impact Reports",
    documentType: "impact_survey",
  },
  {
    folderId: "1s8CyOudeFj1S6-exrTcx8qTkxwDPG5tH",
    label: "Grantee Check-in Transcripts",
    documentType: "midpoint_checkin_transcript",
  },
  {
    folderId: "1Sg7eCEJ3rLRRy7TBYYKhG1DNemovTBP3",
    label: "Colombia",
    documentType: "grant_description", // default; filename parser overrides
  },
  {
    folderId: "1hItZtcYt9AwvxSMAyu1Gc7Cz04wMiPRV",
    label: "Kenya",
    documentType: "grant_description", // default; filename parser overrides
  },
  {
    folderId: "19dfFP9xiZN9-KuASlmoUgF20nCky4GIe",
    label: "Grant Descriptions US",
    documentType: "grant_description",
  },
];
