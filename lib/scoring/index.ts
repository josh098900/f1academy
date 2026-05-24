// Pure scoring engine — see docs/files/SCORING_SYSTEM.md.
// Deterministic, dependency-free: the scoreRound action and the tests share it.

export type SessionStatus = "classified" | "dnf" | "dsq" | "dns";
export type RaceType = "race1" | "race2" | "race3";
export type SessionType = "qualifying" | RaceType;

export type DriverSession = {
  type: SessionType;
  position: number | null; // finishing position; null if DNF/DSQ/DNS
  gridPosition: number | null; // race start position
  status: SessionStatus;
  fastestLap: boolean;
};

export const POLE_WIN_BONUS = 5;
export const PODIUM_STREAK_BONUS = 3;
export const POSITION_LOSS_CAP = -5;
export const BACK_OF_GRID_PENALTY = -2; // P16+ in a race
export const DNF_POINTS = -5;
export const DSQ_POINTS = -10;

const RACE_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};

// Qualifying: position-based.
export function qualifyingPoints(position: number | null): number {
  if (position === null) return 0;
  if (position === 1) return 10;
  if (position === 2) return 8;
  if (position === 3) return 6;
  if (position === 4) return 5;
  if (position === 5) return 4;
  if (position === 6) return 3;
  if (position <= 10) return 2; // P7–P10
  if (position <= 15) return 1; // P11–P15
  return 0; // P16+
}

// Race finishing points (before bonuses).
export function racePoints(
  position: number | null,
  status: SessionStatus
): number {
  if (status === "dsq") return DSQ_POINTS;
  if (status === "dnf") return DNF_POINTS;
  if (status === "dns") return 0;
  if (position === null) return 0;
  if (position <= 10) return RACE_POINTS[position];
  if (position <= 15) return 0;
  return BACK_OF_GRID_PENALTY; // P16+
}

// Fastest lap: +5, but only for a classified top-10 finish.
export function fastestLapBonus(
  position: number | null,
  fastestLap: boolean,
  status: SessionStatus
): number {
  if (!fastestLap || status !== "classified" || position === null) return 0;
  return position <= 10 ? 5 : 0;
}

// Positions gained (+1 each, uncapped) or lost (-1 each, capped at -5).
export function positionDelta(
  gridPosition: number | null,
  position: number | null,
  status: SessionStatus
): number {
  if (status !== "classified" || gridPosition === null || position === null) {
    return 0;
  }
  const gained = gridPosition - position;
  return gained >= 0 ? gained : Math.max(gained, POSITION_LOSS_CAP);
}

// Total points for one race (finishing points + fastest lap + positions delta).
export function raceScore(session: DriverSession): number {
  return (
    racePoints(session.position, session.status) +
    fastestLapBonus(session.position, session.fastestLap, session.status) +
    positionDelta(session.gridPosition, session.position, session.status)
  );
}

function isPodium(session: DriverSession | undefined): boolean {
  return (
    !!session &&
    session.status === "classified" &&
    session.position !== null &&
    session.position <= 3
  );
}

export type WeekendInput = {
  sessions: DriverSession[];
  boost?: boolean;
  // Whether the previous round's final race was a podium for this driver —
  // bridges the cross-round podium streak (R2 of round N → R1 of round N+1).
  incomingPodium?: boolean;
};

export type WeekendScore = {
  qualifying: number;
  races: { type: RaceType; points: number }[];
  poleAndWin: number;
  podiumStreak: number;
  base: number; // before boost
  boosted: boolean;
  total: number; // after boost
};

const RACE_ORDER: RaceType[] = ["race1", "race2", "race3"];

// Score one driver's weekend for one team. `boost` doubles the total.
export function scoreDriverWeekend(input: WeekendInput): WeekendScore {
  const boost = input.boost ?? false;
  const find = (type: SessionType) =>
    input.sessions.find((s) => s.type === type);

  const quali = find("qualifying");
  const races = RACE_ORDER.map((type) => ({ type, session: find(type) })).filter(
    (r): r is { type: RaceType; session: DriverSession } => Boolean(r.session)
  );

  const qualifying = qualifyingPoints(quali?.position ?? null);
  const raceScores = races.map((r) => ({
    type: r.type,
    points: raceScore(r.session),
  }));

  const race1 = find("race1");
  const poleAndWin =
    quali?.position === 1 &&
    race1?.status === "classified" &&
    race1.position === 1
      ? POLE_WIN_BONUS
      : 0;

  // +3 per consecutive podium pair, including the bridge from the prior round.
  const podiumFlags = [
    input.incomingPodium ?? false,
    ...races.map((r) => isPodium(r.session)),
  ];
  let podiumStreak = 0;
  for (let i = 1; i < podiumFlags.length; i++) {
    if (podiumFlags[i - 1] && podiumFlags[i]) podiumStreak += PODIUM_STREAK_BONUS;
  }

  const base =
    qualifying +
    raceScores.reduce((sum, r) => sum + r.points, 0) +
    poleAndWin +
    podiumStreak;

  return {
    qualifying,
    races: raceScores,
    poleAndWin,
    podiumStreak,
    base,
    boosted: boost,
    total: boost ? base * 2 : base,
  };
}
