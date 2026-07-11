import type { Track } from "./types";

// The six 2026 F1 Academy rounds, modelled for the sim.
//
// These numbers are GAMEPLAY-TUNED, not a claim about real F1 Academy lap
// times. Pit losses are deliberately shorter than a real pit lane: a 15-lap
// race cannot carry a 22s stop without the stop dwarfing every other decision
// in the race (it quantised the field into 22s bands). What actually gives a circuit its character here is its overtake
// zones: how many, and how hard. Zandvoort is a one-real-chance track where
// track position is king; Las Vegas is a slipstream lottery. That contrast is
// the point — it's what makes choosing the track a strategic act.
//
// `position` is 0→1 around the lap and is also what the renderer will use to
// place a dot, so a zone at 0.05 really is just after the start/finish line.

export const TRACKS: Record<string, Track> = {
  shanghai: {
    id: "shanghai",
    name: "Shanghai International Circuit",
    baseLapTime: 108,
    pitLoss: 15,
    tyreWearFactor: 1.05,
    zones: [
      { name: "Turn 1 hairpin", position: 0.08, difficulty: 1.1 },
      { name: "Back straight", position: 0.62, difficulty: 1.35 }, // huge braking zone
      { name: "Turn 14", position: 0.88, difficulty: 0.8 },
    ],
  },
  montreal: {
    id: "montreal",
    name: "Circuit Gilles Villeneuve",
    baseLapTime: 96,
    pitLoss: 13,
    tyreWearFactor: 0.95,
    zones: [
      { name: "Turn 1", position: 0.06, difficulty: 1.0 },
      { name: "Casino hairpin", position: 0.55, difficulty: 1.2 },
      { name: "Wall of Champions", position: 0.92, difficulty: 1.25 }, // brave or bin it
    ],
  },
  silverstone: {
    id: "silverstone",
    name: "Silverstone Circuit",
    baseLapTime: 118,
    pitLoss: 16,
    tyreWearFactor: 1.15, // fast corners eat tyres
    zones: [
      { name: "Village", position: 0.18, difficulty: 1.0 },
      { name: "Stowe", position: 0.68, difficulty: 1.15 },
      { name: "Vale", position: 0.85, difficulty: 0.9 },
    ],
  },
  zandvoort: {
    id: "zandvoort",
    name: "Circuit Zandvoort",
    baseLapTime: 102,
    pitLoss: 14,
    tyreWearFactor: 1.1,
    // Famously hard to pass — one real chance a lap. Qualifying matters here.
    zones: [
      { name: "Tarzan", position: 0.05, difficulty: 1.2 },
      { name: "Arie Luyendyk banking", position: 0.95, difficulty: 0.55 },
    ],
  },
  cota: {
    id: "cota",
    name: "Circuit of the Americas",
    baseLapTime: 122,
    pitLoss: 17,
    tyreWearFactor: 1.0,
    zones: [
      { name: "Turn 1 uphill", position: 0.07, difficulty: 1.3 },
      { name: "Turn 11 hairpin", position: 0.52, difficulty: 1.4 }, // longest straight
      { name: "Turn 15", position: 0.8, difficulty: 0.85 },
    ],
  },
  vegas: {
    id: "vegas",
    name: "Las Vegas Strip Circuit",
    baseLapTime: 104,
    pitLoss: 14,
    tyreWearFactor: 0.85, // smooth, cool street surface
    // Enormous straights: a slipstream lottery, passes everywhere.
    zones: [
      { name: "Turn 5", position: 0.22, difficulty: 1.15 },
      { name: "The Strip", position: 0.6, difficulty: 1.5 },
      { name: "Turn 14", position: 0.84, difficulty: 1.25 },
    ],
  },
};

export const TRACK_IDS = Object.keys(TRACKS);

export function getTrack(id: string): Track {
  const track = TRACKS[id];
  if (!track) throw new Error(`Unknown track: ${id}`);
  return track;
}
