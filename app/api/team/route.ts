import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// The trial has ended — the team write path is retired. Kept as a 410 stub so
// the route still resolves; the original Bearer-authenticated saveTeamFor
// handler (the native app's write path) is in git history if the app reopens.
export async function POST(): Promise<Response> {
  return NextResponse.json(
    { ok: false, error: "Academy Fantasy has ended — the trial is closed." },
    { status: 410 }
  );
}
