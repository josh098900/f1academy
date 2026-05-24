// Published F1 team colours, used factually to identify the F1 partner behind
// each F1 Academy entry (the 4px left bar on driver cards, standings accents).
// See docs/files/DESIGN_SYSTEM.md.
export const F1_TEAM_COLORS: Record<string, string> = {
  Mercedes: "#00D2BE",
  "Red Bull Racing": "#1E41FF",
  Ferrari: "#DC0000",
  McLaren: "#FF8700",
  "Aston Martin": "#006F62",
  Alpine: "#0090FF",
  Williams: "#005AFF",
  "Racing Bulls": "#6692FF",
  Haas: "#B6BABD",
  "Kick Sauber": "#52E252",
  Audi: "#52E252", // 2026 entry colour TBC
  Cadillac: "#C9B037", // 2027 entry; placeholder
  "—": "#555555", // no F1 partner
};

// Colour for a driver's F1 partner (null/unknown → the neutral "no partner" grey).
export function teamColor(partner: string | null | undefined): string {
  if (!partner) return F1_TEAM_COLORS["—"];
  return F1_TEAM_COLORS[partner] ?? F1_TEAM_COLORS["—"];
}
