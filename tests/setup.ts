// Registers Testing Library's jest-dom matchers (toBeDisabled, toBeInTheDocument…)
// on Vitest's expect, and unmounts each render after its test.
//
// The cleanup is explicit because Testing Library only auto-registers it when
// Vitest `globals` is enabled (it isn't here) — without it, every render stacks
// on the previous test's DOM and role/text queries match duplicates across
// tests. Both imports are harmless for the pure node-environment suites.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
