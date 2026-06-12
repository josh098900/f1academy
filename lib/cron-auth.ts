import { timingSafeEqual } from "node:crypto";

// Constant-time check of the Bearer CRON_SECRET on the scheduled routes.
// A plain !== short-circuits on the first differing byte — a (theoretical)
// timing side-channel. timingSafeEqual compares in length-independent time.
// Length is checked first because timingSafeEqual throws on unequal-length
// buffers; leaking only the length of an attacker's own guess is harmless.
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("authorization");
  if (!provided) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
