"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteLeague, leaveLeague } from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";

type Mode = "leave" | "delete";

const COPY: Record<Mode, {
  trigger: string;
  confirmAsk: string;
  confirmAction: string;
  pendingLabel: string;
}> = {
  leave: {
    trigger: "Leave league",
    confirmAsk: "Sure?",
    confirmAction: "Leave",
    pendingLabel: "Leaving…",
  },
  delete: {
    trigger: "Delete league",
    confirmAsk: "Sure? This removes the league for everyone.",
    confirmAction: "Delete",
    pendingLabel: "Deleting…",
  },
};

// One button serves both flows. Mode is "leave" for ordinary members and
// "delete" for the owner — the page picks which to render. Both end at the
// /leagues index after the action succeeds.
export function LeaveButton({
  leagueId,
  mode = "leave",
}: {
  leagueId: number;
  mode?: Mode;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const copy = COPY[mode];

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        {copy.trigger}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="font-body text-xs text-secondary">{copy.confirmAsk}</span>
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const action = mode === "delete" ? deleteLeague : leaveLeague;
            const res = await action(leagueId);
            if (res.ok) router.push("/leagues");
          })
        }
      >
        {pending ? copy.pendingLabel : copy.confirmAction}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
    </div>
  );
}
