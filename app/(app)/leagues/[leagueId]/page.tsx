import { notFound, redirect } from "next/navigation";

import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaveButton } from "@/components/leagues/LeaveButton";
import { getLeague, getLeagueStandings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const id = Number(leagueId);
  if (!Number.isInteger(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: non-members can't read the league, so this is null for them.
  const league = await getLeague(supabase, id);
  if (!league) notFound();

  const standings = await getLeagueStandings(supabase, id);

  return (
    <main className="min-h-dvh">
      <header className="border-b border-border-default px-6 py-6 sm:px-12">
        <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
          League
        </p>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          {league.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-wider text-muted uppercase">
            Invite code{" "}
            <span className="tracking-[0.3em] text-accent">
              {league.inviteCode}
            </span>{" "}
            · {league.memberCount} member{league.memberCount === 1 ? "" : "s"}
          </p>
          <LeaveButton leagueId={id} />
        </div>
      </header>

      <section className="py-px">
        <LeaderboardTable rows={standings} currentUserId={user.id} />
      </section>
    </main>
  );
}
