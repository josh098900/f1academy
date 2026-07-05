import Link from "next/link";

import { CIRCUIT_ART } from "@/components/circuits";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { InAppBrowserBanner } from "@/components/auth/InAppBrowserBanner";
import { LockCountdown } from "@/components/team/LockCountdown";
import { CONTACT_EMAIL } from "@/lib/contact";
import { getActiveRound } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  // rounds RLS is public-readable so this works for unauthenticated visitors.
  const supabase = await createClient();
  const round = await getActiveRound(supabase);
  const circuitArt = round?.circuit_name
    ? CIRCUIT_ART[round.circuit_name]
    : undefined;

  return (
    <main className="flex min-h-dvh flex-col">
      {/* First screen: full viewport height on mobile so the hero + sign-in CTA
          own the fold and the footer/legal scroll in below. Uses svh (small
          viewport height) — a STABLE value — rather than dvh, so the block
          doesn't resize when the mobile address bar collapses on scroll. On sm+
          this reverts to flex-1 growth, keeping the original desktop layout
          (footer pinned to the bottom of the screen, all visible). */}
      <div className="flex min-h-svh flex-col sm:min-h-0 sm:flex-1">
        <header className="flex items-center justify-end px-6 py-5 sm:px-12">
          <Link
            href="/login"
            className="font-display text-sm tracking-wider text-secondary uppercase transition-colors hover:text-primary"
          >
            Sign in
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center px-6 sm:px-12">
          {/* Two columns on lg+: hero copy left, Silverstone circuit art fills
              the right (otherwise-empty) half. Single column below lg. */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
                Fantasy League · F1 Academy · 2026 Season
              </p>
              <h1 className="mt-4 font-display text-[clamp(4rem,12vw,8rem)] leading-[0.85] tracking-wide uppercase">
                Academy
                <br />
                <span className="text-accent">Fantasy</span>
              </h1>
              <p className="mt-6 max-w-md font-body text-base leading-relaxed text-secondary">
                Pick four drivers. Boost your star. Score across every weekend.
                Climb leagues with friends.
              </p>

              {round ? (
                <div className="mt-8 space-y-2">
                  <p className="font-mono text-xs tracking-wider text-muted uppercase">
                    Next round · R{round.round_number} ·{" "}
                    <span className="text-secondary">{round.circuit_name}</span>
                  </p>
                  {round.lock_time ? (
                    <LockCountdown lockTime={round.lock_time} />
                  ) : (
                    <p className="font-mono text-2xl text-muted tabular-nums">
                      Locks TBC
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-8 font-mono text-xs tracking-wider text-muted uppercase">
                  Season complete
                </p>
              )}

              <div className="mt-10 flex flex-col items-start gap-3">
                <InAppBrowserBanner />
                <GoogleSignInButton />
                <Link
                  href="/login"
                  className="font-body text-sm text-secondary underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  Use email instead →
                </Link>
              </div>
            </div>

            {/* Right column — decorative circuit art for the active round,
                lg+ only. Rounds without art in the registry render nothing
                and the hero stays single-column. */}
            {circuitArt ? (
              <div className="hidden flex-col items-center gap-5 lg:flex">
                <circuitArt.Art className="w-full max-w-xl text-accent" />
                <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">
                  {circuitArt.caption}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <footer className="border-t border-border-default px-6 py-6 sm:px-12">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs tracking-wider text-secondary uppercase">
          <Link
            href="/about"
            className="transition-colors hover:text-primary"
          >
            About →
          </Link>
          <Link
            href="/recommends"
            className="transition-colors hover:text-primary"
          >
            Recommends →
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-primary"
          >
            Privacy →
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Academy%20Fantasy%20feedback`}
            className="transition-colors hover:text-primary"
          >
            Feedback →
          </a>
        </div>
        <p className="max-w-2xl font-body text-xs leading-relaxed text-muted">
          Free to play. For entertainment only. No money involved. Race data
          sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). Circuit
          outlines from Wikimedia Commons — Silverstone (CC0); Zandvoort by
          ごひょううべこ (CC BY-SA 4.0). F1, FORMULA 1, F1 ACADEMY, GRAND PRIX
          and related marks are trademarks of Formula One Licensing BV. Academy
          Fantasy is unofficial and not associated with the Formula 1 group of
          companies.
        </p>
      </footer>
    </main>
  );
}
