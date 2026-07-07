import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/db/types";

// Refreshes the auth session on every request and keeps the cookie in sync
// between the request and response. Called from the root proxy.ts (Next 16's
// rename of the middleware file convention).
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any logic between createServerClient and getClaims().
  // Doing so can intermittently log users out (per Supabase SSR guidance).
  //
  // getClaims() verifies the JWT locally against the project's public signing
  // key (cached JWKS) instead of round-tripping to the Auth server like
  // getUser() — the expired-session refresh still happens exactly as before.
  // Requires asymmetric JWT signing keys (dashboard → JWT Keys); with legacy
  // HS256 keys it transparently falls back to a server-side check.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
