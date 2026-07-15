import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { QuickRace } from "@/components/paddock/QuickRace";
import { getCurrentUser } from "@/lib/auth";
import { DAILY_RACE_CAP } from "@/lib/paddock/economy";
import {
  type CarLevels,
  ZERO_LEVELS,
  rankFor,
  totalLevels,
} from "@/lib/paddock/garage";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { racesInLast24h } from "@/lib/paddock/settle";
import { getCurrentSeason } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { runPaddockRace } from "./actions";

// The Paddock. The server rates the real F1 Academy field from its real
// results, and — since the garage grew a memory — holds your coins, your car
// and your race log. The race itself is still a pure function of (driver,
// strategy, seed): the server runs it once to bank the result, the browser
// replays the identical race as the broadcast.
export default async function PaddockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const season = await getCurrentSeason(supabase);
  const [drivers, teamRes, recentRes, racesToday] = await Promise.all([
    season ? getDriverRatings(supabase, season.id) : Promise.resolve([]),
    supabase
      .from("paddock_teams")
      .select("coins, car_power, car_aero, car_reliability, car_pit_crew")
      .maybeSingle(),
    supabase
      .from("paddock_races")
      .select("id, finish_position, retired, coins_earned")
      .order("created_at", { ascending: false })
      .limit(5),
    racesInLast24h(supabase),
  ]);
  const team = teamRes.data;
  const coins = team?.coins ?? 0;
  const carLevels: CarLevels = team
    ? {
        power: team.car_power,
        aero: team.car_aero,
        reliability: team.car_reliability,
        pitCrew: team.car_pit_crew,
      }
    : ZERO_LEVELS;
  const rank = rankFor(totalLevels(carLevels));
  const recent = recentRes.data ?? [];

  return (
    <main>
      <PageHeader eyebrow="The Paddock" title="Quick Race" />
      <div className="space-y-6 px-6 py-8 sm:px-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <p className="max-w-2xl font-body text-sm leading-relaxed text-secondary">
            Pick a driver, commit a plan, and watch it play out over 15 laps.
            The strategy is set before the lights and followed literally — so
            the race is your decisions, not your reflexes. Every driver is
            rated from her <span className="text-primary">real 2026 results</span>
            , and every finish pays into your garage.
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Link
              href="/paddock/garage"
              data-tabular
              className="font-mono text-sm tracking-wider uppercase tabular-nums underline-offset-4 hover:underline"
            >
              <span className="text-muted">Garage · </span>
              <span className="text-accent">{coins} coins</span>
            </Link>
            <p
              data-tabular
              className="font-mono text-xs tracking-wider text-muted uppercase tabular-nums"
            >
              Rank {rank} · races today {Math.min(racesToday, DAILY_RACE_CAP)}/
              {DAILY_RACE_CAP}
            </p>
            {recent.length > 0 && (
              <p
                data-tabular
                className="font-mono text-xs tracking-wider text-muted uppercase tabular-nums"
              >
                Last ·{" "}
                {recent
                  .map((r) => (r.retired ? "DNF" : `P${r.finish_position}`))
                  .join(" ")}
              </p>
            )}
          </div>
        </div>

        {drivers.length < 8 ? (
          <p className="font-body text-sm text-secondary">
            Not enough driver data to build a grid yet.
          </p>
        ) : (
          <QuickRace
            drivers={drivers}
            runRace={runPaddockRace}
            carLevels={carLevels}
          />
        )}
      </div>
    </main>
  );
}
