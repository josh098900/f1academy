"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  type SaveTeamInput,
  type SaveTeamResult,
  saveTeamFor,
} from "@/lib/team-save";

// Persists the user's pick for the active round. Authenticates via the session
// cookie, then delegates to the shared saveTeamFor core (re-validated
// server-side; RLS + the enforce_team_rules trigger backstop the write).
export async function saveTeam(input: SaveTeamInput): Promise<SaveTeamResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not signed in." };

  const result = await saveTeamFor(supabase, user.id, input);
  if (result.ok) revalidatePath("/team");
  return result;
}
