import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { getCurrentUser } from "@/lib/auth";
import { getGlobalLeaderboard } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Fetch beyond the top 100 so we can still surface the player's own rank.
  const all = await getGlobalLeaderboard(supabase, 500);
  const rows = all.slice(0, 100);
  const me = all.find((r) => r.userId === user.id);
  const pinned = me && me.rank > rows.length ? me : null;

  return (
    <main>
      <RealtimeRefresh />
      <PageHeader eyebrow="Global · Top 100" title="Leaderboard" />

      <section className="py-px">
        <LeaderboardTable
          rows={rows}
          currentUserId={user.id}
          pinned={pinned}
        />
      </section>
    </main>
  );
}
