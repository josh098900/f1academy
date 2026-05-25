# Scoring System

> The heart of the product. Calibrate this carefully — get it wrong and the game isn't fun.

## Design principles

1. **Reward consistency, not just wins.** A driver who finishes 4th–4th–5th over three rounds should outscore one who wins once then DNFs twice.
2. **Reward bold picks.** Picking a lower-priced driver who outperforms expectations gives a points bonus (the "value" mechanic).
3. **Make every session count.** Qualifying matters (not just race finishes).
4. **Keep the maths intuitive.** A user should be able to estimate their score watching the race, not need a spreadsheet.
5. **Scale matches F1 Academy's structure.** Each race weekend = Qualifying + Race 1 + Race 2. Don't over-fit to F1's single-race format.

## Race weekend structure (F1 Academy)

| Session | Day | What we score |
|---|---|---|
| Free Practice | Friday | Nothing (not competitive) |
| Qualifying | Friday/Saturday | Position-based points |
| Race 1 | Saturday | Position + Fastest Lap + Positions Gained |
| Race 2 | Sunday | Position + Fastest Lap + Positions Gained |

## Points per driver, per round

### Qualifying
| Position | Points |
|---|---|
| Pole (P1) | 10 |
| P2 | 8 |
| P3 | 6 |
| P4 | 5 |
| P5 | 4 |
| P6 | 3 |
| P7–P10 | 2 |
| P11–P15 | 1 |
| P16+ | 0 |

### Race 1 & Race 2 (each)
| Position | Points |
|---|---|
| P1 | 25 |
| P2 | 18 |
| P3 | 15 |
| P4 | 12 |
| P5 | 10 |
| P6 | 8 |
| P7 | 6 |
| P8 | 4 |
| P9 | 2 |
| P10 | 1 |
| P11–P15 | 0 |
| P16+ | -2 (penalty for back-of-grid finishes — reflects driver pricing) |
| DNF | -5 (race-ending crash or mechanical) |
| DSQ | -10 (disqualification) |

### Bonuses (per race)
- **Fastest Lap:** +5 (must finish in top 10 to qualify)
- **Positions Gained:** +1 per place gained from grid position (e.g. start P10 → finish P5 = +5)
- **Positions Lost:** -1 per place lost (cap at -5 to avoid hammering DNFs twice)

### Multi-round bonuses
- **Podium streak:** any driver achieves consecutive race podiums (across Race 1 → Race 2 same weekend, or Race 2 of round N → Race 1 of round N+1) — +3 bonus to that driver's owners
- **Pole + Win:** +5 if same driver took Pole and won Race 1 the same weekend

## Boost mechanic
- The user designates **one driver** in their team as their "Boost"
- That driver's total weekend points are **multiplied by 2** before being added to the user's score
- Boost can be changed every round (free)
- Boost change requires having that driver in your team at the lock time

## Worked example (Round 2, Montreal 2026 — fictional results)

Imagine a user picks: **Felbermayr (Boost), Palmowski, Gademan, Ferreira**

| Driver | Quali | Race 1 | Race 2 | Bonuses | Total | × Boost |
|---|---|---|---|---|---|---|
| Felbermayr | P1: 10 | Win: 25, FL: 5, +0 OT | P2: 18, +1 OT | Pole+Win: 5, Podium streak: 3 | **67** | **134** |
| Palmowski | P2: 8 | P3: 15, +0 OT | P1: 25, FL: 5, +1 OT | Podium streak: 3 | **57** | 57 |
| Gademan | P3: 6 | P4: 12, +0 OT | P3: 15, +0 OT | — | **33** | 33 |
| Ferreira | P6: 3 | P7: 6, +1 OT | DNF: -5 | — | **5** | 5 |

**Round score: 134 + 57 + 33 + 5 = 229 points**

Felbermayr scored podiums in both races (P1 then P2), so she gets the podium-streak bonus too. The boost mechanic alone added 67 points (doubling her 67). Picking a "value" driver like Ferreira who DNF'd hurt — but if she'd finished P4, you'd have 50+ points instead of 5. That's the trade-off being engineered.

## Driver pricing

Prices range **£4M to £15M**, calibrated by:
- 60% — points-per-round average across last 3 rounds
- 30% — points-per-round average across last full season
- 10% — qualitative adjustments (team change, Wild Card status, etc.)

Prices are **static within a round** (no in-round price changes for v1). They re-calibrate **between rounds**.

Starting prices for the 2026 season are seeded manually based on 2025 finishing positions plus any major team moves. See `data/seed-prices-2026.json` (to be created in implementation).

Budget cap is **£40M** for 4 drivers + 1 boost designation = effectively the same 4 driver picks. Average driver price = £10M; budget cap forces trade-offs (can't pick the top 4 drivers).

## Penalties for "transfer abuse"

- Free transfer count: **1 per round**
- Each additional transfer: **-10 points** deducted from that round's score
- Wildcard chip: **1 per season**, resets the team with no transfer penalty
- Transfers lock when Qualifying starts; no transfers during a race weekend

## How a round is scored, technically

1. Admin marks the round as "complete" in admin panel
2. Scoring engine runs (`POST /api/admin/score-round`)
3. For each user team locked at the start of Qualifying:
   - Calculate each driver's weekend points using the rules above
   - Apply the boost multiplier
   - Subtract transfer penalty if any
   - Sum to round score
   - Add to season cumulative
4. Update leaderboards (global + each mini-league the user is in)
5. Generate Claude Coach post-race recap (one Anthropic API call per user)
6. Send notification (email v1, push later) — "Your Round X score: Y points"

Scoring must be **deterministic and re-runnable**. Same inputs = same outputs. If we discover a results error, we can rerun and update — but log every rerun for audit.

## Edge cases to handle

| Case | Behaviour |
|---|---|
| Driver doesn't race (skipped round) | Scores 0; user still locked in to that pick for the weekend |
| Wild Card driver appears in a round | Available to pick at a default £5M price; standard scoring |
| Driver is replaced mid-weekend (e.g. injury) | Original pick scores 0 for sessions they missed; replacement is not auto-substituted |
| Race red-flagged / shortened | Standard FIA-style 50% / 75% points scaling if officially declared |
| Race cancelled outright | Zero points for that race; weekend score uses remaining sessions only |
| Penalty applied post-race | Re-run scoring; users see "updated" badge with explainer |

## Tuning notes (for post-v1)

- After 2 rounds of live play, look at the distribution of scores. Goal: top 1% score ~40% more than median user. If gap is wider, the game is too punishing on casual users. If narrower, picks don't feel meaningful.
- Watch how often the boost driver swings the round. Goal: boost choice should explain ~30% of variance in user scores.
- If "value picks" (drivers <£7M) almost never pay off, raise floor prices or boost their points per position.
