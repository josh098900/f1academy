import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { CoachCard } from "@/components/coach/CoachCard";
import { LockCountdown } from "@/components/team/LockCountdown";
import { getActiveRound, getUserTeam } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { getLatestRecap } from "../coach-actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const round = await getActiveRound(supabase);
  const [saved, scored] = await Promise.all([
    round ? getUserTeam(supabase, user.id, round.id) : Promise.resolve(null),
    supabase
      .from("user_scores")
      .select("round_id", { count: "exact", head: true })
      .eq("user_id", user.id),
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
            <CoachCard load={getLatestRecap} title="Your last round" />
          </div>
        ) : (
          <p className="max-w-md font-body text-sm leading-relaxed text-muted">
            Pick a team and the Coach will recap how you did after each round.
          </p>
        )}
      </div>
    </main>
  );
}
