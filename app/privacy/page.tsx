import Link from "next/link";

import type { Metadata } from "next";

import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Privacy · Academy Fantasy",
  description:
    "What data Academy Fantasy stores, where it lives, and your rights — written honestly, kept short.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:text-secondary"
        >
          ← Academy Fantasy
        </Link>

        <p className="mt-10 font-body text-xs tracking-[0.2em] text-secondary uppercase">
          Privacy
        </p>
        <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          What we store and why
        </h1>

        <div className="mt-8 space-y-6 font-body text-base leading-relaxed text-primary">
          <p>
            Academy Fantasy is built solo and runs on free tiers. The data
            side is genuinely simple — here&apos;s exactly what&apos;s
            collected, why, and where it goes.
          </p>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              What&apos;s stored
            </h2>
            <p className="mt-2">
              When you sign in: your email address (from Google or magic
              link) and a display name — your Google name if you signed in
              with Google, otherwise the part of your email before the @.
              You can change the display name any time from your dashboard.
            </p>
            <p className="mt-3">
              Once you start playing: the drivers you pick for each round,
              your boost choice, your wildcard status, your scores after
              each round closes, any leagues you create or join, and your
              preferences — whether the Coach is on, whether you want
              lock-time reminders. That&apos;s the whole list.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              Where the data lives
            </h2>
            <p className="mt-2">
              Your account and game data are stored in{" "}
              <span className="text-primary">Supabase</span>, hosted in
              their London region — they handle the database and
              authentication.
            </p>
            <p className="mt-3">
              If you turn the Coach on, the prompts sent to it (round info,
              your team&apos;s points) go to{" "}
              <span className="text-primary">Google&apos;s Gemini API</span>.
              Generated text is cached so the same insight isn&apos;t
              produced twice.
            </p>
            <p className="mt-3">
              If you keep email reminders on, those send via{" "}
              <span className="text-primary">Resend</span> from
              noreply@academy.jmathers.com. Page views and site performance
              are tracked via{" "}
              <span className="text-primary">Vercel Analytics</span> —
              first-party only, no third-party ad networks, no cross-site
              tracking.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              Cookies
            </h2>
            <p className="mt-2">
              Two kinds, both functional: sign-in cookies set by Supabase
              Auth so you stay signed in, and anonymous page-view counters
              from Vercel Analytics. No ad cookies. No tracking pixels. No
              retargeting.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              Your rights
            </h2>
            <p className="mt-2">
              If you want to see what&apos;s stored about you, or want your
              account and data deleted entirely, email me at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}
                className="text-accent underline-offset-4 transition-colors hover:underline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and I&apos;ll handle it personally. Usually within a few days.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              What this isn&apos;t
            </h2>
            <p className="mt-2">
              No ads. No data sold or shared with third parties beyond the
              vendors named above (which are all just infrastructure —
              Supabase stores, Gemini generates, Resend sends, Vercel
              hosts). The game is free to play. No payments, no upsells,
              no premium tier.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg tracking-wide text-accent uppercase">
              Updates
            </h2>
            <p className="mt-2">
              If this page changes, the new version will be at this URL —
              there&apos;s no &ldquo;old privacy policy&rdquo; archive,
              just the current one. The date below tracks when it last
              changed.
            </p>
          </section>
        </div>

        <p className="mt-10 font-mono text-xs tracking-wider text-muted uppercase">
          Last updated · 30 May 2026
        </p>

        <p className="mt-2 font-display text-sm tracking-wider text-secondary uppercase">
          — Josh
        </p>
      </div>
    </main>
  );
}
