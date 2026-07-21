import "server-only";

import { type SupabaseClient, createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";

// Authenticating an API caller by its Supabase access token, not a cookie.
//
// The web app authenticates through the session cookie (@supabase/ssr); native
// clients and any other HTTP caller present `Authorization: Bearer <jwt>`
// instead. This is the shared front door for every write route the mobile apps
// (and anything else off the browser) will call.
//
// It returns a per-request client carrying the caller's token, so RLS applies
// as that user for anything the route then does — the same client shape the
// query/save helpers already expect.
//
// getUser() over getClaims() is deliberate: these routes gate MUTATIONS, and a
// round-trip to the Auth server rejects a revoked session immediately rather
// than at token expiry. That mirrors the Server Action posture documented in
// lib/auth.ts — reads verify the JWT locally, writes pay for immediacy.

export type BearerAuth =
  | { ok: true; supabase: SupabaseClient<Database>; userId: string }
  | { ok: false; status: number; error: string };

export async function authenticateBearer(
  request: Request
): Promise<BearerAuth> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token." };
  }

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
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, status: 401, error: "Invalid or expired token." };
  }

  return { ok: true, supabase, userId: user.id };
}
