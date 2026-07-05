# Code Review: Phase 2 (Transfers & Wildcard Chip)

This code review analyzes the implementation of the phase-2 features: budget/squad validation, transfers, wildcard chips, countdowns, and UI responsiveness.

---

## Summary of Findings

| Priority | Category | Component / File | Description |
| :--- | :--- | :--- | :--- |
| 🔴 **High** | Security / Integrity | `app/(app)/team/actions.ts` | **Critical Wildcard Bypass:** `saveTeam` does not call `resolveWildcard` and lacks check for current round's wildcard state, allowing users to undo a saved wildcard and reuse it later. |
| 🟡 **Medium** | Test Coverage | `tests/team-rules.test.ts` | **Testing Gap:** `resolveWildcard` has zero test coverage in the unit test suite. |
| 🟡 **Medium** | UX / Consistency | `components/team/TeamPicker.tsx` | **Sticky Wildcard Bypass in UI:** Users can toggle off a wildcard in the picker even if it has already been saved for the round. |
| 🔵 **Low** | Performance | `components/team/LockCountdown.tsx` | **Unnecessary CPU usage:** The `setInterval` keeps ticking every second even after the lock time has expired. |
| 🔵 **Low** | Accessibility (a11y) | `components/team/DriverCard.tsx` | **Keyboard Navigation:** Card uses `role="button"` but lacks `tabIndex` and `onKeyDown` handlers. Adding them requires target-filtering to prevent conflict with the inner boost button. |
| 🔵 **Low** | Design System | `components/team/...` | **Visual Drift:** Missing the hover accent flash and incorrect font-size in `DriverCard`, and missing the pulse animation in `BudgetBar`. |

---

## Detailed Analysis & Recommended Fixes

### 1. Critical Wildcard Integrity Bypass
> [!WARNING]
> The database schema enforces that a wildcard is once per season and sticky once saved. However, the server action `saveTeam` does not enforce the sticky rule or check for an existing wildcard on the current round.

