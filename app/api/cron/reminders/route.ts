import { NextResponse } from "next/server";

import { sendLockReminder } from "@/lib/email/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Window: lock_time within 18..30 hours from now. Catches Saturday-morning
// locks when this cron runs at 12:00 UTC on Friday.
const MIN_AHEAD_MS = 18 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 30 * 60 * 60 * 1000;

const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://f1academy-mu.vercel.app";

type ReminderError = { user: string; round: number; reason: string };

// Scheduled lock-time email reminders. Gated by CRON_SECRET so only Vercel
// (or you, via curl) can trigger it. Idempotent — the unique (user_id,
// round_id, kind) constraint on reminder_log means a re-run sends nothing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const now = Date.now();
  const minLock = new Date(now + MIN_AHEAD_MS).toISOString();
  const maxLock = new Date(now + MAX_AHEAD_MS).toISOString();

  const { data: rounds } = await db
    .from("rounds")
    .select("id, round_number, country, circuit_name, lock_time")
    .eq("status", "upcoming")
    .gte("lock_time", minLock)
    .lte("lock_time", maxLock)
    .throwOnError();

  if (!rounds || rounds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, rounds: 0 });
  }

  let sent = 0;
  let skipped = 0;
  const errors: ReminderError[] = [];

  for (const round of rounds) {
    // Opted-in users
    const { data: optedIn } = await db
      .from("users")
      .select("id")
      .eq("reminders_enabled", true)
      .throwOnError();
    const candidateIds = (optedIn ?? []).map((u) => u.id);
    if (candidateIds.length === 0) continue;

    // Exclude players who've already saved a team for this round
    const { data: teams } = await db
      .from("user_teams")
      .select("user_id")
      .eq("round_id", round.id)
      .in("user_id", candidateIds)
      .throwOnError();
    const hasTeam = new Set((teams ?? []).map((t) => t.user_id));

    // Exclude players we've already emailed for this round
    const { data: log } = await db
      .from("reminder_log")
      .select("user_id")
      .eq("round_id", round.id)
      .eq("kind", "lock_reminder")
      .in("user_id", candidateIds)
      .throwOnError();
    const alreadyEmailed = new Set((log ?? []).map((r) => r.user_id));

    for (const userId of candidateIds) {
      if (hasTeam.has(userId)) {
        skipped++;
        continue;
      }
      if (alreadyEmailed.has(userId)) {
        skipped++;
        continue;
      }

      // Insert the log row first (acts as the idempotency claim). If another
      // cron run got there first, the unique constraint trips and we skip.
      const { error: claimError } = await db
        .from("reminder_log")
        .insert({
          user_id: userId,
          round_id: round.id,
          kind: "lock_reminder",
        });
      if (claimError) {
        // Likely a unique-constraint violation — another process claimed it.
        skipped++;
        continue;
      }

      // Fetch the auth email (public.users doesn't store it)
      const { data: authUser } =
        await db.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) {
        errors.push({ user: userId, round: round.round_number, reason: "no email" });
        continue;
      }

      const result = await sendLockReminder({
        to: email,
        roundNumber: round.round_number,
        circuitName: round.circuit_name ?? `Round ${round.round_number}`,
        country: round.country ?? "",
        lockTime: round.lock_time ?? new Date(now + MAX_AHEAD_MS).toISOString(),
        appUrl: APP_URL,
      });

      if (result.ok) {
        sent++;
      } else {
        errors.push({
          user: userId,
          round: round.round_number,
          reason: result.error,
        });
        // Roll back the claim so a later cron run can retry.
        await db
          .from("reminder_log")
          .delete()
          .eq("user_id", userId)
          .eq("round_id", round.id)
          .eq("kind", "lock_reminder");
      }
    }
  }

  return NextResponse.json({
    ok: true,
    rounds: rounds.length,
    sent,
    skipped,
    errors,
  });
}
