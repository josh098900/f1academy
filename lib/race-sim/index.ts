// The race simulator — a pure, deterministic function.
//
// simulateRace(input) → the same race, every time, on any device. Nothing here
// touches the DOM, the network or the clock. That's deliberate: we store only
// the inputs and the seed in the database, and recompute the race on demand, so
// both players in an async match watch a byte-identical broadcast, and nobody
// can tamper with a result by tampering with a replay.
//
// The model has exactly four systems: pace from stats, tyre degradation,
// overtaking, and pit stops. Resisting a fifth is the whole discipline.

import { Rng } from "./rng";
import { COMPOUNDS, MODES, isOverCliff, tyreLapDelta, wearIncrement } from "./tyres";
import type {
  CarFrame,
  Classification,
  CompoundId,
  Entrant,
  Frame,
  PaceMode,
  RaceEvent,
  RaceInput,
  RaceResult,
  Track,
} from "./types";

export * from "./types";
export { COMPOUNDS, MODES } from "./tyres";
export { TRACKS, TRACK_IDS, getTrack } from "./tracks";
export { RACING_LINES, RACEABLE_TRACKS, getRacingLine } from "./racing-lines";
export type { RacingLine } from "./racing-lines";
export { deriveDriverStats, NEUTRAL } from "./derive";
export type { DriverForm } from "./derive";
export { Rng } from "./rng";

// --- Tuning constants. Every one of these is a gameplay dial. ---------------

const DT = 0.5; // simulation step, seconds
const MAX_RACE_SECONDS = 3 * 60 * 60; // safety valve against a runaway loop

// Balance is DATA, not constants baked into the maths.
//
// A racing game lives or dies on these numbers, and they will be retuned for as
// long as the game exists — so they are injectable (RaceInput.tuning) and can be
// swept in a script or pinned in a test. The defaults below were measured, not
// guessed: see the balance assertions in tests/race-sim.test.ts, which fail if a
// future tweak makes a maxed package a certainty or turns pole into the whole
// race.
export type Tuning = {
  paceWeight: number; // a 100-pace driver is this much % faster than a 0-pace one
  carWeight: number; // ditto for the car
  maxSigma: number; // lap-time scatter (s) for a maximally erratic driver
  qualiSigmaMult: number; // one lap, more on the line — upsets happen

  dirtyAirWindow: number; // seconds behind where following gets harder
  dirtyAirPenalty: number; // seconds per lap lost in the wake
  overtakeWindow: number; // must be this close entering a zone to have a go
  failedPassCost: number; // seconds lost running wide / locking up
  carLengthSeconds: number; // the buffer a blocked car sits behind at

  basePassChance: number;
  wPace: number; // per second of lap-time advantage
  wRacecraft: number; // per 100 points of racecraft difference
  wTyre: number; // per second of tyre advantage
  wPower: number; // per 100 points of power difference
  minPass: number;
  maxPass: number;

  baseCrewTime: number; // stationary seconds before pit-crew upgrades
  crewTimeSaving: number; // a maxed crew saves this much
  maxStops: number;
};

export const DEFAULT_TUNING: Tuning = {
  paceWeight: 0.006,
  carWeight: 0.006,
  maxSigma: 0.6,
  qualiSigmaMult: 1.25,

  dirtyAirWindow: 1.0,
  dirtyAirPenalty: 0.06,
  overtakeWindow: 0.8,
  failedPassCost: 0.15,
  carLengthSeconds: 0.18,

  basePassChance: 0.32,
  wPace: 0.9,
  wRacecraft: 0.35,
  wTyre: 0.15,
  wPower: 0.2,
  minPass: 0.03,
  maxPass: 0.85,

  baseCrewTime: 2.5,
  crewTimeSaving: 1.2,
  maxStops: 2,
};

// --- Internal per-car state ------------------------------------------------

type CarState = {
  entrant: Entrant;
  progress: number; // total laps completed, as a float. Higher = further ahead.
  compound: CompoundId;
  wear: number;
  mode: PaceMode;
  lapNoise: number; // rolled once per lap — see rollLapNoise
  lapIndex: number; // which lap the noise belongs to
  pitTimer: number; // seconds left stationary; > 0 means in the pits
  stops: number;
  finished: boolean;
  finishTime: number;
  cliffAnnounced: boolean;
};

