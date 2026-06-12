"use client";

import { useTransition } from "react";

import { deleteAnnouncement } from "@/app/admin/news/actions";

export function DeleteAnnouncementButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await deleteAnnouncement(id)))}
      className="font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:text-danger disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
