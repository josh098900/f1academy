"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const MAX_LEAGUES = 5;

// 6 chars, no ambiguous letters/digits.
function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export type CreateLeagueResult =
  | { ok: true; id: number; code: string }
  | { ok: false; error: string };

export async function createLeague(name: string): Promise<CreateLeagueResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    return { ok: false, error: "Name must be 2–40 characters." };
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (!season) return { ok: false, error: "No current season." };

  const { count } = await supabase
    .from("league_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_LEAGUES) {
    return { ok: false, error: `You can only be in ${MAX_LEAGUES} leagues.` };
  }

  // Insert with a unique code, retrying on the rare collision.
  let leagueId: number | null = null;
  let code = "";
  for (let attempt = 0; attempt < 5 && leagueId === null; attempt++) {
    code = makeCode();
    const { data, error } = await supabase
      .from("leagues")
      .insert({
        name: trimmed,
        invite_code: code,
        owner_id: user.id,
        season_id: season.id,
      })
      .select("id")
      .single();
    if (data && !error) {
      leagueId = data.id;
    } else if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  }
  if (leagueId === null) {
    return { ok: false, error: "Couldn't generate a unique code — try again." };
  }

  const { error: memberError } = await supabase
    .from("league_members")
    .insert({ league_id: leagueId, user_id: user.id });
  if (memberError) return { ok: false, error: memberError.message };

  revalidatePath("/leagues");
  return { ok: true, id: leagueId, code };
}

export type JoinLeagueResult =
  | { ok: true; id: number; name: string }
  | { ok: false; error: string };

export async function joinLeague(code: string): Promise<JoinLeagueResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { data, error } = await supabase.rpc("join_league", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, error: error.message };
  const row = data?.[0];
  if (!row) return { ok: false, error: "League not found." };

  revalidatePath("/leagues");
  return { ok: true, id: row.id, name: row.name };
}

export async function leaveLeague(
  leagueId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  // Block owners from silently leaving — the league would be left with a
  // non-member owner and no admin handle. They use deleteLeague instead.
  const { data: league } = await supabase
    .from("leagues")
    .select("owner_id")
    .eq("id", leagueId)
    .maybeSingle();
  if (league?.owner_id === user.id) {
    return {
      ok: false,
      error: "You own this league — delete it instead of leaving.",
    };
  }

  const { error } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leagues");
  return { ok: true };
}

// Owner-only. RLS's "owner deletes league" policy is the actual authority;
// the ON DELETE CASCADE on league_members and (eventually) league_invites
// means a single DELETE tears down the whole league cleanly.
export async function deleteLeague(
  leagueId: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase
    .from("leagues")
    .delete()
    .eq("id", leagueId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leagues");
  return { ok: true };
}
