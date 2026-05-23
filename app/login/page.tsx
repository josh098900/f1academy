"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
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

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-12">
      <div className="w-full max-w-sm">
        <p className="font-body text-xs uppercase tracking-[0.2em] text-secondary">
          Academy Fantasy
        </p>
        <h1 className="mt-3 font-display uppercase leading-none tracking-wide text-[clamp(2.5rem,6vw,4rem)]">
          Sign In
        </h1>

        {status === "sent" ? (
          <p className="mt-6 font-body text-sm leading-relaxed text-primary">
            Check your inbox — we sent a magic link to{" "}
            <span className="text-accent">{email}</span>. Click it to finish
            signing in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
        )}

        <p className="mt-8 font-mono text-xs uppercase tracking-wider text-muted">
          Free to play · No money involved
        </p>
      </div>
    </main>
  );
}
