# SPL HQ — REEL Plan (v0.4, 2026-11-25)

**This repo copy is the master** from 11/25 on (the Claude Project keeps an older snapshot). Record every decision in §0.

Building SPL HQ as a REEL-style app (owner sign-in, ESPN link, trades with automatic ESPN moves, chat), modeled on MAFFL HQ's REEL
(`maffl-commish/maffl` → `_ops/docs/REEL.md`, `APP_DESIGN.md`, `REEL_OPERATIONS.md`, `REEL_SERIES.md`, `TRADE_CENTER_DESIGN.md`).

## 0. Decisions (newest on top)

- 2026-11-26 · **WS5: a 4-team test league, not 12** (Mike). The test league's 4 teams mirror Mike, Joe, Al and Glen's real SPL rosters (Mike's own ESPN
  team = Mike, by his SWID). ESPN writes are a switch on the Ops desk (Script property, off by default) and can only reach `WRITE_LEAGUE`. Mirroring is
  run by Mike from the Ops desk (on demand, to set up and to reset after demos), not a scheduled robot: the test league only changes when someone
  writes to it. A trade write is one POST, never retried, then read back; anything short of "every player moved" becomes a Do-on-ESPN step with
  ESPN's reason. Practice trades never write to the real league, and real trades never write to the test league.
