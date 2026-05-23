/**
 * wiki-sync — fetch the current F1 Academy season from Wikipedia and emit
 * reviewable seed data. See docs/files/DATA_PIPELINE.md.
 *
 * Source of truth: Wikipedia (CC BY-SA 4.0). We never scrape f1academy.com.
 * Output (db/seed/<year>.json) is for ADMIN REVIEW and is NOT applied to the
 * database automatically — a separate seed step does that after verification.
 *
 * Run: pnpm exec tsx scripts/wiki-sync.ts [year]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const YEAR = Number(process.argv[2]) || 2026;
const PAGE = `${YEAR}_F1_Academy_season`;
const API = "https://en.wikipedia.org/w/api.php";

// flagicon code (ISO-3 / IOC, Wikipedia uses both) -> ISO 3166-1 alpha-2.
const COUNTRY: Record<string, string> = {
  NLD: "NL", NED: "NL", DNK: "DK", DEN: "DK", ESP: "ES", GBR: "GB",
  BRA: "BR", AUT: "AT", NZL: "NZ", ITA: "IT", DEU: "DE", GER: "DE",
  FRA: "FR", USA: "US", CHN: "CN", CAN: "CA", SAU: "SA", ROU: "RO",
  CHE: "CH", SWE: "SE", BEL: "BE", AUS: "AU", JPN: "JP", POL: "PL",
  IRL: "IE", PRT: "PT", POR: "PT", MEX: "MX", ARG: "AR", COL: "CO",
};

type Entry = {
  team: string;
  teamCountry: string | null;
  carNumber: number | null;
  driver: string;
  driverCountry: string | null;
  f1Partner: string | null;
  rounds: string; // raw, e.g. "1-2"
  isWildcard: boolean;
};

type Round = {
  roundNumber: number;
  country: string | null;
  circuit: string;
  location: string | null;
  dates: string[]; // race dates present (2 or 3), year omitted on Wikipedia
  threeRace: boolean;
};

async function fetchWikitext(
  page: string
): Promise<{ text: string; revid: number; title: string }> {
  const url =
    `${API}?action=parse&page=${encodeURIComponent(page)}` +
    `&prop=wikitext|revid&format=json&formatversion=2`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "AcademyFantasy-wiki-sync/0.1 (portfolio; github.com/josh098900)",
    },
  });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  const json = (await res.json()) as {
    parse?: { wikitext?: string; revid?: number; title?: string };
  };
  const p = json.parse;
  if (!p?.wikitext) throw new Error(`No wikitext for ${page} (page missing?)`);
  return { text: p.wikitext, revid: p.revid ?? 0, title: p.title ?? page };
}

// --- wikitext cell helpers -------------------------------------------------

function stripRefs(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{efn[\s\S]*?\}\}/gi, "");
}

// Remove a leading "attr |" prefix (rowspan, align, nowrap, ...) from a cell.
// The attribute part never contains a template/link, so we only strip when the
// text before the first single pipe looks like HTML attributes.
function stripCellAttrs(cell: string): string {
  const m = cell.match(/^\s*([^|{}[\]\n]*?)\s*\|(?!\|)([\s\S]*)$/);
  if (m && /=|nowrap|align|rowspan|colspan|scope|style|class/i.test(m[1])) {
    return m[2].trim();
  }
  return cell.trim();
}

function firstWikilink(s: string): string | null {
  const m = s.match(/\[\[([^\]]+)\]\]/);
  if (!m) return null;
  const parts = m[1].split("|");
  return parts[parts.length - 1].trim(); // display text
}

// Plain readable text of a cell: prefer a wikilink's display, otherwise strip
// templates/flags/markup. Drivers without a Wikipedia article appear unlinked.
function cellText(s: string): string {
  return stripRefs(s)
    .replace(/\{\{flagicon\|[^}]*\}\}/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function nameOf(cell: string): string | null {
  const c = stripCellAttrs(cell);
  const text = firstWikilink(c) ?? cellText(c);
  return text.length > 0 ? text : null;
}

// Car number, allowing the {{tooltip|9|...}} wrapper Wikipedia uses for #09-style entries.
function parseNum(cell: string): number | null {
  const tip = cell.match(/\{\{tooltip\|(\d+)/i);
  if (tip) return Number(tip[1]);
  return /^\d+$/.test(cell) ? Number(cell) : null;
}

function firstFlag(s: string): string | null {
  const m = s.match(/\{\{flagicon\|([a-z]+)/i);
  return m ? m[1].toUpperCase() : null;
}

function toIso2(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY[code] ?? code; // fall back to raw code (surfaced as a warning)
}

function isNA(s: string): boolean {
  return /\{\{N\/A\}\}/i.test(s);
}

function extractTables(wt: string): string[] {
  const tables: string[] = [];
  let i = 0;
  for (;;) {
    const start = wt.indexOf("{|", i);
    if (start === -1) break;
    const end = wt.indexOf("|}", start);
    if (end === -1) break;
    tables.push(wt.slice(start, end + 2));
    i = end + 2;
  }
  return tables;
}

// --- parsers ---------------------------------------------------------------

function parseEntries(wt: string): Entry[] {
  const table = extractTables(wt).find((t) => /Full season entries/i.test(t));
  if (!table) throw new Error("Could not find the 'Full season entries' table");

  const entries: Entry[] = [];
  let team = "";
  let teamCountry: string | null = null;
  let wildcard = false; // flips at the mid-table "Wildcard entries" header

  for (const block of table.split(/\n\|-/)) {
    if (/Wildcard entries/i.test(block)) {
      wildcard = true;
      continue;
    }

    const cells: string[] = [];
    for (const raw of block.split("\n")) {
      const line = raw.trimEnd();
      if (!line.startsWith("|") || /^\|[-}+]/.test(line) || line.startsWith("||")) {
        continue;
      }
      cells.push(line.slice(1));
    }
    if (!cells.length) continue;
    const clean = cells.map((c) => stripRefs(stripCellAttrs(c)).trim());

    // A row carries a team cell (rowspan) when its first cell is a wikilink
    // rather than a car number.
    let idx = 0;
    if (parseNum(clean[0] ?? "") === null && firstWikilink(cells[0] ?? "")) {
      team = firstWikilink(cells[0]) ?? team;
      teamCountry = toIso2(firstFlag(cells[0]));
      idx = 1;
    }

    const carNumber = parseNum(clean[idx] ?? "");
    if (carNumber === null) continue; // header/caption row, skip

    const driverCell = cells[idx + 1] ?? "";
    const partnerCell = cells[idx + 2] ?? "";
    const driver = nameOf(driverCell);
    if (!driver) continue;

    entries.push({
      team,
      teamCountry,
      carNumber,
      driver,
      driverCountry: toIso2(firstFlag(driverCell)),
      f1Partner: isNA(partnerCell) ? null : nameOf(partnerCell),
      rounds: (clean[idx + 3] ?? "").replace(/\s/g, ""),
      isWildcard: wildcard,
    });
  }
  return entries;
}

function parseCalendar(wt: string): Round[] {
  const at = wt.indexOf("== Calendar ==");
  const region = at === -1 ? wt : wt.slice(at);
  const table = extractTables(region).find(
    (t) => /Feature race/i.test(t) && /Round/i.test(t)
  );
  if (!table) throw new Error("Could not find the calendar table");

  const rounds: Round[] = [];
  for (const block of table.split(/\n\|-/)) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const header = lines.find((l) => /^!\s*\d+\s*$/.test(l));
    if (!header) continue;

    const cells = lines
      .filter((l) => l.startsWith("|") && !/^\|[-}+]/.test(l) && !l.startsWith("||"))
      .map((l) => stripRefs(stripCellAttrs(l.slice(1))).trim());
    if (cells.length < 4) continue;

    const circuitCell = cells[0];
    const raceCells = cells.slice(1, 4); // opening, reverse-grid, feature
    const links = [...circuitCell.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) =>
      m[1].split("|").pop()!.trim()
    );

    rounds.push({
      roundNumber: Number(header.replace(/\D/g, "")),
      country: toIso2(firstFlag(circuitCell)),
      circuit: links[0] ?? circuitCell,
      location: links[1] ?? null,
      dates: raceCells.filter((c) => !isNA(c) && c.length > 0),
      threeRace: !isNA(raceCells[0]),
    });
  }
  return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log(`Fetching ${PAGE} from Wikipedia…`);
  const { text, revid, title } = await fetchWikitext(PAGE);

  const entries = parseEntries(text);
  const rounds = parseCalendar(text);

  const teamMap = new Map<string, string | null>();
  for (const e of entries) if (e.team) teamMap.set(e.team, e.teamCountry);
  const teams = [...teamMap].map(([name, country]) => ({ name, country }));

  const seed = {
    source: {
      page: title,
      revid,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(PAGE)}?oldid=${revid}`,
      license: "CC BY-SA 4.0",
      fetchedAt: new Date().toISOString(),
    },
    season: YEAR,
    teams,
    entries,
    rounds,
  };

  const outDir = path.join(process.cwd(), "db", "seed");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${YEAR}.json`);
  await writeFile(outFile, JSON.stringify(seed, null, 2) + "\n");

  console.log(`\n=== ${title} (rev ${revid}) ===`);
  console.log(`Teams (${teams.length}): ${teams.map((t) => t.name).join(", ")}`);
  console.log(`\nDrivers (${entries.length}):`);
  for (const e of entries) {
    console.log(
      `  #${String(e.carNumber).padStart(2)}  ${e.driver.padEnd(22)} ${
        e.driverCountry ?? "??"
      }  ${e.team.padEnd(18)} ${e.f1Partner ?? "—"}  [${e.rounds}]`
    );
  }
  console.log(`\nRounds (${rounds.length}):`);
  for (const r of rounds) {
    console.log(
      `  R${r.roundNumber}  ${r.circuit.padEnd(30)} ${r.country ?? "??"}  ${r.dates.join(
        ", "
      )}${r.threeRace ? "   [3-race]" : ""}`
    );
  }

  const unmapped = new Set<string>();
  for (const e of entries) {
    for (const c of [e.driverCountry, e.teamCountry])
      if (c && c.length === 3) unmapped.add(c);
  }
  for (const r of rounds) if (r.country && r.country.length === 3) unmapped.add(r.country);
  if (unmapped.size) {
    console.log(`\n⚠ Unmapped country codes (add to COUNTRY map): ${[...unmapped].join(", ")}`);
  }
  console.log(`\nWrote ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
