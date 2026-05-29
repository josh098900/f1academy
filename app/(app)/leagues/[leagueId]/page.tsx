import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { CopyCode } from "@/components/leagues/CopyCode";
import { LeaveButton } from "@/components/leagues/LeaveButton";
import { getCurrentUser } from "@/lib/auth";
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

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // RLS: non-members can't read the league, so this is null for them.
  const league = await getLeague(supabase, id);
  if (!league) notFound();

  const standings = await getLeagueStandings(supabase, id);

  return (
    <main>
      <RealtimeRefresh />
      <PageHeader
        eyebrow={`League · ${league.memberCount} member${league.memberCount === 1 ? "" : "s"}`}
        title={league.name}
        action={
          <LeaveButton
            leagueId={id}
            mode={league.ownerId === user.id ? "delete" : "leave"}
          />
        }
      >
        <div className="mt-3">
          <CopyCode code={league.inviteCode} />
        </div>
      </PageHeader>

      <section className="py-px">
        <LeaderboardTable
          rows={standings}
          currentUserId={user.id}
          showRounds={false}
          emptyMessage="No scores yet — standings appear after the first round is scored."
        />
      </section>
    </main>
  );
}
