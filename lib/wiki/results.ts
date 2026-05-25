// Parse the "Drivers' championship" results matrix from a Wikipedia F1 Academy
// season page. Source: Wikipedia (CC BY-SA 4.0). We never fetch f1academy.com.
//
// The matrix gives race FINISHING positions + fastest lap + status. It does NOT
// contain qualifying or grid positions — those are entered manually and grids
// are derived (see lib/wiki/grid.ts).

export type RaceStatus = "classified" | "dnf" | "dsq" | "dns";
export type RaceType = "race1" | "race2" | "race3";

export type RaceResult = {
  position: number | null;
  fastestLap: boolean;
  status: RaceStatus;
};

export type RoundRaces = Partial<Record<RaceType, RaceResult>>;

export type DriverChampionship = {
  driver: string;
  byRound: Map<number, RoundRaces>;
};

// Strip a leading "attr |" prefix from a wikitable cell (style/background/etc.).
function stripCellAttrs(cell: string): string {
  const m = cell.match(/^\s*([^|{}[\]\n]*?)\s*\|(?!\|)([\s\S]*)$/);
  if (m && /=|style|background|align|nowrap|colspan|rowspan|scope/i.test(m[1])) {
    return m[2].trim();
  }
  return cell.trim();
}

function firstWikilink(s: string): string | null {
  const m = s.match(/\[\[([^\]]+)\]\]/);
  if (!m) return null;
  const parts = m[1].split("|");
  return parts[parts.length - 1].trim();
}

// Driver name from a cell — a wikilink's display, else plain text (drivers
// without a Wikipedia article appear unlinked).
function nameOf(cell: string): string | null {
  const inner = stripCellAttrs(cell);
  const link = firstWikilink(inner);
  if (link) return link;
  const text = inner
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .trim();
  return text || null;
}

// Parse one race cell into a result, or null for an empty (not-yet-run) cell.
function parseCell(raw: string): RaceResult | null {
  const content = stripCellAttrs(raw);
  if (!content) return null;

  let value = content;
  let flags: string[] = [];
  const tpl = content.match(/\{\{\s*F1 race position\s*\|([^}]+)\}\}/i);
  if (tpl) {
    const parts = tpl[1].split("|").map((s) => s.trim());
    value = parts[0];
    flags = parts.slice(1);
  } else {
    value = content
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/'{2,}/g, "")
      .trim();
  }
  if (!value) return null;

  const fastestLap = flags.includes("f");
  if (/^\d+$/.test(value)) {
    return { position: Number(value), fastestLap, status: "classified" };
  }
  const v = value.toUpperCase();
  if (v.includes("RET")) return { position: null, fastestLap, status: "dnf" };
  if (v.includes("DSQ")) return { position: null, fastestLap, status: "dsq" };
  if (/DNS|DNQ|WD/.test(v)) return { position: null, fastestLap, status: "dns" };
  return null;
}

// Pull the first `class="wikitable"` table out of the section wikitext,
// matching its closing |} at the same nesting level.
function firstWikitable(wikitext: string): string | null {
  const start = wikitext.indexOf('{| class="wikitable"');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "|") depth++;
    else if (wikitext[i] === "|" && wikitext[i + 1] === "}") {
      depth--;
      if (depth === 0) return wikitext.slice(start, i + 2);
    }
  }
  return null;
}

type Column = { round: number; raceType: RaceType };

// Header maps round-abbreviation columns (colspan = race count) to rounds in
// order; each round's races become race1..raceN.
function parseColumns(table: string): Column[] {
  const columns: Column[] = [];
  const types: RaceType[] = ["race1", "race2", "race3"];
  let round = 0;
  for (const line of table.split("\n")) {
    const m = line.match(/^!\s*colspan="?(\d+)"?\s*\|.*\[\[/);
    if (!m) continue;
    round += 1;
    for (let i = 0; i < Number(m[1]); i++) {
      columns.push({ round, raceType: types[i] });
    }
  }
  return columns;
}

export function parseChampionship(sectionWikitext: string): DriverChampionship[] {
  const table = firstWikitable(sectionWikitext);
  if (!table) throw new Error("Could not find the championship matrix table");
  const columns = parseColumns(table);

  const drivers: DriverChampionship[] = [];
  for (const block of table.split(/\n\|-/)) {
    // Data cells are `|` lines; Pos and Points are `!` header cells.
    const cells: string[] = [];
    for (const raw of block.split("\n")) {
      const line = raw.trimEnd();
      if (!line.startsWith("|") || /^\|[-}+]/.test(line) || line.startsWith("||")) {
        continue;
      }
      cells.push(line.slice(1));
    }
    if (cells.length === 0) continue;
    if (!/\{\{flagicon/i.test(cells[0])) continue; // driver rows carry a flag

    const driver = nameOf(cells[0]);
    if (!driver) continue; // header/legend row

    const raceCells = cells.slice(1);
    const byRound = new Map<number, RoundRaces>();
    columns.forEach((col, i) => {
      const result = parseCell(raceCells[i] ?? "");
      if (!result) return;
      const r = byRound.get(col.round) ?? {};
      r[col.raceType] = result;
      byRound.set(col.round, r);
    });
    drivers.push({ driver, byRound });
  }

  return drivers;
}

// Results for a single round, by driver — only drivers with results that round.
export function resultsForRound(
  sectionWikitext: string,
  roundNumber: number
): { driver: string; races: RoundRaces }[] {
  return parseChampionship(sectionWikitext)
    .map((d) => ({ driver: d.driver, races: d.byRound.get(roundNumber) ?? {} }))
    .filter((d) => Object.keys(d.races).length > 0);
}
