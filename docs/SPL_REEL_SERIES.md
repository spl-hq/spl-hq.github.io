# SPL REEL card series: the catalog

Last updated: 2026-11-26 (chat) · v1.1 (card facelift) · Owner: Mike (ops), Joe (league calls)

Source of truth for the SPL reel, built on MAFFL REEL's science (`maffl-commish/maffl` → `_ops/docs/REEL_SERIES.md` v2.1,
`CARD_LINES_RECIPE.md`). **There is no Pulse** (Mike 11/26): the cards are the weekly update. The app follows this page
(`index.html` → `SERIES`, `TRAYS`, `BUDGET`, `DROP_H`, `weekCards()`). Add a series here first, then build it.

## The weekly rhythm (drops, ET)

A drop goes out at its slot, counted from the Tuesday after the week's games (2026: Week 1 → Tue Sep 15), and is then kept.
The robots run ~6:17 AM (ESPN history pull → card lines), so the Edition opens at 7 AM. Off-season: no waiting.

| When | Drop | What | Cards |
|---|---|---|---|
| TUE 7 AM | 🗞️ The Edition | The week just went final | 🏁 Your result · 📣 The week · 🏅 Week awards · ⭐ Power 5 · 📊 The table |
| TUE 5 PM | 🎯 Play | Vote + one quiz on that week | 🗳️ Game of the Week · 🧠 Quiz |
| WED 7 AM | 🗄️ Vault | History, one bite | ⚔️ Rivalry of the week · 💰 Keeper economy · 🔒 Your keepers |
| THU 5 PM | ⏭️ Preview | The coming week | ⏭️ Up next · 📅 This week in SPL history |
| ANYTIME | ⚡ Instant | As it happens | Trade offers, commish queue, questions, drafts, 🧮 your live game, 🏟️ live scoreboard, 📰 trade wire, 🎟️ pick wire, 💸 cap impact, 🔒 Signing Day, 💬 chat |

