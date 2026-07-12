"use client";

import { COMPOUNDS, type CompoundId, type Strategy, getTrack } from "@/lib/race-sim";

// The pit wall.
//
// A strategy screen made of sliders is a form: you drag a number and hope. A pit
// wall SHOWS YOU THE CONSEQUENCE of the plan before you commit to it — which lap
// you'll box on, how much life is left when you do, and whether you're about to
// drive off the cliff. Every control here feeds the stint plan below it, so the
// numbers stop being abstract.

// Real F1 compound colours — instantly legible to anyone who watches racing.
const TYRE_COLOUR: Record<CompoundId, string> = {
  soft: "#ff3d3d",
  medium: "#ffb800",
  hard: "#f5f5f5",
};

// Roughly how much wear a lap costs. Cars spend most of the race racing someone,
// so assume a little above neutral — this is the same maths the sim runs, and
// it's why the predicted box lap lands within a lap of the real one.
const TYPICAL_MODE_WEAR = 1.15;

export function wearPerLap(compound: CompoundId, trackId: string): number {
  return (
    COMPOUNDS[compound].wearPerLap *
    getTrack(trackId).tyreWearFactor *
    TYPICAL_MODE_WEAR
  );
}

// The whole plan: when you box, and when EITHER tyre falls off.
//
// You get one stop, so the stint you FINISH on matters as much as the one you
// start on. Fit softs with ten laps to run and they will die and you will crawl
// to the flag — and the screen has to tell you that before you commit, not after.
export function stintPlan(
  strategy: Strategy,
  trackId: string,
  laps: number
): {
  boxLap: number | null;
  cliffLap: number | null; // the tyre you start on
  finalCliffLap: number | null; // the tyre you finish on
} {
  const perLap = wearPerLap(strategy.startCompound, trackId);
  const rawBox = Math.ceil(strategy.pitAtWear / perLap);
  const rawCliff = Math.ceil(COMPOUNDS[strategy.startCompound].cliff / perLap);
  // The sim refuses a stop with under 3 laps left — it can only lose you time.
  const boxLap = rawBox <= laps - 3 ? rawBox : null;
  const cliffLap = rawCliff <= laps ? rawCliff : null;

  // The stint you finish on starts fresh from the box.
  let finalCliffLap: number | null = null;
  if (boxLap !== null) {
    const perLap2 = wearPerLap(strategy.pitCompound, trackId);
    const lap = boxLap + Math.ceil(COMPOUNDS[strategy.pitCompound].cliff / perLap2);
    finalCliffLap = lap <= laps ? lap : null;
  }

  return { boxLap, cliffLap, finalCliffLap };
}

