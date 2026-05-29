"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Updates the player's display_name (RLS already scopes the UPDATE to own-row,
// so no extra auth check is needed beyond confirming a user is present).
// Revalidates the (app) layout so the leaderboard + welcome banner pick it up.
export async function setDisplayName(
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      error: `Between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const { error } = await supabase
    .from("users")
    .update({ display_name: trimmed })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your name. Try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// Lock-time email reminder opt-out toggle. RLS scopes the UPDATE to own-row.
export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("users")
    .update({ reminders_enabled: enabled })
    .eq("id", user.id)
    .throwOnError();

  revalidatePath("/", "layout");
}
