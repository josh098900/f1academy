"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// One-tap Google sign-in. Reused on the landing page CTA. The /login page has
// its own slightly-different inline version because it also offers magic link.
export function GoogleSignInButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
    // On success the browser redirects to Google, so no state to restore.
  }

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-sm bg-accent px-6 font-display text-base tracking-wider text-inverse uppercase transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="mt-2 font-body text-xs text-danger">{error}</p>
      ) : null}
    </div>
  );
}