**Order:** ⚡ Needs you first (can't be swiped), then newest drop first; inside a drop **you → league → play → vault**.
**Budget per week:** you 7 · league 10 · play 3 · vault 4 (off-season: 3 · 4 · 2 · 6). The issue is the newest finished week whose
Edition has dropped; until Tuesday 7 AM last week's issue stays up. Testers pin "now" with localStorage `spl_now` (ms).

## Card anatomy (every card, same order)

1. **Tag row:** who it's for (your team tag, or the SPL stamp) + the series eyebrow: emoji · name · Week N.
2. **Hero:** a number (183.1), a matchup (two scores), or a headline (2 lines max). Never a paragraph.
3. **Story:** one or two sentences. This is where the robot's line goes (card lines); without it, a plain fact.
4. **Detail:** up to 5 rows.
5. **One action:** at most one button, to the place the card is about.
6. **Reactions:** shared (league) cards only, with the series' own tray. Your own cards don't get them. Play cards get votes instead.

## The card kit (v1.1 facelift, after MAFFL REEL's faces)

Build faces from these parts (`index.html` → card kit), not from plain key/value rows:
- **Avatar** `av(owner)`: initials circle (registry full name); yours has the gold ring. Every owner on a card gets one.
- **Score bug** `bug(a, b)`: two rows (avatar · name · record · score), the winner/leader washed gold with a blue score. Results and live games.
- **Mini bugs** in a 2-column grid: the live scoreboard (your game ringed gold).
- **Matchup** `vs2(a, …, b)`: two big avatars with the rivalry grade between them (Up next, Rivalry of the week with the series W–L under each).
- **Tiles** `tile(label, number, owner, sub)`: 2-column stat tiles (Week awards, The week's hot/cold, history records).
- **Chips** `chips([...])`: the 2–4 supporting facts under a story (rank move, streak, series, season high). Blue = good for you, red = bad, gold = notable.
- **Bars** `hbars()` (who holds how much: keeper economy, most active traders) and **meter** `meter(v, max)` (your KP vs the 10 cap, your share of a live game).
- **Ranked rows** (Power 5): big rank numeral · avatar · name + ▲▼ · one-line note · record. **Table**: W–L + PF columns with the playoff cut as a dashed gold line.
- **Wire rows**: pick tickets (`'27 R2`) or trade pairs with avatars and arrows. **Quote** + byline for chat.
A card with empty space under its content is missing a part: add chips or tiles, don't pad with text.

## Rules

1. One fact, one card. The week's top score lives on 🏅 Week awards only (📣 The week shows margins, the live scoreboard is live only).
2. Quizzes ask about what no other card shows (luckiest win / unluckiest loss).
3. League cards never say "you" in the headline; your angle is a highlighted row or a line under it.
4. Every card fits one phone screen at 390 px.
5. Published words don't change: a week's card lines are written once and kept.
6. Votes: one per owner, locked once cast, results only after you vote (or once it closes). Game of the Week closes Thursday 5 PM.
7. Every card links where it can: games → rivalry or Match, tables → Standings, keepers → Team.
8. No rule explanations on cards. Everyone knows the rules.

## The catalog

### ⚡ Needs you
(📋 Questions for Joe live in the Commish desk inbox, not the reel: v0.13.5.)

| Series | id | Audience | Drop | Lives | Writer |
|---|---|---|---|---|---|
| 🔑 Sign in | `signin` | guests | Instant | Until signed in | data |
| 🔁 Trade offer | `offer` | me | Instant | Until answered | data |
| 📥 Trades to approve | `review` | commish | Instant | Until decided | data |
| ⏱️ On the clock | `dclock` | me | Instant | Until you pick | data |
| 🔒 Signing Day (last 3 days) | `signing` | me | Instant | Until the day | data (Season_Calendar) |

### You
| Series | id | Drop | Lives | Writer | Notes |
|---|---|---|---|---|---|
| 🧮 Your game · live | `live` | Instant (games on) | While live | data | Score bar hero, who's left, your best player. |
| 🏁 Your result | `result` | Edition | Until next issue | data + robot `result` line | Score box hero; rank move; all-time series vs him. |
| ⏭️ Up next | `next` | Preview | Until next issue | data + robot `next` line | Next opponent hero, record + form, rivalry grade, series; then the two weeks after (Shoot Out / playoff spot). |
| 💸 Cap impact | `cap` | Instant | 14 days | data | A trade moved a keeper contract: 2027 KP in/out. |
| 🔒 Signing Day | `signing` | Instant (off-season) | Until the day | data | Countdown, KP committed, x of 3. |
| 💬 League chat | `chat` | Instant | Until read | data | |
| 🔒 Your 2027 keepers | `keepers` | Vault | Until next issue | data | |

### League
| Series | id | Drop | Writer | Tray | Notes |
|---|---|---|---|---|---|
| 🏟️ Scoreboard · live | `slate` | Instant (games on) | data | 🔥 😱 🥱 👏 🤡 | Live week only. |
| 📣 The week | `headline` | Edition | robot `headline`/`hot`/`cold` | 🔥 😂 🤯 🤡 💀 | Never the top score. Winners by margin. |
| 🏅 Week awards | `awards` | Edition | data | 🏆 🧠 🔥 😬 👏 | Four tiles: High score · Coach of the Week (biggest jump over his own average) · Low score · Biggest climb in the table (or the league average). No margins: 📣 The week owns them. |
| ⭐ Power 5 | `power5` | Edition | robot `power5` (else record + PF) | 📈 😤 🙏 👀 🔥 | Your row highlighted, or "You: #7" under it. |
| 📊 The table | `table` | Edition | data | 📈 😤 🙏 👀 🔥 | From gold games through the week; rank moves. |
| 📰 Trade wire | `wire` | Instant | data | 💸 🤑 🤡 👀 🔥 | 7 days. |
| 🎟️ Pick trade wire | `pickwire` | Instant | data | 💸 🤑 🤡 👀 🔥 | Every pick that's changed hands. |
| 📰 Trade wire · season | `wireseason` | Instant | data | 💸 🤑 🤡 👀 🔥 | Count + most active. |
| 🗓️ Drafts live / done | `dlive` / `ddone` | Instant | data | | Off-season drafts (WS3). |

### Play
| Series | id | Drop | Lives | Notes |
|---|---|---|---|---|
| 🗳️ Game of the Week | `gotw` | Play | Vote closes Thu 5 PM | Three curated games: ⏱️ thriller, 😱 upset, 💥 shootout (🔨 beatdown as a fallback). |
| 🧠 Quiz | `quiz` | Play | Until next issue | One a week. Even weeks: who won with the lowest score; odd: who lost with the highest. One shot. |

### Vault
| Series | id | Drop | Tray | Notes |
|---|---|---|---|---|
| ⚔️ Rivalry of the week | `rivalry` | Vault | 🔥 😤 😂 👀 💀 | Next week's highest-graded matchup (not the Shoot Out week). |
| 📅 This week in SPL history | `history` | Preview | 👀 😂 🔥 🤯 🫡 | Next week's number in past seasons: record score, closest ever. |
| 💰 Keeper economy | `economy` | Vault | 💸 🤑 🤡 👀 🔥 | Contracts running into next season. |

## Rivalry grade

How big a rivalry is, not who's winning it: extra meetings (division mates), how even the series is, playoff meetings. Graded
on the curve because everyone has met ~20 times since 2006. A Blood feud · B Real rivalry · C Familiar foes · D Passing strangers.

## Card lines (the robot)

`card-lines.yml` → `tools/card_lines.py` → gold `data/Card_Lines.json` (SPL's version of MAFFL's `CARD_LINES_RECIPE.md`).
Claude writes, from gold only: `league.headline/hot/cold`, `owners.<id>.result/next`, `power5`. Lines ≤ 110 characters, the
one angle the numbers don't show, never the top score in the headline, never "you" on shared cards. Written once per week
and kept. Needs the GitHub secret `CLAUDE_CODE_OAUTH_TOKEN`; without it the cards show plain facts.

## Not yet
🗳️ **Trade veto vote** (waiting on Joe's `veto_vote` answer): every accepted trade lands as a card on every uninvolved owner's reel (vote veto, comment, react) + league chat; 24 h in season, 6 vetoes kill it. It'll be a Needs-you card for the 9 uninvolved owners, on the same Votes tab.

From MAFFL's catalog: 📊 Commish polls · 📣 Commish alert (reel + chat) · ⏰ Key date lead window · 📈 Records watch (Fri) · 💸 What would you pay? ·
👋 Meet the owner · @handles tappable on cards · Coach of the Week from optimal lineups (needs box scores in the robot).
