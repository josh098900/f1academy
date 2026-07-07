import "server-only";

import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";
import {
  getActiveRound,
  getDriverProfile,
  getRoundLineup,
  getSeasonForm,
} from "@/lib/queries";

// Shared, user-independent reads, cached in Next's data cache. Every player
// sees identical round/lineup/form data and it only changes when admin ops
// run — yet each page render was re-querying it. Entries are tagged so the
// in-app writes that change this data (results entry, scoring, wiki-sync)
// bust the cache instantly via revalidateTag(GAME_DATA_TAG). The TTL is the
// safety net for writes Next never sees — the local ops scripts (price
// recalibration, add-wildcard, lock times) — which therefore take up to
// REVALIDATE_SECONDS to show up in prod.
//
// These functions run outside a request scope, so they use a bare
// publishable-key client (anon role), never the cookie-bound request client:
// a shared cache must not depend on which user warmed it. Everything read
// here is public-read under RLS. Per-user reads (teams, transfer context,
// preferences) and enforcement reads inside server actions stay uncached in
// lib/queries.ts.

export const GAME_DATA_TAG = "game-data";
const REVALIDATE_SECONDS = 300;

function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export const getActiveRoundCached = unstable_cache(
  () => getActiveRound(anonClient()),
  ["active-round"],
  { tags: [GAME_DATA_TAG], revalidate: REVALIDATE_SECONDS }
);

export const getRoundLineupCached = unstable_cache(
  (roundId: number, seasonId: number, roundNumber: number) =>
    getRoundLineup(anonClient(), {
      id: roundId,
      season_id: seasonId,
      round_number: roundNumber,
    }),
  ["round-lineup"],
  { tags: [GAME_DATA_TAG], revalidate: REVALIDATE_SECONDS }
);

export const getSeasonFormCached = unstable_cache(
  (seasonId: number, beforeRound: number) =>
    getSeasonForm(anonClient(), seasonId, beforeRound),
  ["season-form"],
  { tags: [GAME_DATA_TAG], revalidate: REVALIDATE_SECONDS }
);

export const getDriverProfileCached = unstable_cache(
  (driverId: number) => getDriverProfile(anonClient(), driverId),
  ["driver-profile"],
  { tags: [GAME_DATA_TAG], revalidate: REVALIDATE_SECONDS }
);
