"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

// Friendly text for each ?error= code the auth callbacks redirect with.
const URL_ERROR_MESSAGES: Record<string, string> = {
  link_expired:
    "That sign-in link has expired or already been used. Send a new one below.",
  link_invalid:
    "That sign-in link was malformed. Send a new one below.",
  auth: "Couldn't finish signing you in. Try again below.",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const urlError = params.get("error");
  const urlErrorMessage = urlError
    ? (URL_ERROR_MESSAGES[urlError] ?? URL_ERROR_MESSAGES.auth)
    : null;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  async function handleGoogle() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is redirected to Google, so we only handle errors.
    if (error) {
      setError(error.message);
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-12">
      <div className="w-full max-w-sm">
        <p className="font-body text-xs uppercase tracking-[0.2em] text-secondary">
          Academy Fantasy
        </p>
        <h1 className="mt-3 font-display uppercase leading-none tracking-wide text-[clamp(2.5rem,6vw,4rem)]">
          Sign In
        </h1>

        {urlErrorMessage && status !== "sent" ? (
          <p
            role="alert"
            className="mt-6 border-l-2 border-danger bg-danger/[0.06] px-3 py-2 font-body text-xs text-danger"
          >
            {urlErrorMessage}
          </p>
        ) : null}

        {status === "sent" ? (
          <p className="mt-6 font-body text-sm leading-relaxed text-primary">
            Check your inbox — we sent a magic link to{" "}
            <span className="text-accent">{email}</span>. Click it to finish
            signing in.
          </p>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoogle}
              className="mt-6 w-full"
            >
              Continue with Google
            </Button>

            <div className="mt-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border-default" />
              <span className="font-body text-xs uppercase tracking-wider text-muted">
                or
              </span>
              <span className="h-px flex-1 bg-border-default" />
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block">
              <span className="font-body text-xs uppercase tracking-wider text-secondary">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-2 h-10 w-full rounded-sm border border-border-default bg-surface px-3 font-body text-sm text-primary placeholder:text-muted focus:border-border-strong focus:outline-none"
              />
            </label>

            <Button
              type="submit"
              disabled={status === "sending"}
              className="w-full"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </Button>

              {status === "error" && error ? (
                <p className="font-body text-xs text-danger">{error}</p>
              ) : null}
            </form>
          </>
        )}

        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">
          Free to play · No money involved
        </p>
      </div>
    </main>
  );
}
