"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { leaveLeague } from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

export function LeaveButton({ leagueId }: { leagueId: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        Leave league
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-body text-xs text-secondary">Sure?</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await leaveLeague(leagueId);
            if (res.ok) router.push("/leagues");
          })
        }
      >
        {pending ? "Leaving…" : "Leave"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
    </div>
  );
}
