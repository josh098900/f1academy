import { teamColor } from "@/lib/f1-teams";
import type { LineupDriver } from "@/lib/queries";

// The most important component in the app — see DESIGN_SYSTEM.md.
// Number-led, 4px team-colour left bar, hard edges. Read-only here; the
// TeamPicker layers selection on top in the next chunk.
export function DriverCard({ driver }: { driver: LineupDriver }) {
  const color = teamColor(driver.f1Partner);

  return (
    <article className="group relative flex items-center gap-4 bg-surface">
      {/* 4px team-colour bar */}
      <div
        className="absolute top-0 bottom-0 left-0 w-1"
        style={{ background: color }}
      />

      {/* Car number — massive */}
      <div
        data-tabular
        className="pr-2 pl-6 font-display text-[56px] leading-none text-primary tabular-nums"
      >
        {driver.carNumber ?? "—"}
      </div>

      {/* Name + meta */}
      <div className="flex-1 py-3">
        <div className="font-display text-xl tracking-wide text-primary uppercase">
          {driver.lastName}
        </div>
        <div className="mt-0.5 font-body text-xs tracking-wider text-secondary uppercase">
          {driver.team} · {driver.f1Partner ?? "—"}
        </div>
      </div>

      {/* Price — mono, right-aligned */}
      <div
        data-tabular
        className="px-6 font-mono text-lg text-primary tabular-nums"
      >
        £{driver.price.toFixed(1)}M
      </div>
    </article>
  );
}
