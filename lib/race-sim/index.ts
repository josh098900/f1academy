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
  RetirementCause,
  Track,
} from "./types";

export * from "./types";
export { COMPOUNDS, MODES } from "./tyres";
export { TRACKS, TRACK_IDS, getTrack } from "./tracks";
export { RACING_LINES, RACEABLE_TRACKS, getRacingLine } from "./racing-lines";
export type { RacingLine } from "./racing-lines";
export { deriveDriverStats, NEUTRAL } from "./derive";
export { buildRaceReport } from "./report";
export type { RaceReport } from "./report";
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

  // Blue flags. A car being LAPPED is not racing the car catching it: she
  // yields at the next passing place instead of defending. High, not certain —
  // so traffic still costs the lapping car a moment, which is what it costs in
  // life. A failed wave-by is not a lunge: no time lost, no "defended" event,
  // just another zone spent in her wake.
  blueFlagPassChance: number;

  standingStartLoss: number; // seconds lost getting off the line on lap 1
  fuelLoadLoss: number; // seconds a full tank costs; burns off across the race

  // Incidents. Base risk is per BRAKING ZONE — a lock-up happens under braking,
  // which is also why an incident has a place name. The base is deliberately
  // tiny and the multipliers are large: an incident should be something the
  // player EARNED, not something that happened to them. A race lost to pure
  // luck teaches nothing; a race lost to running dead tyres teaches everything.
  incidentBase: number;
  incidentConsistencyWeight: number; // how much a shaky driver adds
  incidentPushMult: number; // on the limit
  incidentCliffMult: number; // no grip under braking — THE consequence of the cliff
  incidentDirtyAirMult: number; // wheel-to-wheel is where mistakes happen
  incidentMajorShare: number; // of incidents, how many end the race
  incidentMajorShareOnCliff: number; // a mistake on dead tyres is likelier terminal
  lockupTimeLoss: [number, number]; // seconds lost in a moment
  lockupFlatSpot: number; // extra wear from locking a wheel

  // Mechanical failure, per lap. Pure car reliability, nothing to do with the
  // driving — which is exactly what makes the reliability upgrade worth buying.
  mechanicalBase: number;
  mechanicalReliabilityWeight: number;
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
  dirtyAirPenalty: 0.25,
  overtakeWindow: 0.8,
  failedPassCost: 0.15,
  carLengthSeconds: 0.18,

  basePassChance: 0.2,
  wPace: 0.6,
  wRacecraft: 0.35,
  wTyre: 0.15,
  wPower: 0.2,
  minPass: 0.03,
  maxPass: 0.85,

  blueFlagPassChance: 0.9,

  // Getting off the line from a standstill. Without it, cars are at full racing
  // speed from t=0, lap 1 is artificially the quickest lap of anyone's race, and
  // the fastest lap is therefore ALWAYS lap 1 — which is both wrong and dull.
  standingStartLoss: 2.5,

  // More moments, same number of crashes: a lock-up is the best drama in the
  // race — a mistake you SEE, that costs you seconds and flat-spots the tyre —
  // and at the previous rate most races contained none at all. Raising the
  // incident rate while lowering the share of them that end a race buys the
  // moments without turning the game into a demolition derby.
  incidentBase: 0.0015,
  incidentConsistencyWeight: 2.0,
  incidentPushMult: 1.5,
  incidentCliffMult: 10.0,
  incidentDirtyAirMult: 1.3,
  incidentMajorShare: 0.08,
  incidentMajorShareOnCliff: 0.25,
  lockupTimeLoss: [1.5, 4.0],
  lockupFlatSpot: 0.06,

  mechanicalBase: 0.0003,
  mechanicalReliabilityWeight: 8.0,

  // A full tank is heavy, and it burns off. Not a fifth system — it's a term in
  // lap time, like tyre wear, and it's the other half of why the purple lap
  // comes LATE in a real race: the car is getting quicker while the tyre gets
  // slower, and the fastest lap is where those two curves cross. Without it the
  // freshest tyre is always the quickest and the fastest lap is a lap-2
  // formality nobody looks at.
  fuelLoadLoss: 2.0,

  baseCrewTime: 2.5,
  crewTimeSaving: 1.2,
  // A Strategy describes ONE stop: start on X, box at Y% wear, finish on Z.
  // It was 2, which meant the single pitAtWear threshold fired again on the
  // second stint — fit softs at the stop and the same rule boxed you AGAIN four
  // laps later, refitting softs, while the whole field stopped once. Worse, the
  // pit wall had drawn a one-stop race, so the screen was lying about the plan
  // the player had just committed to. The sim now runs the plan it was given;
  // if the tyre you finish on dies, you finish on a dead tyre. Multi-stop plans
  // need a Strategy that can express them, and a stint plan that can draw them.
  maxStops: 1,
};

