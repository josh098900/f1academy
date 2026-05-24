import { redirect } from "next/navigation";

import { DriverCard } from "@/components/team/DriverCard";
import { TeamPicker } from "@/components/team/TeamPicker";
import { getActiveRound, getRoundLineup, getUserTeam } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { saveTeam } from "./actions";

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

  const [lineup, saved] = await Promise.all([
    getRoundLineup(supabase, round),
    getUserTeam(supabase, user.id, round.id),
  ]);

  const locked = round.lock_time
    ? new Date(round.lock_time) <= new Date()
    : false;
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
          {locked
            ? "Locked"
            : `${lineup.length} drivers · Pick 4 · Budget £40.0M · Locks ${locks}`}
        </p>
      </header>

      <section className="py-px">
        {locked ? (
          <LockedTeam lineup={lineup} saved={saved} />
        ) : (
          <TeamPicker
            lineup={lineup}
            initialSelected={saved?.driverIds}
            initialBoost={saved?.boostDriverId}
            onSave={saveTeam}
          />
        )}
      </section>
    </main>
  );
}

// Read-only view once the round has locked.
function LockedTeam({
  lineup,
  saved,
}: {
  lineup: Awaited<ReturnType<typeof getRoundLineup>>;
  saved: Awaited<ReturnType<typeof getUserTeam>>;
}) {
  if (!saved) {
    return (
      <p className="px-6 py-10 font-body text-sm text-secondary sm:px-12">
        You didn&apos;t pick a team for this round.
      </p>
    );
  }
  const boostName = lineup.find((d) => d.driverId === saved.boostDriverId)?.lastName;
  const team = saved.driverIds
    .map((id) => lineup.find((d) => d.driverId === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  return (
    <div>
      <p className="px-6 py-3 font-mono text-xs tracking-wider text-secondary uppercase sm:px-12">
        Your locked team · Boost <span className="text-accent">{boostName ?? "—"}</span>
      </p>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
        {team.map((d) => (
          <DriverCard
            key={d.driverId}
            driver={d}
            selected
            isBoost={d.driverId === saved.boostDriverId}
          />
        ))}
      </div>
    </div>
  );
}
