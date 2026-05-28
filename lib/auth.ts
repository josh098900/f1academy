import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

// React.cache dedupes within a single server render. The (app) layout and the
// page being rendered both need the user — without this they'd each do their
// own auth.getUser() RTT to Supabase; with this they share one call.
// Server actions are a separate request scope and don't benefit, so they keep
// calling supabase.auth.getUser() directly.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
