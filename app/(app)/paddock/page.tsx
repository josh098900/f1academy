import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { QuickRace } from "@/components/paddock/QuickRace";
import { getCurrentUser } from "@/lib/auth";
import { getDriverRatings } from "@/lib/paddock/ratings";
import { getCurrentSeason } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

// The Paddock. The server's only job is to rate the real F1 Academy field from
// its real results; the race itself is a pure function of (driver, strategy,
// seed) and runs entirely in the browser.
export default async function PaddockPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const season = await getCurrentSeason(supabase);
  const drivers = season ? await getDriverRatings(supabase, season.id) : [];

  return (
    <main>
      <PageHeader eyebrow="The Paddock" title="Quick Race" />
      <div className="space-y-6 px-6 py-8 sm:px-12">
        <p className="max-w-2xl font-body text-sm leading-relaxed text-secondary">
          Pick a driver, commit a plan, and watch it play out over 15 laps. The
          strategy is set before the lights and followed literally — so the race
          is your decisions, not your reflexes. Every driver is rated from her{" "}
          <span className="text-primary">real 2026 results</span>.
        </p>

        {drivers.length < 8 ? (
          <p className="font-body text-sm text-secondary">
            Not enough driver data to build a grid yet.
          </p>
        ) : (
          <QuickRace drivers={drivers} />
        )}
      </div>
    </main>
  );
}
