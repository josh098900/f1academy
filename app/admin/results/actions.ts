"use server";

import { revalidatePath } from "next/cache";

import { getAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type SaveResultsResult = { ok: true } | { ok: false; error: string };

type ResultInput = {
  driverId: number;
  position: number | null;
  gridPosition: number | null;
  status: "classified" | "dnf" | "dsq" | "dns";
  fastestLap: boolean;
};

export async function saveSessionResults(input: {
  sessionId: number;
  results: ResultInput[];
}): Promise<SaveResultsResult> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Admin only." };

  const db = createAdminClient();
  const rows = input.results.map((r) => ({
    session_id: input.sessionId,
    driver_id: r.driverId,
    // Position only meaningful when classified.
    position: r.status === "classified" ? r.position : null,
    grid_position: r.gridPosition,
    status: r.status,
    fastest_lap: r.status === "classified" ? r.fastestLap : false,
    data_source: "manual_admin" as const,
  }));

  const { error } = await db
    .from("session_results")
    .upsert(rows, { onConflict: "session_id,driver_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/results");
  return { ok: true };
}
