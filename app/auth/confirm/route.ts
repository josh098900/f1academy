import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Magic-link landing using Supabase's token_hash / verifyOtp flow. Unlike the
// PKCE `?code=` flow on /auth/callback, this works across browsers — the
// token_hash is self-contained and doesn't depend on a code_verifier cookie
// from the browser that requested the link. The magic-link email template in
// the Supabase Dashboard must be configured to point here:
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
//
// PKCE is kept for OAuth (Google) on /auth/callback — same-browser by nature.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    // Most common: link has expired or was already used.
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
