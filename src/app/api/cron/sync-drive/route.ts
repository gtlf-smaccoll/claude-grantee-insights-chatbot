import { NextRequest, NextResponse } from "next/server";
import { syncDriveFiles } from "@/lib/drive-sync";

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron endpoint for automated Drive sync
 * Called on 24-hour schedule to ingest new/updated files from configured Drive folders
 *
 * Authorization: Vercel adds Authorization header with CRON_SECRET
 */
export async function GET(req: NextRequest) {
  try {
    // Verify Vercel Cron authorization
    const authHeader = req.headers.get("authorization");
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error("❌ Cron endpoint called with invalid authorization");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🔄 [CRON] Starting Drive sync...");
    const startTime = Date.now();

    // Run the main sync function
    const result = await syncDriveFiles();

    const duration = Date.now() - startTime;

    console.log(`✨ [CRON] Drive sync completed in ${duration}ms`);
    console.log(`📊 [CRON] Results: ${result.processed} processed, ${result.new} new, ${result.updated} updated, ${result.skipped} skipped`);

    if (result.errors.length > 0) {
      console.warn(`⚠️  [CRON] Encountered ${result.errors.length} errors:`, result.errors);
    }

    return NextResponse.json(
      {
        success: true,
        processed: result.processed,
        new: result.new,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`🚨 [CRON] Drive sync failed: ${errorMsg}`);
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Drive sync failed",
        details: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
