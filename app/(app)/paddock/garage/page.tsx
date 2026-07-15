import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { GarageShop } from "@/components/paddock/GarageShop";
import { getCurrentUser } from "@/lib/auth";
import {
  type CarLevels,
  ZERO_LEVELS,
  rankFor,
  totalLevels,
} from "@/lib/paddock/garage";
import { createClient } from "@/lib/supabase/server";

import { buyPaddockUpgrade } from "../actions";

// The garage. Coins in, machinery out. Every purchase raises your rank, and
// the field you race is built to your rank — so the car you fit today is the
// grid you meet tomorrow.
export default async function GaragePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("paddock_teams")
    .select("coins, car_power, car_aero, car_reliability, car_pit_crew")
    .maybeSingle();

  const coins = team?.coins ?? 0;
  const levels: CarLevels = team
    ? {
        power: team.car_power,
        aero: team.car_aero,
        reliability: team.car_reliability,
        pitCrew: team.car_pit_crew,
      }
    : ZERO_LEVELS;
  const rank = rankFor(totalLevels(levels));

  return (
    <main>
      <PageHeader eyebrow="The Paddock" title="Garage" />
      <div className="space-y-6 px-6 py-8 sm:px-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="max-w-2xl font-body text-sm leading-relaxed text-secondary">
            Bronze to Diamond, level by level. Upgrades make the car faster —
            and raise your <span className="text-primary">rank</span>, which
            raises the field you race. The edge is real, and so is the chase.
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

        <GarageShop
          initialCoins={coins}
          initialLevels={levels}
          buy={buyPaddockUpgrade}
        />
      </div>
    </main>
  );
}
