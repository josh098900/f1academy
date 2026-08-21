/**
 * verify-feed-rls — the league social feed's security matrix, run against the
 * LOCAL Supabase stack (not CI — it needs a database). Seeds three users into
 * one league (owner+member, member, non-member) and asserts the RLS policies
 * and read RPCs from 20260821120000_league_social_feed.sql behave.
 *
 *   pnpm exec supabase start           # stack must be up
 *   pnpm exec tsx scripts/verify-feed-rls.ts
 *
 * Uses the fixed local-dev keys (public, identical on every local stack).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../db/types";

const API_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

type DB = SupabaseClient<Database>;

const service = createClient<Database>(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const EMAILS = {
  alice: "alice@rls.test",
  carol: "carol@rls.test",
  bob: "bob@rls.test",
};
const PASSWORD = "rls-test-pw-123456";
const INVITE = "RLSX01";

async function resetSeed() {
  // Remove any prior run's league (cascades to posts/replies/likes/members).
  await service.from("leagues").delete().eq("invite_code", INVITE);
  // Remove prior test auth users (cascades their public.users rows).
  const { data } = await service.auth.admin.listUsers();
  for (const u of data.users) {
    if (u.email && Object.values(EMAILS).includes(u.email)) {
      await service.auth.admin.deleteUser(u.id);
    }
  }
}

async function makeUser(email: string, name: string): Promise<{ id: string; client: DB }> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw error ?? new Error(`createUser failed for ${email}`);
  const client = createClient<Database>(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw signInErr;
  return { id: data.user.id, client };
}

async function main() {
  await resetSeed();

  // Season (idempotent on the unique year).
  let seasonId: number;
  const { data: existingSeason } = await service
    .from("seasons")
    .select("id")
    .eq("year", 2099)
    .maybeSingle();
  if (existingSeason) {
    seasonId = existingSeason.id;
  } else {
    const { data, error } = await service
      .from("seasons")
      .insert({ year: 2099, is_current: false })
      .select("id")
      .single();
    if (error) throw error;
    seasonId = data.id;
  }

  const alice = await makeUser(EMAILS.alice, "Alice"); // league owner + member
  const carol = await makeUser(EMAILS.carol, "Carol"); // member, not owner
  const bob = await makeUser(EMAILS.bob, "Bob"); //       not a member

  // League owned by Alice; Alice + Carol are members, Bob is not.
  const { data: league, error: leagueErr } = await service
    .from("leagues")
    .insert({ name: "RLS Test League", invite_code: INVITE, owner_id: alice.id, season_id: seasonId })
    .select("id")
    .single();
  if (leagueErr) throw leagueErr;
  const leagueX = league.id;
  await service.from("league_members").insert([
    { league_id: leagueX, user_id: alice.id },
    { league_id: leagueX, user_id: carol.id },
  ]);

  console.log("\nMember (Alice) — can participate:");
  const p1ins = await alice.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: alice.id, body: "First post" })
    .select("id")
    .single();
  check("member can post", !p1ins.error, p1ins.error?.message);
  const p1 = p1ins.data?.id as number;

  const p2ins = await alice.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: alice.id, body: "Second post" })
    .select("id")
    .single();
  check("member can post again", !p2ins.error, p2ins.error?.message);
  const p2 = p2ins.data?.id as number;

  const replyIns = await alice.client
    .from("league_post_replies")
    .insert({ post_id: p1, author_id: alice.id, body: "A reply" })
    .select("id")
    .single();
  check("member can reply", !replyIns.error, replyIns.error?.message);

  const likeIns = await alice.client
    .from("league_post_likes")
    .insert({ post_id: p1, user_id: alice.id });
  check("member can like", !likeIns.error, likeIns.error?.message);

  const likeDup = await alice.client
    .from("league_post_likes")
    .insert({ post_id: p1, user_id: alice.id });
  check("double-like is rejected (PK)", !!likeDup.error);

  const feedA = await alice.client.rpc("league_feed", { p_league: leagueX });
  const rows = feedA.data ?? [];
  check("feed returns member's posts", !feedA.error && rows.length === 2, feedA.error?.message);
  check("feed is newest-first", rows[0]?.id === p2 && rows[1]?.id === p1);
  const p1row = rows.find((r) => r.id === p1);
  check(
    "feed counts + liked_by_me correct",
    p1row?.like_count === 1 && p1row?.reply_count === 1 && p1row?.liked_by_me === true,
    JSON.stringify(p1row && { like: p1row.like_count, reply: p1row.reply_count, liked: p1row.liked_by_me })
  );
  check("feed resolves author name", p1row?.author_name === "Alice");

  const threadA = await alice.client.rpc("league_post_thread", { p_post: p1 });
  check("thread returns the reply with author", (threadA.data ?? []).length === 1 && threadA.data?.[0]?.author_name === "Alice");

  const tooLong = await alice.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: alice.id, body: "x".repeat(501) })
    .select("id");
  check("over-length post rejected by constraint", !!tooLong.error);

  const sysPost = await alice.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: alice.id, body: "sneaky system", is_system: true })
    .select("id");
  check("normal user cannot forge a system post", !!sysPost.error);

  console.log("\nAuthor + owner moderation:");
  const p3 = (await carol.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: carol.id, body: "Carol's post" })
    .select("id")
    .single()).data?.id as number;
  const carolDelOwn = await carol.client.from("league_posts").delete().eq("id", p3).select("id");
  check("author can delete own post", (carolDelOwn.data ?? []).length === 1, carolDelOwn.error?.message);

  const p4 = (await carol.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: carol.id, body: "Carol's second post" })
    .select("id")
    .single()).data?.id as number;
  const ownerDel = await alice.client.from("league_posts").delete().eq("id", p4).select("id");
  check("league owner can moderate (delete a member's post)", (ownerDel.data ?? []).length === 1, ownerDel.error?.message);

  const carolDelOther = await carol.client.from("league_posts").delete().eq("id", p1).select("id");
  const p1StillThere = (await service.from("league_posts").select("id").eq("id", p1).maybeSingle()).data;
  check("non-author member cannot delete another's post", (carolDelOther.data ?? []).length === 0 && !!p1StillThere);

  console.log("\nNon-member (Bob) — locked out:");
  const feedB = await bob.client.rpc("league_feed", { p_league: leagueX });
  check("non-member's feed RPC returns nothing", !feedB.error && (feedB.data ?? []).length === 0);

  const bobRead = await bob.client.from("league_posts").select("id").eq("league_id", leagueX);
  check("non-member cannot read posts (RLS)", (bobRead.data ?? []).length === 0);

  const bobPost = await bob.client
    .from("league_posts")
    .insert({ league_id: leagueX, author_id: bob.id, body: "Intruder" })
    .select("id");
  check("non-member cannot post", !!bobPost.error);

  const bobReply = await bob.client
    .from("league_post_replies")
    .insert({ post_id: p1, author_id: bob.id, body: "Intruder reply" })
    .select("id");
  check("non-member cannot reply", !!bobReply.error);

  const bobLike = await bob.client.from("league_post_likes").insert({ post_id: p1, user_id: bob.id });
  check("non-member cannot like", !!bobLike.error);

  const threadB = await bob.client.rpc("league_post_thread", { p_post: p1 });
  check("non-member's thread RPC returns nothing", !threadB.error && (threadB.data ?? []).length === 0);

  const bobDel = await bob.client.from("league_posts").delete().eq("id", p1).select("id");
  check("non-member cannot delete", (bobDel.data ?? []).length === 0);

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verify-feed-rls failed:", err.message ?? err);
  process.exit(1);
});
