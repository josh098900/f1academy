"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  POST_RATE_LIMIT,
  REPLY_RATE_LIMIT,
  validatePostBody,
  validateReplyBody,
} from "@/lib/social";

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

// ---------------------------------------------------------------------------
// Social feed — text posts, flat replies, likes. RLS is the real guard
// (membership + authorship, see 20260821120000_league_social_feed.sql); these
// add the shared validation (lib/social) and a per-author rate limit. The
// length CHECK constraints backstop the body validation.
// ---------------------------------------------------------------------------

export type FeedActionResult = { ok: true } | { ok: false; error: string };

// How many of this author's rows landed in the last window — the rate-limit
// signal. Counts across leagues (a per-person cap), RLS-safe (own rows).
async function recentCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "league_posts" | "league_post_replies",
  authorId: string,
  windowMs: number
): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("author_id", authorId)
    .gte("created_at", since);
  return count ?? 0;
}

export async function createPost(
  leagueId: number,
  rawBody: string
): Promise<FeedActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const body = validatePostBody(rawBody);
  if (!body.ok) return body;

  if ((await recentCount(supabase, "league_posts", user.id, POST_RATE_LIMIT.windowMs)) >= POST_RATE_LIMIT.max) {
    return { ok: false, error: "You're posting too fast — give it a minute." };
  }

  const { error } = await supabase
    .from("league_posts")
    .insert({ league_id: leagueId, author_id: user.id, body: body.value });
  if (error) return { ok: false, error: "Couldn't post — are you a member of this league?" };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function addReply(
  postId: number,
  leagueId: number,
  rawBody: string
): Promise<FeedActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const body = validateReplyBody(rawBody);
  if (!body.ok) return body;

  if ((await recentCount(supabase, "league_post_replies", user.id, REPLY_RATE_LIMIT.windowMs)) >= REPLY_RATE_LIMIT.max) {
    return { ok: false, error: "You're replying too fast — give it a moment." };
  }

  const { error } = await supabase
    .from("league_post_replies")
    .insert({ post_id: postId, author_id: user.id, body: body.value });
  if (error) return { ok: false, error: "Couldn't reply — are you a member of this league?" };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

// Add or remove the caller's like. Idempotent from the UI's point of view.
export async function toggleLike(
  postId: number,
  leagueId: number
): Promise<FeedActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { data: existing } = await supabase
    .from("league_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("league_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("league_post_likes")
      .insert({ post_id: postId, user_id: user.id });
    if (error) return { ok: false, error: "Couldn't like — are you a member of this league?" };
  }

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

// Delete a post. RLS decides who may: the author, the league owner, or an
// admin — a non-permitted delete simply affects no rows.
export async function deletePost(
  postId: number,
  leagueId: number
): Promise<FeedActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase.from("league_posts").delete().eq("id", postId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function deleteReply(
  replyId: number,
  leagueId: number
): Promise<FeedActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase
    .from("league_post_replies")
    .delete()
    .eq("id", replyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
