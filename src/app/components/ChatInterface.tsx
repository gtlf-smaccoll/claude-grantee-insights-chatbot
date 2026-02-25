"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import { UIMessage } from "ai";
import { CondensedGrant } from "@/types/grants";
import ChatMessage from "./ChatMessage";

interface ChatInterfaceProps {
  scopedGrants?: CondensedGrant[] | null;
  scopedGrantRefs?: string[];
  onClearScope?: () => void;
}

export default function ChatInterface({
  scopedGrants,
  scopedGrantRefs,
  onClearScope,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isCustomLoading, setIsCustomLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isLoading = isCustomLoading;

  // Get scope labels for display
  const scopeLabel = scopedGrants ? `Analyzing ${scopedGrants.length} grant${scopedGrants.length === 1 ? "" : "s"}` : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Custom message handler that includes scopedGrantRefs
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      parts: [{ type: "text", text: input }],
    };

    // Add user message to history
    setMessages([...messages, userMessage]);
    setInput("");
    setIsCustomLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          scopedGrantRefs,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Handle streaming response (SSE format)
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      let assistantMessage = "";
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines[lines.length - 1]; // Keep incomplete line in buffer

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();

          // Skip empty lines and non-data lines
          if (!line || !line.startsWith("data: ")) continue;

          try {
            // Extract JSON from "data: {...}"
            const jsonStr = line.slice(6); // Remove "data: " prefix
            if (!jsonStr) continue;

            const data = JSON.parse(jsonStr);

            // Extract text from text-delta events
            if (data.type === "text-delta" && data.delta) {
              assistantMessage += data.delta;
            }
          } catch (err) {
            // Silently skip parsing errors
            console.debug("Failed to parse SSE line:", line);
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim().startsWith("data: ")) {
        try {
          const jsonStr = buffer.trim().slice(6);
          const data = JSON.parse(jsonStr);
          if (data.type === "text-delta" && data.delta) {
            assistantMessage += data.delta;
          }
        } catch (err) {
          console.debug("Failed to parse final SSE line:", buffer);
        }
      }

      // Add assistant message to history
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          parts: [{ type: "text", text: assistantMessage }],
        },
      ]);
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        const errorMsg = err instanceof Error ? err.message : "Failed to send message";
        console.error("Failed to send message:", err);
        setApiError(errorMsg);
      }
    } finally {
      setIsCustomLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    handleSendMessage(e);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scope header */}
      {scopeLabel && (
        <div className="px-4 py-3 bg-gitlab-orange/10 border-b border-gitlab-orange/30 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-gitlab-orange">{scopeLabel}</span>
          {onClearScope && (
            <button
              onClick={onClearScope}
              className="text-xs text-gitlab-orange hover:text-orange-400 underline"
            >
              Clear scope
            </button>
          )}
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <h2 className="text-xl font-medium text-gray-300 mb-2">
              GitLab Foundation Grant Insights
            </h2>
            <p className="text-sm text-gray-500 max-w-md text-center">
              Ask about grantees, cohorts, impact metrics, challenges, or
              portfolio trends. Try &quot;Which grantees have the highest
              ROI?&quot; or &quot;What challenges are AIEO 2.0 grantees
              facing?&quot;
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {status === "submitted" && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="animate-pulse">Analyzing portfolio data...</div>
              </div>
            )}
          </div>
        )}
        {apiError && (
          <div className="max-w-3xl mx-auto mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {apiError}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 bg-gray-950 px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about grants, grantees, cohorts, impact..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pr-12 text-gray-100 placeholder-gray-500 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange"
              style={{ minHeight: "48px", maxHeight: "200px" }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 bottom-2 rounded-lg bg-gitlab-orange p-2 text-white transition-colors hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
