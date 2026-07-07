import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the `middleware` file convention to `proxy`.
// Runs on every matched request to refresh the Supabase auth session.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Only routes where SERVER code reads the session need the refresh: Server
  // Components can't persist a refreshed cookie themselves, so the proxy must
  // do it for them. Everything else manages without: /login is a static page
  // whose browser client refreshes its own cookies, /auth/* route handlers set
  // cookies directly (exchangeCodeForSession / verifyOtp), and the landing,
  // about, privacy and recommends pages never touch auth. Server actions POST
  // to their page's own path, so they're covered by these patterns.
  //
  // NOTE: a new authenticated section must be added here, or its Server
  // Components will see expired sessions they can't refresh.
  matcher: [
    "/dashboard/:path*",
    "/team/:path*",
    "/drivers/:path*",
    "/leaderboard/:path*",
    "/leagues/:path*",
    "/news/:path*",
    "/admin/:path*",
  ],
};
