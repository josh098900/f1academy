import {
  Flag,
  Home,
  type LucideIcon,
  Newspaper,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

// Single source of truth for primary navigation — used by both the desktop top
// bar and the mobile bottom tab bar (see DESIGN_SYSTEM.md).
export type NavItem = {
  href: string;
  label: string;
  short: string; // bottom-tab label, kept tight
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: Home },
  { href: "/team", label: "Team", short: "Team", icon: Flag },
  { href: "/drivers", label: "Drivers", short: "Drivers", icon: UserRound },
  { href: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy },
  { href: "/leagues", label: "Leagues", short: "Leagues", icon: Users },
  { href: "/news", label: "News", short: "News", icon: Newspaper },
];

// A path is "active" for an item if it equals the href or is nested under it.
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
