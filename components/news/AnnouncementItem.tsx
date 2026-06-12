import type { Announcement } from "@/lib/queries";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// One announcement, rendered the same on the dashboard card and /news. Body is
// plain text (whitespace preserved) — never HTML, so nothing to sanitise.
export function AnnouncementItem({ item }: { item: Announcement }) {
  return (
    <article className="border-l-2 border-accent/40 pl-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {item.pinned ? (
          <span className="font-mono text-[10px] tracking-wider text-accent uppercase">
            Pinned
          </span>
        ) : null}
        {item.title ? (
          <h3 className="font-display text-base tracking-wide text-primary uppercase">
            {item.title}
          </h3>
        ) : null}
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
          {fmtDate(item.createdAt)}
        </span>
      </div>
      <p className="mt-1.5 font-body text-sm leading-relaxed whitespace-pre-line text-secondary">
        {item.body}
      </p>
    </article>
  );
}