// --- Internal per-car state ------------------------------------------------

type CarState = {
  index: number; // its slot in `cars` — lets the hot loop use arrays, not Maps
  entrant: Entrant;
  progress: number; // total laps completed, as a float. Higher = further ahead.
  compound: CompoundId;
  wear: number;
  mode: PaceMode;
  lapNoise: number; // rolled once per lap — see rollLapNoise
  lapIndex: number; // which lap the noise belongs to
  pitTimer: number; // seconds left stationary; > 0 means in the pits
  pitDuration: number; // the full length of the stop being served
  stops: number;
  lastCrossT: number; // race time she last crossed the line
  lastLapTime: number | null;
  bestLapTime: number | null;
  retired: RetirementCause | null;
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
  tune: Tuning,
  raceLaps: number
): number {
  const { driver, car } = state.entrant;
  const driverFactor = 1 - tune.paceWeight * (driver.pace / 100);
  const carPerf = (car.power + car.aero) / 2;
  const carFactor = 1 - tune.carWeight * (carPerf / 100);

  let t = track.baseLapTime * driverFactor * carFactor;
  t += tyreLapDelta(COMPOUNDS[state.compound], state.wear);
  t += MODES[state.mode].lapDelta;
  if (inDirtyAir) t += tune.dirtyAirPenalty;
  if (state.lapIndex === 0) t += tune.standingStartLoss; // off the line
  // Heavy at the start, light at the flag.
  const fuelLeft = Math.max(0, 1 - state.lapIndex / Math.max(1, raceLaps));
  t += tune.fuelLoadLoss * fuelLeft;
  t += state.lapNoise;

  return Math.max(t, track.baseLapTime * 0.5); // never absurd
}

// Execute the player's pre-committed rules. This is the whole of "management":
// they wrote the rules before the lights, and the car follows them literally.
//
// A car races hard when it is racing SOMEONE — whether that's the car in front
// or the one filling its mirrors. An earlier version only pushed when chasing,
// which meant the leader, having nobody ahead, never pushed at all, and then
// CONSERVED once it had a gap. Push is -0.4s a lap and conserve is +0.5s, so the
// car in front ran up to 0.9s a lap slower than the entire field behind it:
// leading was a penalty, the polesitter got swallowed and routinely finished
// last, and pole was worth less than random chance. Drivers defend, not just
// attack.
function decideMode(
  state: CarState,
  gapAhead: number,
  gapBehind: number
): PaceMode {
  const { attackWithin, conserveWhenLeadingBy } = state.entrant.strategy;
  // Someone in reach ahead — go and get them.
  if (gapAhead <= attackWithin) return "push";
  // Someone filling the mirrors — defend. The leader can do this too.
  if (gapBehind <= attackWithin) return "push";
  // Nobody near: back off and look after the tyres.
  if (gapBehind >= conserveWhenLeadingBy) return "conserve";
  return "neutral";
}

// Box when the plan says so.
//
// The player's pitAtWear is the trigger and it is OBEYED. There is deliberately
// no safety net around it in either direction: box too late and you will run on
// dead tyres past the cliff; box too early and you will throw away track
// position for fresh rubber you didn't need. Both are real mistakes, both are
// learnable, and a sim that quietly overrode either would be lying to the
// player about what their own slider does.
//
// (An earlier version refused any stop that couldn't repay its ~15s in pure lap
// time. It meant a player who asked to box at 42% wear was ignored until 70% —
// a control that did nothing. Worse, it outlawed the undercut, which is a real
// strategy: track position is worth something the lap-time maths can't see.)
//
// The ONE thing still blocked is the genuinely absurd: a stop with almost no
// race left to run it in. Boxing on lap 14 of 15 is a guaranteed loss with no
// upside available, and the stateless rule used to do exactly that — which
// quantised the whole field into pit-stop-sized bands.
const MIN_LAPS_TO_JUSTIFY_A_STOP = 3;

