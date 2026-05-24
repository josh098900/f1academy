import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/db/types";

// Service-role client — bypasses RLS. SERVER-ONLY, and only to be used after
// verifying the caller is an admin (see lib/admin.ts). Never import in client code.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
