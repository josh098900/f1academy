// The race simulator's vocabulary. Nothing here knows about pixels, SVG paths
// or React — the engine works in laps, seconds and a 0→1 position around the
// lap. The renderer maps that position onto a circuit path later.

export type CompoundId = "soft" | "medium" | "hard";

// Driver ratings, 0–100. DERIVED FROM REAL RESULTS, never invented and never
// "trained" — see docs. pace ← qualifying, racecraft ← positions gained,
// consistency ← classification rate. Progression lives in the car, not here.
export type DriverStats = {
  pace: number; // one-lap speed
  racecraft: number; // wheel-to-wheel: winning and defending overtakes
  consistency: number; // narrows lap-time scatter; erratic drivers are volatile
};

// Car ratings, 0–100. THIS is what the player upgrades.
export type CarStats = {
  power: number; // straight-line speed — helps lap time and overtaking
  aero: number; // cornering — helps lap time
  reliability: number; // steadies lap times (and, later, avoids failures)
  pitCrew: number; // shaves the stationary time in a pit stop
};

// What the player commits to BEFORE the race. The sim then executes these
// rules on their behalf — deterministic, so both players watch the same race,
// but expressive enough that two identical cars can win or lose on strategy.
export type Strategy = {
  startCompound: CompoundId;
  pitCompound: CompoundId; // what they fit at the stop
  // Box when tyre wear crosses this (0–1). There is no safety net: set it past
  // the compound's cliff and you will run on dead tyres, which is the point.
  pitAtWear: number;
  // Push (faster, burns tyres) when this close to the car ahead, in seconds.
  attackWithin: number;
  // Conserve (slower, saves tyres) when leading the car behind by this much.
  conserveWhenLeadingBy: number;
};

export type Entrant = {
  id: string; // stable id — a user id, or "npc-3"
  name: string; // display name (real F1 Academy driver)
  driver: DriverStats;
  car: CarStats;
  strategy: Strategy;
  isPlayer: boolean; // false for NPC filler
};

// A place on the lap where passing is actually possible. `position` is 0→1
// around the lap; `difficulty` scales the pass probability (a hard, narrow
// corner < 1, a long straight into a heavy braking zone > 1).
export type OvertakeZone = {
  name: string;
  position: number;
  difficulty: number;
};

export type Track = {
  id: string;
  name: string;
  // Reference lap time in seconds for an average car+driver. Gameplay-tuned,
  // not a claim about real F1 Academy lap times.
  baseLapTime: number;
  // Seconds lost driving through the pit lane, before crew time.
  pitLoss: number;
  // How harsh the surface is on tyres (1 = neutral).
  tyreWearFactor: number;
  zones: OvertakeZone[];
};

export type PaceMode = "push" | "neutral" | "conserve";

// One car's state at one instant. This is what the renderer animates.
export type CarFrame = {
  id: string;
  lap: number; // laps completed
  lapPosition: number; // 0→1 around the current lap — the renderer's input
  position: number; // 1-based race position
  gapToLeader: number; // seconds behind the car in front of the race
  lastLapTime: number | null; // her most recent completed lap
  bestLapTime: number | null; // her best so far
  compound: CompoundId;
  wear: number; // 0→1
  mode: PaceMode;
  inPit: boolean;
  // 0 → 1 through the pit stop (null when on track). The renderer drives the
  // car down the pit lane with this, so you can see the stationary time your
  // crew upgrade is buying.
  pitProgress: number | null;
  finished: boolean;
};

export type Frame = {
  t: number; // race time, seconds
  cars: CarFrame[];
};

export type RaceEvent =
  | { t: number; lap: number; type: "overtake"; carId: string; onCarId: string; zone: string }
  | { t: number; lap: number; type: "fastestLap"; carId: string; lapTime: number }
  | { t: number; lap: number; type: "defended"; carId: string; byCarId: string; zone: string }
  | { t: number; lap: number; type: "pit"; carId: string; to: CompoundId; duration: number }
  | { t: number; lap: number; type: "cliff"; carId: string } // tyres fell off the shelf
  | { t: number; lap: number; type: "finish"; carId: string; position: number };

export type Classification = {
  position: number;
  id: string;
  name: string;
  isPlayer: boolean;
  totalTime: number; // seconds; leader's real time
  gapToLeader: number; // seconds
  laps: number;
  pitStops: number;
  bestLapTime: number | null;
};

export type RaceInput = {
  track: Track;
  laps: number;
  entrants: Entrant[]; // grid order = array order (pole first)
  seed: number;
  // Balance dials. Omit for the tuned defaults; override to sweep or to pin a
  // historical balance so an old race replays exactly as it was raced.
  tuning?: Partial<import("./index").Tuning>;
};

export type RaceResult = {
  seed: number;
  trackId: string;
  laps: number;
  frames: Frame[];
  events: RaceEvent[];
  classification: Classification[];
  // Who set the fastest lap of the race, and what it was. The purple time.
  fastestLap: { carId: string; lapTime: number; lap: number } | null;
};
