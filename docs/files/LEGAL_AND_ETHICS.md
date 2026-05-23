# Legal & Ethics

> **Read this before writing a single line of code.**

## TL;DR

We do **not** scrape `f1academy.com` or reverse-engineer their live timing feed. Race results come from Wikipedia (CC BY-SA 4.0), Wikidata (CC0), and a manual admin panel. The app is non-commercial, entertainment-only, unaffiliated.

## The f1academy.com Terms of Use (key clauses)

Pulled from `https://www.f1academy.com/About/Terms-and-Conditions`. Governed by English law.

### Personal, non-commercial use clause
> "The material and content provided on this Site is for your personal, non-commercial use only (save where expressly provided) and you agree not for yourself or through or by way of assistance from any third party to distribute, copy, **extract** or commercially exploit such material or content."

### Anti-reverse-engineering clause
> "You further agree not to **reproduce, distribute, perform, display, modify, adapt, translate, prepare derivative works from, decompile, reverse engineer, disassemble** or otherwise attempt to derive source code from this Site."

### IP and database rights
> "All materials on this Site... are protected by copyrights, **database rights**, trademarks and/or other intellectual property rights..."

## UK Database Right

The UK retained the EU Database Directive post-Brexit. Database rights protect against **extraction or re-utilisation of a substantial part** of a database, independently of copyright. Scraping race results from f1academy.com and serving them through our app is a textbook violation. Enforceable in English courts. Formula One Group is registered in England.

## Fantasy / gaming law (UK)

- **No real money = no gambling licence required.** UK Gambling Commission rules apply where there's a "prize" of monetary value won by chance/skill against a stake. Free-to-play fantasy with no entry fee and no cash prize is outside scope.
- We must **not** offer cash prizes, paid entry, in-game purchases that affect scoring, or any partner promotion that implies a wager.
- The disclaimer in the footer + onboarding must be unambiguous: "Free to play, for entertainment only. No money involved."
- If we ever add prizes (e.g. merch giveaways from a sponsor), revisit this doc — the legal picture changes.

## What we will NOT do

| Action | Why |
|---|---|
| Scrape `f1academy.com` HTML pages programmatically | Violates "extract" clause + Database Right |
| Hit `/_next/data/*` JSON endpoints in bulk | Same — extraction is extraction |
| Reverse-engineer the SignalR/WebSocket live timing protocol | Anti-reverse-engineering clause |
| Mirror or rehost any media (driver photos, videos, liveries) | Copyright |
| Use F1 / F1 Academy logos or trademarks in our branding | Trademark |
| Charge users for the app (entry, premium tier, ads tied to results) | Non-commercial clause + gambling rules |
| Offer cash or cash-equivalent prizes | Gambling regulation |
| Claim official affiliation, endorsement, or partnership | Misleading + trademark |

## What we WILL do

| Action | Source / Justification |
|---|---|
| Use Wikipedia article content for driver bios, race results | CC BY-SA 4.0 — explicit reuse licence with attribution |
| Use Wikidata structured records for driver/team metadata | CC0 — public domain |
| Manual admin entry of race results immediately post-race | Single facts (positions, times) are not protected; this is reporting |
| Reference / link to f1academy.com as the official source | Linking is permitted by their TOS |
| Cite f1academy.com when verifying facts | Verification is not extraction |
| Use Wikimedia Commons images where licence permits (CC, public domain) | Per individual image licence |
| Display driver names, team names, race calendar (factual data) | Single facts, not copyrightable |
| Acknowledge F1 / F1 Academy trademarks in every published surface | Required |

## The "verify, don't extract" rule

We can *look at* f1academy.com to **verify** facts already entered manually or sourced from Wikipedia. We cannot *take* data from f1academy.com. If an admin types in race results immediately after watching the race on F1 TV, and then opens f1academy.com to double-check, that's verification. If a script pulls the standings table from their results page, that's extraction.

## Branding rules

- App name: **Academy Fantasy** (working name — open to change but must not include "F1", "Formula 1", or "F1 Academy" as part of the brand).
- Logo: original design, not derived from any F1/F1 Academy mark.
- Colour palette: deliberately distinct from official F1 Academy pink branding to avoid confusion.
- Domain: something neutral like `academy-fantasy.app` or `gridguess.app`. Avoid `f1academy*` patterns.

## Required notices

Footer of every page + every public dataset README + app onboarding screen:

```
Free to play. For entertainment only. No money involved.

Race data sourced from Wikipedia (CC BY-SA 4.0) and Wikidata (CC0).

F1, FORMULA 1, F1 ACADEMY, GRAND PRIX and related marks are trademarks
of Formula One Licensing BV. Academy Fantasy is unofficial and not
associated with the Formula 1 group of companies.
```

## Should we ask F1 Academy for permission / partnership?

**Phase 4 question, not Phase 0.** Once we have working users and demonstrable engagement, a short email to `general@en.formula1.com` proposing a collaboration (e.g. official integration, a sponsored mini-league, anything) is low-cost. Strangers asking for permission rarely get answers; a working product with users gets answers.

**Do not contact them before launch.**

## Licences for our own work

- **Code:** MIT
- **Documentation:** CC BY 4.0
- **Our scoring system / fantasy rules:** CC BY 4.0 (so others can fork)

## Open questions to resolve before launch

- [ ] Driver photo licensing — link to Wikipedia Commons only, or generate stylised avatars? (Recommend avatars for v1 — sidesteps the issue.)
- [ ] Hosting region for Supabase — UK/EU for GDPR simplicity (user emails for auth).
- [ ] Privacy notice & cookie banner — required under UK GDPR even for free apps.
- [ ] Terms of Service for our own users — short and plain English, covering: free-to-play, no warranty, no PII shared, account deletion rights.
