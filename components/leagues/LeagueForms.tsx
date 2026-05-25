"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createLeague, joinLeague } from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-sm border border-border-default bg-surface px-3 font-body text-sm text-primary placeholder:text-muted focus:border-border-strong focus:outline-none";

export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const res = await createLeague(name);
      if (res.ok) {
        setMsg({ ok: true, text: `Created — invite code ${res.code}` });
        setName("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-sm tracking-wider text-secondary uppercase">
        Create a league
      </h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="League name"
        className={inputClass}
      />
      <Button type="submit" disabled={pending || name.trim().length < 2} className="w-full">
        {pending ? "Creating…" : "Create league"}
      </Button>
      {msg ? (
        <p className={`font-body text-xs ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}

export function JoinLeagueForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const res = await joinLeague(code);
      if (res.ok) {
        setMsg({ ok: true, text: `Joined ${res.name}` });
        setCode("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-sm tracking-wider text-secondary uppercase">
        Join with a code
      </h2>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={6}
        className={`${inputClass} font-mono uppercase tracking-[0.3em]`}
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending || code.trim().length < 6}
        className="w-full"
      >
        {pending ? "Joining…" : "Join league"}
      </Button>
      {msg ? (
        <p className={`font-body text-xs ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}
