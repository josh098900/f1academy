# Data Pipeline

> How race results, driver info, and calendar data get into the system without scraping `f1academy.com`. This is the operationally hardest part of the project — the rest is a normal web app.

## The three data tiers

| Tier | Frequency | Source | Confidence |
|---|---|---|---|
| **Static** (drivers, teams, calendar) | Once per season + small mid-season updates | Wikipedia + Wikidata + manual | High |
| **Pricing** | Once per round | Computed from prior results | Internal |
| **Results** (the hard part) | Once per round (immediately post-race) | Manual admin entry + Wikipedia verification | Manual at first, automation later |

## Tier 1: Static data — drivers, teams, calendar

### Source order
1. **Wikidata** (CC0) — first port of call. Structured. Query via SPARQL.
2. **Wikipedia** (CC BY-SA 4.0) — narrative + missing fields not in Wikidata.
3. **Manual entry** — fallback for missing/incorrect data.

### Wikidata SPARQL example — F1 Academy drivers

Endpoint: `https://query.wikidata.org/sparql`

```sparql
SELECT ?driver ?driverLabel ?dob ?countryLabel ?wpUrl WHERE {
  ?driver wdt:P641 wd:Q124069437.   # sport = F1 Academy
  OPTIONAL { ?driver wdt:P569 ?dob. }
  OPTIONAL { ?driver wdt:P27 ?country. }
  OPTIONAL {
    ?wpUrl schema:about ?driver;
           schema:isPartOf <https://en.wikipedia.org/>.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

(Note: the Wikidata QID for "F1 Academy" — `Q124069437` — should be verified at implementation time; it may have changed.)

### Wikipedia API example — season page

Endpoint: `https://en.wikipedia.org/w/api.php`

```
?action=parse
&page=2026_F1_Academy_season
&prop=wikitext|sections
&format=json
&formatversion=2
```

This returns the wikitext for the season page. The `Full season entries` table contains team/driver/F1-partner data in a known infobox format. We parse it once per season and refresh weekly during the season for any roster changes.

### Implementation

A script `scripts/wiki-sync.ts` (Node + TypeScript) that:

1. Queries Wikidata for the current season's drivers
2. For each driver, fetches the Wikipedia article for missing fields
3. Diffs against our DB
4. Logs changes for admin review (does not auto-apply — every change requires admin approval to prevent vandalism propagation)

Run cadence: **weekly during season**, manual trigger between rounds.

## Tier 2: Pricing (computed internally)

No external data. Pure function over historical results.

```ts
function priceForRound(driverId: number, roundId: number): number {
  const last3 = avgPointsPerRound(driverId, last3Rounds);
  const lastSeason = avgPointsPerRound(driverId, lastFullSeason);
  
  let basePrice = 4 + (last3 * 0.6 + lastSeason * 0.3) * scalingFactor;
  
  // Adjustments
  if (isNewSignedDriver(driverId)) basePrice += 0.5;
  if (isWildcard(driverId, roundId)) basePrice = 5.0; // flat
  
  return clamp(basePrice, 4.0, 15.0);
}
```

Runs via `scripts/price-recalibrate.ts` between rounds. Writes to `driver_prices` table.

Seed prices for Round 1 of a season come from manual judgement based on prior-season finishing position. After Round 1, the formula takes over.

## Tier 3: Results (the hard part)

### v1 approach — manual admin entry

After each race weekend, an admin (Josh, for now) enters results via the admin panel:

1. Open `/admin/results`
2. Select the round and session (Qualifying / Race 1 / Race 2)
3. Drag-and-drop drivers into finishing order, or type position numbers
4. Mark DNF / DSQ / DNS where applicable
5. Tick "Fastest Lap" for the relevant driver
6. Submit → data lands in `session_results` with `data_source = 'manual_admin'`

UX target: **enter a full session in under 60 seconds.**

Then:
7. Go to `/admin/score` for that round
8. Click "Run Scoring" → backend computes all user scores
9. Review for sanity, then publish → scores go live, notifications send

### v1.5 — Wikipedia verification helper

Once results are entered manually, a helper UI fetches the corresponding Wikipedia results table (via the Wikipedia API on the round's article — usually `2026_F1_Academy_round_2_Montreal` or the season article — and diffs it against what we entered. Discrepancies flagged for admin review. **Wikipedia is the source of verification, not the source of truth at this stage** because Wikipedia editors may take hours-to-days to update post-race.

### v2 — Wikipedia as primary, manual as override

Once we trust the Wikipedia pipeline (which usually has full results within 24h post-race), flip the default:
- Wikipedia → DB automatically
- Admin reviews + overrides discrepancies
- Manual entry becomes the fallback when Wikipedia is delayed

This is a meaningful win because it eliminates Josh-as-bottleneck. But it's a v2 problem, not a v1 problem.

### Verification against f1academy.com — legal note

We are allowed to *look at* f1academy.com results to verify our entered data is correct. We are NOT allowed to scrape or extract those results. The admin panel may include a button "Open official results in new tab" linking to `f1academy.com/Racing-Series/Results?raceid=XX` — this opens their site in a new tab so the admin can eyeball it. That's permitted personal use. Programmatic fetching is not.

### Edge case workflow: red-flagged / shortened races

If a race is shortened (red flag, weather, etc.):
1. Admin enters results as classified by FIA
2. Admin sets a "shortened" flag with the percentage of race distance completed
3. Scoring engine applies the standard scaling (50% / 75% / full) per FIA-style rules
4. Coach AI surfaces this in the post-race recap: "Race shortened due to red flag — points scaled to 75% of standard"

## Driver photos & visual assets

**Don't host driver photos.** Press photos are copyright. Wikimedia Commons sometimes has CC-licensed images, but they're inconsistent.

**v1 approach:** generate stylised avatars (e.g. with a service like [DiceBear](https://www.dicebear.com/) seeded by driver name) and use those everywhere. Sidesteps the entire image-licensing problem.

**v1.5 approach:** for drivers with verified CC-licensed images on Commons, optionally swap in the real photo. Always link back to source.

Liveries / car images — same approach. Don't host. Use abstract team-colour swatches in the UI.

## Data freshness & caching

- Static data (drivers, calendar): cached for 24h. Stale-while-revalidate.
- Pricing: only changes between rounds. Cache per round_id; bust on next round.
- Results: pushed via Supabase Realtime channels when admin publishes. Clients re-render.
- Coach insights: cached per user per round. Generate once, serve many times.
- Leaderboards: realtime channel; recompute on score writes.

## Failure modes & recovery

| Failure | Detection | Recovery |
|---|---|---|
| Wikipedia is slow to update results | Admin sees outdated data on verify page | Stay with manual entry, retry Wikipedia later |
| Anthropic API down | Coach endpoint returns 503 | Show "Coach is taking a break — try again shortly" — don't block the rest of the app |
| Supabase down | Site can't load auth or data | Show maintenance page; tweet status |
| Admin enters wrong result | Discrepancy with official results | Re-enter correct values → re-run scoring → users see "updated" badge with explainer |
| Scoring engine bug | Score sanity check fails (e.g. score > 500) | Block publish; alert admin |

## Open questions for implementation

- [ ] Confirm Wikidata QID for F1 Academy at implementation time (`Q124069437` is illustrative — verify)
- [ ] Decide on the Wikipedia round-article URL pattern (varies year-to-year)
- [ ] DiceBear style choice for driver avatars
- [ ] Sentry alerts vs. simple email alerts for production errors
