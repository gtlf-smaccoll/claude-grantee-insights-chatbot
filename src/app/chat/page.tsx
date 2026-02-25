"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { GrantRegistry, GrantRecord, CondensedGrant } from "@/types/grants";
import ChatInterface from "../components/ChatInterface";
import GrantSidebar from "../components/GrantSidebar";
import GrantProfile from "../components/GrantProfile";

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

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatInterface
            scopedGrants={scopedGrants}
            scopedGrantRefs={scopedGrantRefs}
            onClearScope={handleClearScope}
          />
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