// A driver's lap-time scatter. Consistency (driver) and reliability (car) both
// narrow it. Note this changes the SPREAD, not the mean: an erratic driver is
// sometimes quicker than her rating, which is exactly what makes her fun and
// infuriating to field.
function sigmaFor(state: CarState, tune: Tuning): number {
  const { consistency } = state.entrant.driver;
  const { reliability } = state.entrant.car;
  const s =
    tune.maxSigma * (1 - 0.6 * (consistency / 100) - 0.2 * (reliability / 100));
  return Math.max(0.05, s);
}

function rollLapNoise(state: CarState, rng: Rng, tune: Tuning): void {
  state.lapNoise = rng.normal() * sigmaFor(state, tune);
}

// What this car's lap is worth right now, in seconds.
function lapTimeFor(
  state: CarState,
  track: Track,
  inDirtyAir: boolean,
  tune: Tuning
): number {
  const { driver, car } = state.entrant;
  const driverFactor = 1 - tune.paceWeight * (driver.pace / 100);
  const carPerf = (car.power + car.aero) / 2;
  const carFactor = 1 - tune.carWeight * (carPerf / 100);

  let t = track.baseLapTime * driverFactor * carFactor;
  t += tyreLapDelta(COMPOUNDS[state.compound], state.wear);
  t += MODES[state.mode].lapDelta;
  if (inDirtyAir) t += tune.dirtyAirPenalty;
  t += state.lapNoise;

  return Math.max(t, track.baseLapTime * 0.5); // never absurd
}

// Execute the player's pre-committed rules. This is the whole of "management":
// they wrote the rules before the lights, and the car follows them literally.
function decideMode(
  state: CarState,
  gapAhead: number,
  gapBehind: number
): PaceMode {
  const { attackWithin, conserveWhenLeadingBy } = state.entrant.strategy;
  if (gapAhead <= attackWithin) return "push";
  if (gapBehind >= conserveWhenLeadingBy) return "conserve";
  return "neutral";
}

// Box when the plan says so — AND only when the stop can pay for itself.
//
// Two rules, and both matter:
//
// 1. The player's pitAtWear is the trigger. There is deliberately no safety net
//    around it: set it past the compound's cliff and you WILL run on dead
//    tyres. Writing a bad rule has to hurt, or strategy isn't a skill. It can't
//    spiral into farce, because wear caps at 1.0 and so does the penalty.
//
// 2. But a stop must still be worth making. A pit costs ~22s; fresh rubber only
//    pays that back if there are enough laps left to claw it in. Without this
//    gate the sim cheerfully pitted cars on lap 14 of 15 — a guaranteed 22s
//    loss for a one-lap benefit — which quantised the whole field into 22s
//    bands and was the real reason "identical" cars finished a minute apart.
//    A strategist would never do it, so neither does the sim. Note this also
//    permits a genuine rescue stop: once a tyre is truly destroyed it's losing
//    ~6s a lap, and then even a late stop pays.
function shouldPit(
  state: CarState,
  tune: Tuning,
  track: Track,
  lapsRemaining: number
): boolean {
  if (state.stops >= tune.maxStops || state.finished) return false;
  if (state.wear < state.entrant.strategy.pitAtWear) return false;
  if (lapsRemaining <= 0) return false;

  const nowPerLap = tyreLapDelta(COMPOUNDS[state.compound], state.wear);
  const freshPerLap = tyreLapDelta(COMPOUNDS[state.entrant.strategy.pitCompound], 0);
  const savedPerLap = nowPerLap - freshPerLap;
  const cost = track.pitLoss + crewTime(state, tune);
  return savedPerLap * lapsRemaining > cost;
}

function crewTime(state: CarState, tune: Tuning): number {
  return tune.baseCrewTime - tune.crewTimeSaving * (state.entrant.car.pitCrew / 100);
}

// Did this car pass `position` on the lap during this tick? Handles wrapping
// across the start/finish line.
function crossedPosition(prev: number, next: number, position: number): boolean {
  if (next - prev >= 1) return true; // a whole lap in one tick — can't miss it
  const a = prev % 1;
  const b = next % 1;
  if (b >= a) return a < position && position <= b;
  return position > a || position <= b; // wrapped
}

