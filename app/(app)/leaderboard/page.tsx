import { redirect } from "next/navigation";

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
    <main className="min-h-dvh">
      <RealtimeRefresh />
      <header className="border-b border-border-default px-6 py-6 sm:px-12">
        <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
          Global · Top 100
        </p>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          Leaderboard
        </h1>
      </header>

      <section className="py-px">
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      </section>
    </main>
  );
}
