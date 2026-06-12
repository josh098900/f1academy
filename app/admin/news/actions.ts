"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type NewsResult = { ok: true } | { ok: false; error: string };

const BODY_MAX = 1000;
const TITLE_MAX = 120;

// Post an announcement. Admin-only; written via the service role (RLS has no
// write policy, so only the service role can insert).
export async function createAnnouncement(input: {
  title: string;
  body: string;
  pinned: boolean;
}): Promise<NewsResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (body.length === 0) return { ok: false, error: "Body can't be empty." };
  if (body.length > BODY_MAX)
    return { ok: false, error: `Body is too long (max ${BODY_MAX}).` };
  if (title.length > TITLE_MAX)
    return { ok: false, error: `Title is too long (max ${TITLE_MAX}).` };

  const db = createAdminClient();
  const { error } = await db.from("announcements").insert({
    title: title || null,
    body,
    pinned: input.pinned,
  });
  if (error) return { ok: false, error: error.message };

  // Refresh the admin list, the /news page and the dashboard card.
  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAnnouncement(id: number): Promise<NewsResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  const db = createAdminClient();
  const { error } = await db.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/dashboard");
  return { ok: true };
}
