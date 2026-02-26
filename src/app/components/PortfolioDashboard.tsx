"use client";

import { useEffect, useState, useMemo } from "react";
import { CondensedGrant, PortfolioSummary } from "@/types/grants";
import { DocumentType } from "@/types/documents";
import { DocumentCoverageMap, DocumentCoverageResponse } from "@/types/dashboard";

interface PortfolioDashboardProps {
  grants: CondensedGrant[];
  portfolioSummary: PortfolioSummary;
  onClose: () => void;
}

const DOC_TYPES: { key: DocumentType; label: string; shortLabel: string }[] = [
  { key: "grant_description", label: "Grant Description", shortLabel: "Grant Desc" },
  { key: "midpoint_checkin_transcript", label: "Midpoint Transcript", shortLabel: "Midpoint" },
  { key: "midpoint_survey", label: "Midpoint Survey", shortLabel: "Mid Survey" },
  { key: "impact_survey", label: "Impact Survey", shortLabel: "Impact" },
  { key: "closeout_transcript", label: "Closeout Transcript", shortLabel: "Closeout" },
];

function formatMoney(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

type SortField = "name" | "country" | "rfp" | "totalDocs";
type SortDir = "asc" | "desc";

export default function PortfolioDashboard({
  grants,
  portfolioSummary,
  onClose,
}: PortfolioDashboardProps) {
  const [coverageMap, setCoverageMap] = useState<DocumentCoverageMap | null>(null);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "complete" | "incomplete">("all");

  // Fetch coverage data on mount
  useEffect(() => {
    const fetchCoverage = async () => {
      setIsLoadingCoverage(true);
      try {
        const res = await fetch("/api/dashboard/coverage");
        if (res.ok) {
          const data: DocumentCoverageResponse = await res.json();
          setCoverageMap(data.coverage);
        }
      } catch (error) {
        console.error("Failed to fetch document coverage:", error);
      } finally {
        setIsLoadingCoverage(false);
      }
    };
    fetchCoverage();
  }, []);

  // Compute per-RFP grant counts
  const rfpCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of grants) {
      const rfp = g.rfp || "Other";
      counts[rfp] = (counts[rfp] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [grants]);

  // Compute per-country grant counts
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of grants) {
      const country = g.country || "Unknown";
      counts[country] = (counts[country] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [grants]);

  // Compute coverage summary counts
  const coverageSummary = useMemo(() => {
    if (!coverageMap) return null;
    return DOC_TYPES.map((dt) => ({
      key: dt.key,
      label: dt.label,
      count: coverageMap[dt.key]?.length ?? 0,
    }));
  }, [coverageMap]);

  // Build coverage rows + apply filters + sorting
  const tableRows = useMemo(() => {
    const coverageSets: Record<DocumentType, Set<string>> = {} as Record<DocumentType, Set<string>>;
    if (coverageMap) {
      for (const dt of DOC_TYPES) {
        coverageSets[dt.key] = new Set(coverageMap[dt.key] || []);
      }
    }

    let rows = grants.map((g) => {
      const docs = coverageMap
        ? DOC_TYPES.reduce((count, dt) => count + (coverageSets[dt.key].has(g.ref) ? 1 : 0), 0)
        : 0;
      return {
        ref: g.ref,
        name: g.name,
        country: g.country,
        rfp: g.rfp,
        active: g.active,
        totalDocs: docs,
        hasDocs: coverageMap
          ? Object.fromEntries(DOC_TYPES.map((dt) => [dt.key, coverageSets[dt.key].has(g.ref)])) as Record<DocumentType, boolean>
          : ({} as Record<DocumentType, boolean>),
      };
    });

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.ref.toLowerCase().includes(q) ||
          r.country.toLowerCase().includes(q) ||
          r.rfp.toLowerCase().includes(q)
      );
    }

    // Coverage filter
    if (coverageFilter === "complete") {
      rows = rows.filter((r) => r.totalDocs === 5);
    } else if (coverageFilter === "incomplete") {
      rows = rows.filter((r) => r.totalDocs < 5);
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "country") cmp = a.country.localeCompare(b.country);
      else if (sortField === "rfp") cmp = a.rfp.localeCompare(b.rfp);
      else if (sortField === "totalDocs") cmp = a.totalDocs - b.totalDocs;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [grants, coverageMap, search, coverageFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const activeCount = portfolioSummary.active_grants;
  const completedCount = portfolioSummary.total_grants - activeCount;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-100">Portfolio Dashboard</h2>
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
        >
          Back to Chat
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* ===== STATS SECTION ===== */}
        <div className="mb-8">
          {/* Top stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Grants" value={portfolioSummary.total_grants.toString()} />
            <StatCard
              label="Active / Completed"
              value={`${activeCount} / ${completedCount}`}
              sub={`${((activeCount / portfolioSummary.total_grants) * 100).toFixed(0)}% active`}
            />
            <StatCard label="Total Invested" value={formatMoney(portfolioSummary.total_invested)} />
            <StatCard label="Countries" value={portfolioSummary.countries.length.toString()} />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Country breakdown */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Grants by Country</h3>
              <div className="space-y-2">
                {countryCounts.map(([country, count]) => (
                  <div key={country} className="flex justify-between items-center">
                    <span className="text-xs text-gray-300 truncate">{country}</span>
                    <span className="text-xs font-medium text-gray-100 ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RFP cohort breakdown */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">RFP Cohorts</h3>
              <div className="space-y-2">
                {rfpCounts.map(([rfp, count]) => (
                  <div key={rfp} className="flex justify-between items-center">
                    <span className="text-xs text-gray-300 truncate">{rfp}</span>
                    <span className="text-xs font-medium text-gray-100 ml-2">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio type breakdown */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Portfolio Types</h3>
              <div className="space-y-2">
                {Object.entries(portfolioSummary.portfolio_types)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-xs text-gray-300">{type || "Unclassified"}</span>
                      <span className="text-xs font-medium text-gray-100">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== DOCUMENT COVERAGE SECTION ===== */}
        <div>
          <h3 className="text-sm font-semibold text-gray-200 mb-4">Document Coverage</h3>

          {/* Coverage summary bar */}
          {coverageSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              {coverageSummary.map((cs) => (
                <div key={cs.key} className="bg-gray-900 rounded-lg border border-gray-800 px-3 py-2">
                  <div className="text-xs text-gray-500">{cs.label}</div>
                  <div className="text-sm font-semibold text-gray-100">
                    {cs.count}{" "}
                    <span className="text-xs font-normal text-gray-500">
                      / {portfolioSummary.total_grants}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grants..."
              className="w-full sm:w-64 text-xs rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-gitlab-orange focus:outline-none"
            />
            <div className="flex gap-1">
              {(["all", "incomplete", "complete"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setCoverageFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    coverageFilter === f
                      ? "border-gitlab-orange text-gitlab-orange bg-gitlab-orange/10"
                      : "border-gray-700 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f === "all" ? "All" : f === "incomplete" ? "Missing Docs" : "Complete"}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-600 ml-auto">
              {tableRows.length} grant{tableRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Coverage table */}
          {isLoadingCoverage ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-800 rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="border-b border-gray-700">
                    <th
                      className="text-left px-3 py-2 text-gray-400 font-semibold cursor-pointer hover:text-gray-200 whitespace-nowrap"
                      onClick={() => handleSort("name")}
                    >
                      Grantee {sortIcon("name")}
                    </th>
                    <th
                      className="text-left px-3 py-2 text-gray-400 font-semibold cursor-pointer hover:text-gray-200 whitespace-nowrap"
                      onClick={() => handleSort("country")}
                    >
                      Country {sortIcon("country")}
                    </th>
                    <th
                      className="text-left px-3 py-2 text-gray-400 font-semibold cursor-pointer hover:text-gray-200 whitespace-nowrap"
                      onClick={() => handleSort("rfp")}
                    >
                      RFP {sortIcon("rfp")}
                    </th>
                    {DOC_TYPES.map((dt) => (
                      <th
                        key={dt.key}
                        className="text-center px-2 py-2 text-gray-400 font-semibold whitespace-nowrap"
                        title={dt.label}
                      >
                        {dt.shortLabel}
                      </th>
                    ))}
                    <th
                      className="text-center px-2 py-2 text-gray-400 font-semibold cursor-pointer hover:text-gray-200 whitespace-nowrap"
                      onClick={() => handleSort("totalDocs")}
                    >
                      Total {sortIcon("totalDocs")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.ref}
                      className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-gray-200 max-w-[200px] truncate" title={row.name}>
                        {row.name}
                        <span className="text-gray-600 ml-1">{row.ref}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{row.country}</td>
                      <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate" title={row.rfp}>
                        {row.rfp}
                      </td>
                      {DOC_TYPES.map((dt) => (
                        <td key={dt.key} className="text-center px-2 py-2">
                          {row.hasDocs[dt.key] ? (
                            <span className="text-green-400" title="Available">✓</span>
                          ) : (
                            <span className="text-gray-700" title="Missing">✗</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center px-2 py-2">
                        <span
                          className={`text-xs font-medium ${
                            row.totalDocs === 5
                              ? "text-green-400"
                              : row.totalDocs >= 3
                              ? "text-yellow-400"
                              : row.totalDocs > 0
                              ? "text-orange-400"
                              : "text-gray-600"
                          }`}
                        >
                          {row.totalDocs}/5
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-100">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