- 2026-11-26 · **Header = identity + desk only** (Mike). Avatar = initials from the registry full name and opens settings directly; no role shown
  anywhere. No connection pill unless offline/unreachable ("Live" belongs on Match/Roster, tied to ESPN). Offline: only chat queues (it never
  reached the backend, so sending later can't double-post); trades, picks, drafts and settings refuse offline rather than queue, since a
  late-arriving offer or pick could land on a changed board.
- 2026-11-26 · **WS4: the Reel.** Reactions on league cards only (personal cards stay private). The Weekly Pulse is written by a robot from gold
  only (no ESPN call, no invented facts) and published automatically every Tuesday, no review step (Mike: the site maintains itself); Claude
  writes it when `CLAUDE_CODE_OAUTH_TOKEN` is set, else a template edition, so the reel never goes empty. Claude's card lines come from the
  Pulse (one line per owner → 🎙️ card), not a separate robot. Rivalry grade measures how big a rivalry is, not who's winning it. Upcoming
  pairings come from a daily robot (`data/SPL_Schedule.csv`), not a live call, so Up next works offline. "Drops/series timing" = cards are keyed
  by week (done/save per week) and the Pulse lands Tuesday; no separate drop clock for now.
- 2026-11-26 · **WS3: one draft engine for every off-season draft.** Divisional + Slot ship first (backend `Drafts`/`DraftPicks`); the SPL Draft room and the Shoot Out Draft reuse the same engine with their own config. Orders are computed in the app from ESPN history and **confirmed by the commish when he opens a draft** (he can reorder), so an unclear bracket never blocks a draft. Rehearsals (`mode` test) run any time on the last finished season's order. A commish may enter a pick for any owner (recorded and posted as "entered by"). Divisional Draft reading (4 founders, each starts a division; full division must assign; one assigned-in per division) goes to Joe as a 📋 question. Gold: `data/Offseason_Drafts.csv` (robot-written).
- 2026-11-26 · **WS2 League screens built from gold.** Rulebook text lives in `data/SPL_Rulebook.md` (amend there; the 2023 docx conversion stays as the archive). History + GM Rankings are *derived* from ESPN games (no hand-kept standings); missing seasons go in `Season_Results_Manual.csv`. GM Rankings are our career table until Glen shares his formula. Dates the commish sets go in `Season_Calendar.csv`.
- 2026-11-26 · **Desks behind the login, not in League** (Mike, WS1). Header Desk button for desk roles only. Joe (commish) sees the Commish desk only; Mike (ops + commish) gets the Ops desk plus Joe's Commish desk as "Joe's view", read-only except trades Joe is in and backup after `BACKUP_WAIT_H` = 48 h (default until Joe answers otherwise). Pick ledger fixes are Joe's. Questions live inside the desk.
- 2026-11-25 · **League history = ESPN 19583, 2006–2026** in gold `data/SPL_Matchups.csv` (robot-written). Missing: 2004–05 (pre-ESPN) and 2020–21 (no scores on ESPN). Ask Joe/Glen for those seasons' results to backfill by hand.
- 2026-11-25 · **Theme: "Nittany"** (Penn State blue + white) replaces Stadium Lights (black/neon). Supersedes the wireframe doc's theme choice.
- 2026-11-25 · **Trade center v1 in test mode** with defaults until Joe answers: 2027 picks only (17 rounds), contracts travel with the player, commish approves every trade, no self-approval (Joe ↔ Mike trades: either approves, flagged). Live pick ledger = Sheet Picks tab (export to gold `Draft_Pick_Ownership.csv` comes with the ledger robot).
- 2026-11-25 · **Home = the REEL feed**, same mechanics as MAFFL (swipe ← done / → save, Saved/Done buckets, Undo, needs-you cards locked, caught-up end card). SPL card series start from live ESPN + keeper data; drops, reactions and Claude card lines follow MAFFL REEL_SERIES once the trade center is in.
- 2026-11-25 · **Joe gets a real login** (Mike), same as every owner will: passphrase made on the Ops desk, texted by Mike, device token on the phone. No `#joe` shortcut or name picker. Roles live in the Owners tab (`role`: owner / commish / ops).
- 2026-11-25 · **Full service: Claude pushes straight to `main`** (Mike). No Claude Code prompts / GitHub Desktop step. "PR first" on request.
- 2026-11-25 · **The app manages the app.** Questions for Joe, feedback and ops status live in the app (League → 📋 Questions, 💡 Ideas, 🛠️ Ops desk), Sheet-backed, emailed to ops. v0.1 shipped.
- 2026-11-25 · **Accounts created.** GitHub org `spl-hq` (repo renamed to `spl-hq.github.io`, site `https://spl-hq.github.io/`); league Google account `spl.hq.ops@gmail.com` with Sheet "SPL HQ App" + Apps Script "SPL HQ Backend". Work the league Google account in its own Chrome profile (Apps Script breaks with several Google accounts signed in).
- 2026-11-25 · **Read real, write test.** One cookie pair (Mike's ESPN login) reaches every league Mike is in. `READ_LEAGUE` = **19583** (real SPL: rosters, standings, schedule, history; read-only, from day one). `WRITE_LEAGUE` = **1722387564** (test league; the only league the backend will write to). Demo trades run in the test league; flipping `WRITE_LEAGUE` to 19583 needs Joe's sign-off + Mike as LM there. Option: a robot mirrors the 12 SPL rosters into the test league (commish adds) so demo trades use real SPL players.
- 2026-11-25 · **Prove it on the test league first.** Test league **1722387564** ("Testing MAFFL HQ", where MAFFL's write experiments ran; Mike is LM). Joe is made co-commish there for the demo.
- 2026-11-25 · **Standings are in.** Owning trades means SPL HQ competes with ESPN a bit; standings (and live Match) are allowed in the app. Supersedes Brief §2 "build only what ESPN cannot show".
- 2026-11-25 · **Runtime fetches allowed for the app's own backend.** Static history data stays embedded; the app may call its backend (identity, trades, chat, ESPN).
- 2026-11-25 · **Mike owns the infrastructure; Joe owns the league.** Supersedes Brief §7 ("repo under Joe's account", "Mike is helping, not adopting").
  - Joe = rules authority, commish decisions (trade approvals, announcements, rulings).
  - Mike = co-commish on the site + ops owner (robots, connectors, accounts, deploys). Mike's espn_s2/SWID drive all ESPN reads and writes.
- 2026-11-25 · **Two desks.** Joe's 📥 Commish desk (approvals, rulings, announcements) and Mike's 🛠️ Ops desk (is the system healthy, is Joe's desk flowing). Mike also sees Joe's queue and can act as backup.
- 2026-11-25 · **No self-approval.** Joe approves trades Mike is in; Mike approves trades Joe is in; everything else goes to Joe by default, with Mike as backup after a set wait.
- 2026-11-25 · **One app from day one.** No classic site + separate app (MAFFL's cutover debt). Keepers, Draft, History, GM Rankings, Rules are League screens inside the app.

## 1. Why SPL fits REEL
An SPL trade moves three asset types, and ESPN tracks only one:
- **Players** → ESPN (commish trade write, proven on MAFFL 11/25: `POST …/transactions/`, `EXECUTE`, read back).
- **Draft picks** → SPL ledger (ESPN's offline draft holds none of it).
- **Keeper contracts** → SPL ledger (ESPN keepers are off; KP, years, escalators live in Keeper_Contracts.csv).
Flow: owners agree in the app → the commish approves → the robot executes the player leg on ESPN + reads it back, and commits the pick/contract ledger.

## 2. Accounts and ownership

| Thing | Plan |
|---|---|
| GitHub | Org **`spl-hq`**, Mike owner (via `maffl-commish`), Joe added as a second owner after the demo. Repo **`spl-hq.github.io`** → `https://spl-hq.github.io/`. |
| Google | **`spl.hq.ops@gmail.com`** owns Sheet "SPL HQ App" + Apps Script "SPL HQ Backend" (own Chrome profile). Joe shared as Sheet editor later. |
| ESPN | Reads SPL 19583; writes test league 1722387564 until sign-off. Cookies `ESPN_S2` + `SWID` (Mike's) in Script properties + GitHub secrets. Expire ~yearly. |
| Claude robot token | `CLAUDE_CODE_OAUTH_TOKEN` from Mike's subscription (card lines, later). |
| Uptime monitor | UptimeRobot polls `?action=health` for `"healthy":true`. |
| Secrets | Never in the repo. Contacts live only in the Sheet. |

Shared test league caution: MAFFL's backend may also write to 1722387564. Don't run MAFFL write experiments while demoing SPL.

## 3. Roles
Owners tab gets a `role` column: **owner** (trade, chat, react, vote, settings) · **commish** (Joe + Mike: approve/negate trades not their own, rulings, pins, announcements, passphrases) · **ops** (Mike: Ops desk, robots, seed/test tools, kill switches `ESPN_WRITES`, `OWNER_EMAILS`, `APP_MODE`).

## 4. The two desks
**📥 Commish desk (Joe; Mike can see it):** To do (trades to approve, passphrase requests, rulings), Do-on-ESPN steps (only if a write fails), Log, Announcements.
**🛠️ Ops desk (Mike):** Joe's queue + nudge, robots, connectors (ESPN, GitHub token, email quota, Sheet size), ESPN write log + kill switch, app health, feedback, Joe's answers. **v0.1 built**: health + answers + feedback.

## 5. What gets built (port vs new)

| MAFFL piece | SPL |
|---|---|
| `Code.gs` loader | ✅ ported (`backend/Code.gs`) |
| `logic.js` core (passphrase + device tokens, formula guards, health) | v0.1 has health/answers/feedback/standings; sign-in next, with `role` |
| `mod_social.js` (chat, DMs, reactions, polls) | Port |
| `mod_espn.js` (reads, write guard) | Reads ✅ (19583 + test); writes later, guarded to `WRITE_LEAGUE` |
| `mod_desk.js` | Split: commish desk + ops desk |
| `mod_trades.js` | **Rewrite**: players + picks + keeper contracts; cap check |
| `daily.js` | Later; strip MAFFL-only parts; standings |
| Mock + regression + CI | Smoke test ✅; CI next |
| `credit-sync` robot | Becomes `ledger-sync`: approved trade → `Draft_Pick_Ownership.csv` + `Keeper_Contracts.csv` |
| App | ✅ shell in Stadium Lights; port card anatomy, matchup + player screens later |

New gold: `Draft_Pick_Ownership.csv` (season, round, original_owner_id, current_owner_id, trade_id). Keeper_Contracts.csv gains a traded-contract event.
SPL-only: pick-your-opponent playoff pick → ESPN `/schedule` write; keeper deadline + cap-impact cards; pick trade wire; Slot/Divisional draft-day cards.

## 6. Build order
1. ✅ Accounts. ⬜ UptimeRobot after deploy.
2. ✅ Foundation v0.1 (app shell, loader, logic, Questions, Ideas, Ops desk, standings). ⬜ Mike deploys the web app → `API_URL`.
3. Static League screens: Keepers, Draft, History/GM Rankings, Rules (data already gathered in the Claude Project).
4. Sign-in + both desks + chat. ESPN reads: rosters, Match.
5. ✅ Trade center on the test league (v0.13: mirror + ESPN trade write) → ⬜ demo to Joe (`docs/SPL_DEMO_SCRIPT.md`).
6. Joe signs off → `WRITE_LEAGUE` = 19583.
7. Reel robots + playoff-pick write (2027 season).
8. ✅ WS4 Reel cards (v0.12): Up next + rivalry grade, reactions, Weekly Pulse robot + page, pick wire, cap impact, Signing Day.
9. WS3 off-season in the app: ✅ Divisional + Slot draft rooms (v0.11) · ⬜ SPL Draft room · ⬜ Keeper declarations · ⬜ Shoot Out Draft + Seed 3 pick (ESPN `/schedule` write).

## 8. Open (asked in the app: League → 📋 Questions)
ESPN co-commish · test-league demo · traded keeper contracts · pick seasons · trade approval + review window · key dates · chat · Al vs James Farrington · Divisional Draft rules · Joe's #1 wish.
