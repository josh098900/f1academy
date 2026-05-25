import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateLeagueForm, JoinLeagueForm } from "@/components/leagues/LeagueForms";
import { getUserLeagues } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const leagues = await getUserLeagues(supabase, user.id);

  return (
    <main className="min-h-dvh px-6 py-6 sm:px-12">
      <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
        Mini-leagues
      </p>
      <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
        Leagues
      </h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {leagues.length === 0 ? (
            <p className="font-body text-sm text-secondary">
              You&apos;re not in any leagues yet. Create one or join with a code.
            </p>
          ) : (
            <div className="border border-border-default">
              {leagues.map((l) => (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3 transition-colors last:border-0 hover:bg-surface"
                >
                  <span className="font-body text-primary">{l.name}</span>
                  <span className="font-mono text-xs tracking-wider text-secondary uppercase">
                    {l.memberCount} member{l.memberCount === 1 ? "" : "s"} ·{" "}
                    <span className="text-muted">{l.inviteCode}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8">
          <CreateLeagueForm />
          <JoinLeagueForm />
        </div>
      </div>
    </main>
  );
}
