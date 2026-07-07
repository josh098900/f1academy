// Per-round form sparkline — hard-edged bars per DESIGN_SYSTEM.md, one per
// completed round, latest round in accent. Heights are normalised against
// `max` (the grid's best single weekend) so bars mean the same thing on every
// card. A null value (driver didn't race that round) renders as a baseline
// tick rather than nothing, so the timeline stays aligned.
type Props = {
  values: (number | null)[]; // aligned to roundNumbers
  roundNumbers: number[];
  max: number;
  className?: string;
};

const BAR_W = 5;
const GAP = 2;
const HEIGHT = 18;

export function FormSpark({ values, roundNumbers, max, className }: Props) {
  if (values.length === 0 || !values.some((v) => v !== null)) return null;

  const width = values.length * BAR_W + (values.length - 1) * GAP;
  const label = `Form: ${roundNumbers
    .map((rn, i) => `R${rn} ${values[i] === null ? "—" : `${values[i]} pts`}`)
    .join(", ")}`;

  return (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className={className}
    >
      {values.map((v, i) => {
        const x = i * (BAR_W + GAP);
        if (v === null) {
          return (
            <rect
              key={i}
              x={x}
              y={HEIGHT - 2}
              width={BAR_W}
              height={2}
              className="fill-border-strong"
            />
          );
        }
        // Negative weekends (DNF-heavy) clamp to the 2px baseline.
        const h = Math.max(2, Math.round((Math.max(0, v) / max) * HEIGHT));
        const latest = i === values.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={HEIGHT - h}
            width={BAR_W}
            height={h}
            className={latest ? "fill-accent" : "fill-muted"}
          />
        );
      })}
    </svg>
  );
}
