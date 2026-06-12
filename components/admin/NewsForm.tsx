"use client";

import { useState, useTransition } from "react";

import { createAnnouncement } from "@/app/admin/news/actions";
import { Button } from "@/components/ui/button";

export function NewsForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await createAnnouncement({ title, body, pinned });
      if (res.ok) {
        setTitle("");
        setBody("");
        setPinned(false);
        setMsg({ ok: true, text: "Posted ✓" });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="space-y-3 border border-border-default p-5">
      <label className="block">
        <span className="font-body text-xs tracking-wider text-secondary uppercase">
          Title (optional)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Race weekend"
          className="mt-2 h-10 w-full rounded-sm border border-border-default bg-surface px-3 font-body text-sm text-primary placeholder:text-muted focus:border-border-strong focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="font-body text-xs tracking-wider text-secondary uppercase">
          Update
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="e.g. Results for this round post Monday after the sync runs. Standings update then."
          className="mt-2 w-full rounded-sm border border-border-default bg-surface px-3 py-2 font-body text-sm leading-relaxed text-primary placeholder:text-muted focus:border-border-strong focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="size-4 accent-accent"
        />
        <span className="font-body text-xs tracking-wider text-secondary uppercase">
          Pin to top
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={pending || body.trim().length === 0}
          onClick={submit}
        >
          {pending ? "Posting…" : "Post update"}
        </Button>
        {msg ? (
          <span
            className={`font-body text-xs ${msg.ok ? "text-success" : "text-danger"}`}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
