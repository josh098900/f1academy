# Code Review: Phase 3 (Admin Area & Scoring Engine)

This code review analyzes the implementation of the phase-3 features: administrative results entry, deterministic scoring engine, streak calculations, and the `scoreRound` orchestration action.

---

## Summary of Findings

| Priority | Category | Component / File | Description |
| :--- | :--- | :--- | :--- |
| 🔴 **High** | Data Integrity | `app/admin/score/actions.ts` | **Critical Typo / Case Mismatch:** `saveRound` saves `s.transfer_penalty` instead of `s.transferPenalty`. Since `s.transfer_penalty` is undefined, transfer penalties are silently saved as `0`/`null` in the DB. |
| 🔴 **High** | Architecture | `app/admin/score/actions.ts` | **Stale Cumulative Scores:** `cumulative_points` is computed on-the-fly and stored in a static round record. Re-scoring an earlier round will result in subsequent rounds having stale, out-of-date cumulative totals. |
| 🟡 **Medium** | Input Gaps | `components/admin/ResultsForm.tsx` | **Duplicate Position Entries:** The results entry form lacks validation for duplicate/conflicting grid or finishing positions (e.g., entering two P1s), causing corrupted scoring output. |
| 🔵 **Low** | Robustness | `components/admin/ResultsForm.tsx` | **State Fallback:** Lacks fallback for undefined row states in the entrants loop, risking runtime crashes ifentrant arrays change. |
| 🔵 **Low** | Clean Code | `scripts/r3-test.ts` | **Untracked File:** Fictional test harness script left in workspace root, needs `.gitignore` exclusion or removal. |

---

## Detailed Analysis & Recommended Fixes

### 1. Critical Silent Bug: Transfer Penalty Typo
> [!WARNING]
> A case mismatch between typescript types and Supabase column names causes the transfer penalty column to always record `0` or `null` in the database, while the total points correctly subtract the penalty.

