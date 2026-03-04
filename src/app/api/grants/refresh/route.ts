import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshGrantRegistry } from "@/lib/google-sheets";

/**
 * POST /api/grants/refresh — Force-refresh the grant registry cache.
 * Clears the in-memory cache and re-fetches from Google Sheets immediately.
 * Requires authentication.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const registry = await refreshGrantRegistry();
    return NextResponse.json({
      success: true,
      total_grants: registry.portfolio_summary.total_grants,
      last_updated: registry.last_updated,
    });
  } catch (error) {
    console.error("Failed to refresh grant registry:", error);
    return NextResponse.json(
      { error: "Failed to refresh grant data" },
      { status: 500 }
    );
  }
}
