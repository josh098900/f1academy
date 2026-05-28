# Race Weekend Runbook

What to do, when, for a single race weekend. Follow top-to-bottom; each section is one block of time. The whole loop takes ~10–15 minutes of active admin work spread across three days.

---

## Pre-weekend (Thursday or Friday)

A 2-minute sanity check the day or two before the round. Done once per round.

- Open `/team` while signed in. Does the **driver lineup load with prices**? If yes, the round is fully configured (rounds row + sessions + driver_prices all present). If no, you're missing prerequisites — fix before lock_time.
- On `/team`, the **lock countdown** should show the correct time (default lock_time is 08:00 UTC on the Saturday of the race weekend).
- Confirm the daily cron is alive: in the Vercel dashboard, **Functions → Crons** should show `/api/cron/sync` with a recent successful run from `lhr1`. If it hasn't run in the last 24 hours, investigate before the weekend.

If something's off, fix it now — much easier than under time pressure on Monday.

---

## Saturday: lock + qualifying entry

### Saturday 08:00 UTC (09:00 BST) — automatic lock

Nothing for you to do. At `lock_time`, the team picker becomes read-only for everyone. Players who haven't picked by then don't score for this round.

### Saturday after qualifying — quali entry (~5 minutes)

Quali usually runs early Saturday. As soon as final positions are official (Wikipedia race-weekend page is the easiest source — search "2026 [Country] F1 Academy round"):

1. Open `/admin/results` while signed in as an admin.
2. Select the current **Round** and the **Qualifying** session.
3. For each driver, enter her **finishing position** (P1 = pole). Drivers who didn't set a lap → status `dns`.
4. Save.

That's it for Saturday. You don't need to enter race results — the cron will pick those up on Monday.

> **Why quali matters**: it feeds (a) qualifying fantasy points and (b) the **derived grid** for both races (Race 1 is reverse-top-8 from quali; Race 2 is quali order). Without quali entered before Monday's scoring, the position-delta bonus in both races is 0 for everyone.

---

## Sunday — nothing to do

Race 1 (Saturday) and Race 2 (Sunday) happen. Wikipedia is usually updated within a few hours of each race finishing. You don't need to touch anything.

---

## Monday: scoring (~3 minutes)

The cron runs daily at **07:00 UTC** (08:00 BST). It pulls race results from Wikipedia, applies them, and re-scores the round automatically. So by ~07:01 UTC Monday, scores should be live.

### Verify it ran

Three quick checks:

1. **Vercel Functions → Crons** in the dashboard — should show today's `/api/cron/sync` invocation succeeded.
2. Open `/leaderboard` while signed in. Your team should now have round_points for this round and a new cumulative total.
3. Open `/team` (or click your team's drivers on `/drivers`) — per-round form should show this round with sensible points.

If all three look right, you're done.

### If the cron didn't run or failed

Trigger it manually from your terminal:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://f1academy-mu.vercel.app/api/cron/sync
```

Healthy response: `HTTP/2 200` with body `{"ok":true,"synced":[{"round":N,"applied":M,"scored":K}]}`.
- `synced: []` means there was nothing to apply — either no new Wikipedia data, or the round was already scored.
- An error response (4xx/5xx) needs investigating before retrying.

---

## Fallback: if Wikipedia hasn't updated yet

Rare but happens. If by Monday morning the championship table on the season Wikipedia page still doesn't have the new round's column:

1. Either wait a few hours and re-trigger the cron later.
2. Or manually enter race results via `/admin/results` for **Race 1** and **Race 2**: each driver's finish position, fastest-lap flag (if she set it), and status (`classified` / `dnf` / `dsq` / `dns`). Then click **Score Round** on `/admin/score`. Same data the cron would have written, just entered by hand.

---

## Sanity checks before walking away

Take 30 seconds Monday afternoon:

- `/leaderboard` — rank order looks plausible (no one with absurdly high/low points)?
- `/drivers/[anyone]` — the new round's row shows up in her form with reasonable points?
- Open the Coach card on `/dashboard` (if opted in) — recap mentions this round's drivers and points?
- Sentry inbox empty (no errors during cron or scoring)?

If everything reads sensibly, the round is closed. Move on with your week.

---

## What to update in this runbook

Each weekend you learn something new — odd Wikipedia structure, a driver name that didn't resolve, a cron flake. Update this file with what you'd want future-you to know. Keep it short; the value is in *what to do*, not in narrative.
