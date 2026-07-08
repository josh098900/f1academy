import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

// The link-preview card (og:image / twitter:image) — the first thing a
// newcomer sees when anyone shares the game. Deliberately EVERGREEN: no round
// names or lock dates, because platforms cache previews for weeks and stale
// "live" info reads worse than none. Rendered from our design tokens (black
// canvas, electric magenta, Bebas wordmark) with fully original geometry —
// no Wikimedia circuit art here, since CC BY-SA attribution can't travel
// with a detached social image.
//
// Static: no dynamic data, so Next prerenders it at build and serves a plain
// PNG. Fonts are committed under assets/og (both SIL OFL, licences alongside)
// because Satori needs raw font bytes — next/font doesn't apply here.

export const alt =
  "Academy Fantasy — the free fantasy league for F1 Academy. Pick 4 drivers, £40M cap, boost one.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#ff2d92";
const CANVAS = "#0a0a0a";
const WHITE = "#f5f5f5";

// Alternating finish-line checker column (right edge).
function Checker() {
  const rows = 14;
  const cols = 3;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            width: 30,
            height: 30,
            background: (r + c) % 2 === 0 ? "#1f1f1f" : "transparent",
          }}
        />
      );
    }
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        right: 0,
        display: "flex",
        flexWrap: "wrap",
        width: cols * 30,
        height: rows * 30,
      }}
    >
      {cells}
    </div>
  );
}

// Kerb strip along the bottom — skewed magenta/dark blocks, racing-curb style.
function Kerb() {
  const blocks = [];
  for (let i = 0; i < 26; i++) {
    blocks.push(
      <div
        key={i}
        style={{
          width: 52,
          height: 26,
          background: i % 2 === 0 ? ACCENT : "#1a1a1a",
          transform: "skewX(-24deg)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: -20,
        display: "flex",
        width: 1260,
        overflow: "hidden",
      }}
    >
      {blocks}
    </div>
  );
}

export default async function OpengraphImage() {
  const [bebas, mono] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/og/BebasNeue-Regular.ttf")),
    readFile(path.join(process.cwd(), "assets/og/JetBrainsMono-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CANVAS,
          fontFamily: "JetBrains Mono",
          position: "relative",
        }}
      >
        {/* Depth: magenta glow behind the leaderboard card. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background:
              "radial-gradient(circle at 78% 42%, rgba(255,45,146,0.20), rgba(255,45,146,0.04) 45%, rgba(10,10,10,0) 65%)",
          }}
        />

        <Checker />

        {/* The product, miniaturised: a leaderboard card with an open P1. */}
        <div
          style={{
            position: "absolute",
            top: 150,
            right: 84,
            width: 330,
            display: "flex",
            flexDirection: "column",
            background: "#141414",
            border: "1px solid #2f2f2f",
            transform: "rotate(-2deg)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 20px",
              borderBottom: "1px solid #2f2f2f",
            }}
          >
            <div style={{ fontSize: 16, letterSpacing: 4, color: "#888888" }}>
              LEADERBOARD
            </div>
            <div style={{ width: 10, height: 10, background: ACCENT }} />
          </div>
          {[
            { pos: "P1", name: "YOU?", pts: "—", hot: true },
            { pos: "P2", name: "ALICE", pts: "134" },
            { pos: "P3", name: "MARCO", pts: "121" },
            { pos: "P4", name: "NINA", pts: "117" },
          ].map((r) => (
            <div
              key={r.pos}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "13px 20px",
                gap: 16,
                background: r.hot ? "rgba(255,45,146,0.14)" : "transparent",
                borderBottom: "1px solid #222222",
                borderLeft: r.hot ? `4px solid ${ACCENT}` : "4px solid transparent",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  color: r.hot ? ACCENT : "#888888",
                  width: 40,
                }}
              >
                {r.pos}
              </div>
              <div
                style={{
                  fontFamily: "Bebas Neue",
                  fontSize: 30,
                  color: r.hot ? ACCENT : WHITE,
                  flexGrow: 1,
                }}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 20, color: r.hot ? ACCENT : "#b3b3b3" }}>
                {r.pts}
              </div>
            </div>
          ))}
        </div>

        {/* Content column. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            paddingLeft: 76,
            paddingBottom: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 16, height: 16, background: ACCENT }} />
            <div
              style={{
                fontSize: 23,
                letterSpacing: 7,
                color: ACCENT,
              }}
            >
              FREE TO PLAY · 2026 SEASON
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Bebas Neue",
              fontSize: 185,
              lineHeight: 0.88,
              marginTop: 26,
            }}
          >
            <div style={{ color: WHITE, display: "flex" }}>ACADEMY</div>
            <div style={{ color: ACCENT, display: "flex" }}>FANTASY</div>
          </div>

          <div
            style={{
              fontSize: 27,
              color: "#b3b3b3",
              marginTop: 28,
              display: "flex",
            }}
          >
            The free fantasy league for F1 Academy
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 2,
                background: ACCENT,
                color: CANVAS,
                padding: "10px 20px",
              }}
            >
              PICK 4
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 2,
                border: "2px solid #303030",
                color: WHITE,
                padding: "8px 20px",
              }}
            >
              £40M CAP
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 2,
                border: "2px solid #303030",
                color: WHITE,
                padding: "8px 20px",
              }}
            >
              BOOST ONE
            </div>
          </div>
        </div>

        <Kerb />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bebas Neue", data: bebas, style: "normal", weight: 400 },
        { name: "JetBrains Mono", data: mono, style: "normal", weight: 400 },
      ],
    }
  );
}
