import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { RealtimeRefresh } from "@/components/RealtimeRefresh";
import { getGlobalLeaderboard } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = await getGlobalLeaderboard(supabase, 100);

  return (
    <main>
      <RealtimeRefresh />
      <PageHeader eyebrow="Global · Top 100" title="Leaderboard" />

      <section className="py-px">
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      </section>
    </main>
  );
}
