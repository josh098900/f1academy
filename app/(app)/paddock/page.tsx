import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { RaceViewer } from "@/components/paddock/RaceViewer";
import { getCurrentUser } from "@/lib/auth";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { getCurrentSeason } from "@/lib/queries";
import type { Entrant, Strategy } from "@/lib/race-sim";
import { createClient } from "@/lib/supabase/server";

const TRACK_ID = "silverstone"; // the only circuit with a centreline yet
const LAPS = 15;

// A plausible one-stop plan. In P4 this becomes the player's own pre-race
// strategy — the rules they commit to before the lights.
function planFor(i: number): Strategy {
  const aggressive = i % 3 === 0;
  return {
    startCompound: aggressive ? "soft" : "medium",
    pitCompound: aggressive ? "medium" : "hard",
    pitAtWear: aggressive ? 0.6 : 0.68,
    attackWithin: aggressive ? 1.2 : 0.8,
    conserveWhenLeadingBy: 2.5,
  };
}

// Every car identical for now, so the racing you see is driven purely by the
// drivers' real form. The garage — where the car becomes yours — is P4.
const STOCK_CAR = { power: 60, aero: 60, reliability: 60, pitCrew: 60 };

export default async function PaddockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const season = await getCurrentSeason(supabase);
  const rated = season ? await getDriverRatings(supabase, season.id) : [];

  // Eight drivers, quickest first — a believable front of the grid.
  const field = [...rated]
    .sort((a, b) => b.stats.pace - a.stats.pace)
    .slice(0, 8);

  if (field.length < 8) {
    return (
      <main>
        <PageHeader eyebrow="The Paddock" title="Race" />
        <p className="px-6 py-10 font-body text-sm text-secondary sm:px-12">
          Not enough driver data to build a grid yet.
        </p>
      </main>
    );
  }

  const entrants: Entrant[] = field.map((d, i) => ({
    id: String(d.driverId),
    name: d.shortName,
    driver: d.stats,
    car: STOCK_CAR,
    strategy: planFor(i),
    isPlayer: i === 0, // highlight one car until the garage exists
  }));

  // A fixed seed for now, so the page is stable to reload and to discuss. A
  // real match will store its seed on the row and replay identically forever.
  const seed = 20260712;

  return (
    <main>
      <PageHeader eyebrow="The Paddock · Preview" title="Race" />
      <div className="space-y-6 px-6 py-8 sm:px-12">
        <p className="max-w-2xl font-body text-sm leading-relaxed text-secondary">
          A 15-lap race at Silverstone, simulated. Every driver is rated from her{" "}
          <span className="text-primary">real 2026 results</span> — pace from
          qualifying, racecraft from places gained, consistency from finishing —
          and every car here is identical, so what you&apos;re watching is pure
          driver form. Passes only happen in the marked zones. Tyres go off.
        </p>

        <RaceViewer
          entrants={entrants}
          trackId={TRACK_ID}
          laps={LAPS}
          seed={seed}
        />

        <div className="max-w-2xl border border-border-default bg-surface p-5">
          <p className="font-display text-xs tracking-[0.2em] text-accent uppercase">
            The grid
          </p>
          <ul className="mt-3 space-y-1.5">
            {entrants.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 font-mono text-xs text-secondary"
              >
                <span className="flex-1 truncate font-body text-primary">{e.name}</span>
                <span data-tabular className="tabular-nums">
                  PAC {e.driver.pace}
                </span>
                <span data-tabular className="tabular-nums">
                  RAC {e.driver.racecraft}
                </span>
                <span data-tabular className="tabular-nums">
                  CON {e.driver.consistency}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-body text-xs text-muted">
            Ratings are read from real results and move as the season does. Drivers
            are never invented or &ldquo;trained&rdquo; — upgrades will live in the
            car.
          </p>
        </div>
      </div>
    </main>
  );
}
