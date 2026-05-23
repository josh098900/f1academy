# Design System

> The visual rulebook for Academy Fantasy. **The single source of truth that prevents generic AI-crafted drift.**
>
> Every component, every screen, every PR must check against this doc. If a choice isn't covered here, ask before improvising — improvisation is where the generic look creeps in.

## Philosophy

Academy Fantasy borrows the **language** of mature motorsport design — F1's broadcast graphics, the F1 Fantasy app, FOM's timing screens, F1 Manager. It does NOT copy assets, fonts, or marks. We capture the spirit:

1. **Black-first, not "dark mode."** No light theme exists. Black is the canvas, not a setting.
2. **One accent, used aggressively.** No three-colour palettes. No gradients on UI.
3. **Condensed bold uppercase display type.** 70 years of motorsport visual vocabulary.
4. **Hard geometry.** Border radius 0–2px on most things. Sharp diagonals as a motif.
5. **Numerals as design elements.** Positions, points, prices are the heroes — 60–120px, tabular mono.
6. **Information density.** Race fans want stats. We don't over-pad.
7. **Functional colour.** Team/driver colours identify, not decorate.
8. **Asymmetry and edges.** Content runs to the screen edge like a Bloomberg terminal, not centred with breathing-room margins.
9. **Restraint on motion.** Brake-pulse on press, digit-roll on countdown. No parallax. No glide-in scroll reveals.

## What we will NEVER use (the AI-crafted tells)

| Anti-pattern | Why we avoid |
|---|---|
| `rounded-lg`, `rounded-xl`, `rounded-2xl` anywhere | The single biggest "generated app" tell |
| Inter, system-ui, Geist, Plus Jakarta Sans, Space Grotesk | All converge on the same look |
| Purple-to-pink gradients on buttons | The Vercel/v0 default |
| Subtle drop shadows (`shadow-md`, `shadow-lg`) | We use hard borders, not soft shadows |
| Glassmorphism / backdrop blur | Era-marked, generic |
| Centered hero + 3-column features landing page | The starter-kit layout |
| `slate-*` or `zinc-*` neutrals straight from Tailwind defaults | Recognisable on sight |
| Lucide icons used as primary visual elements | Fine for UI affordances, never for hero illustration |
| Emoji as design accents 🚀 | Reads as AI-generated copy |
| "Get Started" CTA buttons in a centred hero | The starter-kit cliché |

## Colour tokens

All colours are **OKLCH** for perceptual uniformity (Tailwind v4 native).

### Foundational
```
--bg-base:        #0A0A0A    /* near-black, anti-banding */
--bg-surface:     #141414    /* card / panel background */
--bg-elevated:    #1C1C1C    /* dropdowns, modals */
--border-default: #2A2A2A    /* barely visible */
--border-strong:  #3D3D3D    /* hover, focus */
```

### Text
```
--text-primary:   #F5F5F5    /* warm white */
--text-secondary: #888888    /* labels, metadata */
--text-muted:     #555555    /* timestamps, disclaimers */
--text-inverse:   #0A0A0A    /* on accent backgrounds */
```

### Accent (the one colour)
```
--accent:         #FF2D92    /* electric magenta */
--accent-hover:   #FF52A6
--accent-active:  #E61F7E
--accent-muted:   #4A0F2D    /* 20% mix into bg */
```

This is a saturated magenta that nods to F1 Academy's pink heritage without copying their exact mark. Used **only** for: primary action buttons, current-user highlight, "in the points" indicators, lock-countdown alert states.

### Semantic
```
--success:        #00E5A0    /* sharp mint — for "scoring" / positions gained */
--danger:         #FF3D3D    /* sharper than F1 red, our own */
--warning:        #FFB800    /* yellow flag, oversteer */
--info:           #4DB8FF    /* rare; use sparingly */
```

### F1 partner team colours (functional)

