import type { ComponentType } from "react";

import { SilverstoneCircuit } from "./SilverstoneCircuit";
import { ZandvoortCircuit } from "./ZandvoortCircuit";

// Round-aware circuit art for the landing hero, keyed by rounds.circuit_name
// (exactly as stored in the DB). Rounds without an entry simply render no art
// — the hero falls back to single-column. Adding a new round's art is one
// component + one entry here; see the sourcing notes in each component.
export type CircuitArt = {
  Art: ComponentType<{ className?: string }>;
  caption: string;
};

export const CIRCUIT_ART: Record<string, CircuitArt> = {
  "Silverstone Circuit": {
    Art: SilverstoneCircuit,
    caption: "Silverstone · 18 corners · 5.891 km",
  },
  "Circuit Zandvoort": {
    Art: ZandvoortCircuit,
    caption: "Zandvoort · 14 corners · 4.259 km",
  },
};
