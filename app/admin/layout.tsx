import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdmin } from "@/lib/admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border-default px-6 py-4 sm:px-12">
        <Link
          href="/admin/results"
          className="font-display text-sm tracking-[0.2em] text-accent uppercase"
        >
          Academy Fantasy · Admin
        </Link>
        <nav className="flex items-center gap-5 font-body text-xs tracking-wider text-secondary uppercase">
          <Link href="/admin/results" className="hover:text-primary">
            Results
          </Link>
          <Link href="/admin/score" className="hover:text-primary">
            Score
          </Link>
          <Link href="/dashboard" className="hover:text-primary">
            Exit
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