function shouldPit(
  state: CarState,
  tune: Tuning,
  lapsRemaining: number
): boolean {
  if (state.stops >= tune.maxStops || state.finished) return false;
  if (lapsRemaining < MIN_LAPS_TO_JUSTIFY_A_STOP) return false;
  return state.wear >= state.entrant.strategy.pitAtWear;
}

function crewTime(state: CarState, tune: Tuning): number {
  return tune.baseCrewTime - tune.crewTimeSaving * (state.entrant.car.pitCrew / 100);
}

// How likely is this car to make a mistake in this braking zone?
//
// Almost all of it is circumstance, and circumstance is chosen: pushing hard,
// racing in someone's dirty air, and above all running a tyre that has fallen
// off the cliff — because a dead tyre has no grip under braking, which is
// precisely how a driver locks a wheel and ends up in the gravel. This is what
// finally gives the cliff teeth. Before, running past it only cost you seconds;
// now it can cost you the race, which is what it costs in life.
function incidentRisk(
  state: CarState,
  inDirtyAir: boolean,
  tune: Tuning
): number {
  const { consistency } = state.entrant.driver;
  let risk =
    tune.incidentBase *
    (1 + ((100 - consistency) / 100) * tune.incidentConsistencyWeight);
  if (state.mode === "push") risk *= tune.incidentPushMult;
  if (isOverCliff(COMPOUNDS[state.compound], state.wear)) {
    risk *= tune.incidentCliffMult;
  }
  if (inDirtyAir) risk *= tune.incidentDirtyAirMult;
  return risk;
}

// The car letting go, rather than the driver. Nothing to do with how she's
// driving — this is the reliability rating, and the only defence is a better car.
//
// The curve is deliberately QUADRATIC, not linear. A linear one made a
// reliability-25 shed retire 5.3% of the time against 4.3% for a good car —
// a rounding error, which would have made the reliability upgrade worthless the
// day we put it in the garage. Squaring it means a well-built car is genuinely
// safe and a bad one is genuinely fragile, which is the only way the player ever
// feels the money they spent.
function mechanicalRisk(state: CarState, tune: Tuning): number {
  const { reliability } = state.entrant.car;
  const frailty = (100 - reliability) / 100;
  return (
    tune.mechanicalBase * (1 + frailty * frailty * tune.mechanicalReliabilityWeight)
  );
}

