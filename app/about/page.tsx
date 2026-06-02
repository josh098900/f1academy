import { Coffee } from "lucide-react";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Academy Fantasy",
  description:
    "Why I built Academy Fantasy — a personal note from the developer about Formula 1, the F1 Academy series, and what I hoped to add to race weekends.",
};

export default function AboutPage() {
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
          About
        </p>
        <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          From the developer
        </h1>

        <div className="mt-8 space-y-5 font-body text-base leading-relaxed text-primary">
          <p>
            I&apos;ve followed Formula 1 since I was a kid, through driver eras,
            team mergers, regulation changes, all of it. When F1 Academy
            launched in 2023, I tuned in from the start. It felt overdue: a
            structured single seater championship dedicated to bringing more
            women into the sport, with proper seats, sponsorship, and serious
            racing.
          </p>
          <p>
            A few seasons in, the grid is deeper, the racing is sharper, and
            graduates are starting to find places in feeder championships. The
            series doesn&apos;t need defending — the results do that on their
            own.
          </p>
          <p>
            Academy Fantasy started as a question I couldn&apos;t stop turning
            over: every major motorsport series has a fantasy game. F1 Academy
            didn&apos;t. So I built one — partly because I&apos;m a fan, partly
            because I&apos;m a developer looking to ship something I&apos;d
            actually use myself, and partly because anything that puts more eyes
            on the series is a good thing.
          </p>
          <p>
            It&apos;s free to play. No money, no ads, no upsells. Race results
            come from Wikipedia. Pick four drivers under a budget, score across
            the weekend, climb the leaderboard with friends.
          </p>
          <p>
            Thanks for trying it out. If it adds a little something to your race
            weekends, that&apos;s the whole point.
          </p>
        </div>

        <p className="mt-10 font-display text-sm tracking-wider text-secondary uppercase">
          — Josh
        </p>

        <aside className="mt-12 border border-border-default p-5">
          <p className="font-body text-sm leading-relaxed text-secondary">
            The game is free and always will be — no charge to play, nothing
            locked behind money. But if you&apos;ve enjoyed it and fancy
            chipping in toward the running costs (or just a coffee for a
            student dev), there&apos;s a tip jar. Completely optional, and it
            changes nothing about the game.
          </p>
          <a
            href="https://buymeacoffee.com/josh098900"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-sm border border-border-strong px-4 py-2 font-display text-sm tracking-wider text-primary uppercase transition-colors hover:border-accent hover:bg-accent hover:text-inverse focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Coffee className="size-4" />
            Buy me a coffee
          </a>
        </aside>

        <Link
          href="/recommends"
          className="mt-12 inline-block font-mono text-xs tracking-wider text-secondary uppercase transition-colors hover:text-primary"
        >
          A few things I&apos;d recommend →
        </Link>
      </div>
    </main>
  );
}
