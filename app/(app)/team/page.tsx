import { redirect } from "next/navigation";

import { DriverCard } from "@/components/team/DriverCard";
import { getActiveRound, getRoundLineup } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const round = await getActiveRound(supabase);

  if (!round) {
    return (
      <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-12">
        <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] tracking-wide uppercase">
          Season Complete
        </h1>
        <p className="mt-2 font-body text-sm text-secondary">
          No upcoming rounds to pick for.
        </p>
      </main>
    );
  }

  const lineup = await getRoundLineup(supabase, round);
  const locks = round.lock_time
    ? new Date(round.lock_time).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "TBC";

  return (
    <main className="min-h-dvh">
      <header className="border-b border-border-default px-6 py-6 sm:px-12">
        <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
          Round {round.round_number} · {round.country}
        </p>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          {round.circuit_name}
        </h1>
        <p className="mt-3 font-mono text-xs tracking-wider text-muted uppercase">
          {lineup.length} drivers · Pick 4 · Budget £40.0M · Locks {locks}
        </p>
      </header>

      {/* Edge-to-edge, hairline-separated grid (Bloomberg-terminal density). */}
      <section className="py-px">
        <div className="grid grid-cols-1 gap-px bg-border-default sm:grid-cols-2 lg:grid-cols-3">
          {lineup.map((d) => (
            <DriverCard key={d.driverId} driver={d} />
          ))}
        </div>
      </section>
    </main>
  );
}
