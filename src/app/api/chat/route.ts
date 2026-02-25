import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGrantRegistry } from "@/lib/google-sheets";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { retrieveContext } from "@/lib/retrieval";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, scopedGrantRefs }: { messages: UIMessage[]; scopedGrantRefs?: string[] } = await req.json();

  // Load the grant registry (cached, refreshes hourly)
  let registry;
  try {
    registry = await getGrantRegistry();

    // Filter registry to scoped grants if provided
    if (scopedGrantRefs && scopedGrantRefs.length > 0) {
      const filteredGrants = registry.grants.filter((g) => scopedGrantRefs.includes(g.ref));

      // Rebuild portfolio_summary for scoped grants
      const scopedSummary = {
        total_grants: filteredGrants.length,
        total_invested: filteredGrants.reduce((sum, g) => sum + (g.amount || 0), 0),
        countries: Array.from(new Set(filteredGrants.map(g => g.country))),
        active_grants: filteredGrants.filter(g => g.active).length,
        rfp_cohorts: Array.from(new Set(filteredGrants.map(g => g.rfp).filter(Boolean))),
        portfolio_types: filteredGrants.reduce((acc, g) => {
          acc[g.portfolio_type] = (acc[g.portfolio_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      registry = {
        ...registry,
        grants: filteredGrants,
        portfolio_summary: scopedSummary,
      };
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Failed to load grant registry:", err.message);
    return new Response(
      JSON.stringify({ error: `Failed to load grant data: ${err.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Extract the user's latest message for vector retrieval
  const lastUserMessage = messages
    .filter((m) => m.role === "user")
    .pop();
  const userQuery =
    lastUserMessage?.parts
      ?.filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      )
      .map((p) => p.text)
      .join("") ?? "";

  // Retrieve relevant document chunks from the vector store
  // Graceful degradation: if retrieval fails or vector store is empty,
  // chat still works with just the grant registry (Phase 1 behavior)
  let retrievedContext = "";
  if (userQuery && process.env.PINECONE_API_KEY) {
    try {
      // Build retrieval options - if scoped, filter to those grants
      const retrievalOptions = scopedGrantRefs?.length
        ? { referenceNumbers: scopedGrantRefs }
        : undefined;

      const retrieval = await retrieveContext(userQuery, retrievalOptions);
      if (retrieval.chunks.length > 0) {
        retrievedContext = `\n\n## Retrieved Document Context\n\nThe following document excerpts are relevant to the user's question. Use these to provide specific, evidence-based answers with citations.\n\n${retrieval.formattedContext}`;
      }
    } catch (error) {
      console.error("Retrieval failed, continuing without document context:", error);
    }
  }

  try {
    const systemPrompt = buildSystemPrompt(registry, scopedGrantRefs) + retrievedContext;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Explicit baseURL + apiKey + headers to override any shell env interference
    const anthropic = createAnthropic({
      baseURL: "https://api.anthropic.com/v1",
      apiKey,
      headers: {
        "x-api-key": apiKey,
      },
    });

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Chat API error:", err.message, error);
    return new Response(
      JSON.stringify({ error: `Chat failed: ${err.message || String(error)}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
