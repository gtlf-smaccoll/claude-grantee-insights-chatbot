import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runIngestion } from "@/lib/ingestion";

// Allow up to 5 minutes for ingestion (Vercel Pro plan limit)
export const maxDuration = 300;

/**
 * POST /api/ingest — Trigger document ingestion.
 *
 * Admin-only endpoint. Restricted to emails in ADMIN_EMAILS env var.
 * If ADMIN_EMAILS is not set, any authenticated user can trigger ingestion.
 *
 * Request body (all optional):
 *   { useClaudeChunking: boolean, dryRun: boolean, folderIds: string[], forceReprocess: boolean }
 */
export async function POST(req: Request) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Admin check
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length > 0 && !adminEmails.includes(session.user?.email ?? "")) {
    return new Response("Forbidden — admin access required", { status: 403 });
  }

  // Parse options from request body
  const body = await req.json().catch(() => ({}));
  const options = {
    useClaudeChunking: body.useClaudeChunking ?? false,
    dryRun: body.dryRun ?? false,
    folderIds: body.folderIds as string[] | undefined,
    forceReprocess: body.forceReprocess ?? false,
  };

  console.log("Ingestion triggered via API:", options);

  try {
    const result = await runIngestion(options);
    return Response.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Ingestion failed:", msg);
    return new Response(
      JSON.stringify({ error: `Ingestion failed: ${msg}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