Used as the 4px left-bar on driver cards and as standings accents. These are the published team colours, used factually (we're identifying the F1 partner team behind each F1 Academy driver):

```ts
export const F1_TEAM_COLORS = {
  'Mercedes':         '#00D2BE',
  'Red Bull Racing':  '#1E41FF',
  'Ferrari':          '#DC0000',
  'McLaren':          '#FF8700',
  'Aston Martin':     '#006F62',
  'Alpine':           '#0090FF',
  'Williams':         '#005AFF',
  'Racing Bulls':     '#6692FF',
  'Haas':             '#B6BABD',
  'Kick Sauber':      '#52E252',
  'Audi':             '#52E252',     // 2026 entry colour TBC
  'Cadillac':         '#C9B037',     // 2027 entry; placeholder
  '—':                '#555555',     // no F1 partner
} as const;
```

## Typography

### Fonts (all free, Google Fonts)

| Role | Font | Why |
|---|---|---|
| Display + numerals | **Bebas Neue** | Condensed bold all-caps, classic motorsport feel, captures the F1 Display spirit without licensing |
| Body | **Archivo** | Slightly geometric, distinctive, has condensed variants for data-dense sections, far from the Inter default |
| Tabular mono | **JetBrains Mono** | Tabular figures, clean technical feel, distinct from Geist Mono |

### Font import (next/font)

```ts
// app/layout.tsx
import { Bebas_Neue, Archivo, JetBrains_Mono } from 'next/font/google';

const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
});

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-body',
  axes: ['wdth'],          // enable width axis for condensed variants
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${archivo.variable} ${jetbrains.variable}`}>
      <body className="bg-base text-primary font-body antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Type scale (dramatic, not timid)

```
--text-hero:        clamp(4rem, 12vw, 8rem)        /* 64–128px — driver numbers, lock timer */
--text-display:     clamp(2.5rem, 6vw, 4rem)       /* 40–64px — round name, page titles */
--text-h1:          2rem                            /* 32px */
--text-h2:          1.5rem                          /* 24px — driver name in card */
--text-h3:          1.125rem                        /* 18px */
--text-body:        0.9375rem                       /* 15px — body default */
--text-small:       0.8125rem                       /* 13px — metadata, labels */
--text-xs:          0.6875rem                       /* 11px — uppercase tracked labels */
```

### Type rules

- Display font (Bebas Neue) is **always uppercase**, letter-spacing 0.02–0.05em.
- Section headers use Bebas Neue, 11–13px, tracked-out 0.15em, uppercase. (Think "QUALIFYING" header above a sessions list.)
- Body font (Archivo) for paragraphs, descriptions, labels.
- Mono (JetBrains Mono) for ALL numbers that align in tables: prices, points, times, positions.
- Mono with `font-variant-numeric: tabular-nums` enabled by default for monospace.
- Body Archivo can be tightened for hero quotes with `font-stretch: 87.5%` (the condensed axis).
- **Never** use display font for paragraphs (illegible at scale).
- **Never** use body font for huge numerals (lacks the punch).

## Geometry

### Border radius
```
--radius-none:  0px       /* data cells, tables, leaderboard rows */
--radius-sm:    2px       /* default for everything */
--radius-md:    4px       /* avatars only */
--radius-full:  9999px    /* badges, pills, tags */
```

That's it. There is no `--radius-lg`. There is no `--radius-xl`. If a component needs them, it's wrong.

### Borders
- 1px solid `var(--border-default)` for most card/panel edges
- 1px solid `var(--border-strong)` on hover or focus
- 4px solid `var(--team-color)` for driver-card left bars (the only "thick" border)
- **No** soft drop shadows. Use hard borders.

### The signature motif: the chevron cut

A 15° diagonal cut on the top-right corner of select elements (user's own team card, "ON TRACK" banner, current round indicator). Implementation:

```css
.chevron-cut {
  clip-path: polygon(0 0, calc(100% - 1.5rem) 0, 100% 1.5rem, 100% 100%, 0 100%);
}
```

Use **sparingly** — once or twice per screen max. Overuse kills the impact.

## Spacing

4px base unit. Tailwind defaults are fine; just commit to using them consistently.

Layout edge rule: **on mobile, content runs to the screen edge (no horizontal padding) for data-dense panels** (leaderboards, driver lists). Padding kicks in only inside cells/cards. This is the Bloomberg-terminal density we want.

## Tailwind v4 config

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  /* Colours */
  --color-base: #0A0A0A;
  --color-surface: #141414;
  --color-elevated: #1C1C1C;
  --color-border-default: #2A2A2A;
  --color-border-strong: #3D3D3D;

  --color-primary: #F5F5F5;
  --color-secondary: #888888;
  --color-muted: #555555;

  --color-accent: #FF2D92;
  --color-accent-hover: #FF52A6;
  --color-accent-active: #E61F7E;

  --color-success: #00E5A0;
  --color-danger: #FF3D3D;
  --color-warning: #FFB800;
  --color-info: #4DB8FF;

  /* Type */
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Archivo', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* Radius */
  --radius-none: 0px;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-full: 9999px;
}

/* Globals */
body {
  font-feature-settings: 'ss01', 'cv01';
  -webkit-font-smoothing: antialiased;
}

