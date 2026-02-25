"use client";

import { CondensedGrant } from "@/types/grants";

interface FilterPanelProps {
  grants: CondensedGrant[];
  filteredGrants: CondensedGrant[];
  filters: {
    country?: string;
    rfp?: string;
    intervention?: string;
    active?: boolean;
  };
  onFilterChange: (filters: FilterPanelProps["filters"]) => void;
  onApplyToChat?: (grants: CondensedGrant[]) => void;
  resultCount: number;
}

export default function FilterPanel({
  grants,
  filteredGrants,
  filters,
  onFilterChange,
  onApplyToChat,
  resultCount,
}: FilterPanelProps) {
  // Extract unique values from grants
  const countries = Array.from(
    new Set(grants.map((g) => g.country).filter(Boolean))
  ).sort();

  const rfps = Array.from(
    new Set(grants.map((g) => g.rfp).filter(Boolean))
  ).sort();

  const interventions = Array.from(
    new Set(grants.map((g) => g.intervention).filter(Boolean))
  ).sort();

  const handleCountryChange = (value: string) => {
    onFilterChange({
      ...filters,
      country: value || undefined,
    });
  };

  const handleRfpChange = (value: string) => {
    onFilterChange({
      ...filters,
      rfp: value || undefined,
    });
  };

  const handleInterventionChange = (value: string) => {
    onFilterChange({
      ...filters,
      intervention: value || undefined,
    });
  };

  const handleActiveChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      active: checked ? true : undefined,
    });
  };

  const handleResetFilters = () => {
    onFilterChange({
      country: undefined,
      rfp: undefined,
      intervention: undefined,
      active: undefined,
    });
  };

  return (
    <div className="px-4 py-3 border-b border-gray-700 space-y-3">
      {/* Search and results summary */}
      <div className="text-xs text-gray-500">
        {resultCount} grants
        {resultCount < grants.length && ` (filtered)`}
      </div>

      {/* Country filter */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Country
        </label>
        <select
          value={filters.country || ""}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="w-full text-xs rounded border border-gray-600 bg-gray-800 text-gray-100 px-2 py-1.5 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange"
        >
          <option value="">All countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      {/* RFP filter */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          RFP Cohort
        </label>
        <select
          value={filters.rfp || ""}
          onChange={(e) => handleRfpChange(e.target.value)}
          className="w-full text-xs rounded border border-gray-600 bg-gray-800 text-gray-100 px-2 py-1.5 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange"
        >
          <option value="">All cohorts</option>
          {rfps.map((rfp) => (
            <option key={rfp} value={rfp}>
              {rfp}
            </option>
          ))}
        </select>
      </div>

      {/* Intervention Area filter */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Intervention Area
        </label>
        <select
          value={filters.intervention || ""}
          onChange={(e) => handleInterventionChange(e.target.value)}
          className="w-full text-xs rounded border border-gray-600 bg-gray-800 text-gray-100 px-2 py-1.5 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange"
        >
          <option value="">All interventions</option>
          {interventions.map((intervention) => (
            <option key={intervention} value={intervention}>
              {intervention}
            </option>
          ))}
        </select>
      </div>

      {/* Active status filter */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active-filter"
          checked={filters.active === true}
          onChange={(e) => handleActiveChange(e.target.checked)}
          className="rounded border border-gray-600 w-4 h-4 cursor-pointer"
        />
        <label
          htmlFor="active-filter"
          className="text-xs font-medium text-gray-400 cursor-pointer"
        >
          Active grants only
        </label>
      </div>

      {/* Reset button */}
      {(filters.country ||
        filters.rfp ||
        filters.intervention ||
        filters.active) && (
        <button
          onClick={handleResetFilters}
          className="w-full text-xs text-gray-400 hover:text-gray-300 py-1 border border-gray-600 rounded hover:border-gray-500 transition-colors"
        >
          Reset filters
        </button>
      )}

      {/* Apply to Chat button */}
      {onApplyToChat && resultCount > 0 && (
        <button
          onClick={() => onApplyToChat(filteredGrants)}
          className="w-full text-xs font-medium text-white bg-gitlab-orange hover:bg-orange-600 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={resultCount === grants.length && !filters.country && !filters.rfp && !filters.intervention && !filters.active}
        >
          Apply to Chat ({resultCount})
        </button>
      )}
    </div>
  );
}
