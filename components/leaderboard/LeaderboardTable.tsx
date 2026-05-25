import type { LeaderboardRow } from "@/lib/queries";

// Leaderboard rows per DESIGN_SYSTEM.md: mono tabular numbers, the current user
// marked with a 2px accent bar on the left edge (no row background).
export function LeaderboardTable({
  rows,
  currentUserId,
  emptyMessage = "No scores yet — standings appear after the first round is scored.",
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-6 py-10 font-body text-sm text-secondary sm:px-12">
        {emptyMessage}
      </p>
    );
  }

  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((r) => {
          const me = r.userId === currentUserId;
          return (
            <tr
              key={r.userId}
              className="border-b border-border-default transition-colors last:border-0 hover:bg-surface"
            >
              <td
                data-tabular
                className="relative w-12 py-3 pr-2 pl-6 font-mono text-secondary tabular-nums"
              >
                {me ? (
                  <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-accent" />
                ) : null}
                {r.rank}
              </td>
              <td className="py-3 font-body text-primary">
                {r.displayName}
                {me ? (
                  <span className="ml-2 font-mono text-[10px] tracking-wider text-accent uppercase">
                    You
                  </span>
                ) : null}
              </td>
              <td
                data-tabular
                className="py-3 pr-6 text-right font-mono text-primary tabular-nums"
              >
                {r.total.toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
