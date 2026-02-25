"use client";

import { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: UIMessage;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const text = getMessageText(message);

  if (!text) return null;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gitlab-purple flex items-center justify-center text-white text-xs font-bold">
          GL
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-gitlab-orange text-white"
            : "bg-gray-800 text-gray-100"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{text}</div>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:my-3 prose-headings:text-gitlab-orange prose-strong:text-white prose-table:text-gray-100 prose-th:text-gray-200 prose-td:border-gray-600 prose-th:border-gray-600">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-bold">
          You
        </div>
      )}
    </div>
  );
}