// The probability an attack in this zone comes off.
function passProbability(
  attacker: CarState,
  defender: CarState,
  attackerLap: number,
  defenderLap: number,
  zoneDifficulty: number,
  tune: Tuning
): number {
  const paceAdvantage = defenderLap - attackerLap; // seconds/lap quicker
  const racecraftDelta =
    attacker.entrant.driver.racecraft - defender.entrant.driver.racecraft;
  const tyreAdvantage =
    tyreLapDelta(COMPOUNDS[defender.compound], defender.wear) -
    tyreLapDelta(COMPOUNDS[attacker.compound], attacker.wear);
  const powerDelta = attacker.entrant.car.power - defender.entrant.car.power;

  const raw =
    tune.basePassChance +
    paceAdvantage * tune.wPace +
    (racecraftDelta / 100) * tune.wRacecraft +
    tyreAdvantage * tune.wTyre +
    (powerDelta / 100) * tune.wPower;

  return Math.max(tune.minPass, Math.min(tune.maxPass, raw * zoneDifficulty));
}

// One flying lap on fresh softs, and the grid falls out of it.
//
// This exists because grid position is powerful — at a track like Zandvoort it
// can decide the race — so it must be EARNED by the package the player built,
// not assigned arbitrarily. Qualifying is where pace and car turn into track
// position; the race is where racecraft and strategy get to overturn it. The
// scatter is deliberately wider than in the race: it's one lap, so a consistent
// driver banks her rating and an erratic one might steal pole or bin it.
export type QualifyingResult = {
  position: number;
  id: string;
  lapTime: number;
  gap: number;
};

export function simulateQualifying(
  entrants: Entrant[],
  track: Track,
  seed: number,
  tuning: Partial<Tuning> = {}
): QualifyingResult[] {
  const tune = { ...DEFAULT_TUNING, ...tuning };
  const rng = new Rng(seed);
  const laps = entrants.map((entrant) => {
    const { driver, car } = entrant;
    const driverFactor = 1 - tune.paceWeight * (driver.pace / 100);
    const carPerf = (car.power + car.aero) / 2;
    const carFactor = 1 - tune.carWeight * (carPerf / 100);
    const sigma = Math.max(
      0.05,
      tune.maxSigma *
        (1 - 0.6 * (driver.consistency / 100) - 0.2 * (car.reliability / 100))
    );
    const lapTime =
      track.baseLapTime * driverFactor * carFactor +
      COMPOUNDS.soft.freshDelta +
      rng.normal() * sigma * tune.qualiSigmaMult;
    return { id: entrant.id, lapTime };
  });

  laps.sort((a, b) => a.lapTime - b.lapTime);
  const pole = laps[0]?.lapTime ?? 0;
  return laps.map((l, i) => ({
    position: i + 1,
    id: l.id,
    lapTime: l.lapTime,
    gap: l.lapTime - pole,
  }));
}

// Convenience: qualify, then line them up in that order for the race.
export function gridFromQualifying(
  entrants: Entrant[],
  track: Track,
  seed: number,
  tuning: Partial<Tuning> = {}
): Entrant[] {
  const quali = simulateQualifying(entrants, track, seed, tuning);
  const byId = new Map(entrants.map((e) => [e.id, e]));
  return quali.map((q) => byId.get(q.id)!);
}

