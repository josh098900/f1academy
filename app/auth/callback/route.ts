import { NextResponse } from "next/server";

import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

// Magic-link / OAuth landing. Supabase redirects here with a `?code=` which we
// exchange for a session cookie, then forward the user into the app.
//
// Redirects are built with `new URL(next, request.url)` — using the request's
// own URL as the base so we never trust a raw x-forwarded-host header to form
// the redirect target. In practice Vercel sets that header itself, but the
// belt-and-braces is two lines and removes the header from the attack surface.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // No code, or exchange failed.
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
