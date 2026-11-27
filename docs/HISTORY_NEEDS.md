# SPL history: what's on file, what's missing, who gets it

_2026-11-27 · Mike asked "what historic info do you need from me?" This is the checklist. Newest decisions in STATUS.md._

Rule of thumb: **anything ESPN still has, a robot pulls** (Mike does nothing). **Anything that only lived in the
SPL Packet, Joe's head or old emails, Mike brings** into `data/` as gold CSV. Every item below names its target file.

## On file today (gold)

| Fact | Coverage | File |
|---|---|---|
| Every game + score | 2006–2019, 2022–2026 (1,800 games) | `SPL_Matchups.csv` (robot) |
| Standings, champion, runner-up | same seasons | built from matchups |
| Owners, aliases, team names | 2026, 2025, 2019 names only | `SPL_Owner_Registry.csv` |
| SPL Draft board | **2026 only** | `Draft_Picks.csv` |
| Keeper contracts | contracts alive in the 2024–26 Keeper Matrix tabs (36) | `Keeper_Contracts.csv` |
| Divisional / Slot draft results | 2024, 2025, 2026 (partial) | `Offseason_Drafts.csv` |
| Trades | only trades made in the app (none real yet) | `Trade_Log.csv` (robot) |
| Rules | 2023 constitution + rule-change dates | `SPL_Rulebook.md`, `Season_Calendar.csv` |

## Robots can get these from ESPN (Claude's job, not yours)

ESPN keeps the league back to 2006 (id 19583). Claude will try each; whatever ESPN refuses moves to your list.

1. **Draft boards 2006–2025** (round, pick, team, keeper flag) → `Draft_Picks.csv`. Biggest win for player files.
2. **Trades + adds/drops** (ESPN transactions) → `Trade_Log.csv` history rows. ESPN often keeps these only for recent seasons.
3. **Team names every season** → registry. Fills "what was your team called in 2011".
4. **Final rosters each season** (who ended the year with whom) → new `Season_Rosters.csv`. Feeds "who has owned this player".
5. **2020 + 2021 games**: ESPN answered with 0 games in the history pull (HISTORY_PULL_REPORT). One more try with a different view;
   if it still fails, those two seasons come from you.

## Only you (or Joe) have these. Ranked by what they unlock

| # | What | Why it matters | Where it likely lives | Target |
|---|---|---|---|---|
| 1 | **Keeper history 2019–2023**: every keeper each owner kept, the round/KP, term, tags, terminations | Player files ("who kept him"), keeper economy cards, cap history. Today we only see contracts still alive in 2024 | Older SPL Packet Keeper Matrix tabs | `Keeper_Contracts.csv` (same columns; status `expired` for finished ones) |
| 2 | **2020 + 2021 seasons** if ESPN won't give them: final standings at minimum (W-L, PF, PA, finish, champ), weekly scores if you have them | Holes in every all-time record, rivalry series and champion list | SPL Packet, old ESPN screenshots, Joe | `Season_Results_Manual.csv` (standings) or `SPL_Matchups.csv` rows (games) |
| 3 | **2004–2005** (pre-ESPN, the league says founded 2004) — same as #2 | Makes "all-time" actually all-time | Joe | `Season_Results_Manual.csv` |
| 4 | **Draft boards ESPN doesn't have** (any year the robot comes back empty, and keeper slots on the board) | Player files, "best/worst picks" | SPL Packet draft tabs | `Draft_Picks.csv` |
| 5 | **Trades before the app** that ESPN lost: date, the two owners, players and picks each way | "Traded by" in player files, trade wire history, pick lineage | Packet trade log, league emails/texts | `Trade_Log.csv` (we'll give you a template) |
| 6 | **Divisional + Slot draft results before 2024** | Off-season history, Division history | Packet | `Offseason_Drafts.csv` |
| 7 | **Ownership changes**: anyone who left/joined, co-owners, which seasons | Owner records credited to the right person | Joe | `SPL_Owner_Registry.csv` (`first_season`, notes) |
| 8 | **Money**: dues, prize sheet and payouts by year | League economy, "career winnings" | Joe / Packet | new `Payouts.csv` (amounts only, no payment handles) |
| 9 | **Rule changes by season** you know of beyond what's in the calendar (roster size, scoring, playoffs format, keeper rule changes) | Explains old numbers; keeps comparisons fair | Constitution versions, Winter Meeting notes | `Season_Calendar.csv` (`kind=rule`) |
| 10 | **Awards / lore**: trophies, punishments, named rivalries, nicknames, memorable moments | Reel history cards, This Week in SPL history | Joe, group chat | `SPL_Lore.csv` (free text, dated) |

## Easiest way to hand it over

Don't clean anything. Drop the raw sources and Claude does the transcription, the owner matching (Owner Registry aliases) and
the `needs_review` flags, then shows you only the rows it couldn't place:

- **The whole SPL Packet** (every year you have, all tabs), plus any older Excel/Google Sheets.
- Screenshots are fine (draft boards, old standings, keeper matrices).
- A voice memo for lore/rule history works too.

Where: attach in chat, or connect the folder from the Claude desktop app. Claude commits the gold CSVs; `build-data.yml` rebuilds the app data;
player files, records and reel cards pick it up with no app change.
