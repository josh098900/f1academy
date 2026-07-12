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

// jsdom implements no SVG geometry: getTotalLength/getPointAtLength simply don't
// exist, so anything that measures a path (the race viewer maps a car's 0→1 lap
// position onto the circuit with them) throws on render. Stub them so components
// that USE the geometry can still be tested for behaviour. The geometry itself is
// verified separately, in maths, not in the DOM.
//
// It has to go on SVGElement, not SVGPathElement: jsdom creates <path> as a
// generic SVGElement, so patching the more specific prototype does nothing.
if (typeof SVGElement !== "undefined") {
  const proto = SVGElement.prototype as unknown as {
    getTotalLength?: () => number;
    getPointAtLength?: (l: number) => { x: number; y: number };
  };
  proto.getTotalLength ??= () => 1000;
  proto.getPointAtLength ??= (l: number) => ({ x: l, y: l });
}
