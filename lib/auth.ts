import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// Reads the signed-in user from the JWT via getClaims(), which verifies the
// token locally against the project's public signing key (cached JWKS) — no
// round-trip to the Auth server like getUser(). Pages only ever need id and
// email, and both live in the claims. React.cache dedupes within a single
// server render so the (app) layout and the page share one call.
//
// Server actions are a separate request scope and don't benefit from the
// cache; mutations deliberately keep calling supabase.auth.getUser() so a
// revoked session is rejected immediately rather than at token expiry.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});