[data-tabular] {
  font-variant-numeric: tabular-nums;
}
```

## shadcn/ui overrides

shadcn ships with sensible defaults — but those defaults ARE the AI-crafted look. Override them all.

When `pnpm dlx shadcn@latest add button`, immediately:

1. Open the new component file
2. Replace every `rounded-md` with `rounded-sm` (which is now 2px)
3. Replace every `bg-primary` with `bg-accent`
4. Replace any `shadow-sm` with `border border-default`
5. For buttons: `font-display tracking-wider uppercase text-sm`
6. Remove any `transition-all` and replace with `transition-colors duration-150`

### Button variants (custom, override shadcn)

```tsx
// components/ui/button.tsx (after customisation)
const buttonVariants = cva(
  "inline-flex items-center justify-center font-display uppercase tracking-wider text-sm transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:  "bg-accent text-base hover:bg-accent-hover active:bg-accent-active",
        secondary:"bg-surface text-primary border border-default hover:border-strong",
        ghost:    "text-secondary hover:text-primary hover:bg-surface",
        danger:   "bg-danger text-primary hover:opacity-90",
      },
      size: {
        sm:  "h-8 px-3 text-xs",
        md:  "h-10 px-5",
        lg:  "h-12 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);
```

Note: hard corners (no `rounded-*` class). Hard edges and uppercase tracked-out display font are the button signature.

## Components

### DriverCard

The most important component in the app. Used in the team picker, leaderboard rows, driver detail header.

```tsx
// components/team/DriverCard.tsx (the pattern)
<article className="
  group relative flex items-center gap-4 
  bg-surface border border-default
  hover:border-strong transition-colors
  cursor-pointer
">
  {/* 4px team-colour bar */}
  <div 
    className="absolute left-0 top-0 bottom-0 w-1" 
    style={{ background: teamColor }} 
  />
  
  {/* Driver number — massive */}
  <div className="font-display text-[72px] leading-none pl-6 pr-2 text-primary tabular-nums">
    {driver.carNumber}
  </div>
  
  {/* Name + meta */}
  <div className="flex-1 py-3">
    <div className="font-display text-xl tracking-wide text-primary uppercase">
      {driver.lastName}
    </div>
    <div className="font-body text-xs text-secondary uppercase tracking-wider mt-0.5">
      {driver.team} · {driver.f1Partner}
    </div>
  </div>
  
  {/* Price — mono, right-aligned */}
  <div className="font-mono text-lg text-primary tabular-nums px-6">
    £{price.toFixed(1)}M
  </div>

  {/* Hover: subtle accent flash on left edge */}
  <div className="
    absolute left-0 top-0 bottom-0 w-1 bg-accent
    opacity-0 group-hover:opacity-100 transition-opacity
  " />
</article>
```

### Lock countdown

```tsx
// components/team/LockCountdown.tsx
<div className="flex items-baseline gap-2">
  <span className="font-body text-xs text-secondary uppercase tracking-wider">
    Locks in
  </span>
  <span className="font-mono text-2xl text-primary tabular-nums">
    {days}d {hours.toString().padStart(2,'0')}:{minutes.toString().padStart(2,'0')}:{seconds.toString().padStart(2,'0')}
  </span>
</div>
```

When < 1 hour: text turns accent magenta, optional digit-roll animation (CSS only, transform translateY on individual digit spans).

### Leaderboard row

```tsx
<tr className="
  border-b border-default last:border-0
  hover:bg-surface transition-colors
  data-[current=true]:relative
  data-[current=true]:before:absolute data-[current=true]:before:left-0 
  data-[current=true]:before:top-0 data-[current=true]:before:bottom-0
  data-[current=true]:before:w-0.5 data-[current=true]:before:bg-accent
">
  <td className="font-mono text-secondary tabular-nums py-3 pl-4 w-12">
    {position}
  </td>
  <td className="font-mono text-xs text-secondary w-8">
    {positionChange > 0 ? <span className="text-success">▲ {positionChange}</span> 
     : positionChange < 0 ? <span className="text-danger">▼ {Math.abs(positionChange)}</span>
     : <span>—</span>}
  </td>
  <td className="font-body text-primary py-3">
    {user.displayName}
  </td>
  <td className="font-mono text-primary tabular-nums text-right pr-4 tabular-nums">
    {points.toLocaleString()}
  </td>
</tr>
```

No row backgrounds for the current user. A 2px accent bar on the left edge. Subtle.

### Budget bar

```tsx
<div className="space-y-2">
  <div className="flex justify-between items-baseline">
    <span className="font-body text-xs uppercase tracking-wider text-secondary">
      Budget
    </span>
    <span className="font-mono text-sm tabular-nums text-primary">
      £{spent.toFixed(1)}M / £{cap.toFixed(1)}M
    </span>
  </div>
  <div className="h-1 bg-surface relative overflow-hidden">
    <div 
      className="h-full transition-all duration-300 origin-left"
      style={{ 
        width: `${(spent/cap)*100}%`,
        background: spent > cap ? 'var(--color-danger)' : 'var(--color-accent)',
      }}
    />
  </div>
</div>
```

A thin 4px bar, not a chunky progress component. Pulses red briefly when over cap (CSS keyframes).

### Coach AI surface

Looks distinct from primary content. Less authoritative.

```tsx
<aside className="border border-accent/30 bg-accent/[0.03] p-5 space-y-3">
  <div className="flex items-center justify-between">
    <span className="font-display text-xs uppercase tracking-[0.2em] text-accent">
      Coach's Take
    </span>
    <span className="font-mono text-[10px] text-muted uppercase">
      Generated by Claude
    </span>
  </div>
  <p className="font-body text-sm text-primary leading-relaxed">
    {insight}
  </p>
</aside>
```

The accent border is 30% opacity, the background fill is barely-there 3%. The "Generated by Claude" tag is always visible, never small enough to hide.

## Motion

Restraint over flair. Three approved animations:

### 1. Brake pulse (on tap/press)
```css
@keyframes brake-pulse {
  0%   { box-shadow: inset 4px 0 0 var(--color-accent); }
  100% { box-shadow: inset 0 0 0 transparent; }
}
.brake-pulse:active {
  animation: brake-pulse 200ms ease-out;
}
```

### 2. Digit roll (countdown final hour)
Individual digit spans animate `transform: translateY` when value changes. CSS keyframes, 150ms.

### 3. Score reveal (post-race)
When user opens post-race recap for the first time, numbers count up from 0 to final value over 800ms (ease-out). Once per round per user.

**Forbidden**: glide-in scroll reveals, parallax, pulsing glow, hover scale transforms, page-load stagger animations.

## Photography / imagery

We don't host driver photos in v1 (see DATA_PIPELINE.md — licensing avoidance). Driver avatars are generated stylised — propose **DiceBear "Notionists" or "Adventurer"** style, seeded by driver name, in grayscale + accent magenta highlights.

Backgrounds: solid surface colours. No track photos, no blurred imagery, no decorative geometry.

The exception: the marketing/landing page (logged-out homepage) can use **one** high-contrast hero photo — high-grain, motion-blurred, B&W with a single magenta tint — sourced from Wikimedia Commons under appropriate licence. Treat it like a film poster, not a stock photo.

## On-brand checklist (per PR)

Before merging any UI work, the answer to every question should be yes:

- [ ] Background is `--bg-base` or `--bg-surface`. No `bg-white`, `bg-slate-*`, `bg-zinc-*`.
- [ ] No element has `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`.
- [ ] No element uses `shadow-md`, `shadow-lg`, `shadow-xl`.
- [ ] No glass / backdrop-blur effects.
- [ ] Display text uses `font-display` (Bebas Neue), uppercase, tracked.
- [ ] All numbers in data tables use `font-mono tabular-nums`.
- [ ] Accent magenta used only for: primary action, current-user highlight, in-points state.
- [ ] Driver cards have the 4px team-colour left bar.
- [ ] No gradient buttons. No purple-to-pink anything.
- [ ] No Lucide icons used as decorative hero elements (they're fine for UI affordances).
- [ ] Mobile layout has data running edge-to-edge in dense panels (no `px-6` on the body wrapper for leaderboards).
- [ ] Empty/loading states match the aesthetic (not generic spinners on white).

## References

Open these tabs while building, particularly for layout reference:

| Site / app | What to study |
|---|---|
| formula1.com | Driver pages, current homepage, hard-edged hero treatments |
| F1 Fantasy web app | The team picker layout, budget bar treatment |
| FOM broadcast graphics | Live timing overlays, position changes, sector indicators |
| F1 Manager 2024/25 (game) | Information density, dashboard layout, racing fonts |
| FT.com | Information density done well in editorial context |
| The Athletic | Sports content with mature typography |
| Bloomberg Terminal screenshots | The platonic ideal of edge-aligned data UI |
| Issey Miyake / A-COLD-WALL websites | Hard geometric layouts with single accents |

## Future variants

When (if) the app supports themes other than the core black, options to consider:

- **Race weekend mode**: red corner cut + race name banner, automatically active Friday–Sunday of a round
- **Champion mode**: gold accent overlay if a user is leading their league
- **Wild card weekend**: bonus visual flair when wild card drivers are racing

Don't build these in v1. Note them so we don't paint ourselves into a corner.

---

**Maintainer rule**: this doc updates when we make a design decision, not before. If a component requires a choice that isn't here, pause, decide, document it here, then ship. Drift kills design systems.
