import { teamColor } from "@/lib/f1-teams";
import type { LineupDriver } from "@/lib/queries";
import { cn } from "@/lib/utils";

// The most important component in the app — see DESIGN_SYSTEM.md.
// Number-led, 4px team-colour left bar, hard edges. Optional selection state
// (used by the TeamPicker): selected → accent border, with a 2× boost toggle.
type Props = {
  driver: LineupDriver;
  selected?: boolean;
  isBoost?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onBoost?: () => void;
};

export function DriverCard({
  driver,
  selected = false,
  isBoost = false,
  disabled = false,
  onToggle,
  onBoost,
}: Props) {
  const color = teamColor(driver.f1Partner);
  const interactive = Boolean(onToggle);

  return (
    <article
      data-selected={selected}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive && !disabled ? onToggle : undefined}
      className={cn(
        "group relative flex items-center gap-4 border bg-surface transition-colors",
        selected
          ? "border-accent"
          : "border-border-default hover:border-border-strong",
        disabled && !selected && "opacity-40",
        interactive && !disabled && "cursor-pointer"
      )}
    >
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
      <div className="min-w-0 flex-1 py-3">
        <div className="truncate font-display text-xl tracking-wide text-primary uppercase">
          {driver.lastName}
        </div>
        <div className="mt-0.5 truncate font-body text-xs tracking-wider text-secondary uppercase">
          {driver.team} · {driver.f1Partner ?? "—"}
        </div>
      </div>

      {/* Boost toggle — only on selected cards */}
      {selected && onBoost ? (
        <button
          type="button"
          aria-label="Boost (2× points)"
          aria-pressed={isBoost}
          onClick={(e) => {
            e.stopPropagation();
            onBoost();
          }}
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase transition-colors",
            isBoost
              ? "border-accent bg-accent text-inverse"
              : "border-border-strong text-secondary hover:text-primary"
          )}
        >
          2×
        </button>
      ) : null}

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
