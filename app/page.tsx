import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end px-6 py-5 sm:px-12">
        <Link
          href="/login"
          className="font-display text-sm uppercase tracking-wider text-secondary transition-colors hover:text-primary"
        >
          Sign in
        </Link>
      </header>
      <section className="flex flex-1 flex-col justify-center px-6 sm:px-12">
        <p className="font-body text-xs uppercase tracking-[0.2em] text-secondary">
          Fantasy League · F1 Academy · 2026 Season
        </p>
        <h1 className="mt-4 font-display uppercase leading-[0.85] tracking-wide text-[clamp(4rem,12vw,8rem)]">
          Academy
          <br />
          <span className="text-accent">Fantasy</span>
        </h1>
        <p className="mt-6 max-w-md font-body text-base leading-relaxed text-secondary">
          Pick four drivers. Spend your budget. Boost your star. Score across
          every race weekend and climb your mini-league.
        </p>
        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">
          Building toward Silverstone — 3–5 July 2026
        </p>
      </section>

      <footer className="border-t border-border-default px-6 py-6 sm:px-12">
        <p className="max-w-2xl font-body text-xs leading-relaxed text-muted">
          Free to play. For entertainment only. No money involved. Race data
          sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0). F1, FORMULA
          1, F1 ACADEMY, GRAND PRIX and related marks are trademarks of Formula
          One Licensing BV. Academy Fantasy is unofficial and not associated
          with the Formula 1 group of companies.
        </p>
      </footer>
    </main>
  );
}
