import { NextResponse, type NextRequest } from "next/server";

// The trial is closed. Every authenticated route now redirects to the farewell
// page at / — there's no app left to reach and no session to refresh. (This
// previously called updateSession() to refresh the Supabase auth cookie; the
// original is in git if the app is ever reopened.)
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  // The authenticated surface — dashboards, team, leagues, admin, and the
  // Server Actions that POST to those paths. Redirecting all of it closes the
  // app in one place; the public farewell page at / is not matched.
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
