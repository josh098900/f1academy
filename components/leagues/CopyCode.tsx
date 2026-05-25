"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

// Tap-to-copy the league invite code. Falls back silently if the Clipboard API
// is unavailable (e.g. non-secure context).
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — leave the code visible to copy manually.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Invite code copied" : "Copy invite code"}
      className="group inline-flex items-center gap-2 rounded-sm border border-border-default px-3 py-1.5 font-mono text-xs tracking-wider uppercase transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="text-muted">Invite</span>
      <span className="tracking-[0.3em] text-accent">{code}</span>
      <span className={cn("text-muted transition-colors", copied && "text-success")}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </span>
    </button>
  );
}
