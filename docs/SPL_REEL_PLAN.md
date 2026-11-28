# SPL HQ — REEL Plan (v0.4, 2026-11-25)

**This repo copy is the master** from 11/25 on (the Claude Project keeps an older snapshot). Record every decision in §0.

Building SPL HQ as a REEL-style app (owner sign-in, ESPN link, trades with automatic ESPN moves, chat), modeled on MAFFL HQ's REEL
(`maffl-commish/maffl` → `_ops/docs/REEL.md`, `APP_DESIGN.md`, `REEL_OPERATIONS.md`, `REEL_SERIES.md`, `TRADE_CENTER_DESIGN.md`).

## 0. Decisions (newest on top)

- 2026-11-28 · **Power 5 → Power 3** (Mike): three teams, each with a short write-up (robot `power3`, else built from the numbers). Fewer rows, more story.
- 2026-11-27 · **Player files read as a career, not a log** (Mike): tiles + a per-season cost bar (MAFFL's auction-price chart, on SPL's KP scale) + folding owner stints. A keeper deal belongs to whoever signed it; later holders show it as "came over with his deal".

- 2026-11-27 · **Chat: @mentions everywhere, division rooms, no owner-made groups** (Mike asked; group call was Claude's). Ported MAFFL REEL's
  @ work: composer @ picker, tappable @Handles, an @ Mentions tab. Owners named on cards are tappable @Handles → that owner's team page
  (💬 Message, ⚔️ Rivalry). Groups: every owner automatically gets **their division's room** (membership read from ESPN, so it follows the
  Divisional Draft by itself), the same shape as MAFFL's tier rooms (MAFFL never had owner-made groups). Custom groups skipped: in a trade
  league with a veto vote, private multi-owner rooms invite "who's colluding" questions, and DMs already cover the private side. Easy to add later.

- 2026-11-27 · **No Home cards for the SPL Draft** (Mike): everyone is in the draft room and it's done in 2-3 hours, so no on-the-clock / live / done card cycle. Divisional, Slot and Shoot Out drafts keep theirs (spread out over days, that's where the cards earn their keep).
- 2026-11-27 · **Joe's desk is the clean one; the Ops desk is the workshop** (Mike). Commish desk = real league controls only (drafts incl. ESPN
  load, Signing Day, trades, questions, pick fixes) in folding sections; rehearsals, robots, watchdog, test league and tour stay on the Ops desk.
- 2026-11-27 · **Test league team names stay as ESPN has them** (Mike): the mirror only moves players.
- 2026-11-27 · **Drafting in the app means the app loads ESPN** (Mike), **in one batch after the draft** (Mike, same day: not pick by pick). The
  desk's "Load into ESPN" puts every pick and keeper onto the owner's ESPN team with the LM add; re-runnable to finish/repair. Test league until Joe signs off; then `WRITE_LEAGUE` = 19583.
  Open question to prove on the test league after ESPN's 2027 rollover: whether ESPN accepts LM adds before its own draft is marked done; if
  not, capture ESPN's offline-draft-results call and switch the loader to it (same desk button).
- 2026-11-27 · **Commish controls live on the desks, not in the rooms** (Mike). Open / undo / cancel / ESPN load for every draft = the 🗓️ Drafts
  card on the Commish desk (Joe) and Ops desk (Mike). Rooms are for drafting (the commish may still enter a pick for an owner there).
- 2026-11-27 · **▦ Grid board** (Mike): the SPL Draft room shows the board like the league's Google Sheet (slots × rounds, colored by position).

- 2026-11-27 · **Keeper declaring opens when the off-season starts** (Mike), by itself from the calendar, and stays open until Signing Day
  closes it. No commish step needed; rehearsals and a commish close still work. Plans + the 3-year outlook are always on the keepers card.

- 2026-11-27 · **League tab = Drafts first** (Mike). A row of draft buttons (SPL Draft, Divisional, Slot, Shoot Out) always in the same spot so
  owners can get back into a room; Standings move to the bottom of Match; Trades + Keepers tiles go (the GM desk on Team has both).
