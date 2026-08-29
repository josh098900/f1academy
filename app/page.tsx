// The trial has ended — a static farewell page (no auth, no database reads), so
// it keeps working even after the free-tier Supabase project pauses on
// inactivity. The final standings are a snapshot image at public/final-standings.png.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 sm:px-12">
        <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
          F1 Academy · 2026 Season · Trial complete
        </p>
        <h1 className="mt-4 font-display text-[clamp(3.5rem,11vw,7rem)] leading-[0.85] tracking-wide uppercase">
          Academy
          <br />
          <span className="text-accent">Fantasy</span>
        </h1>

        <div className="mt-8 max-w-xl space-y-4 font-body text-base leading-relaxed text-secondary">
          <p className="text-primary">Thank you for taking part.</p>
          <p>
            For the short season you picked your four, boosted your star, built
            leagues with friends, and climbed the standings weekend by weekend.
            It was a genuine joy to build and to run, and the best part was
            watching real people play it.
          </p>
          <p>
            The game has now ended and sign-in is closed. Below are the final
            standings, exactly as they stood at the chequered flag.
          </p>
        </div>

        <div className="mt-12">
          <p className="font-display text-sm tracking-wider text-secondary uppercase">
            Final standings
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/final-standings.png"
            alt="The final Academy Fantasy leaderboard — 2026 F1 Academy trial standings"
            className="mt-3 w-full rounded-sm border border-border-default"
          />
        </div>

        <p className="mt-12 font-display text-lg tracking-wide text-primary uppercase">
          Until the next lights-out. 🏁
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
