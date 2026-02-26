import { listFilesRecursive } from "./google-drive";
import { DRIVE_FOLDERS } from "./drive-config";
import { parseFilename } from "./filename-parser";
import { lookupGrant, resetGrantCache } from "./grant-lookup";
import { extractText } from "./text-extraction";
import { chunkDocument } from "./chunking";
import { upsertChunks } from "./vector-store";
import { getFullGrantRecords } from "./google-sheets";
import {
  getLatestSyncGeneration,
  getChunksByFileId,
  deleteChunksByFileId,
  shouldSkipFile,
} from "./drive-sync-state";
import { GrantRecord } from "@/types/grants";
import { DocumentChunk, ChunkMetadata } from "@/types/documents";

export interface SyncResult {
  processed: number;
  new: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "text/plain",
  "text/csv",
  "application/vnd.google-apps.document", // Google Docs
]);

function isSupportedFile(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

/**
 * Main Drive Sync orchestration function
 * Automatically detects and ingests new/updated files from Google Drive
 */
export async function syncDriveFiles(): Promise<SyncResult> {
  const result: SyncResult = {
    processed: 0,
    new: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log("🔄 Starting Drive sync...");

    // 1. Refresh grant cache to ensure current data
    resetGrantCache();

    // 2. Get current grants from Sheets
    const grants = await getFullGrantRecords();
    console.log(`📋 Loaded ${grants.length} grants from Sheets`);

    // 3. Get current sync generation
    const currentGen = await getLatestSyncGeneration();
    const nextGen = currentGen + 1;
    console.log(`📊 Next sync generation: ${nextGen}`);

    // 4. Create a map of grants for faster lookup
    const grantMap = new Map(grants.map((g) => [g.reference_number, g]));

    // 5. Process each configured Drive folder
    for (const folderConfig of DRIVE_FOLDERS) {
      try {
        console.log(`📁 Processing folder: ${folderConfig.label}`);

        // List all files in folder (recursive)
        const files = await listFilesRecursive(folderConfig.folderId);
        console.log(
          `📄 Found ${files.length} files in folder ${folderConfig.label}`
        );

        let folderProcessed = 0;

        for (const file of files) {
          // Skip unsupported file types
          if (!isSupportedFile(file.mimeType)) {
            continue;
          }

          // Parse filename to extract metadata
          const parsed = parseFilename(file.name);

          if (!parsed.referenceNumber) {
            result.errors.push(
              `File "${file.name}": No reference number found in filename`
            );
            continue;
          }

          // Look up grant
          const grant = grantMap.get(parsed.referenceNumber);

          if (!grant) {
            result.errors.push(
              `File "${file.name}": Grant ${parsed.referenceNumber} not found in Sheets`
            );
            continue;
          }

          // Check if file should be skipped
          // Use a fallback timestamp if modifiedTime is unavailable
          const fileModifiedTime = file.modifiedTime || new Date().toISOString();
          if (await shouldSkipFile(file.id, fileModifiedTime)) {
            result.skipped++;
            continue;
          }

          // Determine if this is a new or updated file
          const existingChunks = await getChunksByFileId(file.id);
          const isUpdate = existingChunks.length > 0;

          // Process and store file
          try {
            await processAndStoreFile(
              file,
              grant,
              nextGen,
              folderConfig.documentType
            );

            result.processed++;
            if (isUpdate) {
              result.updated++;
            } else {
              result.new++;
            }
            folderProcessed++;

            console.log(
              `✅ ${isUpdate ? "Updated" : "Processed"} file: ${file.name}`
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            result.errors.push(`File "${file.name}": ${errorMsg}`);
            console.error(
              `❌ Failed to process file "${file.name}": ${errorMsg}`
            );
          }
        }

        console.log(
          `✅ Completed folder "${folderConfig.label}" (${folderProcessed} processed)`
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Folder "${folderConfig.label}": ${errorMsg}`);
        console.error(`❌ Failed to process folder: ${errorMsg}`);
      }
    }

    console.log(
      `\n✨ Drive sync complete! Processed: ${result.processed}, New: ${result.new}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`🚨 Drive sync failed: ${errorMsg}`);
    result.errors.push(`Sync failed: ${errorMsg}`);
    throw error;
  }
}

/**
 * Process and store a single file
 * Downloads, extracts text, chunks, and upserts to Pinecone
 */
async function processAndStoreFile(
  file: any,
  grant: GrantRecord,
  syncGen: number,
  defaultDocumentType: string
): Promise<void> {
  // 1. Download and extract text
  console.log(`  📥 Extracting text from ${file.name}...`);
  const text = await extractText(file);

  // 2. Determine document type (from filename, or use folder default)
  const parsed = parseFilename(file.name);
  const docType = parsed.documentType || defaultDocumentType;

  // 3. Chunk the document
  console.log(`  🔀 Chunking document (type: ${docType})...`);

  // Create ExtractedDocument object for chunking
  const extractedDoc: any = {
    file,
    text,
    documentType: docType,
    referenceNumber: parsed.referenceNumber,
    granteeName: grant.grantee_name,
  };

  const chunks = await chunkDocument(extractedDoc, grant, {
    useClaudeChunking: false, // Use default paragraph-based chunking
  });

  console.log(`  📦 Created ${chunks.length} chunks`);

  // Get the file's timestamp (with fallback)
  const fileTimestamp = file.modifiedTime || new Date().toISOString();

  // 4. Enrich chunks with metadata
  const enrichedChunks = chunks.map(
    (chunk) =>
      ({
        chunkUid: chunk.chunkUid,
        text: chunk.text,
        metadata: {
          ...chunk.metadata,
          // Sync tracking fields
          drive_file_id: file.id,
          drive_file_modified: fileTimestamp,
          ingestion_timestamp: Date.now(),
          sync_generation: syncGen,
          // Document metadata
          source_file: file.name,
          drive_url: file.webViewLink,
          document_date: fileTimestamp,
          // Grant metadata
          reference_number: grant.reference_number,
          grantee_id: grant.grantee_id,
          grantee_name: grant.grantee_name,
          grantee_country: grant.grantee_country,
          state: grant.state,
          program_officer: grant.program_officer,
          rfp: grant.rfp,
          grant_portfolio_type: grant.grant_portfolio_type,
          intervention_area_primary: grant.intervention_area_primary,
          intervention_area_secondary: grant.intervention_area_secondary,
          impact_pathway: grant.impact_pathway,
          labor_market_sector: grant.labor_market_sector,
          project_mechanism: grant.project_mechanism,
          primary_population_focus: grant.primary_population_focus,
          grant_amount: grant.grant_amount,
          grant_title: grant.grant_title,
          active: grant.active,
          fiscal_year: grant.fiscal_year,
          roi: grant.roi_lifetime_income_gain,
          people_served: grant.estimated_total_people_served,
          cost_per_person: grant.cost_per_person,
          income_change_pct: grant.pct_change_in_annual_income,
        } as ChunkMetadata,
      } as DocumentChunk)
  );

  // 5. Delete old chunks for this file (if updating)
  const existingChunks = await getChunksByFileId(file.id);
  if (existingChunks.length > 0) {
    console.log(`  🗑️  Deleting ${existingChunks.length} old chunks...`);
    await deleteChunksByFileId(file.id);
  }

  // 6. Upsert new chunks to Pinecone
  console.log(`  📤 Upserting ${enrichedChunks.length} chunks to Pinecone...`);
  await upsertChunks(enrichedChunks);

  console.log(`  ✅ File processed successfully`);
}
