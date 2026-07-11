// Pit-wall loading chip — a flat side-profile car with spinning wheels, speed
// streaks and a scrolling track line, beside cycling pit-wall copy. Ported
// from the 1a design comp onto the design tokens (black canvas, one magenta
// accent). Server-renderable: every animation is CSS (see globals.css f1-*),
// so it works inside a loading.tsx boundary before any JS arrives, and
// prefers-reduced-motion freezes it into a static chip.

const PHRASES = ["Warming tyres", "Box, box", "Timing screens up", "Finding clear air"];

export function PitwallLoader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex items-center gap-5 border-y-2 border-border-default bg-base px-9 py-7"
    >
      <svg width="132" height="46" viewBox="0 0 220 74" aria-hidden="true">
        {/* speed streaks */}
        <g>
          <rect className="f1-streak" x="4" y="26" width="24" height="3" fill="#888888" />
          <rect
            className="f1-streak"
            x="10"
            y="40"
            width="30"
            height="3"
            fill="#ff2d92"
            style={{ animationDelay: "0.3s" }}
          />
          <rect
            className="f1-streak"
            x="2"
            y="54"
            width="20"
            height="3"
            fill="#888888"
            style={{ animationDelay: "0.55s" }}
          />
        </g>
        {/* car silhouette — accent magenta, white detailing */}
        <g>
          <rect x="40" y="62" width="42" height="4" fill="#ff2d92" />
          <rect x="40" y="50" width="4" height="16" fill="#f5f5f5" />
          <polygon points="44,50 108,42 108,54 50,54" fill="#ff2d92" />
          <path
            d="M108 42 L128 38 L134 28 L148 28 L156 38 L196 42 L206 47 L206 54 L104 54 Z"
            fill="#ff2d92"
          />
          <path d="M132 36 Q145 18 160 34" stroke="#ff2d92" strokeWidth="4" fill="none" />
          <rect x="136" y="46" width="58" height="5" fill="#f5f5f5" />
          <rect x="192" y="26" width="26" height="5" fill="#ff2d92" />
          <rect x="214" y="24" width="4" height="26" fill="#ff2d92" />
          <rect x="200" y="31" width="4" height="14" fill="#ff2d92" />
        </g>
        {/* wheels: magenta tyre, dark inner, spinning spokes */}
        <circle cx="92" cy="57" r="15" fill="#ff2d92" />
        <g className="f1-wheel">
          <circle cx="92" cy="57" r="7" fill="#0a0a0a" />
          <path d="M92 50.5 L92 63.5 M85.5 57 L98.5 57" stroke="#ff2d92" strokeWidth="2.5" />
          <circle cx="92" cy="57" r="2.4" fill="#f5f5f5" />
        </g>
        <circle cx="184" cy="57" r="15" fill="#ff2d92" />
        <g className="f1-wheel">
          <circle cx="184" cy="57" r="7" fill="#0a0a0a" />
          <path d="M184 50.5 L184 63.5 M177.5 57 L190.5 57" stroke="#ff2d92" strokeWidth="2.5" />
          <circle cx="184" cy="57" r="2.4" fill="#f5f5f5" />
        </g>
        {/* scrolling track line */}
        <line
          className="f1-track"
          x1="30"
          y1="73"
          x2="220"
          y2="73"
          stroke="#3d3d3d"
          strokeWidth="2"
          strokeDasharray="14 14"
        />
      </svg>

      <div className="flex flex-col gap-0.5">
        {/* Cycling copy: absolutely stacked phrases sharing one animation cycle.
            Non-first phrases start hidden so reduced-motion shows only the first. */}
        <div className="relative h-5 min-w-40 font-display text-sm tracking-wider text-primary uppercase">
          {PHRASES.map((phrase, i) => (
            <span
              key={phrase}
              className="f1-phrase absolute inset-0"
              style={{ animationDelay: `${i * 2}s`, opacity: i === 0 ? 1 : 0 }}
            >
              {phrase}…
            </span>
          ))}
        </div>
        <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
          Academy Fantasy
        </span>
      </div>
    </div>
  );
}