export function TyrePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CompoundId;
  onChange: (c: CompoundId) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
        {label}
      </p>
      <div className="mt-3 flex gap-3">
        {(Object.keys(COMPOUNDS) as CompoundId[]).map((id) => {
          const active = value === id;
          const colour = TYRE_COLOUR[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              aria-label={COMPOUNDS[id].label}
              className="group flex flex-col items-center gap-1.5"
            >
              {/* The tyre itself: a ring in the real compound colour. */}
              <span
                className={`flex size-11 items-center justify-center rounded-full border-[3px] transition-transform ${
                  active ? "scale-110" : "opacity-45 group-hover:opacity-80"
                }`}
                style={{ borderColor: colour, background: "#141414" }}
              >
                <span
                  className="font-display text-sm leading-none"
                  style={{ color: colour }}
                >
                  {COMPOUNDS[id].label[0]}
                </span>
              </span>
              <span
                className={`font-mono text-[9px] tracking-wider uppercase ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {COMPOUNDS[id].label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PitWallSlider({
  label,
  readout,
  hint,
  min,
  max,
  value,
  onChange,
  danger,
}: {
  label: string;
  readout: string;
  hint: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  danger?: boolean;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={`pw-${label}`}
          className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase"
        >
          {label}
        </label>
        <span
          data-tabular
          className={`font-mono text-sm tabular-nums ${
            danger ? "text-danger" : "text-accent"
          }`}
        >
          {readout}
        </span>
      </div>
      <input
        id={`pw-${label}`}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pitwall-slider mt-2.5"
        style={{ ["--fill" as string]: `${fill}%` }}
      />
      <p className="mt-1.5 font-body text-[11px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

// The plan, drawn. This is the whole point of the screen: your sliders become a
// picture of the race you've just ordered, cliff and all.
export function StintPlan({
  strategy,
  trackId,
  laps,
}: {
  strategy: Strategy;
  trackId: string;
  laps: number;
}) {
  const { boxLap, cliffLap, finalCliffLap } = stintPlan(strategy, trackId, laps);
  const startColour = TYRE_COLOUR[strategy.startCompound];
  const endColour = TYRE_COLOUR[strategy.pitCompound];
  const runsPastCliff = cliffLap !== null && (boxLap === null || boxLap > cliffLap);
  const finalTyreDies = finalCliffLap !== null;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] tracking-[0.2em] text-secondary uppercase">
          Stint plan
        </p>
        <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
          {boxLap === null
            ? "No stop"
            : `Box lap ${boxLap} · ${COMPOUNDS[strategy.startCompound].label} → ${
                COMPOUNDS[strategy.pitCompound].label
              }`}
        </p>
      </div>

      {/* One cell per lap. */}
      <div className="mt-2 flex gap-px">
        {Array.from({ length: laps }, (_, i) => {
          const lap = i + 1;
          const onFirstStint = boxLap === null || lap <= boxLap;
          const pastCliff = onFirstStint
            ? cliffLap !== null && lap > cliffLap
            : finalCliffLap !== null && lap > finalCliffLap;
          const isBox = boxLap === lap;
          return (
            <div key={lap} className="flex-1">
              <div
                title={`Lap ${lap}${pastCliff ? " — tyres gone" : ""}`}
                className="h-6"
                style={{
                  background: pastCliff
                    ? "repeating-linear-gradient(45deg, #ff3d3d, #ff3d3d 3px, #4a0f0f 3px, #4a0f0f 6px)"
                    : onFirstStint
                      ? startColour
                      : endColour,
                  opacity: pastCliff ? 1 : 0.85,
                  borderRight: isBox ? "2px solid #ff2d92" : undefined,
                }}
              />
              {lap % 5 === 0 || lap === 1 ? (
                <p
                  data-tabular
                  className="mt-1 text-center font-mono text-[9px] text-muted tabular-nums"
                >
                  {lap}
                </p>
              ) : (
                <p className="mt-1 text-center font-mono text-[9px] text-transparent">
                  ·
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* The race engineer's verdict. ONE stop — so both tyres have to survive,
          and the screen says which one won't. */}
      {runsPastCliff || finalTyreDies ? (
        <p className="mt-2 flex items-start gap-2 border-l-2 border-danger bg-danger/[0.06] px-3 py-2 font-body text-xs text-danger">
          <span aria-hidden="true">▲</span>
          <span>
            {runsPastCliff
              ? boxLap === null
                ? `No stop, and the ${COMPOUNDS[strategy.startCompound].label} falls off on lap ${cliffLap}. You'll crawl to the flag.`
                : `You run the ${COMPOUNDS[strategy.startCompound].label} to lap ${boxLap}, but it falls off on lap ${cliffLap} — ${boxLap - cliffLap} lap${boxLap - cliffLap === 1 ? "" : "s"} on dead tyres, losing seconds each.`
              : `You box on lap ${boxLap}, but the ${COMPOUNDS[strategy.pitCompound].label} won't last: it falls off on lap ${finalCliffLap} and you have to bring it home. Fit something harder, or box later.`}
          </span>
        </p>
      ) : (
        <p className="mt-2 border-l-2 border-border-strong px-3 py-2 font-body text-xs text-secondary">
          {boxLap === null
            ? `No stop — the ${COMPOUNDS[strategy.startCompound].label} goes the distance. Slower, but you never lose the time in the pit lane.`
            : `Clean plan. You box on lap ${boxLap} with life left in the ${COMPOUNDS[strategy.startCompound].label}, and the ${COMPOUNDS[strategy.pitCompound].label} sees you to the flag.`}
        </p>
      )}
    </div>
  );
}
