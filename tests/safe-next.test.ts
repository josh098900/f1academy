import { describe, expect, it } from "vitest";

import { safeNext } from "../lib/auth/safe-next";

describe("safeNext", () => {
  it("returns dashboard fallback for null, undefined, or empty", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext("")).toBe("/dashboard");
  });

  it("passes through valid same-origin paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/team")).toBe("/team");
    expect(safeNext("/leagues/42")).toBe("/leagues/42");
    expect(safeNext("/dashboard?welcome=1")).toBe("/dashboard?welcome=1");
    expect(safeNext("/drivers/3#stats")).toBe("/drivers/3#stats");
  });

  it("rejects absolute URLs to off-domain hosts", () => {
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("http://evil.com/path")).toBe("/dashboard");
    expect(safeNext("ftp://evil.com")).toBe("/dashboard");
    expect(safeNext("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects protocol-relative paths that browsers might follow off-domain", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("//evil.com/path")).toBe("/dashboard");
    expect(safeNext("///evil.com")).toBe("/dashboard");
  });

  it("rejects backslash mixing that some browsers normalise to `/`", () => {
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext("/path\\with\\backslash")).toBe("/dashboard");
  });

  it("rejects bare relative paths (we want explicit /)", () => {
    expect(safeNext("dashboard")).toBe("/dashboard");
    expect(safeNext("../escape")).toBe("/dashboard");
  });
});
