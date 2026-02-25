"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import ChatMessage from "./ChatMessage";

export default function ChatInterface() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
        {error && (
          <div className="max-w-3xl mx-auto mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error.message || "An error occurred. Please try again."}
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