#### The Problem
In [round.ts](file:///Users/josh/Development/Projects/f1academy/lib/scoring/round.ts#L15-L20), the returned score structure is:
```typescript
export type UserRoundScore = {
  roundPoints: number;
  boostPointsAdded: number;
  transferPenalty: number; // camelCase
  breakdown: { drivers: DriverBreakdown[]; transferPenalty: number };
};
```
However, in [actions.ts](file:///Users/josh/Development/Projects/f1academy/app/admin/score/actions.ts#L189), the database insert values are mapped as:
```typescript
    return {
      user_id: t.user_id,
      round_id: roundId,
      round_points: s.roundPoints,
      boost_points_added: s.boostPointsAdded,
      transfer_penalty: s.transfer_penalty, // s.transfer_penalty is undefined!
      cumulative_points: (prior.get(t.user_id) ?? 0) + s.roundPoints,
      breakdown: s.breakdown as Json,
    };
```
Because the Supabase TS type generator generates `transfer_penalty` as optional (`transfer_penalty?: number`), TypeScript permits passing `undefined` without throwing a compiler error. Supabase then falls back to the database default of `0`.

#### The Solution
Correct the property name to `s.transferPenalty`:
```diff
     return {
       user_id: t.user_id,
       round_id: roundId,
       round_points: s.roundPoints,
       boost_points_added: s.boostPointsAdded,
-      transfer_penalty: s.transfer_penalty,
+      transfer_penalty: s.transferPenalty,
       cumulative_points: (prior.get(t.user_id) ?? 0) + s.roundPoints,
       breakdown: s.breakdown as Json,
     };
```

---

### 2. Architectural Cumulative Scores Sync Issue
> [!IMPORTANT]
> Storing cumulative scores inside round-level user scores violates clean storage principles, making historical scoring corrections hard to manage.

#### The Problem
When the admin runs `scoreRound` for round $N$, it calculates `cumulative_points` as the sum of prior rounds + current round points.
If the admin corrects a results error in round $N-1$ and re-scores it, the cumulative points for $N-1$ update correctly. However, the pre-existing row for round $N$ is **not** recalculated, meaning round $N$'s `cumulative_points` becomes stale and incorrect.

#### The Solution
Choose one of the following architectural approaches:
1. **Dynamic Cumulative Calculation:** Do not store `cumulative_points` in the database. Instead, calculate cumulative scores dynamically in SQL using a window function:
   ```sql
   SELECT 
     user_id, 
     round_id, 
     round_points,
     SUM(round_points) OVER (
       PARTITION BY user_id 
       ORDER BY round_number
     ) AS cumulative_points
   FROM user_scores
   JOIN rounds ON user_scores.round_id = rounds.id;
   ```
2. **Cascading Updates:** If database-level cumulative storage is required for indexing/performance, scoring a round must trigger a cascade that recalculates scores for all subsequent rounds in that season.
3. **Locking Constraints:** Prevent re-scoring of past rounds once a subsequent round has already been completed, forcing manual migrations for historical edits.

---

### 3. Missing Grid and Finish Position Validation
> [!WARNING]
> Entering duplicate positions (e.g. two drivers starting P1 or finishing P1) is accepted by both the UI and the backend database, leading to incorrect scoring outcomes.

#### The Problem
In [ResultsForm.tsx](file:///Users/josh/Development/Projects/f1academy/components/admin/ResultsForm.tsx#L86-L100), inputs are mapped straight to values:
```typescript
      const results = entrants.map((e) => {
        const row = rows[e.driverId];
        return {
          driverId: e.driverId,
          position: row.position ? Number(row.position) : null,
          gridPosition: isQuali || !row.grid ? null : Number(row.grid),
          status: row.status,
          fastestLap: row.fastestLap,
        };
      });
```
If two entrants are saved with `position: 1`, they both earn 25 finishing points and can trigger Pole/Win bonuses.

#### The Solution
Add validation in the `ResultsForm` component before saving. Display an error message if:
- Any two classified drivers share the same finishing position.
- Any two drivers share the same starting grid position.
- Any position values are outside the range of $1$ to $N$ (number of entrants).

Example validation code:
```typescript
  function validateResults() {
    const finishPositions = new Set<number>();
    const gridPositions = new Set<number>();
    
    for (const e of entrants) {
      const row = rows[e.driverId];
      if (row.status === "classified") {
        if (!row.position) return "All classified drivers must have a finishing position.";
        const pos = Number(row.position);
        if (pos < 1 || pos > entrants.length) return `Position ${pos} is out of bounds.`;
        if (finishPositions.has(pos)) return `Duplicate finishing position: P${pos}.`;
        finishPositions.add(pos);
      }
      
      if (!isQuali && row.grid) {
        const grid = Number(row.grid);
        if (grid < 1 || grid > entrants.length) return `Grid position ${grid} is out of bounds.`;
        if (gridPositions.has(grid)) return `Duplicate grid position: P${grid}.`;
        gridPositions.add(grid);
      }
    }
    return null;
  }
```

---

### 4. Entrant State Fallback Defensive Code
> [!TIP]
> A robust component should never throw runtime errors due to missing items in a state map.

#### The Problem
In `ResultsForm.tsx` line 116, the loop fetches the state row:
```typescript
          {entrants.map((e) => {
            const row = rows[e.driverId];
            return (
              <tr key={e.driverId} className="...">
                {/* row.position throws if row is undefined */}
                <input value={row.position} ... />
```
If `entrants` changes asynchronously due to a database hotfix or background query refresh without changing the session ID key, `rows[e.driverId]` will be `undefined`, throwing a `TypeError`.

#### The Solution
Add a fallback empty row state object:
```typescript
          {entrants.map((e) => {
            const row = rows[e.driverId] || {
              position: "",
              grid: "",
              status: "classified",
              fastestLap: false
            };
```
