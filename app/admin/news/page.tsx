import { DeleteAnnouncementButton } from "@/components/admin/DeleteAnnouncementButton";
import { NewsForm } from "@/components/admin/NewsForm";
import { getAnnouncements } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function AdminNewsPage() {
  const supabase = await createClient();
  const announcements = await getAnnouncements(supabase);

  return (
    <main className="px-6 py-6 sm:px-12">
      <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] tracking-wide uppercase">
        News
      </h1>
      <p className="mt-2 max-w-xl font-body text-sm text-secondary">
        Post updates for players — they appear on the dashboard and the News
        page. Pin time-sensitive notices (like &ldquo;results post Monday&rdquo;)
        to keep them on top.
      </p>

      <div className="mt-6 max-w-xl">
        <NewsForm />
      </div>

      <div className="mt-10 max-w-xl">
        <h2 className="font-display text-sm tracking-[0.2em] text-secondary uppercase">
          Posted ({announcements.length})
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-3 font-body text-sm text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="mt-4 space-y-px">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="border border-border-default bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {a.pinned ? (
                      <span className="font-mono text-[10px] tracking-wider text-accent uppercase">
                        Pinned ·{" "}
                      </span>
                    ) : null}
                    {a.title ? (
                      <span className="font-display text-sm tracking-wide text-primary uppercase">
                        {a.title}
                      </span>
                    ) : null}
                    <p className="mt-1 font-body text-sm leading-relaxed whitespace-pre-line text-secondary">
                      {a.body}
                    </p>
                    <p className="mt-2 font-mono text-[10px] tracking-wider text-muted uppercase">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <DeleteAnnouncementButton id={a.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
