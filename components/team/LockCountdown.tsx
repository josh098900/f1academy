"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// Live countdown to a round's lock time. Turns accent in the final hour and,
// once it hits zero, refreshes so the server re-renders the locked view.
// See DESIGN_SYSTEM.md.
export function LockCountdown({ lockTime }: { lockTime: string }) {
  const router = useRouter();
  const target = new Date(lockTime).getTime();
  // null until mounted, so SSR and first client render match (no hydration mismatch).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const raf = requestAnimationFrame(update); // initial value, async (next frame)
    const id = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const expired = now !== null && now >= target;
  useEffect(() => {
    if (expired) router.refresh();
  }, [expired, router]);

  const label = (
    <span className="font-body text-xs tracking-wider text-secondary uppercase">
      Locks in
    </span>
  );

  if (now === null) {
    return (
      <div className="flex items-baseline gap-2">
        {label}
        <span
          data-tabular
          className="font-mono text-2xl text-muted tabular-nums"
        >
          —
        </span>
      </div>
    );
  }

  if (expired) {
    return (
      <span
        data-tabular
        className="font-mono text-2xl tracking-wide text-accent tabular-nums uppercase"
      >
        Locked
      </span>
    );
  }

  const total = Math.floor((target - now) / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const finalHour = total <= 3600;

  return (
    <div className="flex items-baseline gap-2">
      {label}
      <span
        data-tabular
        className={cn(
          "font-mono text-2xl tabular-nums",
          finalHour ? "text-accent" : "text-primary"
        )}
      >
        {days > 0 ? `${days}d ` : ""}
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
