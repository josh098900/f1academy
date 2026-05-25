import { redirect } from "next/navigation";

import { AppNav } from "@/components/nav/AppNav";
import { createClient } from "@/lib/supabase/server";

import { signOut } from "./dashboard/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <AppNav email={user.email ?? ""} signOut={signOut} />
      {/* Clear the mobile bottom tab bar (hidden on desktop). */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+3.75rem)] sm:pb-0">
        {children}
      </div>
    </div>
  );
}
