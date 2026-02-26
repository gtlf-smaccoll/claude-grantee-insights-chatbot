"use client";

import { useState, useCallback } from "react";
import {
  GrantRecord,
  GrantSummaryCard,
  SimilarGrantResult,
  IntroductionRationale,
  PeerInsights,
} from "@/types/grants";

interface SimilarGrantsSectionProps {
  grant: GrantRecord;
  summary: GrantSummaryCard | null;
  onNavigateToGrant: (referenceNumber: string) => void;
}

function LoadingDots() {
  return (
    <div className="flex gap-1">
      <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-[10px] px-2 py-1 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors flex items-center gap-1"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function SimilarGrantsSection({
  grant,
  summary,
  onNavigateToGrant,
}: SimilarGrantsSectionProps) {
  // Similarity search state
  const [results, setResults] = useState<SimilarGrantResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Introduction rationale state (per result)
  const [introTarget, setIntroTarget] = useState<string | null>(null);
  const [introRationale, setIntroRationale] = useState<IntroductionRationale | null>(null);
  const [introLoading, setIntroLoading] = useState(false);

  // Peer insights state (global for all results)
  const [insightsData, setInsightsData] = useState<PeerInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const handleFindSimilar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setIntroTarget(null);
    setIntroRationale(null);
    setInsightsData(null);

    try {
      const res = await fetch(`/api/grants/${grant.reference_number}/similar`);
      if (!res.ok) throw new Error("Failed to find similar grants");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [grant.reference_number]);

  const handleWhyConnect = useCallback(
    async (targetRef: string) => {
      // Toggle off if already showing this one
      if (introTarget === targetRef && introRationale) {
        setIntroTarget(null);
        setIntroRationale(null);
        return;
      }

      setIntroTarget(targetRef);
      setIntroRationale(null);
      setIntroLoading(true);

      try {
        // Fetch target grant details + summary
        const [grantRes, summaryRes] = await Promise.all([
          fetch(`/api/grants/${targetRef}`),
          fetch(`/api/grants/${targetRef}/summary`).catch(() => null),
        ]);

        const targetGrant = grantRes.ok ? await grantRes.json() : null;
        const targetSummary =
          summaryRes && summaryRes.ok ? await summaryRes.json() : null;

        if (!targetGrant) {
          throw new Error("Could not load target grant");
        }

        const res = await fetch(
          `/api/grants/${grant.reference_number}/similar/introduction`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceGrant: grant,
              sourceSummary: summary,
              targetGrant,
              targetSummary,
            }),
          }
        );

        if (!res.ok) throw new Error("Failed to generate introduction");
        const rationale: IntroductionRationale = await res.json();
        setIntroRationale(rationale);
      } catch {
        setIntroRationale(null);
        setIntroTarget(null);
      } finally {
        setIntroLoading(false);
      }
    },
    [grant, summary, introTarget, introRationale]
  );

  const handlePeerInsights = useCallback(async () => {
    if (insightsData) {
      setInsightsData(null);
      return;
    }

    if (!results || results.length === 0) return;

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const similarRefs = results.slice(0, 5).map((r) => r.reference_number);
      const res = await fetch(
        `/api/grants/${grant.reference_number}/similar/insights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceGrant: grant,
            sourceSummary: summary,
            similarRefs,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to generate insights");
      const insights: PeerInsights = await res.json();
      setInsightsData(insights);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setInsightsLoading(false);
    }
  }, [grant, summary, results, insightsData]);

  const formatScore = (score: number) => `${Math.round(score * 100)}%`;

  return (
    <div className="py-4 border-b border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Similar Grants</h3>
        {!results && !isLoading && (
          <button
            onClick={handleFindSimilar}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-600 text-gray-400 hover:text-gitlab-orange hover:border-gitlab-orange/50 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Similar
          </button>
        )}
        {results && (
          <button
            onClick={() => {
              setResults(null);
              setIntroTarget(null);
              setIntroRationale(null);
              setInsightsData(null);
              setError(null);
            }}
            className="text-[10px] px-2 py-1 text-gray-500 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4">
          <LoadingDots />
          <span className="text-xs text-gray-500">Searching for similar grants...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <p className="text-xs text-red-400/70 py-2">{error}</p>
      )}

      {/* Results */}
      {results && results.length === 0 && (
        <p className="text-xs text-gray-500 py-2">No similar grants found.</p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {/* Action bar */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handlePeerInsights}
              disabled={insightsLoading}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                insightsData
                  ? "border-blue-700/50 text-blue-400 bg-blue-900/10"
                  : "border-gray-600 text-gray-400 hover:text-blue-400 hover:border-blue-700/50"
              } disabled:opacity-50`}
            >
              {insightsLoading ? (
                <LoadingDots />
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {insightsData ? "Hide Peer Insights" : "Peer Insights"}
                </>
              )}
            </button>
            <button
              onClick={handleFindSimilar}
              className="text-[10px] px-2 py-1 rounded-lg border border-gray-600 text-gray-500 hover:text-gray-400 hover:border-gray-500 transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Peer Insights (global) */}
          {insightsError && (
            <p className="text-xs text-red-400/70 py-1">{insightsError}</p>
          )}

          {insightsData && (
            <div className="bg-blue-900/10 border border-blue-800/30 rounded-lg p-3 mb-3 space-y-3">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                Peer Insights — What Similar Grantees Learned
              </h4>

              {insightsData.challenges_faced.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-medium text-gray-400 mb-1">Challenges Faced</h5>
                  <ul className="space-y-1">
                    {insightsData.challenges_faced.map((c, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-red-400 flex-shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insightsData.what_worked.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-medium text-gray-400 mb-1">What Worked</h5>
                  <ul className="space-y-1">
                    {insightsData.what_worked.map((w, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-green-400 flex-shrink-0">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insightsData.practical_advice.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-medium text-gray-400 mb-1">Practical Advice</h5>
                  <ul className="space-y-1">
                    {insightsData.practical_advice.map((a, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-gitlab-orange flex-shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insightsData.source_grants.length > 0 && (
                <p className="text-[10px] text-gray-600 pt-1">
                  Based on documents from: {insightsData.source_grants.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Result cards */}
          {results.map((result) => (
            <div key={result.reference_number} className="space-y-0">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <button
                    onClick={() => onNavigateToGrant(result.reference_number)}
                    className="text-xs font-medium text-gray-100 hover:text-gitlab-orange transition-colors text-left truncate"
                  >
                    {result.grantee_name}
                  </button>
                  <span className="bg-gitlab-orange/10 text-gitlab-orange text-[10px] px-1.5 py-0.5 rounded flex-shrink-0">
                    {formatScore(result.similarity_score)} match
                  </span>
                </div>

                <p className="text-[10px] text-gray-500 mb-1.5">
                  {result.grantee_country}
                  {result.intervention_area_primary && ` • ${result.intervention_area_primary}`}
                  {result.primary_population_focus && ` • ${result.primary_population_focus}`}
                </p>

                {result.one_liner && (
                  <p className="text-[10px] text-gray-400 mb-2 italic">
                    {result.one_liner}
                  </p>
                )}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleWhyConnect(result.reference_number)}
                    disabled={introLoading && introTarget === result.reference_number}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      introTarget === result.reference_number && introRationale
                        ? "border-gitlab-orange/50 text-gitlab-orange bg-gitlab-orange/5"
                        : "border-gray-600 text-gray-500 hover:text-gitlab-orange hover:border-gitlab-orange/50"
                    } disabled:opacity-50`}
                  >
                    {introLoading && introTarget === result.reference_number
                      ? "Analyzing..."
                      : introTarget === result.reference_number && introRationale
                      ? "Hide"
                      : "Why connect?"}
                  </button>
                </div>
              </div>

              {/* Introduction rationale (inline below this card) */}
              {introTarget === result.reference_number && introLoading && (
                <div className="ml-3 mt-1 flex items-center gap-2 py-2">
                  <LoadingDots />
                  <span className="text-[10px] text-gray-500">Generating introduction...</span>
                </div>
              )}

              {introTarget === result.reference_number && introRationale && (
                <div className="ml-1 mt-1 bg-gitlab-orange/5 border border-gitlab-orange/20 rounded-lg p-3 space-y-2.5">
                  {/* Commonalities */}
                  {introRationale.commonalities.length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-medium text-gray-400 mb-1">
                        What They Share
                      </h5>
                      <ul className="space-y-0.5">
                        {introRationale.commonalities.map((c, i) => (
                          <li key={i} className="text-[10px] text-gray-300 flex gap-1.5">
                            <span className="text-gitlab-orange flex-shrink-0">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Learning opportunities */}
                  <div className="grid grid-cols-1 gap-2">
                    {introRationale.learning_opportunities.source_can_learn && (
                      <div>
                        <h5 className="text-[10px] font-medium text-gray-400 mb-0.5">
                          {grant.grantee_name} can learn
                        </h5>
                        <p className="text-[10px] text-gray-300">
                          {introRationale.learning_opportunities.source_can_learn}
                        </p>
                      </div>
                    )}
                    {introRationale.learning_opportunities.target_can_learn && (
                      <div>
                        <h5 className="text-[10px] font-medium text-gray-400 mb-0.5">
                          {result.grantee_name} can learn
                        </h5>
                        <p className="text-[10px] text-gray-300">
                          {introRationale.learning_opportunities.target_can_learn}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Suggested introduction */}
                  {introRationale.introduction_message && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-[10px] font-medium text-gray-400">
                          Suggested Introduction
                        </h5>
                        <CopyButton text={introRationale.introduction_message} />
                      </div>
                      <div className="bg-gray-900/50 rounded p-2 border border-gray-700/50">
                        <p className="text-[10px] text-gray-200 leading-relaxed">
                          {introRationale.introduction_message}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
