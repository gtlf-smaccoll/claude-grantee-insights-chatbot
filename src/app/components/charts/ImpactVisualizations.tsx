"use client";

import React, { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { CondensedGrant } from "@/types/grants";

// Dynamic imports with SSR disabled — Recharts uses browser APIs
const ROIScatterChart = dynamic(() => import("./ROIScatterChart"), {
  ssr: false,
  loading: () => <ChartPlaceholder />,
});
const CumulativeImpactChart = dynamic(
  () => import("./CumulativeImpactChart"),
  { ssr: false, loading: () => <ChartPlaceholder /> }
);
const LifetimeEarningsChart = dynamic(
  () => import("./LifetimeEarningsChart"),
  { ssr: false, loading: () => <ChartPlaceholder /> }
);
const PortfolioCompositionChart = dynamic(
  () => import("./PortfolioCompositionChart"),
  { ssr: false, loading: () => <ChartPlaceholder /> }
);
const ROISummaryTable = dynamic(() => import("./ROISummaryTable"), {
  ssr: false,
  loading: () => <ChartPlaceholder />,
});

function ChartPlaceholder() {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 h-[340px] flex items-center justify-center">
      <div className="text-xs text-gray-600 animate-pulse">
        Loading chart...
      </div>
    </div>
  );
}

// Error boundary to prevent chart crashes from taking down the whole page
class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-900 rounded-lg border border-red-900/50 p-4 h-[340px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-red-400 mb-1">
              {this.props.name} failed to load
            </p>
            <p className="text-[10px] text-gray-600">{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ImpactVisualizationsProps {
  grants: CondensedGrant[];
}

type ViewTab = "charts" | "summary";

interface ChartFilters {
  fiscalYear?: number;
  country?: string;
  rfp?: string;
  strategicAlignment?: string;
}

export default function ImpactVisualizations({
  grants,
}: ImpactVisualizationsProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("charts");
  const [filters, setFilters] = useState<ChartFilters>({});

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const fiscalYears = Array.from(
      new Set(
        grants
          .map((g) => g.fiscal_year)
          .filter((fy): fy is number => fy != null)
      )
    ).sort((a, b) => a - b);

    const countries = Array.from(
      new Set(grants.map((g) => g.country || "").filter(Boolean))
    ).sort();

    const rfps = Array.from(
      new Set(grants.map((g) => g.rfp || "").filter(Boolean))
    ).sort();

    const strategicAlignments = Array.from(
      new Set(grants.map((g) => g.strategic_alignment || "").filter(Boolean))
    ).sort();

    return { fiscalYears, countries, rfps, strategicAlignments };
  }, [grants]);

  // Apply filters to grants
  const filteredGrants = useMemo(() => {
    let result = grants;

    if (filters.fiscalYear != null) {
      result = result.filter((g) => g.fiscal_year === filters.fiscalYear);
    }
    if (filters.country) {
      result = result.filter((g) => g.country === filters.country);
    }
    if (filters.rfp) {
      result = result.filter((g) => g.rfp === filters.rfp);
    }
    if (filters.strategicAlignment) {
      result = result.filter(
        (g) => g.strategic_alignment === filters.strategicAlignment
      );
    }

    return result;
  }, [grants, filters]);

  const hasActiveFilters =
    filters.fiscalYear != null ||
    filters.country != null ||
    filters.rfp != null ||
    filters.strategicAlignment != null;

  const handleResetFilters = () => {
    setFilters({});
  };

  const selectClass =
    "text-[11px] rounded border border-gray-700 bg-gray-800 text-gray-300 px-2 py-1 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange";

  return (
    <div className="mb-8">
      {/* Header with tab toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-200">Impact & ROI</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-2">View:</span>
          <button
            onClick={() => setActiveTab("charts")}
            className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
              activeTab === "charts"
                ? "bg-gitlab-orange text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-300"
            }`}
          >
            Charts
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`text-[10px] px-2.5 py-1 rounded transition-colors ${
              activeTab === "summary"
                ? "bg-gitlab-orange text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-300"
            }`}
          >
            Summary
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Fiscal Year */}
        <select
          value={filters.fiscalYear ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              fiscalYear: e.target.value ? Number(e.target.value) : undefined,
            }))
          }
          className={selectClass}
        >
          <option value="">All Fiscal Years</option>
          {filterOptions.fiscalYears.map((fy) => (
            <option key={fy} value={fy}>
              FY {fy}
            </option>
          ))}
        </select>

        {/* Country */}
        <select
          value={filters.country ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              country: e.target.value || undefined,
            }))
          }
          className={selectClass}
        >
          <option value="">All Countries</option>
          {filterOptions.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* RFP */}
        <select
          value={filters.rfp ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              rfp: e.target.value || undefined,
            }))
          }
          className={selectClass}
        >
          <option value="">All RFP Cohorts</option>
          {filterOptions.rfps.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Strategic Alignment */}
        <select
          value={filters.strategicAlignment ?? ""}
          onChange={(e) =>
            setFilters((f) => ({
              ...f,
              strategicAlignment: e.target.value || undefined,
            }))
          }
          className={selectClass}
        >
          <option value="">All Alignments</option>
          {filterOptions.strategicAlignments.map((sa) => (
            <option key={sa} value={sa}>
              {sa}
            </option>
          ))}
        </select>

        {/* Reset + filtered count */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="text-[10px] text-gray-500 hover:text-gray-300 underline transition-colors"
            >
              Reset
            </button>
            <span className="text-[10px] text-gray-500">
              {filteredGrants.length} of {grants.length} grants
            </span>
          </div>
        )}
      </div>

      {/* Charts view */}
      {activeTab === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartErrorBoundary name="ROI Scatter Chart">
            <ROIScatterChart grants={filteredGrants} />
          </ChartErrorBoundary>
          <ChartErrorBoundary name="Cumulative Impact Chart">
            <CumulativeImpactChart grants={filteredGrants} />
          </ChartErrorBoundary>
          <ChartErrorBoundary name="Lifetime Earnings Chart">
            <LifetimeEarningsChart grants={filteredGrants} />
          </ChartErrorBoundary>
          <ChartErrorBoundary name="Portfolio Composition">
            <PortfolioCompositionChart grants={filteredGrants} />
          </ChartErrorBoundary>
        </div>
      )}

      {/* Summary view */}
      {activeTab === "summary" && (
        <ChartErrorBoundary name="ROI Summary">
          <ROISummaryTable grants={filteredGrants} />
        </ChartErrorBoundary>
      )}
    </div>
  );
}
