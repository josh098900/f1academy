// Pure validation + rate-limit logic for the league social feed. No DB, no
// framework — the Server Actions and the tests share it, exactly like
// lib/scoring. The length caps mirror the CHECK constraints in
// 20260821120000_league_social_feed.sql (the DB is the belt; this is the nicer
// error and the single source of the numbers).

export const POST_MAX_LENGTH = 500;
export const REPLY_MAX_LENGTH = 280;

// ≤5 posts and ≤10 replies per minute per author — enough for a lively thread,
// tight enough to kill spam / wall-of-text flooding.
export type RateLimit = { max: number; windowMs: number };
export const POST_RATE_LIMIT: RateLimit = { max: 5, windowMs: 60_000 };
export const REPLY_RATE_LIMIT: RateLimit = { max: 10, windowMs: 60_000 };

export type BodyResult = { ok: true; value: string } | { ok: false; error: string };

// Trim, require non-empty, and cap length by CODE POINT count so it matches
// Postgres char_length (JS string.length counts UTF-16 units, which overcounts
// emoji/astral characters and would reject valid input the DB accepts).
function validateBody(raw: string, max: number, label: string): BodyResult {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: `${label} can't be empty.` };
  const chars = [...value].length;
  if (chars > max) {
    return { ok: false, error: `${label} is too long — ${chars}/${max} characters.` };
  }
  return { ok: true, value };
}

export function validatePostBody(raw: string): BodyResult {
  return validateBody(raw, POST_MAX_LENGTH, "Post");
}

export function validateReplyBody(raw: string): BodyResult {
  return validateBody(raw, REPLY_MAX_LENGTH, "Reply");
}

// Would a new action right now break the limit? `recent` is the author's recent
// action times (ms epoch); anything at/beyond the window edge is counted, so a
// caller passing the last N action times gets a straight yes/no.
export function isRateLimited(recent: number[], now: number, limit: RateLimit): boolean {
  const cutoff = now - limit.windowMs;
  const inWindow = recent.filter((t) => t > cutoff).length;
  return inWindow >= limit.max;
}
