import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { teamColor } from "@/lib/f1-teams";
import { getActiveRound, getRoundLineup } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function DriversPage() {
  const supabase = await createClient();
  const round = await getActiveRound(supabase);
  const lineup = round ? await getRoundLineup(supabase, round) : [];

  return (
    <main>
      <PageHeader
        eyebrow={round ? `Round ${round.round_number} grid` : "Drivers"}
        title="Drivers"
      />

      {lineup.length === 0 ? (
        <p className="px-6 py-10 font-body text-sm text-muted sm:px-12">
          No drivers to show yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-px p-6 sm:grid-cols-2 sm:px-12 lg:grid-cols-3">
          {lineup.map((d) => (
            <li key={d.driverId}>
              <Link
                href={`/drivers/${d.driverId}`}
                className="group flex items-center gap-4 border border-border-default bg-surface px-4 py-3 transition-colors hover:border-border-strong"
                style={{ borderLeft: `4px solid ${teamColor(d.f1Partner)}` }}
              >
                {d.avatarUrl ? (
                  <Image
                    src={d.avatarUrl}
                    alt={d.fullName}
                    width={44}
                    height={44}
                    className="size-11 shrink-0 border border-border-default bg-base"
                    unoptimized
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base tracking-wide text-primary uppercase">
                    {d.lastName}
                  </p>
                  <p className="truncate font-body text-xs tracking-wider text-secondary uppercase">
                    {d.team} · {d.f1Partner ?? "—"}
                  </p>
                </div>
                <span
                  data-tabular
                  className="shrink-0 font-mono text-sm text-primary tabular-nums"
                >
                  £{d.price.toFixed(1)}M
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
