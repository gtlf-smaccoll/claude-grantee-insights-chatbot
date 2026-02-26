"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GrantRegistry, GrantRecord, CondensedGrant } from "@/types/grants";
import ChatInterface from "../components/ChatInterface";
import GrantSidebar from "../components/GrantSidebar";
import GrantProfile from "../components/GrantProfile";
import PortfolioDashboard from "../components/PortfolioDashboard";

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
      <div className="flex h-screen">
        {/* Sidebar with grant list */}
        {grantRegistry && (
          <GrantSidebar
            grants={grantRegistry.grants}
            onSelectGrant={handleSelectGrant}
            onApplyFiltersToChat={handleApplyFiltersToChat}
            selectedGrantRef={selectedGrantRef}
            isLoadingGrant={isLoadingGrant}
          />
        )}

        {/* Main content area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Toolbar with dashboard toggle */}
          <div className="flex items-center justify-end px-4 py-2 border-b border-gray-800 bg-gray-950 flex-shrink-0">
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

          {/* Chat (hidden when dashboard is open, but stays mounted to preserve state) */}
          <div className={showDashboard ? "hidden" : "flex flex-col flex-1 min-h-0"}>
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
        </main>

        {/* Grant profile overlay */}
        <GrantProfile grant={selectedGrant} onClose={handleCloseProfile} />

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
