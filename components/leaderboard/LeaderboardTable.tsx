import type { LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

// Leaderboard rows per DESIGN_SYSTEM.md: mono tabular numbers, the current user
// marked with a 2px accent bar on the left edge (no row background). `pinned`
// shows the player's own row when they fall outside the visible top set.
export function LeaderboardTable({
  rows,
  currentUserId,
  pinned = null,
  showRounds = true,
  emptyMessage = "No scores yet — standings appear after the first round is scored.",
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
  pinned?: LeaderboardRow | null;
  showRounds?: boolean;
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
      <thead>
        <tr className="border-b border-border-default">
          <th
            scope="col"
            className="w-12 py-2 pr-2 pl-6 text-left font-mono text-[10px] tracking-wider text-muted uppercase"
          >
            #
          </th>
          <th
            scope="col"
            className="py-2 text-left font-mono text-[10px] tracking-wider text-muted uppercase"
          >
            Player
          </th>
          {showRounds ? (
            <th
              scope="col"
              className="hidden py-2 text-right font-mono text-[10px] tracking-wider text-muted uppercase sm:table-cell"
            >
              Rounds
            </th>
          ) : null}
          <th
            scope="col"
            className="py-2 pr-6 text-right font-mono text-[10px] tracking-wider text-muted uppercase"
          >
            Points
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Row
            key={r.userId}
            row={r}
            me={r.userId === currentUserId}
            showRounds={showRounds}
          />
        ))}
        {pinned ? (
          <>
            <tr aria-hidden>
              <td
                colSpan={showRounds ? 4 : 3}
                className="py-1 text-center text-muted"
              >
                ⋯
              </td>
            </tr>
            <Row row={pinned} me showRounds={showRounds} />
          </>
        ) : null}
      </tbody>
    </table>
  );
}

function Row({
  row,
  me,
  showRounds,
}: {
  row: LeaderboardRow;
  me: boolean;
  showRounds: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border-default transition-colors last:border-0 hover:bg-surface",
        me && "bg-surface/60"
      )}
    >
      <td
        data-tabular
        className="relative w-12 py-3 pr-2 pl-6 font-mono text-secondary tabular-nums"
      >
        {me ? (
          <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-accent" />
        ) : null}
        {row.rank}
      </td>
      <td className="py-3 font-body text-primary">
        {row.displayName}
        {me ? (
          <span className="ml-2 font-mono text-[10px] tracking-wider text-accent uppercase">
            You
          </span>
        ) : null}
      </td>
      {showRounds ? (
        <td
          data-tabular
          className="hidden py-3 text-right font-mono text-secondary tabular-nums sm:table-cell"
        >
          {row.roundsPlayed}
        </td>
      ) : null}
      <td
        data-tabular
        className="py-3 pr-6 text-right font-mono text-primary tabular-nums"
      >
        {row.total.toLocaleString()}
      </td>
    </tr>
  );
}
