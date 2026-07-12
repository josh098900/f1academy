"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  COMPOUNDS,
  type Entrant,
  type RaceResult,
  getRacingLine,
  getTrack,
  simulateRace,
} from "@/lib/race-sim";

// The broadcast. Dots lapping a circuit, a timing tower, and a ticker.
//
// Note what is NOT passed in: the race itself. The server sends only the
// entrants and the seed, and this component recomputes the whole race in the
// browser. The sim is deterministic, so that produces exactly the race the
// server would have produced — which is the entire reason for the design. A
// 15-lap timeline is ~3,500 frames × 8 cars; shipping that over the wire would
// be megabytes, and it would be a result we'd then have to trust the client not
// to edit. Sending 8 stat blocks and an integer is better on every axis.

const SPEEDS = [1, 5, 20, 60];
const DEFAULT_SPEED = 20;
const PATH_SAMPLES = 720; // lookup table resolution around the lap

type Props = {
  entrants: Entrant[];
  trackId: string;
  laps: number;
  seed: number;
};

type Point = { x: number; y: number };

export function RaceViewer({ entrants, trackId, laps, seed }: Props) {
  const line = getRacingLine(trackId);
  const track = getTrack(trackId);

  // Recompute the race from the seed. Memoised on the inputs, so scrubbing and
  // re-renders are free.
  const result: RaceResult = useMemo(
    () => simulateRace({ track, laps, entrants, seed }),
    [track, laps, entrants, seed]
  );

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

  const [raceTime, setRaceTime] = useState(0);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [playing, setPlaying] = useState(true);

  const duration = result.frames.at(-1)?.t ?? 0;

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
              {/* The cars. Slowest-first so the leader draws on top. */}
              {live &&
                [...live]
                  .sort((a, b) => b.position - a.position)
                  .map((c) => {
                    const p =
                      samples[Math.floor(c.lapPosition * PATH_SAMPLES) % PATH_SAMPLES];
                    const colour = c.isPlayer ? "#ff2d92" : c.inPit ? "#555555" : "#f5f5f5";
                    return (
                      <g key={c.id} opacity={c.inPit ? 0.45 : 1}>
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
