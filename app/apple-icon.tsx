import { ImageResponse } from "next/og";

// Generated Apple touch icon (home-screen icon on iOS). Having this also stops
// Safari/iOS probing the site root for /apple-touch-icon.png, which 404s when
// no icon link is present. On-brand: magenta "AF" monogram on near-black.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ff2d92",
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: "-0.06em",
        }}
      >
        AF
      </div>
    ),
    { ...size }
  );
}
