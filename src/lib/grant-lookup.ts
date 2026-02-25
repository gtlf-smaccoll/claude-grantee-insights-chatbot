import { GrantRecord } from "@/types/grants";
import { fetchGrantsFromSheet } from "./google-sheets";

/**
 * In-memory cache of grant records for fast lookup during ingestion.
 * Populated on first call, then reused.
 */
let grantCache: GrantRecord[] | null = null;

/**
 * Look up a GrantRecord by reference number or grantee name.
 * Tries exact reference number match first, then fuzzy name match.
 *
 * This bridges the document pipeline to the structured grant data
 * so each chunk gets the full grant metadata.
 */
export async function lookupGrant(
  referenceNumber: string | null,
  granteeName: string | null
): Promise<GrantRecord | null> {
  if (!grantCache) {
    grantCache = await fetchGrantsFromSheet();
  }

  // Try exact reference number match first (most reliable)
  if (referenceNumber) {
    const match = grantCache.find(
      (g) => g.reference_number === referenceNumber
    );
    if (match) return match;
  }

  // Try fuzzy name match
  if (granteeName) {
    const normalized = granteeName.toLowerCase().trim();
    if (normalized.length < 3) return null;

    // Exact substring match
    const exactMatch = grantCache.find(
      (g) =>
        g.grantee_name.toLowerCase().includes(normalized) ||
        normalized.includes(g.grantee_name.toLowerCase())
    );
    if (exactMatch) return exactMatch;

    // Word-level match: check if most words in the query appear in the grant name
    const queryWords = normalized.split(/\s+/).filter((w) => w.length > 2);
    if (queryWords.length > 0) {
      let bestMatch: GrantRecord | null = null;
      let bestScore = 0;

      for (const grant of grantCache) {
        const grantNameLower = grant.grantee_name.toLowerCase();
        const matchingWords = queryWords.filter((w) =>
          grantNameLower.includes(w)
        );
        const score = matchingWords.length / queryWords.length;
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          bestMatch = grant;
        }
      }

      if (bestMatch) return bestMatch;
    }
  }

  return null;
}

/**
 * Reset the grant cache (e.g., after sheet data is refreshed).
 */
export function resetGrantCache(): void {
  grantCache = null;
}