// Where on the circuit a car physically is: its position around the current
// lap, 0→1. Total progress measures the RACE; this measures the ROAD.
function roadPosition(progress: number): number {
  return ((progress % 1) + 1) % 1;
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
  const captureFrames = input.captureFrames ?? true;
  const tune: Tuning = { ...DEFAULT_TUNING, ...input.tuning };
  const rng = new Rng(seed);

  // Grid order: pole sits marginally up the road, so lap 1 starts realistically
  // strung out rather than as an eight-way dead heat.
  const cars: CarState[] = entrants.map((entrant, gridIndex) => ({
    index: gridIndex,
    entrant,
    progress: -gridIndex * (tune.carLengthSeconds / track.baseLapTime) * 2,
    compound: entrant.strategy.startCompound,
    wear: 0,
    mode: "neutral" as PaceMode,
    lapNoise: 0,
    lapIndex: 0,
    pitTimer: 0,
    pitDuration: 0,
    stops: 0,
    lastCrossT: 0,
    lastLapTime: null,
    bestLapTime: null,
    retired: null,
    finished: false,
    finishTime: 0,
    cliffAnnounced: false,
  }));
  for (const car of cars) rollLapNoise(car, rng, tune);

  const frames: Frame[] = [];
  const events: RaceEvent[] = [];
  let t = 0;
  let finishedCount = 0;
  let fastestLap: RaceResult["fastestLap"] = null;

  // Scratch buffers, allocated once and reused every tick. See the note above
  // simulateRace: a 15-lap race runs ~3,600 ticks, and rebuilding two arrays and
  // two object-keyed Maps on each of them cost ~18,000 allocations per race —
  // enough to push the statistical tests past CI's timeout. Determinism is
  // untouched; this only changes where the numbers are kept.
  const running: CarState[] = [...cars];
  const onTrack: CarState[] = [];
  const roadOrder: CarState[] = [];
  const roadPos = new Array<number>(cars.length).fill(0);
  const roadAhead = new Array<CarState | null>(cars.length).fill(null);
  const proposed = new Array<number>(cars.length).fill(0);
  const lapTimes = new Array<number>(cars.length).fill(track.baseLapTime);
  const finishedThisTick: CarState[] = [];

  // Race order. Out of the race is behind everyone still in it; finishing the
  // distance beats being anywhere on track; and finishers are ranked by when
  // they crossed — NOT by frozen progress, which is just wherever their final
  // step happened to land.
  // A TOTAL order — every comparison falls back to the grid index, so no two
  // cars ever tie.
  //
  // This matters because `running` is a reused buffer sorted in place, so each
  // tick begins in the PREVIOUS tick's order rather than a fresh copy of `cars`.
  // JS sort is stable, so a genuine tie would resolve according to whatever
  // order the buffer happened to be left in — and the race would depend on its
  // own history rather than only on the seed. Breaking every tie explicitly
  // means the comparator alone decides, and determinism is a property of the
  // maths rather than an accident of the buffer.
  const byRaceOrder = (a: CarState, b: CarState) => {
    if (a.retired !== null && b.retired !== null) {
      return b.progress - a.progress || a.index - b.index;
    }
    if (a.retired !== null) return 1;
    if (b.retired !== null) return -1;
    if (a.finished && b.finished) {
      return a.finishTime - b.finishTime || a.index - b.index;
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress || a.index - b.index;
  };
  // Sorts the reused `running` buffer in place.
  const order = () => running.sort(byRaceOrder);

  while (t < MAX_RACE_SECONDS && cars.some((c) => !c.finished && !c.retired)) {
    order();

    // 1. Serve pit stops. A stationary car makes no progress — which is exactly
    // why the pit loss hurts, and why the crew upgrade is worth buying.
    for (const car of running) {
      if (car.pitTimer > 0) car.pitTimer = Math.max(0, car.pitTimer - DT);
    }

    // A car in the pit lane, or one that has taken the flag, is NOT ON THE
    // RACING LINE. Everything below — pace decisions, dirty air, blocking,
    // overtakes — must therefore run against the cars actually out there.
    //
    // This was a real bug and a nasty one: a pitting car's progress freezes at
    // the start/finish line, but it stayed in the running order, so the blocking
    // logic treated it as a stationary obstacle ON TRACK. Whole trains of cars
    // stopped dead on the straight, nose-to-tail, queueing behind a rival who
    // was in the pit box. It was visible on screen as cars parked on the flag,
    // and it was quietly distorting every race result.
    onTrack.length = 0;
    for (const c of running) {
      if (!c.finished && !c.retired && c.pitTimer === 0) onTrack.push(c);
    }

    // Road order: who is physically ahead of whom on the racing line, from
    // each car's position around the LAP — not its race progress. The two
    // agree right up until someone is about to be lapped, and then they don't:
    // a leader catching a backmarker is a whole lap ahead in RACE terms and
    // two car lengths behind in ROAD terms. Dirty air, blocking and overtaking
    // are physics, and physics happens on the road — computed against race
    // order they cannot see a lapping encounter at all, and the leader drives
    // clean through the backmarker's car. (Unreachable in a short race whose
    // field never spreads a full lap; the safety car makes it routine, because
    // bunching the field is exactly how leaders end up in traffic.)
    //
    // A circle has no first car, so the "head" is the car with the most clear
    // road in front of it. In a same-lap race that is precisely the race
    // leader, and blocking resolves front-to-back in race order as it always
    // did — this layer changes nothing until the moment somebody gets lapped.
    roadOrder.length = 0;
    for (const c of onTrack) {
      roadPos[c.index] = roadPosition(c.progress);
      roadOrder.push(c);
    }
    roadOrder.sort(
      (a, b) => roadPos[b.index] - roadPos[a.index] || a.index - b.index
    );
    let head = 0;
    {
      const n = roadOrder.length;
      let widest = -1;
      for (let i = 0; i < n; i++) {
        const aheadCar = roadOrder[(i - 1 + n) % n];
        roadAhead[roadOrder[i].index] = n >= 2 ? aheadCar : null;
        if (n < 2) continue;
        const gap =
          (roadPos[aheadCar.index] - roadPos[roadOrder[i].index] + 1) % 1;
        if (gap > widest) {
          widest = gap;
          head = i;
        }
      }
    }

    // 2. Choose pace mode from each car's own pre-committed rules. This stays
    // in RACE order deliberately: attack and defence are about POSITION — you
    // push to take P3 or to keep it, not to fend off a car a lap down.
    for (let i = 0; i < onTrack.length; i++) {
      const car = onTrack[i];
      const ahead = onTrack[i - 1];
      const behind = onTrack[i + 1];
      const lap = lapTimeFor(car, track, false, tune, laps);
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

    for (const car of cars) {
      if (car.finished || car.retired) {
        proposed[car.index] = car.progress;
        continue;
      }
      if (car.pitTimer > 0) {
        proposed[car.index] = car.progress; // stationary in the box
        lapTimes[car.index] = lapTimeFor(car, track, false, tune, laps);
      }
    }

    for (const car of onTrack) {
      // Dirty air is a wake, and a wake doesn't care what lap the car making
      // it is on — so the gap here is road distance, not race distance.
      const ahead = roadAhead[car.index];
      const roughLap = lapTimeFor(car, track, false, tune, laps);
      const gapAhead = ahead
        ? ((roadPos[ahead.index] - roadPos[car.index] + 1) % 1) * roughLap
        : Infinity;
      const inDirtyAir = gapAhead <= tune.dirtyAirWindow;

      const lap = lapTimeFor(car, track, inDirtyAir, tune, laps);
      lapTimes[car.index] = lap;
      proposed[car.index] = car.progress + DT / lap;
    }

    // 4. Blocking + overtakes, resolved front-to-back along the ROAD from the
    // head of the queue, so a slow car genuinely holds up everyone behind it
    // — including, now, a backmarker holding up the leader about to lap her.
    for (let k = 1; k < roadOrder.length; k++) {
      const n = roadOrder.length;
      const car = roadOrder[(head + k) % n];
      const ahead = roadOrder[(head + k - 1) % n];

      // Bring the car ahead into this car's lap frame. On the same lap this
      // changes nothing; when she is a whole lap down (or up), it shifts her
      // progress by that lap so everything below stays a plain comparison of
      // positions on the road. Within blocking range the two cars are inches
      // apart on the circuit, so the progress difference is always within a
      // whisker of a whole number and the rounding is unambiguous.
      const lapsApart = Math.round(car.progress - ahead.progress);
      const aheadNow = ahead.progress + lapsApart;
      const aheadNext = proposed[ahead.index] + lapsApart;

      const carNext = proposed[car.index];
      const lap = lapTimes[car.index];
      const buffer = tune.carLengthSeconds / lap; // in laps

      // Would it end this tick alongside or past the car in front?
      if (carNext < aheadNext - buffer) continue; // clear air, carry on

      // It's on the gearbox. Is it at a passing place, and close enough?
      const gapNow = (aheadNow - car.progress) * lap;
      const zone = track.zones.find((z) =>
        crossedPosition(car.progress, carNext, z.position)
      );

      // Blue flags: a car a whole lap ahead of the one in front is LAPPING
      // her, not racing her — and the backmarker's job is to get out of the
      // way, not to defend a position she doesn't hold.
      const lapping = lapsApart >= 1;

      if (zone && gapNow <= tune.overtakeWindow) {
        const p = lapping
          ? tune.blueFlagPassChance
          : passProbability(
              car,
              ahead,
              lap,
              lapTimes[ahead.index],
              zone.difficulty,
              tune
            );
        if (rng.chance(p)) {
          // Through. Take the position: slot in a car length ahead — but
          // never through the NEXT car up the road. In a nose-to-tail train
          // the cars sit exactly a buffer apart, so a full car-length slot-in
          // landed ON the following car and the sort's tie-break quietly
          // handed over a second position for one dice roll. Passing into a
          // train beats ONE car: land in the gap, on the next gearbox.
          let slot = aheadNext + buffer;
          if (k >= 2) {
            const beyond = roadOrder[(head + k - 2 + n) % n];
            const beyondNext =
              proposed[beyond.index] +
              Math.round(car.progress - beyond.progress);
            if (beyondNext > aheadNext) {
              slot = Math.min(slot, (aheadNext + beyondNext) / 2);
            }
          }
          proposed[car.index] = slot;
          events.push({
            t,
            lap: Math.max(0, Math.floor(car.progress)) + 1,
            type: "overtake",
            carId: car.entrant.id,
            onCarId: ahead.entrant.id,
            zone: zone.name,
            ...(lapping ? { lapping: true } : {}),
          });
          continue;
        }
        if (!lapping) {
          // Rebuffed: lost momentum, and still stuck behind.
          events.push({
            t,
            lap: Math.max(0, Math.floor(car.progress)) + 1,
            type: "defended",
            carId: ahead.entrant.id,
            byCarId: car.entrant.id,
            zone: zone.name,
          });
          proposed[car.index] = aheadNext - buffer - tune.failedPassCost / lap;
          continue;
        }
        // A missed wave-by is not a failed lunge: no time lost, no glory for
        // the backmarker — just another zone spent in her wake.
      }

      // No way past here — sit in the dirty air and wait for a zone.
      proposed[car.index] = Math.min(carNext, aheadNext - buffer);
    }

    // 5. Commit the tick: wear, lap boundaries, pit decisions, finishing.
    // Cars that take the flag this tick are collected rather than announced
    // immediately: more than one can cross inside a single step, and the order
    // they happen to sit in the array is not the order they crossed the line.
    finishedThisTick.length = 0;
    for (const car of cars) {
      if (car.finished || car.retired) continue;
      const before = car.progress;
      const after = proposed[car.index];
      const advanced = Math.max(0, after - before);
      car.progress = after;

      if (car.pitTimer > 0) continue; // in the pits: no wear, no laps

      // --- Something goes wrong ------------------------------------------
      // Braking zones are where mistakes happen, which is why an incident has
      // a place name. Rolled per zone crossed, so a lap with three heavy
      // braking zones carries three chances to get it wrong.
      const aheadOf = roadAhead[car.index];
      const lapNowFor = lapTimes[car.index];
      const inDirty =
        aheadOf !== null &&
        ((roadPos[aheadOf.index] - roadPos[car.index] + 1) % 1) * lapNowFor <=
          tune.dirtyAirWindow;

      for (const zone of track.zones) {
        if (!crossedPosition(before, after, zone.position)) continue;
        if (!rng.chance(incidentRisk(car, inDirty, tune))) continue;

        const onDeadTyres = isOverCliff(COMPOUNDS[car.compound], car.wear);
        const majorShare = onDeadTyres
          ? tune.incidentMajorShareOnCliff
          : tune.incidentMajorShare;

        if (rng.chance(majorShare)) {
          // Into the barrier. Race over.
          car.retired = "crash";
          events.push({
            t,
            lap: Math.floor(car.progress) + 1,
            type: "retirement",
            carId: car.entrant.id,
            cause: "crash",
            zone: zone.name,
          });
          break;
        }

        // A moment: locked a wheel, ran wide, lost time — and flat-spotted the
        // tyre, so the mistake keeps costing after the corner.
        const timeLost = rng.range(tune.lockupTimeLoss[0], tune.lockupTimeLoss[1]);
        car.progress = Math.max(before, car.progress - timeLost / lapNowFor);
        car.wear = Math.min(1, car.wear + tune.lockupFlatSpot);
        events.push({
          t,
          lap: Math.floor(car.progress) + 1,
          type: "lockup",
          carId: car.entrant.id,
          zone: zone.name,
          timeLost,
        });
        break; // one moment per tick is plenty
      }
      if (car.retired) continue;

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

        // The car itself letting go. Checked once a lap and driven purely by
        // reliability — no amount of good driving saves you from a broken car.
        if (lapNow < laps && rng.chance(mechanicalRisk(car, tune))) {
          car.retired = "mechanical";
          events.push({
            t,
            lap: lapNow,
            type: "retirement",
            carId: car.entrant.id,
            cause: "mechanical",
            zone: null,
          });
          continue;
        }

        // Time the lap she just completed. The crossing is interpolated within
        // the tick for the same reason the finish is: a lap timed to the 0.5s
        // step boundary is a lap timed wrong, and these are the numbers the
        // player reads off the screen.
        const spanL = after - before;
        const crossedAt =
          spanL > 0
            ? t + Math.min(1, Math.max(0, (lapNow - before) / spanL)) * DT
            : t;
        const lapTime = crossedAt - car.lastCrossT;
        car.lastCrossT = crossedAt;
        // Every lap is timed, pit laps included — a real screen shows those too,
        // and a lap with a stop in it is ~17s slow, so it can never go purple.
        if (lapTime > 0) {
          car.lastLapTime = lapTime;
          if (car.bestLapTime === null || lapTime < car.bestLapTime) {
            car.bestLapTime = lapTime;
          }
          if (fastestLap === null || lapTime < fastestLap.lapTime) {
            fastestLap = { carId: car.entrant.id, lapTime, lap: lapNow };
            // The first lap anyone completes is trivially the fastest lap of the
            // race so far, so announcing it is noise. The time is still recorded
            // — someone always HOLDS the purple — it just isn't news yet.
            if (lapNow > 1) {
              events.push({
                t: crossedAt,
                lap: lapNow,
                type: "fastestLap",
                carId: car.entrant.id,
                lapTime,
              });
            }
          }
        }

        if (lapNow >= laps) {
          car.finished = true;
          // Interpolate WHEN in this tick she crossed the line. Without this,
          // every finisher is timestamped at the tick boundary, cars that
          // finish in the same tick tie, and the final gaps are quantised to
          // the step size. It also stops a car that overshot the line by a
          // bigger step from being ranked ahead of one that genuinely finished
          // first — which is what put the winner back down the order as the
          // rest of the field came home.
          const span = after - before;
          const crossed = span > 0 ? (laps - before) / span : 0;
          car.finishTime = t + Math.min(1, Math.max(0, crossed)) * DT;
          finishedThisTick.push(car);
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
        if (shouldPit(car, tune, laps - lapNow)) {
          const duration = track.pitLoss + crewTime(car, tune);
          car.pitTimer = duration;
          car.pitDuration = duration;
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

    // Announce the flag in true crossing order, so the finish events — and the
    // positions stamped on them — reflect who actually got there first.
    finishedThisTick.sort((a, b) => a.finishTime - b.finishTime);
    for (const car of finishedThisTick) {
      finishedCount += 1;
      events.push({
        t: car.finishTime,
        lap: laps,
        type: "finish",
        carId: car.entrant.id,
        position: finishedCount,
      });
    }

    // 6. Snapshot for the renderer — the single most expensive thing the sim
    // does, and pure waste when nobody is going to watch it.
    if (!captureFrames) {
      t += DT;
      continue;
    }
    const ranked = order();
    const positionOf = new Map(ranked.map((c, i) => [c, i + 1]));
    const leader = ranked[0];
    frames.push({
      t,
      cars: cars.map<CarFrame>((car) => {
        // The gap the timing screen shows: how far behind the race leader she
        // is, in seconds, at her current pace. A finished car's gap is settled.
        const lap = lapTimeFor(car, track, false, tune, laps);
        const gapToLeader =
          car === leader
            ? 0
            : car.finished && leader.finished
              ? car.finishTime - leader.finishTime
              : Math.max(0, (leader.progress - car.progress) * lap);
        return {
          id: car.entrant.id,
          lap: Math.max(0, Math.floor(car.progress)),
          lapPosition: ((car.progress % 1) + 1) % 1, // always 0→1
          position: positionOf.get(car)!,
          gapToLeader,
          lastLapTime: car.lastLapTime,
          bestLapTime: car.bestLapTime,
          compound: car.compound,
          wear: car.wear,
          mode: car.mode,
          inPit: car.pitTimer > 0,
          pitProgress:
            car.pitTimer > 0 && car.pitDuration > 0
              ? Math.min(1, Math.max(0, 1 - car.pitTimer / car.pitDuration))
              : null,
          finished: car.finished,
          retired: car.retired !== null,
        };
      }),
    });

    t += DT;
  }

  // Classification: finishers by finish time, then anyone still running by
  // distance covered (the safety valve tripped).
  const finishers = cars
    .filter((c) => c.finished)
    .sort((a, b) => a.finishTime - b.finishTime);
  // Anyone who didn't take the flag is classified behind those who did, and the
  // further you got before it ended, the better you're classified — as in life.
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
    bestLapTime: car.bestLapTime,
    retired: car.retired,
  }));

  return {
    seed,
    trackId: track.id,
    laps,
    frames,
    events,
    classification,
    fastestLap,
  };
}
