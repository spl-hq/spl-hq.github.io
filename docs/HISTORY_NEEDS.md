# SPL history: what's on file, what's missing, who gets it

_2026-11-27 · Mike asked "what historic info do you need from me?" This is the checklist. Newest decisions in STATUS.md._

## ✅ Done 11/27 (round 1)
- **ESPN archive robot** (`espn-archive.yml` → `tools/pull_espn_archive.py`): 2006–2026 draft boards (4,283 picks), 252 team-seasons
  (names, divisions, records, final rank), 3,702 final-roster rows → `data/ESPN_*.csv`, report `docs/ESPN_ARCHIVE_REPORT.md`. ESPN has no 2004–05.
  **2020 and 2021 exist on ESPN as empty shells** (12 teams, no draft, no games). Transactions: 3,288 trades/adds/drops for 2018–19 + 2022–26 (ESPN keeps none before 2018).
- **SPL Packet 2026.xlsx transcribed** (every tab read): SPL Draft boards **2019, 2021–2025** → `Draft_Picks.csv` (1,043 picks, names matched to
  ESPN; 2 left flagged), **Keeper Matrix 2019–2026** → new `Keeper_Matrix_History.csv` (254 rows; 1 flagged: Al's 2019 QB "Prior"), the trade notes
  under each board → new `Packet_Trade_Notes.csv` (64 notes, word for word). Board tags solved from ESPN: **MOS = Craig, NUD/NUDE = Amit**.
- ESPN rounds ≠ SPL rounds from 2019 on (the commish keys keepers in as ESPN picks first), so keeper prices use the Packet boards.
- Player files now show all of it (drafts 2006–2026, every keeper matrix, final rosters) via `player-history.js` (loaded only when a file opens).

## ✅ Done 11/27 (round 2: Gmail + Glen's GM Report)
- **2020 + 2021 were both on NFL.com** (league 8606320; NFL.com draft emails both years). From the league emails: 2020 = 2021 Binder (final standings,
  W-L + most PF, slot order) + "2020 SPL Payouts" → **Beasters (Seth) champion, Bocces runner-up + points champ**; 2021 = "SPL Playoff Primer" (seeds,
  non-playoff records) + 2022 Binder slot order + Owen's FA report → **Trojans (Matt) champion, Rampage (Joe) runner-up**, Bocces points champ.
  → `Season_Results_Manual.csv`.
- **Glen's 2025 GM Report** (league EST. **2003**) → `GM_Report_2025.csv`: every owner's titles, playoff years, division titles. Fills 2003 (Muffins champ),
  2004 (Trojans) and 2005 (Beasters) + their playoff teams; matches ESPN on every champion 2006–24 and the emails on 2020–21's playoff six.
- Mike: Al's 2019 "Prior" = Terrelle Pryor; Glen's 2024 "73 Brown" = Chase Brown.

## Still open (from the Packet + Mike)
NFL.com's old leagues no longer exist (Mike 11/27): these now sit with Joe as the app question `history_gaps`.
- **2021 W-L for the six playoff teams** and a few PF (BAG 2020, Al + Rich 2021) — not in any email; NFL.com league 8606320's history page or Glen.
- **2020 draft picks** — only on NFL.com (fantasy.nfl.com/league/8606320, Draft Recap); the Packet has the order only. A screenshot would do.
- 2003–05 records + runner-ups (the GM Report gives titles + playoff teams only).
- Not yet structured from the Packet: 2024 prize/payout sheet (winners by owner), prize structures 2024 + 2025, 2020 Divisional/Slot order,
  the 2020 keeper hot sheet, the "ineligible keepers" lists, draft calculator. Easy to add when wanted.
- Packet trade notes are text; turning them into `Trade_Log`-style rows (owners + players + picks each way) needs a pass with Mike for the vague ones.

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
