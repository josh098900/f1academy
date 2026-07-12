// Seeded pseudo-random number generator — the reason the whole sim is
// reproducible. Every random draw in a race goes through one Rng instance, so
// (inputs + seed) always produces byte-identical results. That's what lets us
// store just the seed in the database and recompute the race on demand, on
// either player's device, and get the same broadcast.
//
// mulberry32: small, fast, good enough distribution for a game. Not crypto.

export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to uint32 so the same seed always starts from the same state.
    this.state = seed >>> 0;
  }

  // Uniform in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Uniform in [min, max).
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Normal(0, 1) via Box–Muller. Used for lap-time scatter: a driver's
  // consistency controls the spread, not the mean, so an erratic driver is
  // sometimes brilliant and sometimes loses half a second for nothing.
  normal(): number {
    // u must be > 0 for log().
    const u = 1 - this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // True with probability p.
  chance(p: number): boolean {
    return this.next() < p;
  }
}
