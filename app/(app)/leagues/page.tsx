import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { CreateLeagueForm, JoinLeagueForm } from "@/components/leagues/LeagueForms";
import { getCurrentUser } from "@/lib/auth";
import { getUserLeagues } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function LeaguesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const leagues = await getUserLeagues(supabase, user.id);

  return (
    <main>
      <PageHeader eyebrow="Mini-leagues" title="Leagues" />

      <div className="grid gap-8 px-6 py-6 sm:px-12 lg:grid-cols-[1fr_320px]">
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
