import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recommends · Academy Fantasy",
  description:
    "Things adjacent to Academy Fantasy worth your time — driver-led initiatives and other efforts pushing the sport in a good direction.",
};

export default function RecommendsPage() {
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
          Recommends
        </p>
        <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
          Worth your time
        </h1>
        <p className="mt-6 max-w-prose font-body text-base leading-relaxed text-secondary">
          A small list of things adjacent to Academy Fantasy that I think
          deserve more eyes — mostly driver-led efforts pushing women in
          motorsport from the grassroots up.
        </p>

        <article className="mt-12 border-l-2 border-accent pl-5">
          <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
            Driver initiative
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-wide uppercase">
            Girls International Racing Lab
          </h2>
          <p className="mt-3 font-body text-base leading-relaxed text-primary">
            Alba Larsen — one of the drivers on the current F1 Academy grid —
            runs this program for young girls in karting and lower formulae,
            helping more of them stay in the sport long enough to make a
            serious go of it. If the spirit of F1 Academy resonates with you,
            this is one of the places putting that idea into practice from the
            bottom up.
          </p>
          <a
            href="https://girlsinternationalracinglab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block font-mono text-xs tracking-wider text-accent uppercase transition-colors hover:text-accent-hover"
          >
            girlsinternationalracinglab.com ↗
          </a>
        </article>
      </div>
    </main>
  );
}
