import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { AnnouncementItem } from "@/components/news/AnnouncementItem";
import { getCurrentUser } from "@/lib/auth";
import { getAnnouncements } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function NewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const announcements = await getAnnouncements(supabase);

  return (
    <main>
      <PageHeader eyebrow="Updates" title="News" />

      <div className="px-6 py-8 sm:px-12">
        {announcements.length === 0 ? (
          <p className="font-body text-sm text-muted">
            No updates yet. Check back around race weekends.
          </p>
        ) : (
          <div className="max-w-2xl space-y-8">
            {announcements.map((a) => (
              <AnnouncementItem key={a.id} item={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
