import Link from "next/link";

import { saveSessionResults } from "./actions";
import { ResultsForm } from "@/components/admin/ResultsForm";
import {
  getAllRounds,
  getCurrentSeason,
  getRoundEntrants,
  getRoundSessions,
  getSessionResults,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const SESSION_LABEL: Record<string, string> = {
  qualifying: "Qualifying",
  race1: "Race 1",
  race2: "Race 2",
  race3: "Race 3",
};

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string; session?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const season = await getCurrentSeason(supabase);
  if (!season) {
    return <main className="px-6 py-6 sm:px-12">No current season.</main>;
  }

  const rounds = await getAllRounds(supabase, season.id);
  const round = params.round
    ? rounds.find((r) => r.round_number === Number(params.round))
    : undefined;

  const sessions = round ? await getRoundSessions(supabase, round.id) : [];
  const session =
    round && params.session
      ? sessions.find((s) => s.session_type === params.session)
      : undefined;

  const [entrants, existing] =
    round && session
      ? await Promise.all([
          getRoundEntrants(supabase, round),
          getSessionResults(supabase, session.id),
        ])
      : [[], []];

  return (
    <main className="px-6 py-6 sm:px-12">
      <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] tracking-wide uppercase">
        Enter Results
      </h1>

      {/* Round selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-body text-xs tracking-wider text-secondary uppercase">
          Round
        </span>
        {rounds.map((r) => (
          <Link
            key={r.id}
            href={`/admin/results?round=${r.round_number}`}
            className={cn(
              "border px-3 py-1 font-mono text-xs uppercase transition-colors",
              round?.id === r.id
                ? "border-accent text-accent"
                : "border-border-default text-secondary hover:border-border-strong hover:text-primary"
            )}
          >
            R{r.round_number}
          </Link>
        ))}
      </div>

      {/* Session selector */}
      {round ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-body text-xs tracking-wider text-secondary uppercase">
            Session
          </span>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/admin/results?round=${round.round_number}&session=${s.session_type}`}
              className={cn(
                "border px-3 py-1 font-mono text-xs uppercase transition-colors",
                session?.id === s.id
                  ? "border-accent text-accent"
                  : "border-border-default text-secondary hover:border-border-strong hover:text-primary"
              )}
            >
              {SESSION_LABEL[s.session_type] ?? s.session_type}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {round && session ? (
          <>
            <p className="mb-4 font-mono text-xs tracking-wider text-muted uppercase">
              {round.circuit_name} · {SESSION_LABEL[session.session_type]} ·{" "}
              {entrants.length} entrants
            </p>
            <ResultsForm
              key={session.id}
              sessionId={session.id}
              sessionType={session.session_type}
              entrants={entrants}
              existing={existing}
              onSave={saveSessionResults}
            />
          </>
        ) : (
          <p className="font-body text-sm text-secondary">
            Pick a round and session to enter results.
          </p>
        )}
      </div>
    </main>
  );
}
