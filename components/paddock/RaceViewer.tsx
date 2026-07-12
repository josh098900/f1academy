"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  COMPOUNDS,
  type Entrant,
  type RaceResult,
  getRacingLine,
  getTrack,
} from "@/lib/race-sim";

// The broadcast. Dots lapping a circuit, a timing tower, and a ticker.
//
// Pure presentation: it is handed a finished RaceResult and plays it back. The
// race is computed by the caller — in the browser, from entrants and a seed,
// because the sim is deterministic. That is the whole point of the design: a
// 15-lap timeline is ~3,700 frames × 8 cars (megabytes), and a result shipped
// from a server is a result you must then trust the client not to edit. Eight
// stat blocks and an integer beat that on every axis.

const SPEEDS = [1, 5, 20, 60];
const DEFAULT_SPEED = 20;
const PATH_SAMPLES = 720; // lookup table resolution around the lap
const PIT_HALF_SPAN = 0.055; // how much of the lap the pit lane runs alongside
const PIT_OFFSET = 30; // how far off the racing line the lane sits, in svg units

type Props = {
  result: RaceResult;
  entrants: Entrant[];
  trackId: string;
  // Fired once when the replay reaches the flag, so the caller can reveal the
  // result rather than spoiling it beside the race.
  onFinish?: () => void;
};

type Point = { x: number; y: number };

// The pit lane, derived from the racing line rather than hand-drawn per circuit.
//
// Take the stretch of track either side of the start/finish, push every point
// out perpendicular to the track, and you have a lane that runs parallel to the
// main straight — for free, on any circuit we ever add. (Perpendicular has two
// directions; RacingLine.pitSide picks the one that isn't the infield.)
function buildPitLane(samples: Point[], startLine: number, side: 1 | -1): Point[] {
  const n = samples.length;
  const at = (i: number) => samples[((i % n) + n) % n];
  const startIdx = Math.round(startLine * n);
  const half = Math.round(PIT_HALF_SPAN * n);

  const lane: Point[] = [];
  for (let k = -half; k <= half; k++) {
    const i = startIdx + k;
    const prev = at(i - 1);
    const next = at(i + 1);
    // Tangent along the track, normalised; the normal is it turned 90°.
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = (-ty / len) * side;
    const ny = (tx / len) * side;
    const p = at(i);
    lane.push({ x: p.x + nx * PIT_OFFSET, y: p.y + ny * PIT_OFFSET });
  }
  return lane;
}

// Where a car sits in the lane, 0→1, given how far through the stop it is.
// It drives in, STOPS in the box — you're watching the stationary seconds your
// pit-crew upgrade is paying for — then drives out.
function pitLanePosition(pitProgress: number): number {
  if (pitProgress < 0.3) return (pitProgress / 0.3) * 0.45;
  if (pitProgress < 0.7) return 0.5; // stationary in the box
  return 0.55 + ((pitProgress - 0.7) / 0.3) * 0.45;
}

function pointOn(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const i = Math.min(points.length - 1, Math.max(0, Math.round(t * (points.length - 1))));
  return points[i];
}

