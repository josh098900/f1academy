import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/db/types";
import { saveTeamFor } from "@/lib/team-save";

export const dynamic = "force-dynamic";

// LOAD-TEST ONLY. A Bearer-callable mirror of the saveTeam Server Action, so a
// plain HTTP tool (gridload) can drive the REAL save path — the production save
// is a Server Action (Next-Action header + RSC body + cookie) and isn't
// replayable. This lets us measure what the Next.js hop costs on top of the raw
// PostgREST upsert. See loadtest/TRAFFIC-MAP.md § 5.
//
// Disabled unless LOADTEST_ROUTES_ENABLED=1, so it 404s in any normal
// deployment (Vercel never sets it). Even enabled it's not a new exposure: the
// write is scoped to the caller's own JWT by RLS + the enforce_team_rules
// trigger, exactly like the UI save.
export async function POST(request: Request): Promise<Response> {
  if (process.env.LOADTEST_ROUTES_ENABLED !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: "Missing bearer token." },
      { status: 401 }
    );
  }

  // Per-request client authenticated as the caller (Bearer, not cookie), so
  // RLS applies as that user — the same client shape the query helpers expect.
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "Invalid token." },
      { status: 401 }
    );
  }

  let body: {
    driverIds?: number[];
    boostDriverId?: number;
    wildcard?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.driverIds) || typeof body.boostDriverId !== "number") {
    return NextResponse.json(
      { ok: false, error: "Expected driverIds:number[] and boostDriverId:number." },
      { status: 400 }
    );
  }

  const result = await saveTeamFor(supabase, user.id, {
    driverIds: body.driverIds,
    boostDriverId: body.boostDriverId,
    wildcard: body.wildcard,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
