import { describe, expect, it } from "vitest";

import {
  POST_MAX_LENGTH,
  POST_RATE_LIMIT,
  REPLY_MAX_LENGTH,
  isRateLimited,
  validatePostBody,
  validateReplyBody,
} from "../lib/social";

describe("validatePostBody / validateReplyBody", () => {
  it("trims and returns the normalised value", () => {
    const r = validatePostBody("  hello grid  ");
    expect(r).toEqual({ ok: true, value: "hello grid" });
  });

  it("rejects empty and whitespace-only bodies", () => {
    expect(validatePostBody("").ok).toBe(false);
    expect(validatePostBody("   \n\t  ").ok).toBe(false);
    expect(validateReplyBody("").ok).toBe(false);
  });

  it("accepts a body exactly at the cap and rejects one over", () => {
    expect(validatePostBody("x".repeat(POST_MAX_LENGTH)).ok).toBe(true);
    expect(validatePostBody("x".repeat(POST_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateReplyBody("x".repeat(REPLY_MAX_LENGTH)).ok).toBe(true);
    expect(validateReplyBody("x".repeat(REPLY_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it("counts by code point, matching Postgres char_length (emoji = 1)", () => {
    // 500 emoji = 500 characters to Postgres, though string.length would be 1000.
    const body = "🏁".repeat(POST_MAX_LENGTH);
    expect(body.length).toBe(POST_MAX_LENGTH * 2); // UTF-16 units — would over-reject
    expect(validatePostBody(body).ok).toBe(true); // but code points are within cap
    expect(validatePostBody("🏁".repeat(POST_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

describe("isRateLimited", () => {
  const now = 1_000_000;
  const { windowMs } = POST_RATE_LIMIT; // 60_000

  it("allows when under the cap", () => {
    const recent = [now - 1000, now - 2000]; // 2 in window, cap 5
    expect(isRateLimited(recent, now, POST_RATE_LIMIT)).toBe(false);
  });

  it("blocks at the cap", () => {
    const recent = [now - 1, now - 2, now - 3, now - 4, now - 5]; // 5 in window
    expect(isRateLimited(recent, now, POST_RATE_LIMIT)).toBe(true);
  });

  it("ignores actions outside the window", () => {
    // Five old actions (>1 min ago) don't count; one recent is fine.
    const recent = [
      now - windowMs - 1,
      now - windowMs - 2,
      now - windowMs - 100,
      now - windowMs - 500,
      now - windowMs - 999,
      now - 1000,
    ];
    expect(isRateLimited(recent, now, POST_RATE_LIMIT)).toBe(false);
  });
});
