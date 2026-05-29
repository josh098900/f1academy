// Allow only same-origin paths in auth-flow `next` redirects. Rejects absolute
// URLs (https://evil.com), protocol-relative paths (//evil.com), backslash
// tricks (/\\evil.com which some browsers normalise), and anything else that
// could land the user off our domain after sign-in. Empty/missing falls back
// to the dashboard.
//
// The previous version of /auth/confirm passed `next` straight into Next's
// redirect(), opening a phishing chain where a malicious link could log a
// user in and then bounce them off-domain. /auth/callback's string
// concatenation was technically safer but pattern-equivalent; both now run
// every candidate through this helper.

export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  if (next.includes("\\")) return "/dashboard";
  return next;
}
