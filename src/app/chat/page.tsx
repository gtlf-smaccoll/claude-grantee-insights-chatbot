"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GrantRegistry, GrantRecord, CondensedGrant, GrantSummaryCard } from "@/types/grants";
import ChatInterface from "../components/ChatInterface";
import GrantSidebar from "../components/GrantSidebar";
import GrantProfile from "../components/GrantProfile";
import PortfolioDashboard from "../components/PortfolioDashboard";
import GrantComparison from "../components/GrantComparison";

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [grantRegistry, setGrantRegistry] = useState<GrantRegistry | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<GrantRecord | null>(null);
  const [selectedGrantRef, setSelectedGrantRef] = useState<string | undefined>();
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(true);
  const [isLoadingGrant, setIsLoadingGrant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopedGrants, setScopedGrants] = useState<CondensedGrant[] | null>(null);
  const [scopedGrantRefs, setScopedGrantRefs] = useState<string[] | undefined>();
  const [showDashboard, setShowDashboard] = useState(false);

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareRefs, setCompareRefs] = useState<string[]>([]);
  const [compareGrants, setCompareGrants] = useState<GrantRecord[]>([]);
  const [compareSummaries, setCompareSummaries] = useState<(GrantSummaryCard | null)[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch grant registry on mount
  useEffect(() => {
    const fetchRegistry = async () => {
      try {
        setIsLoadingRegistry(true);
        const res = await fetch("/api/grants");
        if (!res.ok) throw new Error("Failed to fetch grants");
        const data: GrantRegistry = await res.json();
        setGrantRegistry(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading grants");
        console.error("Failed to fetch grant registry:", err);
      } finally {
        setIsLoadingRegistry(false);
      }
    };

    if (session) {
      fetchRegistry();
    }
  }, [session]);

  // Fetch full grant details when a grant is selected
  const handleSelectGrant = async (grant: CondensedGrant) => {
    try {
      setSelectedGrantRef(grant.ref);
      setIsLoadingGrant(true);
      const res = await fetch(`/api/grants/${grant.ref}`);
      if (!res.ok) throw new Error("Failed to fetch grant details");
      const data: GrantRecord = await res.json();
      setSelectedGrant(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading grant");
      console.error("Failed to fetch grant details:", err);
    } finally {
      setIsLoadingGrant(false);
    }
  };

  const handleCloseProfile = () => {
    setSelectedGrant(null);
    setSelectedGrantRef(undefined);
  };

  const handleApplyFiltersToChat = (grants: CondensedGrant[]) => {
    setScopedGrants(grants);
    setScopedGrantRefs(grants.map((g) => g.ref));
  };

  const handleClearScope = () => {
    setScopedGrants(null);
    setScopedGrantRefs(undefined);
  };

  // Compare mode handlers
  const handleToggleCompareMode = () => {
    if (isCompareMode) {
      setIsCompareMode(false);
      setCompareRefs([]);
      setCompareGrants([]);
      setCompareSummaries([]);
    } else {
      setIsCompareMode(true);
      handleCloseProfile();
    }
  };

  const handleToggleCompareGrant = (grant: CondensedGrant) => {
    setCompareRefs((prev) => {
      if (prev.includes(grant.ref)) {
        return prev.filter((r) => r !== grant.ref);
      }
      if (prev.length >= 3) return prev;
      return [...prev, grant.ref];
    });
  };

  const handleExecuteComparison = async () => {
    if (compareRefs.length < 2) return;
    setIsLoadingComparison(true);
    setShowDashboard(false);

    try {
      const [grantResults, summaryResults] = await Promise.all([
        Promise.all(
          compareRefs.map((ref) =>
            fetch(`/api/grants/${ref}`).then((r) => (r.ok ? r.json() as Promise<GrantRecord> : null))
          )
        ),
        Promise.all(
          compareRefs.map((ref) =>
            fetch(`/api/grants/${ref}/summary`)
              .then((r) => (r.ok ? r.json() as Promise<GrantSummaryCard> : null))
              .catch(() => null)
          )
        ),
      ]);

      const validGrants = grantResults.filter((g): g is GrantRecord => g !== null);
      setCompareGrants(validGrants);
      setCompareSummaries(summaryResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      console.error("Comparison fetch failed:", err);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const handleCloseComparison = () => {
    setCompareGrants([]);
    setCompareSummaries([]);
  };

  // Navigate to a different grant from within GrantProfile (e.g. from Similar Grants)
  const handleNavigateToGrant = (referenceNumber: string) => {
    const target = grantRegistry?.grants.find((g) => g.ref === referenceNumber);
    if (target) {
      handleSelectGrant(target);
    }
  };

  // Show loading state while session is loading
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show authenticated content
  if (status === "authenticated") {
    return (
      <div className={`flex h-screen ${sidebarOpen ? 'overflow-hidden' : ''}`}>
        {/* Sidebar with grant list */}
        {grantRegistry && (
          <GrantSidebar
            grants={grantRegistry.grants}
            onSelectGrant={(grant) => {
              handleSelectGrant(grant);
              setSidebarOpen(false);
            }}
            onApplyFiltersToChat={(grants) => {
              handleApplyFiltersToChat(grants);
              setSidebarOpen(false);
            }}
            selectedGrantRef={selectedGrantRef}
            isLoadingGrant={isLoadingGrant}
            isCompareMode={isCompareMode}
            compareRefs={compareRefs}
            onToggleCompareMode={handleToggleCompareMode}
            onToggleCompareGrant={handleToggleCompareGrant}
            onExecuteComparison={() => {
              handleExecuteComparison();
              setSidebarOpen(false);
            }}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header with logo + dashboard toggle */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-800 bg-gray-950 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Mobile hamburger menu */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1 -ml-1 text-gray-400 hover:text-gray-200"
                aria-label="Open grant list"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gtlf-icon.svg" alt="GitLab Foundation" className="w-6 h-6" />
              <h1 className="text-sm font-semibold text-gray-200 tracking-tight">
                <span className="text-gitlab-orange">GitLab Foundation</span>{" "}
                <span className="text-gray-400 font-normal hidden sm:inline">Grant Insight Generator</span>
              </h1>
            </div>
            <button
              onClick={() => setShowDashboard((prev) => !prev)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showDashboard ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                )}
              </svg>
              {showDashboard ? "Back to Chat" : "Portfolio Dashboard"}
            </button>
          </div>

          {/* Chat (hidden when dashboard or comparison is open, but stays mounted to preserve state) */}
          <div className={showDashboard || compareGrants.length >= 2 || isLoadingComparison ? "hidden" : "flex flex-col flex-1 min-h-0"}>
            <ChatInterface
              scopedGrants={scopedGrants}
              scopedGrantRefs={scopedGrantRefs}
              onClearScope={handleClearScope}
            />
          </div>

          {/* Dashboard (shown when toggled) */}
          {showDashboard && grantRegistry && (
            <PortfolioDashboard
              grants={grantRegistry.grants}
              portfolioSummary={grantRegistry.portfolio_summary}
              onClose={() => setShowDashboard(false)}
            />
          )}

          {/* Comparison view */}
          {(compareGrants.length >= 2 || isLoadingComparison) && !showDashboard && (
            <GrantComparison
              grants={compareGrants}
              summaries={compareSummaries}
              isLoading={isLoadingComparison}
              onClose={handleCloseComparison}
            />
          )}
        </main>

        {/* Grant profile overlay (hidden during comparison) */}
        {compareGrants.length < 2 && !isLoadingComparison && (
          <GrantProfile
            grant={selectedGrant}
            onClose={handleCloseProfile}
            onNavigateToGrant={handleNavigateToGrant}
          />
        )}

        {/* Error display */}
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/30 border border-red-800 text-red-300 px-4 py-2 rounded-lg text-sm max-w-md">
            {error}
          </div>
        )}
      </div>
    );
  }

  return null;
}