- 2026-11-27 · **SPL Draft room** (Mike: "let's build it"). The board is frozen when the commish opens the draft (pick ledger + keepers + tags);
  later fixes are commish picks/undo, not a rebuild. Player pool = ESPN's PPR draft ranks (read-only), with a typed-in fallback. Chat gets
  round summaries only; emails throttle to one per owner per 30 min. The finished live board becomes gold in `Draft_Picks.csv` via the
  ledger robot, so next year's keeper prices read it like any other season. ESPN's offline draft is keyed by the commish until a write is proven.

- 2026-11-27 · **Launch after the 2026 season; off-season mode is automatic** (Mike). Show Joe now; the league starts using SPL HQ once the 2026
  SPL Bowl is final, running the whole 2027 off-season (Divisional, Slot, Signing Day, then the SPL Draft) and the 2027 season. Nothing new
  is introduced to owners mid-season (`LIVE_SEASON` = 2027 gates in-season owner prompts; desks see them now for rehearsals). The app reads
  its phase from gold (season · Shoot Out window · off-season = no games left on ESPN) and re-arranges League/Home itself.
- 2026-11-27 · **Shoot Out Draft on the draft engine** (Appendix Three). Rule 1 pairs computed by the app and confirmed by the commish (the
  tiebreaks the app can't see stay his call), then best-seed-first picks, last two auto-paired. Week 14 on ESPN is set by the commish until
  the `/schedule` write is captured (same call as Seed 3).

- 2026-11-27 · **Keepers v2** (Mike). Your keepers = three slots under one cap summary; details live in sheets, not stacked cards.
  Mine · Market · League switch inside the GM desk's Keepers. Other teams' keepers are read-only (no planning for them). Declaring
  shows a confirm that it goes to the league + the commish and can change until close. New: the **keeper market** (every keepable
  player league-wide at or under a KP price) for off-season shopping.

- 2026-11-27 · **History sources** (Mike). ESPN is pulled by a robot for everything it kept (2006–2026, except empty 2020–21). The SPL Packet is
  transcribed once into gold (`Draft_Picks.csv` for SPL rounds 2019+, `Keeper_Matrix_History.csv`, `Packet_Trade_Notes.csv`). SPL rounds come from
  the Packet boards, not ESPN (keepers were keyed in as ESPN picks). 2020 (NFL.com) gaps get filled from Glen's power rankings.
- 2026-11-27 · **📇 Player files** (Mike). Any player is tappable (Team roster, trade grid) → a sheet: who has him now + this season,
  keeper status for next season, and his SPL paper trail from gold (drafts, keeper contracts, terminations, trades in the app).
  Grows with the data: older draft boards (2019–2025, SPL Packet) go into `data/Draft_Picks.csv` and show up with no app change.
  Team tab header is now a compact desk header (team, record, rank, division, streak, next game); no big blue team card.
- 2026-11-27 · **No "reel" on the site; Home tab = the crest** (Mike). Owners only ever hear "Home" / "your Home screen"; "reel" stays
  internal (code, docs). The Home tab's 🏠 is now a tiny SPL crest, matching the header crest (both go Home). Tour gets a 2nd welcome
  card, "It all lands on Home": your move up top (Shoot Out / Slot / Divisional picks, trade offers, keepers), every week of the season,
  polls + trivia, off-season too. The Home stop keeps only how to use it (scroll, swipe, Saved/Done).
- 2026-11-27 · **👋 Welcome tour, first visit only** (Mike, after MAFFL REEL's one-tour version). Once per owner (per phone), the first
  time they land on a tab's front screen signed in: a welcome card, then 8 stops across the tabs (Desk stop only for desk owners). Replay
  from You → Show me around again; Ops desk → 👋 Welcome tour: for me now, or for one owner / everyone on their next open (backend stamp
  in Script property `TOUR_STAMPS`, handed back by `me`). No per-tab tips: one tour. Nothing goes stale, so no robot.
- 2026-11-26 · **🧢 GM desk = the Team tab** (Mike). An owner's roster, trades and keepers are one desk with a 3-way bar
  (🏈 Roster · 🔁 Trades · 🔒 Keepers) on top of each page, each with a live status line; the Team tab stays lit across all three.
  No owner pill rows: other teams sit behind an 👀 Other teams picker. League → Keepers on your own team lands at the same desk.
- 2026-11-26 · **Show the last copy, then refresh** (Mike: load times). App shell is cached-first (update check covers new versions);
  Home/Match/rosters/standings draw from the phone's last answer and refresh behind. Live actions (trades, desk, votes) always fetch.
- 2026-11-26 · **Keeper calculator → Signing Day declarations in the app** (Mike: "love the scenarios that turn into declare keepers… posts to
  league message board, hits owner cards"). Up to 3 named plans per owner, saved with the sign-in (private until declared). Declaring = the
  official Signing Day act: the backend re-prices from gold + the ESPN roster, enforces 10 KP / three keepers / one tag, posts to league chat
  and the reel; changeable until close; no declaration = carried contracts stand. A desk role opens/closes the window (rehearsal or live); it
  also closes by itself after its date. Final declarations → ledger robot → contracts (live) / `data/test/` (rehearsal). Joe still owns the
  rules: anything the constitution leaves open goes to his 📋 Questions.

- 2026-11-26 · **WS7: the backend watches the robots** (Mike: ops ready before Joe). GitHub's cron never fired on this repo, so an hourly
  Apps Script `tick` (`mod_ops.js`) reads the robots' runs via the GitHub API (`GH_TOKEN`, Actions-only token) and runs late ones; alerts email
  ops on change only; failures are never retried blindly. Sheet backup = daily CSV zip to the ops inbox (no new Google scopes, no loader
  re-paste) over a Drive copy (needs Drive scope + re-paste) or a GitHub artifact (public repo). UptimeRobot stays the one outside watcher.
- 2026-11-26 · **WS6: parity is a living doc + port by priority** (`docs/MAFFL_PARITY.md`). Backend now splits into `mod_*.js` parts the way MAFFL
  does (no loader change); CI runs on every push (alarm on main, gate on PRs). MAFFL-only systems (credits, dues, Survivor, tiers, Ghost,
  auction cards, headline pick) are not ported. SPL → MAFFL items are batched for a MAFFL chat when REEL wakes (this side can't push there).
- 2026-11-26 · **No Pulse: the cards are the update** (Mike). The reel follows MAFFL REEL's card science (REEL_SERIES v2.1): series,
  drops, weekly budget, card anatomy, one fact one card, reactions on shared cards only (per-series trays), votes on play cards (one,
  locked, results after you vote). Catalog: `docs/SPL_REEL_SERIES.md`. Claude writes card lines only (`card-lines.yml`), once per week,
  kept. Supersedes the WS4 Pulse entry below.
- 2026-11-26 · **Commish questions are desk inbox items, not reel cards** (Mike). The reel is for the league; Joe's to-dos live on the Commish desk,
  with the open count on the header Desk button.
- 2026-11-26 · **Mike's answers in the app (pending Joe's OK):** traded keeper contracts travel as-is; only next season's picks trade; Divisional Draft
  as the app runs it; Al = James Farrington; trades go to a **league veto vote run in the app** (league chat entry + a card in every owner's reel:
  vote, comment, react), Joe ↔ Mike trades included (auto after the window). Questions for Joe rebaselined to what's still his call; retired
  questions keep their qids. Supersedes the 11/25 "commish approves every trade" default once Joe confirms `veto_vote`.
- 2026-11-26 · **Limestone gray joins the Nittany theme** (Mike). Gray carries structure (canvas, lines, labels, tab bar, header rule);
  blue stays the action/ownership color. Kept as a separate override block so it can be tuned or removed without touching Nittany.
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
8. ✅ WS4 Reel cards (v0.12–0.13): series catalog + drops + budget, Edition/Play/Vault/Preview cards, votes, reactions, card-lines robot, Up next + rivalry grade, pick wire, cap impact, Signing Day.
9. WS3 off-season in the app: ✅ Divisional + Slot draft rooms (v0.11) · ✅ SPL Draft room (v0.22) · ✅ Keeper declarations (v0.17) · ✅ Shoot Out Draft (v0.21) · ✅ off-season mode (v0.21) · ⬜ ESPN `/schedule` write (Shoot Out + Seed 3).

## 8. Open (asked in the app: League → 📋 Questions)
ESPN co-commish · test-league demo · traded keeper contracts · pick seasons · trade approval + review window · key dates · chat · Al vs James Farrington · Divisional Draft rules · Joe's #1 wish.
