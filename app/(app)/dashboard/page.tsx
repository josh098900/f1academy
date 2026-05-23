import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

      <p className="mt-8 max-w-md font-body text-sm leading-relaxed text-muted">
        This is a placeholder. Team selection, leagues, and your Coach insights
        land here in the coming phases.
      </p>

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary" size="sm">
          Sign out
        </Button>
      </form>
    </main>
  );
}