export function RaceViewer({ result, entrants, trackId, onFinish }: Props) {
  const line = getRacingLine(trackId);
  const track = getTrack(trackId);
  const laps = result.laps;

  const pathRef = useRef<SVGPathElement>(null);
  const [samples, setSamples] = useState<Point[] | null>(null);

  // Sample the path once into a lookup table. getPointAtLength is cheap but not
  // free, and we'd otherwise call it 8× per animation frame forever.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const pts: Point[] = [];
    for (let i = 0; i < PATH_SAMPLES; i++) {
      const p = path.getPointAtLength((i / PATH_SAMPLES) * total);
      pts.push({ x: p.x, y: p.y });
    }
    setSamples(pts);
  }, [line?.d]);

  const pitLane = useMemo(
    () => (samples && line ? buildPitLane(samples, line.startLine, line.pitSide) : null),
    [samples, line]
  );

  const [raceTime, setRaceTime] = useState(0);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [playing, setPlaying] = useState(true);

  const duration = result.frames.at(-1)?.t ?? 0;

  const finished = useRef(false);
  useEffect(() => {
    if (raceTime >= duration && duration > 0 && !finished.current) {
      finished.current = true;
      onFinish?.();
    }
  }, [raceTime, duration, onFinish]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setRaceTime((t) => {
        const next = t + dt * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  // Interpolate between the two frames either side of `raceTime`, so the dots
  // glide instead of stepping at the sim's 0.5s tick. We interpolate TOTAL
  // progress (lap + position), never the 0→1 lap position on its own — that
  // wraps at the start/finish line and would fling a car backwards round the
  // whole circuit once a lap.
  const live = useMemo(() => {
    const frames = result.frames;
    if (frames.length === 0) return null;
    const dt = frames.length > 1 ? frames[1].t - frames[0].t : 0.5;
    const idx = Math.min(frames.length - 1, Math.max(0, Math.floor(raceTime / dt)));
    const a = frames[idx];
    const b = frames[Math.min(frames.length - 1, idx + 1)];
    const span = b.t - a.t || 1;
    const k = Math.min(1, Math.max(0, (raceTime - a.t) / span));

    return a.cars.map((car, i) => {
      const next = b.cars[i];
      const aTotal = car.lap + car.lapPosition;
      const bTotal = next.lap + next.lapPosition;
      // Guard the wrap: if b looks "behind" a, the car crossed the line.
      const total = bTotal >= aTotal ? aTotal + (bTotal - aTotal) * k : aTotal;
      const entrant = entrants.find((e) => e.id === car.id)!;
      return {
        ...car,
        name: entrant.name,
        lapPosition: ((total % 1) + 1) % 1,
        isPlayer: entrant.isPlayer,
      };
    });
  }, [result.frames, raceTime, entrants]);

  // The most recent few events, as a commentary ticker.
  const ticker = useMemo(
    () =>
      result.events
        .filter((e) => e.t <= raceTime && e.type !== "defended")
        .slice(-4)
        .reverse(),
    [result.events, raceTime]
  );

  const nameOf = (id: string) => entrants.find((e) => e.id === id)?.name ?? id;

  if (!line) {
    return (
      <p className="border border-border-default bg-surface p-6 font-body text-sm text-secondary">
        No racing line for {track.name} yet — the circuit art is a filled outline,
        not a centreline, so a car has nothing to follow. Silverstone is raceable.
      </p>
    );
  }

  const leaderLap = live ? Math.max(...live.map((c) => c.lap)) : 0;
  const order = live ? [...live].sort((a, b) => a.position - b.position) : [];

  return (
    <div className="grid gap-px lg:grid-cols-[1fr_320px]">
      {/* The circuit */}
      <div className="relative border border-border-default bg-surface p-4">
        <svg viewBox={line.viewBox} className="w-full" role="img" aria-label={`${track.name} race`}>
          {/* Track: a wide dark band under a thin centreline reads as tarmac. */}
          <path
            ref={pathRef}
            d={line.d}
            fill="none"
            stroke="#2a2a2a"
            strokeWidth={22}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={line.d}
            fill="none"
            stroke="#3d3d3d"
            strokeWidth={1.5}
            strokeDasharray="6 10"
          />

          {samples && (
            <>
              {/* Start/finish */}
              <circle
                cx={samples[Math.floor(line.startLine * PATH_SAMPLES)].x}
                cy={samples[Math.floor(line.startLine * PATH_SAMPLES)].y}
                r={7}
                fill="none"
                stroke="#f5f5f5"
                strokeWidth={2}
              />
              {/* Overtake zones — where a pass can actually happen. */}
              {track.zones.map((z) => {
                const p = samples[Math.floor(z.position * PATH_SAMPLES) % PATH_SAMPLES];
                return (
                  <circle
                    key={z.name}
                    cx={p.x}
                    cy={p.y}
                    r={13}
                    fill="none"
                    stroke="#ff2d92"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                    strokeDasharray="3 4"
                  />
                );
              })}
              {/* The pit lane, and the box the cars actually stop in. */}
              {pitLane && (
                <>
                  <polyline
                    points={pitLane.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#1c1c1c"
                    strokeWidth={13}
                    strokeLinecap="round"
                  />
                  <polyline
                    points={pitLane.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#2a2a2a"
                    strokeWidth={1}
                    strokeDasharray="3 5"
                  />
                  <circle
                    cx={pointOn(pitLane, 0.5).x}
                    cy={pointOn(pitLane, 0.5).y}
                    r={5}
                    fill="none"
                    stroke="#ff2d92"
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                  />
                </>
              )}

              {/* The cars. Slowest-first so the leader draws on top. A car in
                  the pits is drawn on the LANE, not frozen on the racing line.
                  A car that has FINISHED is drawn nowhere: its progress stops at
                  exactly lap 15.0, and 15.0 % 1 === 0 is the start/finish line,
                  so finishers would otherwise pile up on top of the flag —
                  which is precisely what they were doing. Once you take the
                  chequered flag you are off the circuit; the tower has you. */}
              {live &&
                [...live]
                  .filter((c) => !c.finished)
                  .sort((a, b) => b.position - a.position)
                  .map((c) => {
                    const inPit = c.inPit && c.pitProgress !== null && pitLane;
                    const p = inPit
                      ? pointOn(pitLane!, pitLanePosition(c.pitProgress!))
                      : samples[Math.floor(c.lapPosition * PATH_SAMPLES) % PATH_SAMPLES];
                    const colour = c.isPlayer ? "#ff2d92" : "#f5f5f5";
                    return (
                      <g key={c.id} opacity={inPit ? 0.7 : 1}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={c.isPlayer ? 11 : 9}
                          fill={colour}
                          stroke="#0a0a0a"
                          strokeWidth={2}
                        />
                        <text
                          x={p.x}
                          y={p.y + 3.5}
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="bold"
                          fill="#0a0a0a"
                        >
                          {c.position}
                        </text>
                      </g>
                    );
                  })}
            </>
          )}
        </svg>

        {/* Controls */}
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border-default pt-3">
          <button
            type="button"
            onClick={() => {
              if (raceTime >= duration) setRaceTime(0);
              setPlaying((p) => !p);
            }}
            className="h-8 rounded-sm bg-accent px-4 font-display text-xs tracking-wider text-inverse uppercase transition-colors hover:bg-accent-hover"
          >
            {playing ? "Pause" : raceTime >= duration ? "Replay" : "Play"}
          </button>
          <div className="flex gap-px">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={`h-8 border px-2.5 font-mono text-xs transition-colors ${
                  speed === s
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-default text-secondary hover:text-primary"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <span data-tabular className="font-mono text-xs text-secondary tabular-nums">
            LAP {Math.min(leaderLap + 1, laps)}/{laps}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(duration))}
            value={Math.floor(raceTime)}
            onChange={(e) => {
              setPlaying(false);
              setRaceTime(Number(e.target.value));
            }}
            aria-label="Scrub race"
            className="ml-auto h-1 w-32 accent-[#ff2d92]"
          />
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setRaceTime(duration);
            }}
            className="h-8 border border-border-default px-2.5 font-mono text-xs text-secondary transition-colors hover:text-primary"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Timing tower */}
      <div className="flex flex-col border border-border-default bg-surface">
        <p className="border-b border-border-default px-4 py-2 font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
          Timing
        </p>
        <ol className="flex-1">
          {order.map((c) => (
            <li
              key={c.id}
              className={`flex items-center gap-2 border-b border-border-default px-3 py-1.5 font-mono text-xs ${
                c.isPlayer ? "bg-accent/10" : ""
              }`}
            >
              <span
                data-tabular
                className={`w-5 tabular-nums ${c.isPlayer ? "text-accent" : "text-muted"}`}
              >
                {c.position}
              </span>
              <span className="flex-1 truncate font-body text-primary">{c.name}</span>
              {c.finished ? (
                <span className="text-[10px] tracking-wider text-success uppercase">
                  Fin
                </span>
              ) : (
                <>
                  <span
                    title={COMPOUNDS[c.compound].label}
                    className={`text-[10px] ${
                      c.compound === "soft"
                        ? "text-danger"
                        : c.compound === "medium"
                          ? "text-warning"
                          : "text-info"
                    }`}
                  >
                    {COMPOUNDS[c.compound].label[0]}
                  </span>
                  {/* Tyre life — the bar empties as the tyre dies. */}
                  <span className="h-1 w-8 bg-border-default">
                    <span
                      className="block h-1 bg-secondary"
                      style={{ width: `${Math.max(0, 100 - c.wear * 100)}%` }}
                    />
                  </span>
                  {c.inPit ? <span className="text-[10px] text-accent">PIT</span> : null}
                </>
              )}
            </li>
          ))}
        </ol>
        <div className="border-t border-border-default p-3">
          <p className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
            Race control
          </p>
          <ul className="mt-2 space-y-1">
            {ticker.length === 0 ? (
              <li className="font-body text-xs text-muted">Lights out…</li>
            ) : (
              ticker.map((e, i) => (
                <li key={`${e.t}-${i}`} className="font-body text-xs text-secondary">
                  <span className="text-muted">L{e.lap}</span>{" "}
                  {e.type === "overtake" ? (
                    <>
                      <span className="text-primary">{nameOf(e.carId)}</span> passes{" "}
                      {nameOf(e.onCarId)} at {e.zone}
                    </>
                  ) : e.type === "pit" ? (
                    <>
                      <span className="text-primary">{nameOf(e.carId)}</span> boxes —{" "}
                      {COMPOUNDS[e.to].label}
                    </>
                  ) : e.type === "cliff" ? (
                    <>
                      <span className="text-danger">{nameOf(e.carId)}</span>&apos;s tyres are
                      gone
                    </>
                  ) : e.type === "finish" ? (
                    <>
                      <span className="text-primary">{nameOf(e.carId)}</span> finishes P
                      {e.position}
                    </>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
