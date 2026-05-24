import { cn } from "@/lib/utils";

// Thin 4px budget bar — fills with accent, turns danger when over cap.
// See DESIGN_SYSTEM.md.
export function BudgetBar({ spent, cap }: { spent: number; cap: number }) {
  const over = spent > cap;
  const pct = Math.min(100, (spent / cap) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="font-body text-xs tracking-wider text-secondary uppercase">
          Budget
        </span>
        <span
          data-tabular
          className={cn(
            "font-mono text-sm tabular-nums",
            over ? "text-danger" : "text-primary"
          )}
        >
          £{spent.toFixed(1)}M / £{cap.toFixed(1)}M
        </span>
      </div>
      <div className="relative h-1 overflow-hidden bg-surface">
        <div
          className="h-full origin-left transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: over ? "var(--color-danger)" : "var(--color-accent)",
            animation: over ? "budget-over-pulse 500ms ease-in-out 3" : undefined,
          }}
        />
      </div>
    </div>
  );
}
