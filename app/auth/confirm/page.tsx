import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

import { confirmSignIn } from "./actions";

// Magic-link landing — deliberately renders an interstitial with a manual tap
// button instead of verifying the token on GET. Gmail's link scanner, in-app
// browser pre-fetchers, and any other intermediary that hits the URL just
// receive static HTML and never trigger verifyOtp, so the one-time-use token
// stays valid until the real human tap submits the form. See
// docs/files/RACE_WEEKEND_RUNBOOK.md's auth notes if a regression turns up.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const { token_hash, type, next } = await searchParams;
  if (!token_hash || !type) redirect("/login?error=link_invalid");

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-12">
      <div className="w-full max-w-sm">
        <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
          Academy Fantasy
        </p>
        <h1 className="mt-3 font-display text-[clamp(2.5rem,6vw,4rem)] leading-none tracking-wide uppercase">
          One more tap
        </h1>
        <p className="mt-6 font-body text-sm leading-relaxed text-secondary">
          Tap below to finish signing in. We keep this extra step so email
          security scanners can&apos;t consume your sign-in link before you do.
        </p>

        <form action={confirmSignIn} className="mt-8">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={type} />
          <input
            type="hidden"
            name="next"
            value={next ?? "/dashboard"}
          />
          <Button type="submit" className="w-full">
            Sign me in
          </Button>
        </form>

        <p className="mt-8 font-mono text-xs tracking-wider text-muted uppercase">
          Free to play · No money involved
        </p>
      </div>
    </main>
  );
}
