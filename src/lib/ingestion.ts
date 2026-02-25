import { DRIVE_FOLDERS } from "./drive-config";
import { listFilesRecursive } from "./google-drive";
import { extractText } from "./text-extraction";
import { parseFilename } from "./filename-parser";
import { lookupGrant } from "./grant-lookup";
import { chunkDocument } from "./chunking";
import { upsertChunks, deleteChunksBySourceFile } from "./vector-store";
import {
  DriveFileInfo,
  ExtractedDocument,
  DriveFolderConfig,
  IngestionResult,
  IngestionOptions,
} from "@/types/documents";

/**
 * Run the full ingestion pipeline: Drive → Extract → Chunk → Embed → Store.
 *
 * Processes all configured folders (or a subset via options.folderIds).
 * Returns a detailed result with counts and errors for review.
 */
export async function runIngestion(
  options: IngestionOptions
): Promise<IngestionResult> {
  const result: IngestionResult = {
    totalFiles: 0,
    processedFiles: 0,
    skippedFiles: 0,
    totalChunks: 0,
    errors: [],
    unmatchedGrants: [],
  };

  // Filter to specific folders if requested
  const folders = options.folderIds
    ? DRIVE_FOLDERS.filter((f) => options.folderIds!.includes(f.folderId))
    : DRIVE_FOLDERS;

  for (const folder of folders) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Processing folder: ${folder.label}`);
    console.log(`Folder ID: ${folder.folderId}`);
    console.log(`Default doc type: ${folder.documentType}`);
    console.log("=".repeat(60));

    let files: DriveFileInfo[];
    try {
      files = await listFilesRecursive(folder.folderId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR listing files in ${folder.label}: ${msg}`);
      result.errors.push({ file: folder.label, error: `Folder listing failed: ${msg}` });
      continue;
    }

    result.totalFiles += files.length;
    console.log(`  Found ${files.length} files`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`\n  [${i + 1}/${files.length}] ${file.name}`);
      console.log(`    MIME: ${file.mimeType}`);

      try {
        await processFile(file, folder, options, result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`    ERROR: ${msg}`);
        result.errors.push({ file: file.name, error: msg });
      }

      // Small delay between files to be respectful of API rate limits
      if (!options.dryRun && i < files.length - 1) {
        await sleep(500);
      }
    }
  }

  return result;
}

/**
 * Process a single file through the ingestion pipeline.
 */
async function processFile(
  file: DriveFileInfo,
  folder: DriveFolderConfig,
  options: IngestionOptions,
  result: IngestionResult
): Promise<void> {
  // 1. Extract text
  const text = await extractText(file);
  if (!text || text.trim().length < 50) {
    console.log(`    Skipped (no/minimal text content)`);
    result.skippedFiles++;
    return;
  }
  console.log(`    Extracted ${text.length} characters`);

  // 2. Parse filename for reference number and document type
  const parsed = parseFilename(file.name);
  const documentType = parsed.documentType ?? folder.documentType;
  console.log(`    Ref: ${parsed.referenceNumber ?? "none"} | Type: ${documentType}`);

  // 3. Look up the grant record
  const grant = await lookupGrant(parsed.referenceNumber, parsed.granteeName);
  if (grant) {
    console.log(`    Matched grant: ${grant.grantee_name} (${grant.reference_number})`);
  } else {
    console.warn(`    WARNING: No grant match found`);
    result.unmatchedGrants.push({
      file: file.name,
      referenceNumber: parsed.referenceNumber,
    });
  }

  // 4. Build extracted document
  const doc: ExtractedDocument = {
    file,
    text,
    documentType,
    referenceNumber: parsed.referenceNumber ?? grant?.reference_number ?? null,
    granteeName: parsed.granteeName ?? grant?.grantee_name ?? null,
  };

  // 5. Chunk the document
  const chunks = await chunkDocument(doc, grant, {
    useClaudeChunking: options.useClaudeChunking,
  });
  console.log(`    Created ${chunks.length} chunks`);

  if (options.dryRun) {
    console.log(`    [DRY RUN] Would upsert ${chunks.length} chunks`);
    result.processedFiles++;
    result.totalChunks += chunks.length;
    return;
  }

  // 6. Delete old chunks if reprocessing
  if (options.forceReprocess) {
    console.log(`    Deleting old chunks for ${file.name}...`);
    await deleteChunksBySourceFile(file.name);
  }

  // 7. Upsert to vector store
  console.log(`    Upserting ${chunks.length} chunks to Pinecone...`);
  await upsertChunks(chunks);
  console.log(`    Done!`);

  result.processedFiles++;
  result.totalChunks += chunks.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
