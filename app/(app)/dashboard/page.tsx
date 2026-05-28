import { ArrowRight, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { CoachCard } from "@/components/coach/CoachCard";
import { CoachOptIn } from "@/components/coach/CoachOptIn";
import { CoachToggle } from "@/components/coach/CoachToggle";
import { LockCountdown } from "@/components/team/LockCountdown";
import { getCurrentUser } from "@/lib/auth";
import { getActiveRound, getCoachEnabled, getUserTeam } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { getLatestRecap } from "../coach-actions";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const round = await getActiveRound(supabase);
  const [saved, scored, coachEnabled] = await Promise.all([
    round ? getUserTeam(supabase, user.id, round.id) : Promise.resolve(null),
    supabase
      .from("user_scores")
      .select("round_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    getCoachEnabled(supabase, user.id),
  ]);
  const scoredRounds = scored.count ?? 0;
  const locked = round?.lock_time
    ? new Date(round.lock_time) <= new Date()
    : false;

  return (
    <main>
      <PageHeader eyebrow="Dashboard" title="Welcome" />

      <div className="space-y-8 px-6 py-8 sm:px-12">
        {/* Next round */}
        {round ? (
          <section className="border border-border-default bg-surface p-6">
            <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
              {locked ? "Current round" : "Next round"} · Round{" "}
              {round.round_number} · {round.country}
            </p>
            <h2 className="mt-2 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-none tracking-wide uppercase">
              {round.circuit_name}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              {!locked && round.lock_time ? (
                <LockCountdown lockTime={round.lock_time} />
              ) : (
                <span className="font-mono text-sm tracking-wider text-muted uppercase">
                  {locked ? "Locked" : "Locks TBC"}
                </span>
              )}
              <Link
                href="/team"
                className="inline-flex h-10 items-center gap-2 rounded-sm bg-accent px-5 font-display text-sm tracking-wider text-inverse uppercase transition-colors hover:bg-accent-hover"
              >
                {locked
                  ? "View your team"
                  : saved
                    ? "Edit your team"
                    : "Pick your team"}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="border border-border-default bg-surface p-6">
            <h2 className="font-display text-2xl tracking-wide uppercase">
              Season complete
            </h2>
            <p className="mt-2 font-body text-sm text-secondary">
              No upcoming rounds to pick for.
            </p>
          </section>
        )}

        {/* Post-race recap — only once the player has a scored round. */}
        {scoredRounds ? (
          <div className="max-w-2xl">
            {coachEnabled ? (
              <CoachCard load={getLatestRecap} title="Your last round" />
            ) : (
              <CoachOptIn
                title="Your last round"
                body="The Coach can recap your last round — what scored, what didn't, and where the boost landed."
              />
            )}
          </div>
        ) : (
          <p className="max-w-md font-body text-sm leading-relaxed text-muted">
            Pick a team and the Coach will recap how you did after each round.
          </p>
        )}

        {/* Account + preferences. Sign-out is mobile-only (desktop top bar). */}
        <section className="max-w-2xl space-y-5 border-t border-border-default pt-6">
          <p className="font-mono text-xs text-muted">
            Signed in as <span className="text-secondary">{user.email}</span>
          </p>
          <CoachToggle enabled={coachEnabled} />
          <form action={signOut} className="sm:hidden">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-sm border border-border-default px-4 py-2 font-display text-sm tracking-wider text-secondary uppercase transition-colors hover:border-border-strong hover:text-primary"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
