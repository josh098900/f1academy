import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { RosterShop } from "@/components/paddock/RosterShop";
import { getCurrentUser } from "@/lib/auth";
import {
  type CarLevels,
  type StaffLevels,
  ZERO_LEVELS,
  ZERO_STAFF,
  rankFor,
  staffTotal,
  totalLevels,
} from "@/lib/paddock/garage";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { rosterFor } from "@/lib/paddock/roster";
import { getCurrentSeason } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { signPaddockDriver } from "../actions";

// The roster. Four free seats at the bottom of the timesheet, contracts on
// everyone above them — rank opens the band, coins sign the driver, and a
// signature never lapses even when reality moves her rating.
export default async function DriversPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const season = await getCurrentSeason(supabase);
  const [drivers, teamRes, contractsRes] = await Promise.all([
    season
      ? getDriverRatings(supabase, season.id)
      : Promise.resolve([]),
    supabase
      .from("paddock_teams")
      .select(
        "coins, car_power, car_aero, car_reliability, car_pit_crew, eng_race_engineer, eng_simulator, eng_data_analyst"
      )
      .maybeSingle(),
    supabase.from("paddock_contracts").select("driver_id"),
  ]);
  const team = teamRes.data;
  const coins = team?.coins ?? 0;
  const levels: CarLevels = team
    ? {
        power: team.car_power,
        aero: team.car_aero,
        reliability: team.car_reliability,
        pitCrew: team.car_pit_crew,
      }
    : ZERO_LEVELS;
  const staff: StaffLevels = team
    ? {
        raceEngineer: team.eng_race_engineer,
        simulator: team.eng_simulator,
        dataAnalyst: team.eng_data_analyst,
      }
    : ZERO_STAFF;
  const rank = rankFor(totalLevels(levels) + staffTotal(staff));
  const signedIds = new Set(
    (contractsRes.data ?? []).map((c) => c.driver_id)
  );
  const entries = rosterFor(drivers, signedIds, rank);

  return (
    <main>
      <PageHeader eyebrow="The Paddock" title="Roster" />
      <div className="space-y-6 px-6 py-8 sm:px-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="max-w-2xl font-body text-sm leading-relaxed text-secondary">
            Every team starts with the four{" "}
            <span className="text-primary">free seats</span> at the bottom of
            the timesheet. The rest take a contract: your rank opens the band,
            your winnings pay for the signature — and a signed driver is yours
            for good, wherever her real season takes her rating.
          </p>
          <div className="flex items-baseline gap-4">
            <p
              data-tabular
              className="font-mono text-sm tracking-wider uppercase tabular-nums"
            >
              <span className="text-muted">Rank </span>
              <span className="text-primary">{rank}</span>
            </p>
            <Link
              href="/paddock"
              className="font-mono text-xs tracking-wider text-muted uppercase underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              ← Quick race
            </Link>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="font-body text-sm text-secondary">
            No rated drivers yet — the roster opens with the season.
          </p>
        ) : (
          <RosterShop
            entries={entries}
            initialCoins={coins}
            rank={rank}
            sign={signPaddockDriver}
          />
        )}
      </div>
    </main>
  );
}
