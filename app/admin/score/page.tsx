import { ScoreButton } from "@/components/admin/ScoreButton";
import { getAllRounds, getCurrentSeason } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ScorePage() {
  const supabase = await createClient();
  const season = await getCurrentSeason(supabase);
  if (!season) {
    return <main className="px-6 py-6 sm:px-12">No current season.</main>;
  }
  const rounds = await getAllRounds(supabase, season.id);

  return (
    <main className="px-6 py-6 sm:px-12">
      <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] tracking-wide uppercase">
        Score Rounds
      </h1>
      <p className="mt-2 max-w-xl font-body text-sm text-secondary">
        Run scoring after a round&apos;s results are entered. Idempotent — safe
        to re-run if you correct a result.
      </p>

      <div className="mt-6 border border-border-default">
        {rounds.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-3 last:border-0"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-display text-lg tracking-wide text-primary uppercase">
                R{r.round_number}
              </span>
              <span className="font-body text-sm text-secondary">
                {r.circuit_name}
              </span>
              <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                {r.status}
              </span>
            </div>
            <ScoreButton roundId={r.id} />
          </div>
        ))}
      </div>
    </main>
  );
}
