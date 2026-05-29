"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Triggered by the user explicitly tapping the button on /auth/confirm — only
// then do we actually consume the token. URL pre-fetchers (Gmail's link
// scanner, security tools, in-app browsers that double-fetch) see only HTML
// when they GET /auth/confirm, so the token survives until the real tap.
export async function confirmSignIn(formData: FormData): Promise<void> {
  const token_hash = String(formData.get("token_hash") ?? "");
  const type = formData.get("type") as EmailOtpType | null;
  const next = String(formData.get("next") ?? "/dashboard");

  if (!token_hash || !type) {
    redirect("/login?error=link_invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    redirect("/login?error=link_expired");
  }

  redirect(next);
}
