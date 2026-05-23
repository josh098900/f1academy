"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

// Renders when the root layout itself throws, so it ships its own <html>/<body>
// and stays deliberately minimal. Fonts from next/font aren't available here.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-base text-primary antialiased">
        <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-12">
          <p className="text-xs uppercase tracking-[0.2em] text-secondary">
            Academy Fantasy
          </p>
          <h1 className="mt-3 text-[clamp(2.5rem,6vw,4rem)] font-bold uppercase leading-none tracking-wide">
            Yellow Flag
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-secondary">
            Something went wrong on our side. The incident has been logged and
            we&apos;re on it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-8 inline-flex h-10 w-fit items-center justify-center rounded-sm bg-accent px-5 text-sm font-bold uppercase tracking-wider text-inverse transition-colors hover:bg-accent-hover"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
