import type { DriverStats } from "./types";

// Turning real results into ratings.
//
// This is the rule that makes racing REAL F1 Academy drivers defensible: we
// never invent a number and attach it to a real person, and nobody "trains" a
// human being. A driver's ratings are read out of what she actually did on
// track — the same way the fantasy game's prices are — and they move when
// reality moves. Podium at Zandvoort on Sunday, faster in the game on Monday.
//
// All progression the player controls lives in the CAR (lib/race-sim/types
// CarStats), never here.
//
//   pace        ← qualifying positions   (raw one-lap speed)
//   racecraft   ← positions gained in races (wheel-to-wheel)
//   consistency ← classification rate    (finishing, not binning it)
//
// A driver with no results yet sits at the neutral default rather than at zero:
// a rookie is an unknown, not a bad driver.

export const NEUTRAL = 55;
const MIN_RATING = 30;
const MAX_RATING = 98;

// How many races' worth of "we don't know yet" every driver starts with.
//
// Without this, one session counts as much as a full season: a wildcard who ran
// a single qualifying and took pole rated PAC 98 — the fastest driver in the
// game — while the actual front-runner, whose three sessions read [1, 11, 2],
// rated 86. A lucky one-off outranked a whole season's work.
//
// So a rating is only as confident as the evidence behind it: a driver's
// measured form is blended with the neutral prior in proportion to how much
// we've actually seen. One session is mostly prior; a full season is mostly her.
// Ratings sharpen on their own as the season runs, which is exactly right.
const CONFIDENCE_PRIOR = 2;

function shrink(observed: number, samples: number): number {
  if (samples <= 0) return NEUTRAL;
  return (
    (samples * observed + CONFIDENCE_PRIOR * NEUTRAL) /
    (samples + CONFIDENCE_PRIOR)
  );
}

export type DriverForm = {
  // Finishing positions in qualifying, best-first order irrelevant.
  qualifying: number[];
  // One entry per race started.
  races: {
    gridPosition: number | null;
    position: number | null;
    classified: boolean;
  }[];
  // How many cars are typically on the grid — scales what "P6" is worth.
  fieldSize: number;
};

function clamp(n: number): number {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(n)));
}

// Average of a list, or null if empty.
function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function deriveDriverStats(form: DriverForm): DriverStats {
  const field = Math.max(2, form.fieldSize);

  // Pace: pole → ~98, last → ~35. Linear in grid slot, then shrunk toward the
  // prior by how many sessions we've actually seen her run.
  const avgQuali = mean(form.qualifying);
  const pace =
    avgQuali === null
      ? NEUTRAL
      : clamp(
          shrink(98 - ((avgQuali - 1) / (field - 1)) * 63, form.qualifying.length)
        );

  // Racecraft: positions gained, averaged. Gaining 3 places a race is elite;
  // losing 3 is poor. DNFs don't count against racecraft — that's consistency's
  // job, and double-punishing one bad afternoon would be unfair.
  const deltas = form.races
    .filter((r) => r.classified && r.gridPosition !== null && r.position !== null)
    .map((r) => r.gridPosition! - r.position!);
  const avgGained = mean(deltas);
  const racecraft =
    avgGained === null
      ? NEUTRAL
      : clamp(shrink(NEUTRAL + avgGained * 9, deltas.length));

  // Consistency: how often she brings it home. A perfect record is not a
  // perfect rating — nobody is unbreakable — and one retirement shouldn't
  // brand a driver erratic, so this is deliberately gentle.
  const started = form.races.length;
  const finished = form.races.filter((r) => r.classified).length;
  const consistency =
    started === 0
      ? NEUTRAL
      : clamp(shrink(45 + (finished / started) * 48, started));

  return { pace, racecraft, consistency };
}
