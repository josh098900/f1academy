"use client";

import { useState, useTransition } from "react";

import { type ScoreRoundResult, scoreRound } from "@/app/admin/score/actions";
import { Button } from "@/components/ui/button";

export function ScoreButton({ roundId }: { roundId: number }) {
  const [result, setResult] = useState<ScoreRoundResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      {result ? (
        <span
          className={`font-body text-xs ${result.ok ? "text-success" : "text-danger"}`}
        >
          {result.ok
            ? `Scored ${result.scored} team${result.scored === 1 ? "" : "s"} ✓`
            : result.error}
        </span>
      ) : null}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => setResult(await scoreRound(roundId)))
        }
      >
        {pending ? "Scoring…" : "Score round"}
      </Button>
    </div>
  );
}
