#!/usr/bin/env npx tsx

/**
 * Document Ingestion CLI Script
 *
 * Usage:
 *   npx tsx scripts/ingest.ts                    # Full ingestion
 *   npx tsx scripts/ingest.ts --dry-run           # Preview without upserting
 *   npx tsx scripts/ingest.ts --no-claude         # Skip Claude-assisted chunking
 *   npx tsx scripts/ingest.ts --folder <id>       # Process one folder only
 *   npx tsx scripts/ingest.ts --force             # Reprocess existing files
 *   npx tsx scripts/ingest.ts --list-files        # Just list files in all folders
 *
 * Environment variables required:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   PINECONE_API_KEY
 *   VOYAGE_API_KEY
 *   ANTHROPIC_API_KEY (only if using Claude chunking)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from the project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

// We need to set up the path aliases manually for scripts
// Since tsx respects tsconfig.json paths, the @/ alias should work
// but we need to make sure the imports resolve correctly

async function main() {
  const args = process.argv.slice(2);

  // Parse CLI arguments
  const dryRun = args.includes("--dry-run");
  const useClaudeChunking = !args.includes("--no-claude");
  const forceReprocess = args.includes("--force");
  const listFilesOnly = args.includes("--list-files");

  const folderIdx = args.indexOf("--folder");
  const folderIds = folderIdx !== -1 ? [args[folderIdx + 1]] : undefined;

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Document Ingestion CLI

Usage: npx tsx scripts/ingest.ts [options]

Options:
  --dry-run       Preview what would happen without upserting to Pinecone
  --no-claude     Skip Claude-assisted transcript chunking (faster, cheaper)
  --folder <id>   Only process a specific folder by its Google Drive folder ID
  --force         Reprocess files even if already ingested (deletes old chunks first)
  --list-files    Just list all files in all folders (no processing)
  --help, -h      Show this help message

Examples:
  npx tsx scripts/ingest.ts --dry-run --no-claude
  npx tsx scripts/ingest.ts --folder 1KtimzlEqcEllzHALi7d8lIqktL1ny-AD
  npx tsx scripts/ingest.ts --force
`);
    process.exit(0);
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       GitLab Foundation Document Ingestion Pipeline     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Mode:            ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`  Claude chunking: ${useClaudeChunking ? "ON" : "OFF"}`);
  console.log(`  Force reprocess: ${forceReprocess ? "YES" : "NO"}`);
  if (folderIds) {
    console.log(`  Folder filter:   ${folderIds.join(", ")}`);
  }
  console.log("");

  // Validate environment
  const requiredEnvVars = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
  ];

  if (!dryRun && !listFilesOnly) {
    requiredEnvVars.push("PINECONE_API_KEY", "VOYAGE_API_KEY");
  }

  if (useClaudeChunking && !listFilesOnly) {
    requiredEnvVars.push("ANTHROPIC_API_KEY");
  }

  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    for (const v of missing) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  // List files mode
  if (listFilesOnly) {
    const { DRIVE_FOLDERS } = await import("../src/lib/drive-config");
    const { listFilesRecursive } = await import("../src/lib/google-drive");

    const folders = folderIds
      ? DRIVE_FOLDERS.filter((f) => folderIds.includes(f.folderId))
      : DRIVE_FOLDERS;

    let totalFiles = 0;
    for (const folder of folders) {
      console.log(`\n📁 ${folder.label} (${folder.folderId})`);
      console.log(`   Default type: ${folder.documentType}`);

      try {
        const files = await listFilesRecursive(folder.folderId);
        totalFiles += files.length;
        console.log(`   ${files.length} files found:`);

        for (const file of files) {
          const { parseFilename } = await import("../src/lib/filename-parser");
          const parsed = parseFilename(file.name);
          console.log(
            `     - ${file.name} [${file.mimeType}] ref=${parsed.referenceNumber ?? "?"} type=${parsed.documentType ?? folder.documentType}`
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`   ERROR: ${msg}`);
      }
    }
    console.log(`\nTotal files: ${totalFiles}`);
    process.exit(0);
  }

  // Run ingestion
  const { runIngestion } = await import("../src/lib/ingestion");

  const startTime = Date.now();
  const result = await runIngestion({
    useClaudeChunking,
    dryRun,
    folderIds,
    forceReprocess,
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print results
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  Ingestion Complete                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Duration:        ${duration}s`);
  console.log(`  Total files:     ${result.totalFiles}`);
  console.log(`  Processed:       ${result.processedFiles}`);
  console.log(`  Skipped:         ${result.skippedFiles}`);
  console.log(`  Total chunks:    ${result.totalChunks}`);
  console.log(`  Errors:          ${result.errors.length}`);
  console.log(`  Unmatched:       ${result.unmatchedGrants.length}`);

  if (result.unmatchedGrants.length > 0) {
    console.log("\n⚠️  Files with no matching grant record:");
    for (const u of result.unmatchedGrants) {
      console.log(`  - ${u.file} (ref: ${u.referenceNumber ?? "none"})`);
    }
  }

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    for (const e of result.errors) {
      console.log(`  - ${e.file}: ${e.error}`);
    }
  }

  if (dryRun) {
    console.log("\n💡 This was a DRY RUN. No data was written to Pinecone.");
    console.log("   Run without --dry-run to perform the actual ingestion.");
  }
}

main().catch((error) => {
  console.error("\nFatal error:", error);
  process.exit(1);
});
