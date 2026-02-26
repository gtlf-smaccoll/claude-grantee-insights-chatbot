"use client";

import { useEffect, useState } from "react";
import { GrantRecord, GrantSummaryCard, GrantComparisonAnalysis } from "@/types/grants";

interface GrantComparisonProps {
  grants: GrantRecord[];
  summaries: (GrantSummaryCard | null)[];
  isLoading: boolean;
  onClose: () => void;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  return new Date(value).toLocaleDateString();
}

// Determine if a numeric value is the "best" among peers (for highlighting)
type HighlightMode = "max" | "min" | "none";

function getBestIndex(
  values: (number | null | undefined)[],
  mode: HighlightMode
): number | null {
  if (mode === "none") return null;
  const valid = values.map((v, i) => ({ v, i })).filter((x) => x.v != null);
  if (valid.length < 2) return null;
  if (mode === "max") {
    return valid.reduce((best, curr) => (curr.v! > best.v! ? curr : best)).i;
  }
  return valid.reduce((best, curr) => (curr.v! < best.v! ? curr : best)).i;
}

function ComparisonSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-gray-800">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetricRow({
  label,
  values,
  highlight = "none",
}: {
  label: string;
  values: string[];
  highlight?: HighlightMode;
  rawValues?: (number | null | undefined)[];
}) {
  return (
    <div className="flex items-center py-1.5 px-4 hover:bg-gray-900/30">
      <div className="w-44 flex-shrink-0 text-xs text-gray-500">{label}</div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((val, i) => (
          <div key={i} className="text-sm text-gray-200 px-3">
            {val}
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightMetricRow({
  label,
  rawValues,
  formatter,
  highlight,
}: {
  label: string;
  rawValues: (number | null | undefined)[];
  formatter: (v: number | null | undefined) => string;
  highlight: HighlightMode;
}) {
  const bestIdx = getBestIndex(rawValues, highlight);
  return (
    <div className="flex items-center py-1.5 px-4 hover:bg-gray-900/30">
      <div className="w-44 flex-shrink-0 text-xs text-gray-500">{label}</div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${rawValues.length}, 1fr)` }}>
        {rawValues.map((val, i) => (
          <div
            key={i}
            className={`text-sm px-3 ${
              bestIdx === i ? "text-green-400 font-medium" : "text-gray-200"
            }`}
          >
            {formatter(val)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextRow({
  label,
  values,
}: {
  label: string;
  values: (string | null | undefined)[];
}) {
  return (
    <div className="flex items-start py-1.5 px-4 hover:bg-gray-900/30">
      <div className="w-44 flex-shrink-0 text-xs text-gray-500 pt-0.5">{label}</div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((val, i) => (
          <div key={i} className="text-sm text-gray-200 px-3">
            {val || "\u2014"}
          </div>
        ))}
      </div>
    </div>
  );
}

function BulletListRow({
  label,
  lists,
  color = "text-gitlab-orange",
}: {
  label: string;
  lists: (string[] | undefined)[];
  color?: string;
}) {
  return (
    <div className="flex items-start py-1.5 px-4 hover:bg-gray-900/30">
      <div className="w-44 flex-shrink-0 text-xs text-gray-500 pt-0.5">{label}</div>
      <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${lists.length}, 1fr)` }}>
        {lists.map((items, i) => (
          <div key={i} className="px-3">
            {items && items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item, j) => (
                  <li key={j} className="text-xs text-gray-300 flex gap-1.5">
                    <span className={`${color} flex-shrink-0`}>&bull;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-gray-600">&mdash;</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GrantComparison({
  grants,
  summaries,
  isLoading,
  onClose,
}: GrantComparisonProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 bg-gray-950 items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm text-gray-400">Loading comparison data...</span>
        </div>
      </div>
    );
  }

  const [analysis, setAnalysis] = useState<GrantComparisonAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Fetch AI comparative analysis when grants + summaries are ready
  useEffect(() => {
    if (grants.length < 2) return;

    const fetchAnalysis = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const res = await fetch("/api/grants/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grants, summaries }),
        });
        if (res.ok) {
          const data: GrantComparisonAnalysis = await res.json();
          setAnalysis(data);
        } else if (res.status === 503) {
          // API not configured — skip silently
          setAnalysis(null);
        } else {
          setAnalysisError("Failed to generate analysis");
        }
      } catch (err) {
        console.error("Comparison analysis fetch failed:", err);
        setAnalysisError("Failed to generate analysis");
      } finally {
        setAnalysisLoading(false);
      }
    };

    fetchAnalysis();
  }, [grants, summaries]);

  if (grants.length < 2) return null;

  const colCount = grants.length;

  return (
    <div className="flex flex-col flex-1 bg-gray-950 min-h-0">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 flex-shrink-0 bg-gray-950">
        <h2 className="text-sm font-semibold text-gray-100">
          Comparing {colCount} Grants
        </h2>
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
        >
          Close Comparison
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Grant header cards */}
        <div className="flex items-start py-4 px-4 border-b border-gray-800">
          <div className="w-44 flex-shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
            {grants.map((g, i) => (
              <div key={g.reference_number} className="px-3">
                <h3 className="text-sm font-semibold text-gray-100 truncate" title={g.grantee_name}>
                  {g.grantee_name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {g.reference_number} &bull; {g.grantee_country}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      g.active
                        ? "bg-green-900/30 text-green-400"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {g.active ? "Active" : "Completed"}
                  </span>
                  <span className="text-[10px] text-gray-600">{g.rfp}</span>
                </div>
                {/* AI one-liner */}
                {summaries[i]?.one_liner && (
                  <p className="text-xs text-gitlab-orange mt-2 leading-relaxed">
                    {summaries[i]!.one_liner}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Comparative Analysis */}
        <div className="py-5 px-4 border-b border-gray-800 bg-gray-900/30">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-gitlab-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-100">AI Comparative Analysis</h3>
            {analysisLoading && (
              <div className="flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gitlab-orange rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          {analysisLoading && (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-800 rounded w-5/6" />
              <div className="h-3 bg-gray-800 rounded w-full" />
              <div className="h-3 bg-gray-800 rounded w-4/5" />
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="h-20 bg-gray-800 rounded" />
                <div className="h-20 bg-gray-800 rounded" />
                <div className="h-20 bg-gray-800 rounded" />
              </div>
            </div>
          )}

          {analysisError && !analysisLoading && (
            <p className="text-xs text-red-400/70">{analysisError}</p>
          )}

          {analysis && !analysisLoading && (
            <div className="space-y-5">
              {/* Overall Assessment */}
              <p className="text-sm text-gray-300 leading-relaxed">
                {analysis.overall_assessment}
              </p>

              {/* Verdict cards */}
              <div className={`grid gap-3 ${colCount === 2 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-3"}`}>
                {/* Goal Completion */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-green-400 text-sm">🏆</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Goal Completion</span>
                  </div>
                  <p className="text-xs font-medium text-green-400 mb-1.5">{analysis.goal_completion.leader}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{analysis.goal_completion.analysis}</p>
                </div>

                {/* ROI Performance */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-gitlab-orange text-sm">📈</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">ROI Performance</span>
                  </div>
                  <p className="text-xs font-medium text-gitlab-orange mb-1.5">{analysis.roi_performance.leader}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{analysis.roi_performance.analysis}</p>
                </div>

                {/* Toughest Challenges */}
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-red-400 text-sm">⚡</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Toughest Challenges</span>
                  </div>
                  <p className="text-xs font-medium text-red-400 mb-1.5">{analysis.challenges_comparison.hardest}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{analysis.challenges_comparison.analysis}</p>
                </div>
              </div>

              {/* Key Differences */}
              {analysis.key_differences.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 mb-2">Key Differences</h4>
                  <ul className="space-y-1.5">
                    {analysis.key_differences.map((diff, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-gitlab-orange flex-shrink-0">•</span>
                        <span>{diff}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              {analysis.recommendation && (
                <div className="bg-gitlab-orange/5 border border-gitlab-orange/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-300">
                    <span className="font-semibold text-gitlab-orange">Insight: </span>
                    {analysis.recommendation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Summaries */}
        <ComparisonSection title="Per-Grant AI Summary">
          <TextRow
            label="Project Summary"
            values={summaries.map((s) => s?.project_summary)}
          />
          <BulletListRow
            label="Key Findings"
            lists={summaries.map((s) => s?.key_findings)}
          />
          <BulletListRow
            label="Challenges"
            lists={summaries.map((s) => s?.challenges)}
            color="text-red-400"
          />
          <TextRow
            label="Outcomes"
            values={summaries.map((s) => s?.outcomes_summary)}
          />
          <TextRow
            label="What's Next"
            values={summaries.map((s) => s?.follow_on_plans)}
          />
        </ComparisonSection>

        {/* Financial */}
        <ComparisonSection title="Financial">
          <HighlightMetricRow
            label="Grant Amount"
            rawValues={grants.map((g) => g.grant_amount)}
            formatter={formatNumber}
            highlight="max"
          />
          <HighlightMetricRow
            label="Total Investment"
            rawValues={grants.map((g) => g.total_investment_including_overhead)}
            formatter={formatNumber}
            highlight="max"
          />
          <HighlightMetricRow
            label="Co-Investment"
            rawValues={grants.map((g) => g.additional_co_investment_amounts)}
            formatter={formatNumber}
            highlight="max"
          />
          <HighlightMetricRow
            label="Cost Per Person"
            rawValues={grants.map((g) => g.cost_per_person)}
            formatter={formatNumber}
            highlight="min"
          />
        </ComparisonSection>

        {/* Impact Metrics */}
        <ComparisonSection title="Impact Metrics">
          <HighlightMetricRow
            label="People Served"
            rawValues={grants.map((g) => g.estimated_total_people_served)}
            formatter={(v) => (v != null ? v.toLocaleString() : "\u2014")}
            highlight="max"
          />
          <HighlightMetricRow
            label="ROI (Lifetime Income)"
            rawValues={grants.map((g) => g.roi_lifetime_income_gain)}
            formatter={(v) => (v != null ? v.toFixed(1) : "\u2014")}
            highlight="max"
          />
          <HighlightMetricRow
            label="Income Change %"
            rawValues={grants.map((g) => g.pct_change_in_annual_income)}
            formatter={formatPercent}
            highlight="max"
          />
          <HighlightMetricRow
            label="Post-Intervention Income"
            rawValues={grants.map((g) => g.post_intervention_income_avg)}
            formatter={formatNumber}
            highlight="max"
          />
          <TextRow
            label="Evidence Quality"
            values={grants.map((g) => g.evidence_quality_assessment)}
          />
          <TextRow
            label="Execution Risk"
            values={grants.map((g) => g.execution_risk)}
          />
        </ComparisonSection>

        {/* Timeline */}
        <ComparisonSection title="Timeline">
          <MetricRow
            label="Approval Date"
            values={grants.map((g) => formatDate(g.grant_approval_date))}
          />
          <MetricRow
            label="Start Date"
            values={grants.map((g) => formatDate(g.grant_start_date))}
          />
          <MetricRow
            label="Close Date"
            values={grants.map((g) => formatDate(g.grant_close_date))}
          />
          <MetricRow
            label="Duration (Years)"
            values={grants.map((g) => g.grant_years_length?.toString() || "\u2014")}
          />
        </ComparisonSection>

        {/* Demographics */}
        <ComparisonSection title="Demographics">
          <TextRow
            label="Leadership Gender"
            values={grants.map((g) => g.leadership_gender)}
          />
          <TextRow
            label="Leadership Ethnicity"
            values={grants.map((g) => g.leadership_ethnicity)}
          />
          <HighlightMetricRow
            label="Women Impacted %"
            rawValues={grants.map((g) => g.women_impacted_percent)}
            formatter={formatPercent}
            highlight="max"
          />
          <HighlightMetricRow
            label="Historically Marginalized %"
            rawValues={grants.map((g) => g.historically_marginalized_percent)}
            formatter={formatPercent}
            highlight="max"
          />
          <TextRow
            label="Immigrants/Refugees"
            values={grants.map((g) => g.immigrants_or_refugees)}
          />
          <TextRow
            label="Justice Involved"
            values={grants.map((g) => g.justice_involved)}
          />
        </ComparisonSection>

        {/* Classification */}
        <ComparisonSection title="Classification">
          <TextRow
            label="Primary Intervention"
            values={grants.map((g) => g.intervention_area_primary)}
          />
          <TextRow
            label="Impact Pathway"
            values={grants.map((g) => g.impact_pathway)}
          />
          <TextRow
            label="Labor Market Sector"
            values={grants.map((g) => g.labor_market_sector)}
          />
          <TextRow
            label="Project Mechanism"
            values={grants.map((g) => g.project_mechanism)}
          />
          <TextRow
            label="Population Focus"
            values={grants.map((g) => g.primary_population_focus)}
          />
          <TextRow
            label="Portfolio Type"
            values={grants.map((g) => g.grant_portfolio_type)}
          />
          <TextRow
            label="Strategic Alignment"
            values={grants.map((g) => g.strategic_alignment)}
          />
        </ComparisonSection>
      </div>
    </div>
  );
}
