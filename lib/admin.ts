import { createClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; displayName: string };

// Returns the signed-in admin, or null. Reads is_admin from the user's own row
// (allowed by RLS). Use to gate the admin area and admin server actions.
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("is_admin, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.is_admin) return null;
  return { id: user.id, displayName: data.display_name };
}
