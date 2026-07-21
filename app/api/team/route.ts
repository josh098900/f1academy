import { NextResponse } from "next/server";

import { authenticateBearer } from "@/lib/api/bearer-auth";
import { saveTeamFor } from "@/lib/team-save";

export const dynamic = "force-dynamic";

// Save the caller's fantasy team — the mobile write path.
//
// The website saves via the `saveTeam` Server Action (cookie auth); this is the
// Bearer-authenticated equivalent for native clients. Both funnel through the
// same `saveTeamFor` core, so the budget/transfer/wildcard/lock rules live in
// exactly ONE place and can never drift between web and mobile. RLS and the
// enforce_team_rules trigger backstop the write just as they do for the UI.
//
// Write-only by design: reads (round, prices, current team) go direct to
// Supabase from the client under RLS. This route only exists for the thing a
// client must NOT be trusted to do itself — validate and commit the team.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateBearer(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status }
    );
  }

  let body: {
    driverIds?: unknown;
    boostDriverId?: unknown;
    wildcard?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Shape check only — the real validation (prices, budget, eligibility) is
  // saveTeamFor's job, against live server data the client can't forge.
  const { driverIds, boostDriverId } = body;
  if (
    !Array.isArray(driverIds) ||
    !driverIds.every((d) => typeof d === "number") ||
    typeof boostDriverId !== "number"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Expected driverIds:number[] and boostDriverId:number.",
      },
      { status: 400 }
    );
  }

  const result = await saveTeamFor(auth.supabase, auth.userId, {
    driverIds,
    boostDriverId,
    wildcard: body.wildcard === true,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
