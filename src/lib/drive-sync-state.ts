import { getIndex } from "./vector-store";
import { DocumentChunk } from "@/types/documents";

/**
 * Query Pinecone for the latest sync generation number
 * This is used to track which sync run added each chunk
 */
export async function getLatestSyncGeneration(): Promise<number> {
  try {
    const index = getIndex();

    // Query for chunks with sync_generation field
    const response = await index.query({
      vector: Array(1024).fill(0), // Dummy vector for metadata-only query
      topK: 1,
      filter: {
        sync_generation: { $exists: true }
      },
      includeMetadata: true,
    });

    if (!response.matches || response.matches.length === 0) {
      return 0; // First sync
    }

    const generation = response.matches[0].metadata?.sync_generation as number | undefined;
    return generation || 0;
  } catch (error) {
    console.error("Failed to get latest sync generation:", error);
    return 0;
  }
}

/**
 * Get all chunks for a specific file by drive_file_id
 * Used to check if a file has already been processed
 */
export async function getChunksByFileId(
  driveFileId: string
): Promise<DocumentChunk[]> {
  try {
    const index = getIndex();

    const response = await index.query({
      vector: Array(1024).fill(0), // Dummy vector for metadata-only query
      topK: 1000,
      filter: {
        drive_file_id: { $eq: driveFileId }
      },
      includeMetadata: true,
    });

    if (!response.matches || response.matches.length === 0) {
      return [];
    }

    return response.matches.map((m) => ({
      chunkUid: m.id,
      text: m.metadata?.chunk_text as string || "",
      metadata: m.metadata as any,
    }));
  } catch (error) {
    console.error(`Failed to get chunks for file ${driveFileId}:`, error);
    return [];
  }
}

/**
 * Delete all chunks for a specific file
 * Used when re-processing an updated file
 */
export async function deleteChunksByFileId(driveFileId: string): Promise<void> {
  try {
    const chunks = await getChunksByFileId(driveFileId);

    if (chunks.length === 0) {
      return; // Nothing to delete
    }

    const index = getIndex();
    const chunkIds = chunks.map((c) => c.chunkUid);

    // Delete in batches
    const batchSize = 100;
    for (let i = 0; i < chunkIds.length; i += batchSize) {
      const batch = chunkIds.slice(i, i + batchSize);
      await index.deleteMany(batch);
    }

    console.log(`Deleted ${chunkIds.length} chunks for file ${driveFileId}`);
  } catch (error) {
    console.error(`Failed to delete chunks for file ${driveFileId}:`, error);
    throw error;
  }
}

/**
 * Check if a file has been processed before and if it's unchanged
 * Returns true if the file should be skipped (already processed and unchanged)
 */
export async function shouldSkipFile(
  driveFileId: string,
  driveFileModified: string
): Promise<boolean> {
  try {
    const chunks = await getChunksByFileId(driveFileId);

    if (chunks.length === 0) {
      return false; // File not in Pinecone yet, should process
    }

    // Check if the file's modified time matches the stored modified time
    const storedModified = chunks[0]?.metadata?.drive_file_modified as string | undefined;

    if (!storedModified) {
      return false; // No stored modified time, should re-process
    }

    // File has been processed and hasn't changed
    return storedModified === driveFileModified;
  } catch (error) {
    console.error(`Failed to check if file should be skipped:`, error);
    return false; // On error, process the file
  }
}
