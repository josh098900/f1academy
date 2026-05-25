import Link from "next/link";
import { redirect } from "next/navigation";

import { CoachCard } from "@/components/coach/CoachCard";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { getLatestRecap } from "../coach-actions";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Only surface the post-race recap once the player has a scored round.
  const { count: scoredRounds } = await supabase
    .from("user_scores")
    .select("round_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <main className="flex min-h-dvh flex-col px-6 py-10 sm:px-12">
      <p className="font-body text-xs uppercase tracking-[0.2em] text-secondary">
        Dashboard
      </p>
      <h1 className="mt-3 font-display uppercase leading-none tracking-wide text-[clamp(2.5rem,6vw,4rem)]">
        Welcome
      </h1>
      <p className="mt-4 font-body text-sm text-secondary">
        Signed in as <span className="text-primary">{user.email}</span>
      </p>

      {scoredRounds ? (
        <div className="mt-8 max-w-md">
          <CoachCard load={getLatestRecap} title="Your last round" />
        </div>
      ) : (
        <p className="mt-8 max-w-md font-body text-sm leading-relaxed text-muted">
          Pick a team and the Coach will recap how you did after each round.
        </p>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Link
          href="/team"
          className="inline-flex h-10 items-center justify-center rounded-sm bg-accent px-5 font-display text-sm tracking-wider text-inverse uppercase transition-colors hover:bg-accent-hover"
        >
          Pick your team
        </Link>
        <Link
          href="/drivers"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border-default px-5 font-display text-sm tracking-wider text-primary uppercase transition-colors hover:border-border-strong"
        >
          Drivers
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border-default px-5 font-display text-sm tracking-wider text-primary uppercase transition-colors hover:border-border-strong"
        >
          Leaderboard
        </Link>
        <Link
          href="/leagues"
          className="inline-flex h-10 items-center justify-center rounded-sm border border-border-default px-5 font-display text-sm tracking-wider text-primary uppercase transition-colors hover:border-border-strong"
        >
          Leagues
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