#### The Problem
In [actions.ts](file:///Users/josh/Development/Projects/f1academy/app/%28app%29/team/actions.ts#L42-L56), we save the team as:
```typescript
  const ctx = await getTransferContext(supabase, user.id, round);
  if (wildcard && ctx.wildcardUsedInPriorRound) {
    return { ok: false, error: "You've already used your wildcard this season." };
  }
  const transfers = countTransfers(ctx.baseline, driverIds);

  const { error } = await supabase.from("user_teams").upsert({
    user_id: user.id,
    round_id: round.id,
    driver_ids: driverIds,
    boost_driver_id: boostDriverId,
    transfers_used: transfers,
    wildcard_used: wildcard, // user can submit false
  });
```
If a user already saved their team with `wildcard_used = true`, they can submit a subsequent request with `wildcard: false`. Because `saveTeam` does not call the pure `resolveWildcard` helper function from [team-rules.ts](file:///Users/josh/Development/Projects/f1academy/lib/team-rules.ts#L79), it will successfully update `wildcard_used` to `false` in the database, allowing them to restore and reuse their wildcard chip.

#### The Solution
Query the current round's team using `getUserTeam` and invoke the pure helper `resolveWildcard` to determine the resolved wildcard state.

```diff
-  const ctx = await getTransferContext(supabase, user.id, round);
-  if (wildcard && ctx.wildcardUsedInPriorRound) {
-    return { ok: false, error: "You've already used your wildcard this season." };
-  }
-  const transfers = countTransfers(ctx.baseline, driverIds);
+  const [ctx, savedTeam] = await Promise.all([
+    getTransferContext(supabase, user.id, round),
+    getUserTeam(supabase, user.id, round.id),
+  ]);
+
+  const resolved = resolveWildcard({
+    requested: wildcard,
+    existingThisRound: savedTeam?.wildcardUsed ?? false,
+    usedInPriorRound: ctx.wildcardUsedInPriorRound,
+  });
+
+  if (resolved.error) {
+    return { ok: false, error: resolved.error };
+  }
+
+  const finalWildcard = resolved.wildcard;
+  const transfers = countTransfers(ctx.baseline, driverIds);
```

---

### 2. Sticky Wildcard UI Prevention
> [!NOTE]
> If a wildcard was saved on this round, it stays used. The UI should reflect this sticky state.

#### The Problem
In [TeamPicker.tsx](file:///Users/josh/Development/Projects/f1academy/components/team/TeamPicker.tsx#L218-L227), when `wildcard` is active, clicking the button turns it off:
```tsx
    if (wildcard) {
      return (
        <button
          type="button"
          onClick={() => setWildcard(false)}
          className="..."
        >
          Wildcard on ✓
        </button>
      );
    }
```
If `saved.wildcard` (representing the already-persisted DB state) is `true`, we should prevent turning it off.

#### The Solution
Modify the chip render logic to display a non-clickable `span` if it is sticky:
```diff
     if (wildcard) {
+      if (saved.wildcard) {
+        return (
+          <span className="rounded-full border border-accent bg-accent px-3 py-1 font-mono text-[10px] tracking-wider text-inverse uppercase">
+            Wildcard active ✓
+          </span>
+        );
+      }
       return (
         <button
           type="button"
           onClick={() => setWildcard(false)}
           className="..."
         >
           Wildcard on ✓
         </button>
       );
     }
```

---

### 3. Missing Unit Tests for `resolveWildcard`
> [!IMPORTANT]
> A critical rule resolution function must have comprehensive unit tests in [team-rules.test.ts](file:///Users/josh/Development/Projects/f1academy/tests/team-rules.test.ts).

#### The Solution
Add a test suite for `resolveWildcard` to verify all logical paths:

```typescript
describe("resolveWildcard", () => {
  it("forces wildcard to true if already existing in the current round", () => {
    const res = resolveWildcard({
      requested: false,
      existingThisRound: true,
      usedInPriorRound: false,
    });
    expect(res.wildcard).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("permits wildcard activation if not used previously", () => {
    const res = resolveWildcard({
      requested: true,
      existingThisRound: false,
      usedInPriorRound: false,
    });
    expect(res.wildcard).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("blocks wildcard activation if already used in a prior round", () => {
    const res = resolveWildcard({
      requested: true,
      existingThisRound: false,
      usedInPriorRound: true,
    });
    expect(res.wildcard).toBe(false);
    expect(res.error).toBe("You've already used your wildcard this season.");
  });

  it("resolves to false if not requested and not existing", () => {
    const res = resolveWildcard({
      requested: false,
      existingThisRound: false,
      usedInPriorRound: false,
    });
    expect(res.wildcard).toBe(false);
    expect(res.error).toBeUndefined();
  });
});
```

---

### 4. Lock Countdown Performance Leak
> [!TIP]
> Clearing timers as soon as they are no longer needed is a best practice to avoid unnecessary background execution cycles.

#### The Problem
In [LockCountdown.tsx](file:///Users/josh/Development/Projects/f1academy/components/team/LockCountdown.tsx#L21-L29), the interval continues to run every second after the target time has passed, calling `setNow(Date.now())` and triggering client-side renders indefinitely.

```typescript
  useEffect(() => {
    const update = () => setNow(Date.now());
    const raf = requestAnimationFrame(update);
    const id = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);
```

#### The Solution
Stop the interval once the target time is reached:
```diff
   useEffect(() => {
-    const update = () => setNow(Date.now());
-    const raf = requestAnimationFrame(update);
-    const id = setInterval(update, 1000);
-    return () => {
-      cancelAnimationFrame(raf);
-      clearInterval(id);
-    };
-  }, []);
+    let id: NodeJS.Timeout;
+    const update = () => {
+      const time = Date.now();
+      setNow(time);
+      if (time >= target && id) {
+        clearInterval(id);
+      }
+    };
+    const raf = requestAnimationFrame(update);
+    id = setInterval(update, 1000);
+    return () => {
+      cancelAnimationFrame(raf);
+      clearInterval(id);
+    };
+  }, [target]);
```

---

### 5. Accessibility & Keyboard Navigation on Driver Cards
> [!IMPORTANT]
> Interactive semantic elements should always be focusable and triggerable via keyboard.

#### The Problem
In [DriverCard.tsx](file:///Users/josh/Development/Projects/f1academy/components/team/DriverCard.tsx#L29-L41), when the card is interactive, it acts as a button but:
- It does not have a `tabIndex`.
- It does not listen to `keydown` for Space/Enter keys.
- If we add a keyboard listener, keyboard events like Space pressed on the inner `2×` boost button would bubble up to the card, toggling selection state and causing conflicts.

#### The Solution
Add `tabIndex` and an `onKeyDown` handler. Ensure `e.target === e.currentTarget` to prevent child button events from triggering the parent card toggle:

```diff
     <article
       data-selected={selected}
       role={interactive ? "button" : undefined}
       aria-pressed={interactive ? selected : undefined}
+      tabIndex={interactive && !disabled ? 0 : undefined}
+      onKeyDown={(e) => {
+        if (!interactive || disabled) return;
+        if (e.target !== e.currentTarget) return;
+        if (e.key === "Enter" || e.key === " ") {
+          e.preventDefault();
+          onToggle?.();
+        }
+      }}
       onClick={interactive && !disabled ? onToggle : undefined}
```

---

### 6. Alignment with Design System
> [!IMPORTANT]
> To prevent "generic AI-crafted drift", visual design guidelines defined in `DESIGN_SYSTEM.md` must be followed exactly.

#### The Problem
- **Hover accent flash**: [DESIGN_SYSTEM.md](file:///Users/josh/Development/Projects/f1academy/docs/files/DESIGN_SYSTEM.md#L331-L335) specifies a subtle accent flash on left edge of `DriverCard` on hover, but it is missing from [DriverCard.tsx](file:///Users/josh/Development/Projects/f1academy/components/team/DriverCard.tsx).
- **Number size**: The design system defines driver numbers as `text-[72px]`, but `DriverCard.tsx` uses `text-[56px]`.
- **Budget bar over cap state**: The design system specifies that the budget bar "pulses red briefly when over cap (CSS keyframes)", but `BudgetBar.tsx` only changes the color.

#### The Solution
- Add the absolute hover highlight bar to the left edge of `DriverCard.tsx`.
- Adjust font-size to `text-[72px]` (or close to it, depending on grid spacing).
- Add pulse animations when `over` is true in `BudgetBar.tsx`.
