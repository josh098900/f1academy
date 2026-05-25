"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

// Refresh the server-rendered page when user_scores changes (i.e. a round is
// scored), so leaderboards update live. Debounced — scoring upserts many rows
// in one go. RLS means a client only hears about rows it can read, which is
// enough to trigger a full re-fetch.
export function RealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const channel = supabase
      .channel("user-scores-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_scores" },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 600);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
