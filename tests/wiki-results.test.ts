import { describe, expect, it } from "vitest";

import { resultsForRound } from "../lib/wiki/results";

// A trimmed championship matrix: round 1 (Shanghai, 2 races) + round 2
// (Montreal, 3 races), with a linked and an unlinked driver, a fastest lap,
// and a retirement.
const MATRIX = `===Drivers' championship===
{|
| style="vertical-align:top; text-align:center" |
{| class="wikitable" style="font-size: 85%;"
! rowspan="2" |Pos.
! rowspan="2" |Driver
! colspan="2" |[[Shanghai International Circuit|SHA]]<br>{{flagicon|CHN}}
! colspan="3" |[[Circuit Gilles Villeneuve|MTL]]<br>{{flagicon|CAN}}
! rowspan="2" |Points
|-
!R1
!R2
!R1
!R2
!R3
|-
! 1
| style="text-align:left" | {{flagicon|GBR}} [[Alisha Palmowski]]
| style="background:#DFFFDF" | 5
| style="background:#DFDFDF" | {{F1 race position|2|p|f}}
| style="background:#FFFFBF" | {{F1 race position|1|p|f}}
| style="background:#CFCFFF" | 10
| style="background:#FFFFBF" | {{F1 race position|1|p}}
! 78
|-
! 2
| style="text-align:left" | {{flagicon|ESP}} Natalia Granada
| 2
| 14
| style="background:#EFCFFF" | Ret
| 4
| 8
! 20
|-
|}
|}`;

describe("resultsForRound", () => {
  it("parses round 1 (2-race) with fastest lap", () => {
    const r1 = resultsForRound(MATRIX, 1);
    const palmowski = r1.find((d) => d.driver === "Alisha Palmowski");
    expect(palmowski?.races.race1).toEqual({
      position: 5,
      fastestLap: false,
      status: "classified",
    });
    expect(palmowski?.races.race2).toEqual({
      position: 2,
      fastestLap: true,
      status: "classified",
    });
    expect(palmowski?.races.race3).toBeUndefined();
  });

  it("parses an unlinked driver and a retirement in round 2 (3-race)", () => {
    const r2 = resultsForRound(MATRIX, 2);
    const granada = r2.find((d) => d.driver === "Natalia Granada");
    expect(granada).toBeDefined();
    expect(granada?.races.race1).toEqual({
      position: null,
      fastestLap: false,
      status: "dnf",
    });
    expect(granada?.races.race2?.position).toBe(4);
    expect(granada?.races.race3?.position).toBe(8);
  });

  it("only returns drivers with results that round", () => {
    // Both drivers have round-1 and round-2 data here.
    expect(resultsForRound(MATRIX, 1)).toHaveLength(2);
    expect(resultsForRound(MATRIX, 2)).toHaveLength(2);
  });
});