export function simulateRace(input: RaceInput): RaceResult {
  const { track, laps, entrants, seed } = input;
  const tune: Tuning = { ...DEFAULT_TUNING, ...input.tuning };
  const rng = new Rng(seed);

  // Grid order: pole sits marginally up the road, so lap 1 starts realistically
  // strung out rather than as an eight-way dead heat.
  const cars: CarState[] = entrants.map((entrant, gridIndex) => ({
    entrant,
    progress: -gridIndex * (tune.carLengthSeconds / track.baseLapTime) * 2,
    compound: entrant.strategy.startCompound,
    wear: 0,
    mode: "neutral" as PaceMode,
    lapNoise: 0,
    lapIndex: 0,
    pitTimer: 0,
    stops: 0,
    finished: false,
    finishTime: 0,
    cliffAnnounced: false,
  }));
  for (const car of cars) rollLapNoise(car, rng, tune);

  const frames: Frame[] = [];
  const events: RaceEvent[] = [];
  let t = 0;

  const order = () => [...cars].sort((a, b) => b.progress - a.progress);

  while (t < MAX_RACE_SECONDS && cars.some((c) => !c.finished)) {
    const running = order();

    // 1. Serve pit stops. A stationary car makes no progress — which is exactly
    // why the pit loss hurts, and why the crew upgrade is worth buying.
    for (const car of running) {
      if (car.pitTimer > 0) car.pitTimer = Math.max(0, car.pitTimer - DT);
    }

    // 2. Choose pace mode from each car's own pre-committed rules.
    for (let i = 0; i < running.length; i++) {
      const car = running[i];
      if (car.finished || car.pitTimer > 0) continue;
      const ahead = running[i - 1];
      const behind = running[i + 1];
      const lap = lapTimeFor(car, track, false, tune);
      const gapAhead = ahead
        ? Math.max(0, (ahead.progress - car.progress) * lap)
        : Infinity;
      const gapBehind = behind
        ? Math.max(0, (car.progress - behind.progress) * lap)
        : Infinity;
      car.mode = decideMode(car, gapAhead, gapBehind);
    }

    // 3. Advance every car, then resolve blocking front-to-back so that a slow
    // car genuinely holds up everyone behind it. Trains are a feature: they are
    // what make track position, and therefore strategy, matter.
    const proposed = new Map<CarState, number>();
    const lapTimes = new Map<CarState, number>();

    for (let i = 0; i < running.length; i++) {
      const car = running[i];
      if (car.finished) {
        proposed.set(car, car.progress);
        continue;
      }
      if (car.pitTimer > 0) {
        proposed.set(car, car.progress); // stationary
        lapTimes.set(car, lapTimeFor(car, track, false, tune));
        continue;
      }

      const ahead = running[i - 1];
      const roughLap = lapTimeFor(car, track, false, tune);
      const gapAhead = ahead
        ? (ahead.progress - car.progress) * roughLap
        : Infinity;
      const inDirtyAir = gapAhead <= tune.dirtyAirWindow;

      const lap = lapTimeFor(car, track, inDirtyAir, tune);
      lapTimes.set(car, lap);
      proposed.set(car, car.progress + DT / lap);
    }

    // 4. Blocking + overtakes, in track order.
    for (let i = 1; i < running.length; i++) {
      const car = running[i];
      const ahead = running[i - 1];
      if (car.finished || car.pitTimer > 0 || ahead.finished) continue;

      const carNext = proposed.get(car)!;
      const aheadNext = proposed.get(ahead)!;
      const lap = lapTimes.get(car) ?? track.baseLapTime;
      const buffer = tune.carLengthSeconds / lap; // in laps

      // Would it end this tick alongside or past the car in front?
      if (carNext < aheadNext - buffer) continue; // clear air, carry on

      // It's on the gearbox. Is it at a passing place, and close enough?
      const gapNow = (ahead.progress - car.progress) * lap;
      const zone = track.zones.find((z) =>
        crossedPosition(car.progress, carNext, z.position)
      );

      if (zone && gapNow <= tune.overtakeWindow && ahead.pitTimer === 0) {
        const p = passProbability(
          car,
          ahead,
          lap,
          lapTimes.get(ahead) ?? lap,
          zone.difficulty,
          tune
        );
        if (rng.chance(p)) {
          // Through. Take the position: slot in a car length ahead.
          proposed.set(car, aheadNext + buffer);
          events.push({
            t,
            lap: Math.max(0, Math.floor(car.progress)) + 1,
            type: "overtake",
            carId: car.entrant.id,
            onCarId: ahead.entrant.id,
            zone: zone.name,
          });
          continue;
        }
        // Rebuffed: lost momentum, and still stuck behind.
        events.push({
          t,
          lap: Math.max(0, Math.floor(car.progress)) + 1,
          type: "defended",
          carId: ahead.entrant.id,
          byCarId: car.entrant.id,
          zone: zone.name,
        });
        proposed.set(car, aheadNext - buffer - tune.failedPassCost / lap);
        continue;
      }

      // No way past here — sit in the dirty air and wait for a zone.
      proposed.set(car, Math.min(carNext, aheadNext - buffer));
    }

    // 5. Commit the tick: wear, lap boundaries, pit decisions, finishing.
    for (const car of cars) {
      if (car.finished) continue;
      const before = car.progress;
      const after = proposed.get(car)!;
      const advanced = Math.max(0, after - before);
      car.progress = after;

      if (car.pitTimer > 0) continue; // in the pits: no wear, no laps

      if (advanced > 0) {
        car.wear = Math.min(
          1,
          car.wear +
            wearIncrement(
              COMPOUNDS[car.compound],
              car.mode,
              track.tyreWearFactor,
              advanced
            )
        );
      }

      if (!car.cliffAnnounced && isOverCliff(COMPOUNDS[car.compound], car.wear)) {
        car.cliffAnnounced = true;
        events.push({
          t,
          lap: Math.floor(car.progress) + 1,
          type: "cliff",
          carId: car.entrant.id,
        });
      }

      // Crossed the line?
      const lapNow = Math.floor(car.progress);
      if (lapNow > car.lapIndex && car.progress > 0) {
        car.lapIndex = lapNow;
        rollLapNoise(car, rng, tune); // fresh scatter for the new lap

        if (lapNow >= laps) {
          car.finished = true;
          car.finishTime = t;
          events.push({
            t,
            lap: laps,
            type: "finish",
            carId: car.entrant.id,
            position: cars.filter((c) => c.finished).length,
          });
          continue;
        }

        // Pit decisions are taken at the line, where the pit entry is — and the
        // stop is SERVED on that same lap, not the next one.
        //
        // An earlier version queued the stop and served it at the following
        // crossing, quietly giving every car a full extra lap on tyres it had
        // already decided were finished. Cars in traffic (pushing, so wearing
        // faster) sailed over the cliff and lost ~5s a lap, while the leader in
        // clean air never did — which manufactured a 50s spread between
        // IDENTICAL cars and made pole worth 75% of the race. A whole class of
        // apparent "balance problems" was really just this bug.
        if (shouldPit(car, tune, track, laps - lapNow)) {
          const duration = track.pitLoss + crewTime(car, tune);
          car.pitTimer = duration;
          car.compound = car.entrant.strategy.pitCompound;
          car.wear = 0;
          car.cliffAnnounced = false;
          car.stops += 1;
          events.push({
            t,
            lap: lapNow,
            type: "pit",
            carId: car.entrant.id,
            to: car.compound,
            duration,
          });
        }
      }
    }

    // 6. Snapshot for the renderer.
    const ranked = order();
    const positionOf = new Map(ranked.map((c, i) => [c, i + 1]));
    frames.push({
      t,
      cars: cars.map<CarFrame>((car) => ({
        id: car.entrant.id,
        lap: Math.max(0, Math.floor(car.progress)),
        lapPosition: ((car.progress % 1) + 1) % 1, // always 0→1
        position: positionOf.get(car)!,
        compound: car.compound,
        wear: car.wear,
        mode: car.mode,
        inPit: car.pitTimer > 0,
        finished: car.finished,
      })),
    });

    t += DT;
  }

  // Classification: finishers by finish time, then anyone still running by
  // distance covered (the safety valve tripped).
  const finishers = cars
    .filter((c) => c.finished)
    .sort((a, b) => a.finishTime - b.finishTime);
  const rest = cars
    .filter((c) => !c.finished)
    .sort((a, b) => b.progress - a.progress);
  const finalOrder = [...finishers, ...rest];
  const leaderTime = finishers[0]?.finishTime ?? t;

  const classification: Classification[] = finalOrder.map((car, i) => ({
    position: i + 1,
    id: car.entrant.id,
    name: car.entrant.name,
    isPlayer: car.entrant.isPlayer,
    totalTime: car.finished ? car.finishTime : t,
    gapToLeader: (car.finished ? car.finishTime : t) - leaderTime,
    laps: Math.max(0, Math.floor(car.progress)),
    pitStops: car.stops,
  }));

  return { seed, trackId: track.id, laps, frames, events, classification };
}
