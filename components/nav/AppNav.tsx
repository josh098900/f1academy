"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { NAV_ITEMS, isActive } from "./items";

// App navigation: a top bar on desktop, a fixed bottom tab bar on mobile.
// `signOut` is a server action passed down from the layout.
export function AppNav({
  email,
  signOut,
}: {
  email: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  // Optimistic highlight: the tapped tab lights up immediately instead of
  // waiting for the (server-rendered) destination to commit. We remember the
  // pathname the tap happened on; once the pathname moves, the hint is stale
  // and we fall back to the real active route (no effect needed).
  const [pending, setPending] = useState<{ href: string; from: string } | null>(
    null
  );
  const pendingHref = pending && pending.from === pathname ? pending.href : null;
  const activeHref = (href: string) =>
    pendingHref ? pendingHref === href : isActive(pathname, href);
  const onTap = (href: string) => setPending({ href, from: pathname });

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-30 hidden border-b border-border-default bg-base/95 backdrop-blur sm:block">
        <div className="flex h-14 items-center gap-8 px-6 sm:px-12">
          <Link
            href="/dashboard"
            className="font-display text-lg tracking-wide text-primary uppercase"
          >
            Academy<span className="text-accent">Fantasy</span>
          </Link>

          <nav className="flex items-center gap-6">
            {NAV_ITEMS.filter((i) => i.href !== "/dashboard").map((item) => {
              const active = activeHref(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onTap(item.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative font-display text-sm tracking-wider uppercase transition-colors",
                    active ? "text-primary" : "text-secondary hover:text-primary"
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute -bottom-[18px] left-0 h-0.5 w-full bg-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <span className="max-w-[16ch] truncate font-mono text-xs text-muted">
              {email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 font-mono text-xs tracking-wider text-secondary uppercase transition-colors hover:text-primary"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border-default bg-base/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => {
          const active = activeHref(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onTap(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                // active:bg-surface gives instant touch-down feedback the moment
                // the tab is pressed, before navigation commits.
                "relative flex flex-col items-center gap-1 py-2.5 transition-colors active:bg-surface",
                active ? "text-accent" : "text-secondary"
              )}
            >
              {active ? (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 bg-accent" />
              ) : null}
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              <span className="font-mono text-[10px] tracking-wider uppercase">
                {item.short}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
