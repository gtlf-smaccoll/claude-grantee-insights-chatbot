"use client";

import { useState, useMemo } from "react";
import { CondensedGrant } from "@/types/grants";
import FilterPanel from "./FilterPanel";

interface GrantSidebarProps {
  grants: CondensedGrant[];
  onSelectGrant: (grant: CondensedGrant) => void;
  onApplyFiltersToChat?: (grants: CondensedGrant[]) => void;
  selectedGrantRef?: string;
  isLoadingGrant?: boolean;
  isCompareMode?: boolean;
  compareRefs?: string[];
  onToggleCompareMode?: () => void;
  onToggleCompareGrant?: (grant: CondensedGrant) => void;
  onExecuteComparison?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function GrantSidebar({
  grants,
  onSelectGrant,
  onApplyFiltersToChat,
  selectedGrantRef,
  isLoadingGrant = false,
  isCompareMode = false,
  compareRefs = [],
  onToggleCompareMode,
  onToggleCompareGrant,
  onExecuteComparison,
  isOpen = false,
  onClose,
}: GrantSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{
    country?: string;
    rfp?: string;
    intervention?: string;
    active?: boolean;
  }>({});

  // Compute filtered list
  const filteredGrants = useMemo(() => {
    let result = grants;

    // Filter by search (name or title)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (grant) =>
          grant.name.toLowerCase().includes(query) ||
          grant.title.toLowerCase().includes(query)
      );
    }

    // Filter by country
    if (filters.country) {
      result = result.filter((grant) => grant.country.trim() === filters.country);
    }

    // Filter by RFP
    if (filters.rfp) {
      result = result.filter((grant) => grant.rfp.trim() === filters.rfp);
    }

    // Filter by intervention
    if (filters.intervention) {
      result = result.filter(
        (grant) => grant.intervention.trim() === filters.intervention
      );
    }

    // Filter by active status
    if (filters.active === true) {
      result = result.filter((grant) => grant.active);
    }

    return result;
  }, [grants, searchQuery, filters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleResetSearch = () => {
    setSearchQuery("");
  };

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-gray-700 bg-gray-950
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:transition-none
        ${isOpen ? 'flex' : 'hidden lg:flex'}
      `}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-gray-100">
              {isCompareMode ? "Compare Grants" : "Grant Portfolio"}
            </h1>
            <p className="text-xs text-gray-500">
              {isCompareMode
                ? `${compareRefs.length} of 3 selected`
                : `${grants.length} grants`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCompareMode}
              className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                isCompareMode
                  ? "border-gitlab-orange text-gitlab-orange bg-gitlab-orange/10"
                  : "border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-500"
              }`}
            >
              {isCompareMode ? "Exit" : "Compare"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden text-gray-400 hover:text-gray-200 p-1"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search grants..."
            className="w-full text-xs rounded border border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-500 px-3 py-2 focus:border-gitlab-orange focus:outline-none focus:ring-1 focus:ring-gitlab-orange"
          />
          {searchQuery && (
            <button
              onClick={handleResetSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      <FilterPanel
        grants={grants}
        filteredGrants={filteredGrants}
        filters={filters}
        onFilterChange={setFilters}
        onApplyToChat={onApplyFiltersToChat}
        resultCount={filteredGrants.length}
      />

      {/* Grants list */}
      <div className="flex-1 overflow-y-auto">
        {filteredGrants.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-gray-500">No grants found</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredGrants.map((grant) => {
              const isChecked = compareRefs.includes(grant.ref);
              const isMaxed = compareRefs.length >= 3 && !isChecked;

              if (isCompareMode) {
                return (
                  <button
                    key={grant.ref}
                    onClick={() => onToggleCompareGrant?.(grant)}
                    disabled={isMaxed}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                      isChecked
                        ? "bg-gitlab-orange/10 border-l-2 border-gitlab-orange text-gray-100"
                        : isMaxed
                        ? "text-gray-600 cursor-not-allowed"
                        : "hover:bg-gray-800 text-gray-300 hover:text-gray-100"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                        isChecked
                          ? "bg-gitlab-orange border-gitlab-orange"
                          : isMaxed
                          ? "border-gray-700 bg-gray-800"
                          : "border-gray-500"
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{grant.name}</div>
                      <div className="text-gray-500 text-xs truncate">
                        {grant.ref} • {grant.country}
                      </div>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={grant.ref}
                  onClick={() => onSelectGrant(grant)}
                  disabled={isLoadingGrant && selectedGrantRef === grant.ref}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    selectedGrantRef === grant.ref
                      ? "bg-gitlab-orange text-white"
                      : "hover:bg-gray-800 text-gray-300 hover:text-gray-100"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-medium truncate">{grant.name}</div>
                  <div className="text-gray-500 text-xs truncate">
                    {grant.ref} • {grant.country}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {isCompareMode ? (
        <div className="px-4 py-3 border-t border-gray-700 space-y-2">
          {compareRefs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {compareRefs.map((ref) => {
                const g = grants.find((gr) => gr.ref === ref);
                return (
                  <span
                    key={ref}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gitlab-orange/15 text-gitlab-orange border border-gitlab-orange/30"
                  >
                    {g?.name?.slice(0, 15) || ref}
                    <button
                      onClick={() => onToggleCompareGrant?.(g || { ref } as CondensedGrant)}
                      className="hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onExecuteComparison}
              disabled={compareRefs.length < 2}
              className="flex-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-gitlab-orange text-white hover:bg-gitlab-orange/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Compare ({compareRefs.length})
            </button>
            <button
              onClick={onToggleCompareMode}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 truncate">Grants Index</p>
        </div>
      )}
    </aside>
  );
}
