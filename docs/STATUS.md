# SPL HQ — Status

_Read first. Newest on top._ **Last updated:** 2026-11-27 by Claude (chat, 👋 welcome tour v0.19.0, backend v0.14.0)

## Now
- **WS7 ops ready-check (v0.16, backend v0.12.0):** audit in `docs/OPS_AUDIT_2026-11-26.md`. Big find: **GitHub's schedule has never fired on this repo**, so the backend's new hourly watchdog now runs late robots itself. **Mike, three one-time steps (runbook):** ① Script property `GH_TOKEN` (fine-grained, this repo, Actions read+write, 1 yr) ② Apps Script ⏰ trigger on `tick`, hourly ③ UptimeRobot on `?action=health`. Then Ops desk → 🤖 Robots & watchdog should read ✅ all good. ESPN writes are ON (test league): off after the demo.
- **Reel v0.14 (backend v0.11.0): no Pulse, the cards are the update.** Catalog: `docs/SPL_REEL_SERIES.md` (after MAFFL REEL_SERIES v2.1). **Mike: add the GitHub secret `CLAUDE_CODE_OAUTH_TOKEN`** (`claude setup-token`) so Claude writes the card lines; then Actions → Card lines → Run workflow. Until then the cards show plain facts.
- **WS5 ready to try (v0.13, backend v0.10.0):** the 4-team ESPN test league mirrors Mike, Joe, Al and Glen's real SPL rosters, and approved trades between them move on ESPN by themselves. **Mike:** Ops desk → 🏈 ESPN test league → turn writes on → 🪞 Mirror SPL rosters (a quiet day: locked players may refuse). Then the demo: `docs/SPL_DEMO_SCRIPT.md`. **Not run yet:** ESPN writes ship off and the mirror only runs when Mike taps it (Thanksgiving: run it before the 12:30 kickoff or wait for Tue). Trade body now matches MAFFL's proven call exactly (`mod_espn.js`, APP_DESIGN §10b).
- **🔒 Keeper Signing Day live (v0.17):** try it: 📥 Desk → Commish · Joe's view → 🔒 Keeper Signing Day → 🧪 Rehearse it, then League → Keepers → build a plan → Declare. Wipe from the same card when done.
- **WS3 part 1 live (v0.11):** 🗓️ Off-season hub + Divisional + Slot draft rooms. Try it: League → Off-season → 🧪 Rehearse Divisional (2025's real order). Next WS3 parts: SPL Draft room (biggest), Shoot Out Draft (Keeper declarations ✅ v0.17) + Seed 3 picks (ESPN `/schedule` write).
- **v0.2: real sign-in.** Backend deployed and healthy (11/25: Sheet ✅, SPL 19583 ✅ 12 teams, test league ✅ 4 teams). Next: Mike runs SPL HQ → Run setup check (seeds owners + shows his passphrase once) → signs in → Ops desk → makes Joe's passphrase → texts it.
- Trade center live in test mode. Next: ESPN execution on the test league (mirror SPL rosters there, then the commish trade write), drops + reactions for the reel.
- Next: Joe answers the 📋 Questions in the app → sign-in + desks + chat → pick-only trade center → ESPN trades on the test league → demo to Joe.

## Open questions (in the app: 📥 Commish desk → 📋 Questions, rebaselined 11/26)
Joe sees 7: ESPN co-commish · test-league demo · **league veto vote in the app** (constitution: 24 h / 6 vetoes in season, 72 h challenge off-season) ·
**Mike's calls** (traded contracts travel, next-season picks only, Divisional Draft rules) · 2027 dates · move league talk to app chat · Joe's #1 wish.
Settled by Mike (retired, answers kept on the Ops desk): keeper_travels, pick_years, div_draft, al_name, trade_review, commish_trades; review_window + chat superseded.
One more question cleanup before the list goes to Joe.

## Recently shipped
- 2026-11-27 · v0.19.0 (backend v0.14.0) · 👋 **Welcome tour** (Mike, after MAFFL REEL). An owner's first signed-in visit: a "This is SPL HQ"
  card (it's yours · live from ESPN · everything but your lineup), then Show me around walks Home → Match → Team (+ the GM desk bar) →
  Chat → League → Desk (commish/ops only) → You, switching tabs, ringing tab buttons gold and cutting out anything else; tab bar stays
  visible; ✕/Skip end it; missing targets skipped; never starts over a deep link or an open sheet. Replay: You → 👋 Show me around again;
  🛠️ Ops desk → 👋 Welcome tour → Replay for me (now) · Replay for them (pick an owner) · Everyone (next open, any phone). Backend: ops
  action `tour` stamps Script property `TOUR_STAMPS`; `me` returns the owner's newest stamp; the app replays once per unseen stamp.
  Smoke test +5. Existing owners (Mike, Joe) see it once on their next open. SW `splhq-v37`.
- 2026-11-26 · v0.18.0 · 🧢 **GM desk** (Mike: one owner desk instead of separate trade + keeper portals, and an obvious way back to your team).
  The Team tab is now your GM desk: a 3-way bar **🏈 Roster · 🔁 Trades · 🔒 Keepers** sits on top of your team, the Trades page, the trade
  grid + builder, and your Keepers page; the one you're on is navy, each shows a live line (record · "1 needs you" in gold / open offers /
  picks · KP left + keepers of 3 / "Declare now" in gold / ✅ Declared). The Team tab stays lit on all of them (your Keepers too, even from
  League). Replaces v0.17.2's two tiles and the grid's "‹ Trades" back. Keepers page: owner pill row gone; someone else's keepers get
  "‹ Your keepers" + an 👀 Other teams picker at the bottom. SW `splhq-v36`.
- 2026-11-26 · v0.17.4 · 🏷️ **Keeper price on every roster row** (Mike: the trade grid must show where each player was drafted). New `kpBadge()` on the
  trade grid, the trade builder and the Team roster: 🔒 gold = carries a contract (next season's KP → final year, TAG for a franchise year);
  blue **R3 · 6 KP** = what keeping him costs, from his round in last season's SPL Draft (UD · 2 KP = undrafted); grey **✗ no ext.** / **✗ cut**
  = can't be kept (contract ran out, terminated; same check as the Keepers page). D/ST skipped. SW `splhq-v35`.
- 2026-11-26 · v0.17.3 · 🏈 Team page: **Keeper contracts card removed** (Mike: the 🔒 Keepers tile is where owners go for keeper info). Roster rows keep their small 🔒 KP tag. SW `splhq-v34`.
- 2026-11-26 · v0.17.2 · 🏈 **Team tab overhaul** (Mike: drop the owner pill row, trading + keepers up top). Your team opens with two big tiles:
  🔁 **Trades** (gold "N need your answer" when an offer waits, else open offers / picks) and 🔒 **Keepers** (Signing Day: declare / ✅ declared,
  else your current plan's KP left + keepers of 3). The owner pill row is gone; other rosters sit behind a 👀 **Other teams** picker at the bottom.
  Someone else's team: ‹ Your team, then Propose a trade · Message · Rivalry · Keepers on top (the bottom Trade center card is gone). SW `splhq-v33`.
- 2026-11-26 · v0.17.1 (backend v0.13.1) · ⚡ **Faster everywhere** (Mike: lots of load times). Measured: every backend call costs ~1 s of
  Google overhead, +~1 s per Sheet read, +2–5 s when ESPN is asked; Home waited on the slowest of 5 calls and the app itself waited on the
  network at every launch. Now: **the app opens from the phone's copy** (service worker cached-first, fresh copy fetched behind it; the ✨
  update check still catches new versions in seconds); **Home draws your last reel instantly** and refreshes in place; **Match** shows the
  last copy of the live week while ESPN answers; **rosters + standings** show the last copy and refresh behind (kept per owner, cleared on
  sign-out). Backend: each tab is read once per request instead of once per helper (sign-in, rules, desk each re-read Owners/Answers).
  SW `splhq-v32`.
- 2026-11-26 · v0.17 (backend v0.13.0) · 🔒 **Keeper calculator → Signing Day in the app** (Mike). League → 🔒 Keepers rebuilt around **plans**:
  up to 3 named scenarios (＋ Plan · Copy · Rename · Delete), yours saved with your sign-in (any phone, private until you declare; other
  teams' plans stay on the phone). Per plan: **✂️ terminate?** on any carried contract (half of each year left lands as a cap penalty),
  **🏷️ Franchise Tag** (year-one KP, then F years, "Your 1st ✗" row), 1y/2y/3y term chips, eligibility on every candidate (under contract,
  no extensions, terminated, picked up in season = "OK only if by Week 14"), cap profile '27–'29, **⚖️ Compare plans** table.
  **✍️ Declare** (while Signing Day is open): server check first (re-priced from gold CSVs on main + your ESPN roster: 10 KP, 3 max, one tag),
  then 🔒 Lock it in → posted to league chat; change it until close (league sees "changed"). Commish can enter one for an owner.
  **📋 Signing Day board** on Keepers + reel. Reel: ⚡ needs-you **Declare your keepers** (`kdecl`), ✅ your declaration, 📋 board → 🏁 results
  (`kboard`, 14 days). **📥 Commish desk → 🔒 Keeper Signing Day:** open live (everyone emailed) or 🧪 rehearse, close date, close now
  (results post), ops wipes rehearsals. Closes by itself after the date (ledger robot's 2-h call finalizes). New backend part
  `mod_keepers.js` (KeeperPlans + KeeperDecl tabs, Script property KEEPER_WINDOW, actions keepers/kplans/kdeclare/kwindow). 🤖 ledger-sync:
  final declarations → gold `data/Keeper_Declarations.csv`; live also adds the new contracts + terminations to `Keeper_Contracts.csv`
  (marked [decl id], once). Rehearsals → `data/test/` only. SW cache `splhq-v31`.
- 2026-11-26 · docs · 🏈 New `docs/ESPN_CAPABILITIES.md` for the Joe conversation: what the app can write to ESPN (proven: trades, add/drop), what ESPN's LM Tools can do that we haven't captured yet (edit H2H matchups incl. the Seed 3 pick, adjust scoring, schedule settings, draft order, keeper rounds, divisions), what ESPN refused (team rename) and what SPL HQ owns because ESPN can't.
- 2026-11-26 · v0.16 (backend v0.12.0) · 🛠️ **WS7 Ops + robots, and the pre-Joe architecture audit** (`docs/OPS_AUDIT_2026-11-26.md`).
  Found: GitHub's cron had never fired here (0 scheduled runs since the repo was made). New backend part `mod_ops.js` + hourly `tick`
  (Apps Script trigger; rides health pings until it's installed): **watchdog** reads every robot's runs from GitHub (`GH_TOKEN`) and runs
  any robot past its interval (ledger 2 h, history 24 h + Tue 6:17 AM ET must-run), never one that's running, just ran or failed;
  **daily Sheet backup** (every tab as CSV, zipped, emailed to the ops account only, when anything changed); checks for Pages = main,
  ESPN cookie age (first-seen tracking, alert at 330 d), GitHub token expiry, Sheet size; **ops emailed when a problem starts and when all
  is clear**. Ops desk: new 🤖 **Robots & watchdog** card (each robot's last good run, ❌ failed + open run, late, "GitHub's schedule hasn't
  fired yet", watchdog log, Run checks now, Back up now). Fixes: History robot freshness now from its own pull stamp (was masked by other
  robots rebuilding league-data.js); service worker deletes old caches (phones kept v1…v27); `robot_push.sh` runs the app check before
  any robot push (robot pushes never start CI); card lines no longer chain off a failed history pull; robots get one concurrency group each (the shared group made GitHub cancel robots fired by the same push); emails left goes gold under 20.
  Runbook: `GH_TOKEN`, trigger, backup + restore, UptimeRobot, launch checklist. Smoke test +21 (watchdog, alerts on change, backup, desk feed). SW `splhq-v30`.
- 2026-11-26 · v0.15.1 · 🩹 Your avatar on reel cards was a stretched oval (its class `me` also matched the header avatar button's pill style). Renamed to `avme`.
- 2026-11-26 · v0.15 · 🎨 **Reel card facelift** (Mike: the cards are the main experience; many wasted space, read oddly or were formatted wrong).
  New card kit after MAFFL REEL's faces (`docs/SPL_REEL_SERIES.md` → The card kit): owner avatars (initials, yours gold-ringed), score bugs,
  mini bugs, matchup heroes, stat tiles, fact chips, bars, meters, ranked rows. Every card redone: 🏁 Your result (headline "L by 15.1" + score
  bug + rank/streak/series chips, story snaps or extends the streak) · 🧮 Your game live (score bug, share-of-points meter, best player chip) ·
  🏟️ Live scoreboard (2×3 mini bugs, yours ringed) · ⏭️ Up next (two big avatars, grade between, series/playoffs/streak chips) · 📣 The week
  (🔥/🥶 tiles + every result by margin with avatars) · 🏅 Week awards (4 tiles: high, coach, low, biggest climb; margins left to The week:
  one fact, one card) · ⭐ Power 5 (big rank numerals, avatars, ▲▼, record; fixed the centered rows) · 📊 Table (W–L + PF, dashed playoff cut,
  "the cut" line) · 🗳️ Game of the Week + 🧠 Quiz (avatars) · ⚔️ Rivalry of the week (series W–L under each avatar, chips) · 📅 History
  (record + closest/biggest tiles + 10 years ago) · 🔒 Keepers + 💸 Cap impact + Signing Day (KP meter + chips) · 💰 Economy (bars by owner) ·
  🎟️ Pick wire (pick tickets + avatars) · 📰 Trade wire (avatars, approved/test chips) · 💬 Chat (byline + big quote).
- 2026-11-26 · backend v0.11.2 · 🔁 **ESPN reads retry on a network blip.** Ops desk → Test league showed red "Address unavailable: <ESPN URL>"
  (Mike, 8:11 AM): Google's fetcher couldn't reach ESPN for a moment, not an ESPN refusal. `espn_()` now tries a read up to 3 times (1 s, 2 s
  apart) and, if all fail, says "ESPN didn't answer (network blip). Try again in a minute." instead of the raw URL. Reads only: writes
  (`espnPost_`) still never retry.
- 2026-11-26 · backend v0.11.1 · 🔀 **WS6 MAFFL ↔ SPL parity.** New `docs/MAFFL_PARITY.md` (read against MAFFL main): what's left to port
  MAFFL → SPL (commish polls first, since the league veto vote rides on them; then announcements, passphrase requests, vault cards…) and a
  hand-back list SPL → MAFFL for when REEL wakes (iOS frame fixes, `robot_push.sh`, ESPN write switch + log, robot freshness, rules from
  answers…). Shipped the two urgent ports: **backend split MAFFL-style** (`logic.js` was 83 KB of a ~95 KB cache ceiling; now core 26 KB +
  `mod_espn`, `mod_social`, `mod_trades`, `mod_drafts`, evaluated in the core's scope; per-part cache under VERSION, 6 h last-good, ops
  emailed if a part won't compile; **loader unchanged, no re-paste**) and **CI** `checks.yml` (backend syntax + size, smoke test loading
  the parts, new `tests/app_check.js` for the inline scripts, `sw.js`, `league-data.js`). No app change.
- 2026-11-26 · v0.14 (backend v0.11.0) · 🎞️ **The reel's science** (Mike: the Pulse is no longer a thing; the cards are the update; follow
  MAFFL REEL's latest docs). New catalog `docs/SPL_REEL_SERIES.md`: every series with its group, drop, lifespan, writer and reaction tray.
  **Drops** (ET, from the Tuesday after the week): 🗞️ Edition Tue 7 AM (🏁 Your result · 📣 The week · 🏅 Week awards · ⭐ Power 5 ·
  📊 The table), 🎯 Play Tue 5 PM (🗳️ Game of the Week: thriller / upset / shootout, one locked vote, results after you vote, closes Thu
  5 PM · 🧠 Quiz: one a week, luckiest win / unluckiest loss), 🗄️ Vault Wed 7 AM (⚔️ Rivalry of the week · 💰 Keeper economy · 🔒 Your
  keepers), ⏭️ Preview Thu 5 PM (⏭️ Up next: next opponent + the two weeks after · 📅 This week in SPL history). Instant: offers, drafts,
  🧮 your live game, 🏟️ live scoreboard, trade + pick wire, cap impact, Signing Day, chat. Weekly budget (you 7 · league 10 · play 3 ·
  vault 4), Needs you first, then newest drop first, you → league → play → vault. Card anatomy everywhere (tag row · hero · story ·
  ≤5 rows · one action · reactions); one fact one card (the top score lives on Week awards only); no "you" in shared headlines.
  **Reactions** only on shared cards, each series with its own tray (MAFFL's). **Votes**: backend Votes tab, `vote` + `social`
  (reactions + votes in one read). 📰 Weekly Pulse **retired**: tile, page, `weekly-pulse.yml`, `data/Weekly_Pulse.json` gone.
  ✍️ New robot `card-lines.yml` → `tools/card_lines.py` → gold `data/Card_Lines.json`: Claude writes the few words on the cards (league
  headline/hot/cold, a result + next line per owner, Power 5), once per week and kept; no token → plain facts. Ops desk: Card lines
  robot line.
- 2026-11-26 · v0.13.6 · 🗂️ **Ops desk accordions (Mike).** Every Ops desk card now folds: 🩺 System & robots · 🔑 Passphrases · 📋 Joe's answers ·
  💡 Feedback (split out of answers) · 🏈 Test league · 🧪 Test trades · 📱 App. Each header carries a status badge so the desk reads at a glance closed
  (blue = fine, gold = needs a look e.g. "1 of 12 set up" / "3 to mirror", red = broken, e.g. "❌ 2 problems"). A red section opens itself.
  Open/closed is remembered per phone (default all closed); Open all / Close all chips on top. New passphrase card stays above, unfolded. SW cache `splhq-v26`.
- 2026-11-26 · v0.13.5 · 📥 **Questions moved off the reel into the Commish desk inbox** (Mike): no more "Questions for Joe" card on Home. On Joe's
  Commish desk the 📋 Questions card sits at the top of the inbox, gold with "needs you" while any are open, and the header button reads
  **📥 Desk · N** (open questions). Mike's Ops desk view unchanged. SW cache `splhq-v25`.
- 2026-11-26 · v0.13.4 · 📋 **Questions for Joe rebaselined** (Mike answered 6 in the app). Joe now sees 7: `espn_lm`, `test_league`, new `veto_vote`
  (Mike's "league veto vote, run in the app" spelled out with the constitution's 24 h / 6-veto in-season and 72 h off-season rules; covers Joe ↔ Mike
  trades, so `commish_trades` retires), new `mike_calls` (one OK for contracts travel as-is, 2027 picks only, Divisional Draft as described),
  `deadlines` (now asks for the 2027 dates by name), new `chat_move` (league chat already shipped), `first_wish`. Retired questions stay in
  `QUESTIONS` with `retired:` so the Ops desk still shows their answers (greyed). Counts on Home + desks use active questions only.
  Mike's answers already drive the rules (latest commish answer wins). Registry: Al = James Farrington now `confirmed`. **Not built yet:** the
  veto vote itself (the trade flow is still commish-approves); build once Joe answers `veto_vote`. SW cache `splhq-v24`.
- 2026-11-26 · v0.13.3 (backend v0.10.2) · 🏷️ **Test team names = real SPL names + "(test)"** (Mike): Mirror's first step renames each ESPN test team
  ("Bad Attitude Gang (test)", "Reeling RaMPaGe (test)", "Farrington's FREELANCERS (test)", "Fluff Muffins (test)"); the Ops card flags teams still to rename.
  LM team edit `PUT …/teams/<id>` `{name}` is **not proven** (MAFFL never wrote team names): read back + logged; if ESPN refuses the full name
  (length), one shorter try ("FREELANCERS (test)"); a rename is idempotent, so that second try can't double-apply.
- 2026-11-26 · v0.13.2 (backend v0.10.1) · 🪞 Mirror v2 + MAFFL's exact trade body. Read MAFFL (`_ops/apps-script/mod_espn.js`, APP_DESIGN §10b): the LM trade write
  now sends MAFFL's proven body (adds `expirationDate`, `isActingAsTeamOwner`, `skipTransactionCounters`; scoring period from `mStatus.latestScoringPeriod`).
  The mirror gains a **move** step: an SPL player sitting on the wrong test team is moved with that proven LM trade instead of drop + add (a dropped
  player goes on waivers and the add could be refused). Order: drop players no SPL team has → move → commish-add the rest. ESPN keepers: not used
  (ESPN keepers are next-season only and can't model SPL contracts; the app's 🔒 tags + cap follow players by name, so demo trades show them).
- 2026-11-26 · v0.13.1 · 🎨 **Limestone gray layer (Mike).** A splash of Penn State's gray on top of Nittany blue + white: page canvas is now a cool
  neutral gray (`#E8EAED`) so white cards and tiles pop, lines/labels/muted text go neutral gray, tab bar is off-white with gray inactive tabs
  (active = navy), and a thin Limestone `#A2AAAD` rule sits under the navy header. Blue still marks everything you tap, win or own; gold/red
  unchanged. All in one "Limestone" CSS block at the end of `<style>`: delete it to go back. SW cache `splhq-v21`.
- 2026-11-26 · v0.13 (backend v0.10.0) · 🏈 **WS5: ESPN writes on the test league + the Joe demo.** Test league 1722387564 keeps **4 teams** (Mike: no need for 12):
  Mike's own ESPN team (found by his SWID) = Mike, the other three by team id = Joe, Al, Glen (`DEMO_OWNERS`). New Ops desk card **🏈 ESPN test league**:
  **ESPN writes** switch (Script property `ESPN_WRITES`, off by default; writes can only ever go to `WRITE_LEAGUE`), each test team vs its SPL roster
  ("14 of 16 match · 1 to drop · 2 to add"), **🪞 Mirror SPL rosters** (commish drops on all 4 teams first, then adds, one player per write, step by step
  with progress, read back after each step; run again to reset after demo trades), and the **ESPN write log** (new Sheet tab `EspnLog`: every write,
  ESPN's answer). **Approved trades** between those 4 owners now execute on the test league: one LM trade write (never retried), then a read-back;
  all players moved → card + league chat say **🏈 Done on ESPN · test league**; anything else → the Commish desk's **Do on ESPN** list with ESPN's reason
  (`espn_note`). Pick-only trades owe ESPN nothing; other owners' test trades stay practice. Offers now keep the ESPN player id. Guards: practice
  trades never touch the real league, real trades never go to the test league. Demo script: `docs/SPL_DEMO_SCRIPT.md`. Smoke test covers mirror,
  trade write, read-back, refusal and the switch.
- 2026-11-26 · v0.12.1 · 👤 **Header + settings cleanup (Mike).** Avatar shows real initials from the Owner Registry full name (Michael Murello → **MM**,
  Joseph Reilly → JR …). Tapping it opens your settings directly (full name, team, @handle, contact info, email toggles, sign out): no "Open settings"
  step, no Role line (desk access still comes from the Owners tab, just not shown). Header **"live" pill removed**: the header now only shows
  **offline** (red, tap for why) when the phone has no signal or SPL HQ can't be reached; "Live" stays on Match where it means ESPN. Offline
  behaviour (POPPY-style): chat messages typed offline wait in an outbox ("⏳ Waiting for signal"), send themselves when the phone is back
  online and a toast says so; every other action refuses up front with "You're offline: nothing was sent" instead of a vague error.
- 2026-11-26 · v0.12 (backend v0.9.0) · 🎞️ **WS4: The Reel (cards).** 🗓️ **Up next** (reel card + top of Your rivalries): your next 3 weeks after the current one:
  opponent, their record and last-3 form, the all-time series line ("You lead 12–10") and a **rivalry grade** (A Blood feud · B Real rivalry ·
  C Familiar foes · D Passing strangers: extra meetings, how even, playoff meetings, graded on the curve since everyone has met ~20 times);
  tap → rivalry page. Week 14 says the Shoot Out opponent comes from the Shoot Out Draft (ESPN's pairing shown as a placeholder), Week 15+
  shows your playoff spot today. Grades also on Rivalries + each rivalry page. 🔥 **Reactions** on league cards (🔥 😂 😬 👏 💀 🐐, tap again to
  undo). 📰 **Weekly Pulse**: new robot `weekly-pulse.yml` → `tools/pulse.py` builds the week's facts from gold only
  (results, table + rank moves, streaks, all-time series, season high, Coach of the Week = biggest jump over his own average, next week's
  pairings) and Claude writes headline, game lines, a line for every owner, Coach of the Week, power ranking and previews (validated JSON; no
  token → template edition; Claude failed → template + red Action). New League tile 📰 **Weekly Pulse** (archive by week) + reel cards: the
  Pulse, and 🎙️ **Your week in a line** (Claude-written card line). 🎟️ **Pick trade wire** (every pick that's changed hands), 📰 season trade
  wire (count + most active), 💸 **Cap impact** after a trade moves a keeper contract (2027 KP in/out, KP left), 🔒 **Signing Day** countdown
  in the off-season (needs-you in the last 3 days). Saved/Done copies drop the live reaction row. Ops desk: Pulse robot + Schedule lines.
  🤖 `espn-history.yml` now runs **daily** and also writes gold `data/SPL_Schedule.csv` (games still to play) for Up next and the Pulse preview.
  Backend: Reactions tab, `reacts` / `react`.
- 2026-11-26 · 🤖 Robot fix: two robots fired by one push both rebuilt `league-data.js` and the second failed its rebase (ledger-sync on the v0.11 push). New `tools/robot_push.sh` (used by all three robots): rebase, keep the robot's own gold, rebuild `league-data.js` from the merged data, push; 3 tries; stops if the rebuild fails.
- 2026-11-26 · v0.11 (backend v0.8.0) · 🗓️ **WS3 part 1: the April drafts run live in the app.** New League tile **Off-season**: countdown to the
  2027 off-season, every event in order (Winter Meeting, Divisional, Slot, Signing Day, SPL Draft, Shoot Out) with the 2027 orders computed from
  the 2026 finish ("if the season ended today" until the SPL Bowl is final; checked against 2025: the computed orders match what the league did).
  🧭 **Divisional Draft room**: 4 founders snake 1-2-3-4-4-3-2-1; tap an owner, then your division or "Assign here" (one assigned-in per
  division; a full division must assign). 🎰 **Slot Draft room**: claim a slot 1–12, each shows its snake picks. Commish (desk roles) opens a
  draft (order prefilled, ↑ to adjust), can enter a pick for an owner not signed up yet (league sees "entered by"), undo the last pick, cancel.
  🧪 Rehearsals use the last finished season's real order; ops clears them. League chat gets every pick; the owner on the clock gets an email
  (new Settings toggle **On the clock**, on by default) and a ⏱️ needs-you reel card; live + results cards for everyone. Needs-you cards now
  always lead the reel. Backend: Drafts + DraftPicks tabs, `drafts`/`draftopen`/`draftpick`/`draftundo`/`draftcancel`/`draftwipe`, ledger feed
  gains finished drafts. 🤖 `ledger-sync` now also writes gold `data/Offseason_Drafts.csv` (rehearsals → `data/test/`), and `build_data.py`
  derives `offseason` (divisions + SPL Draft slots by season) for the SPL Draft room. New 📋 question for Joe: does the Divisional Draft work
  the way the app runs it? (Re-seeded brackets like 2024 put both wildcard winners on the champ's side; the app counts the one who fell to the
  champ on his side and flags it.)
- 2026-11-26 · v0.10 · 🏆 **WS2 League screens** (no more "Coming soon" on League). 📖 **Rules**: rulebook from new gold `data/SPL_Rulebook.md`
  (the 2023 constitution, same words, rebuilt for the phone), search with highlights, each section badged ✓ current / Joe to confirm / out of date;
  🗓️ Timeline (`data/Season_Calendar.csv`: 2027 off-season dates + how the league got here); ⚖️ vs ESPN (`data/Rules_Conflicts.csv`, C1–C10).
  🔒 **Keepers**: Signing Day countdown (from the draft date once set), 2027 cap card (committed / penalties / plan, KP left, x of 3),
  2027–29 cap profile, 🧪 try a signing (roster from ESPN when signed in, or search; price from the 2026 draft round; plans saved on the phone),
  every contract in the league. 📝 **Draft**: 2026 board by round, traded picks ("via X"), who got/gave, per-owner view (gold `data/Draft_Picks.csv`).
  📚 **History**: trophy case + every season 2004–2026 (champion, runner-up, playoff games, table); gaps 2004–05 + 2020–21 marked and ready to
  backfill in `data/Season_Results_Manual.csv`. 🎓 **GM Rankings**: careers from every game, sort by titles / win % / playoffs / points, tap for each
  season. All derived in `tools/build_data.py` → `league-data.js`. 🤖 New robot `build-data.yml`: any change in `data/` rebuilds `league-data.js`
  (so History/GM also refresh with every weekly ESPN pull). Not yet: Joe marking sections current/stale from his desk (needs WS1 desk + backend),
  2019–25 draft boards, Glen's own GM formula.
- 2026-11-26 · v0.9 (backend v0.7.0) · 📥 **Desks behind the login (WS1)**. Commish + Ops desks and 📋 Questions are out of the League tab (League = owner stuff only). A **Desk** button sits in the header next to your initials, only for desk roles: Joe → 📥 Commish desk; Mike → 🛠️ Ops desk with an **Ops | Commish · Joe's view** switch. Joe's view is read-only for Mike except where the rules need him: trades Joe is in (no self-approval) and backup on any trade that has waited **48 h** on Joe (`BACKUP_WAIT_H`, enforced in the backend; locked trades say why and how long to go). Pick ledger fix is Joe's (backend refuses Mike). Wipe test trades moved to the Ops desk. Ops desk is ops-only. Reel's "trades to approve" card counts only trades you can act on.
- 2026-11-26 · 📜 Constitution in the repo: `docs/SPL_CONSTITUTION_2023-06-12.md` (verbatim from Mike's .docx; June 2023 draft, stale on dues/prizes/roster, see ESPN conflict register C1–C10). Source for the Rules screen (build order step 3). New find: Appendix Three Shoot Out matchmaking (Week 14 opponents) — another ESPN-can't-model screen.
- 2026-11-26 · backend v0.6.1 · Rules follow the latest answer from **either commish** (Mike answered keeper_travels = travels 11/26), not only Joe.
- 2026-11-26 · v0.8.3 · 📱 Footer confirmed fixed. Header: installed on the Home Screen, iOS blurs a band just below the status bar, softening the crest + title; when installed the header contents now start 16 pt lower (`html.sa`), browser unchanged.
- 2026-11-25 · v0.8.2 · 📱 Home Screen bottom gap (round 3): installed with a see-through status bar, iOS reports a viewport one status bar (~54 pt) shorter than the screen, so the frame stopped short and navy showed under the tab bar. A tiny script sizes the frame to `screen.height` when installed + portrait (browser unchanged). Top is confirmed fixed (navy behind the clock).
- 2026-11-25 · v0.8.1 · 📱 Home Screen header/footer, round 2 (Mike's screenshot): the hidden ✨ Update pill was parked under the status bar, and iOS blurs anything there (the washed-out band, with the pill's text faintly visible). Pill is now not rendered until needed and drops in below the header. html/body are navy (only the scrolling middle is light), tab bar labels sit closer to the home indicator, white to the bottom edge.
- 2026-11-25 · v0.8 (backend v0.6) · 🤖 **Ledger robot** (`ledger-sync.yml`, every 2 h): approved trades → `Trade_Log.csv`, live pick ledger →
  `Draft_Pick_Ownership.csv`, keeper contracts follow traded players in `Keeper_Contracts.csv` (marked `[trade id]`, applied once), then
  `league-data.js` rebuilt. Test mode writes to `data/test/` only. **Rules from Joe's answers**: pick seasons (next 1/2/3) seed themselves;
  contracts travel or reset. 🎟️ **Pick ledger fix** on the Commish desk (move a pick with a reason; league chat told). Ops desk: Ledger
  robot freshness + rules in force. Backend: public `?action=ledger` (league facts only, no notes/contacts), `pickfix`.
- 2026-11-25 · v0.7.1 · 🤖 Automated upkeep (Mike: the site maintains itself). History robot runs every Tuesday ~6 AM ET (+ Wednesday backstop) and rebuilds `league-data.js`; Ops desk shows "History robot · updated N ago · through YYYY wk N" (red if older than 9 days). CLAUDE.md gains the standing rule: anything that goes stale gets a robot.
- 2026-11-25 · v0.7 · ⚔️ **Rivalries** + league history. New robot `.github/workflows/espn-history.yml` (`tools/pull_history.py`, secrets ESPN_S2/SWID)
  pulled every SPL season ESPN has into gold `data/SPL_Matchups.csv`: 2006–2026, ~1,800 games, every team resolved to an owner via the
  registry (added alias "Alan Farrington" → farrington). **Gaps:** ESPN has no scores for 2020 + 2021 (schedules only, all 0–0) and nothing
  before 2006 (Glen's GM Report counts from 2004). Check vs GM Report: Mike vs Joe playoffs 3–0 ✓. `tools/build_data.py` derives the
  compact game list into `league-data.js`; the robot rebuilds it when it re-runs (by hand: Actions → ESPN history pull → Run workflow).
  App: League → Rivalries (you vs every owner, any owner's view), rivalry page (series, regular/playoffs, points, last 5, streak, biggest
  wins, closest, shootout, playoff meetings, every game by season), ⚔️ series line on Match and the reel's Your game card, Team → ⚔️ Rivalry.
- 2026-11-25 · v0.6 (backend v0.5) · Three MAFFL REEL ports (Mike). 🔁 **Trade grid**: Trades → Browse all teams shows every SPL roster side by side,
  scroll left/right, yours pinned on the left, grouped by position with 🔒 keepers and 🎟️ pick counts; tap a team → **side-by-side builder**
  (you send | they send, tap players + picks, live summary, note, Send/Counter). ⚙️ **Settings** (initials → Settings): @handle (unique),
  up to 2 emails + mobile (owners only, Sheet only), email toggles with All on / All off (offer received, counter, accepted, declined,
  commish decision, DMs + @mentions max one per chat per 30 min, commish announcements on by default). Team tab shows 💬 Text / 📞 Call /
  ✉️ Email for other owners who filled theirs in. ✨ **Update ready** pill: the app fingerprints itself and checks for a newer copy on open,
  on return and every 10 min; reloads by itself after 10+ min away unless you're typing. Backend: `settings`, `savesettings`, `contacts`,
  `notify_` hooked to offers, answers, commish decisions, DMs and @mentions; Owners tab gains handle/email/phone/notify.
- 2026-11-25 · v0.5.2 · 📱 iPhone layout fix (Mike's screenshot: tab bar floating above the bottom, washed-out band over the header). App now uses MAFFL REEL's app frame: header, scrolling middle and tab bar fill the screen as one column (no fixed bars over a scrolling page); tab bar sits on the bottom edge with the home-indicator space inside it; navy runs under the status bar. Chat composer and Send answers stick to the bottom of the scroll area.
- 2026-11-25 · v0.5.1 · 🎨 "Nittany" theme (Mike): Penn State blue + white replaces the black/neon Stadium Lights look. Navy header, white cards, Beaver Blue buttons and accents, gold only for Needs-you/keeper tags, red only for alerts. Status bar + manifest navy; Home Screen icons re-backed on navy (`?v=3`). Re-add the Home Screen icon to pick up the new icon.
- 2026-11-25 · v0.5 · 🔁 **Trade center** (test mode). Offers mix players + 2027 draft picks; keeper contracts travel with their player (🔒 shown
  with KP). Flow: offer → accept / decline / counter / withdraw → commish approve / negate (reason) → picks move in the ledger. Players checked
  against live ESPN rosters, picks against the Picks tab (seeded: every team owns its own 2027 rounds 1–17), double taps return the same offer,
  a counter declines the original. Nobody approves their own trade; a Joe ↔ Mike trade can be approved by either and the league card says so
  (new question for Joe). SPL HQ posts trade cards into the DM and league chat (Open trade ›). 📥 Commish desk screen (trades to approve,
  Do-on-ESPN steps, recent decisions, Ops: wipe test trades). Reel: needs-you offer cards, commish "N trades to approve", 📰 trade wire cards.
  Team tab: Propose a trade / Your trades + picks. League grid: Trades + Commish desk. Backend v0.4 (`trades`, `offer`, `respond`, `tradeact`,
  `wipetrades`; Offers + Picks tabs; Chat gains `ref`). `TRADE_MODE = "test"`: nothing is owed on ESPN until Joe signs off.
- 2026-11-25 · v0.4 · 🏠 **Home is the reel** (Mike: match where MAFFL REEL landed): one card per screen, scroll up for the next; swipe
  ← ✓ Done / → ⭐ Save with Undo; ⭐ Saved + ✓ Done chips open their cards (Saved stays until acted on, Done clears after 7 days);
  "N left", progress rail on the right; Needs-you cards lead and shake instead of swiping; "All caught up" end card.
  SPL cards so far: Sign in (guests), 📋 Questions for Joe (commish/ops, until all answered), ⚔️ Your game, 🏟️ Week scoreboard,
  🚀 Top score, 😬 Closest game, 📊 The table, 🔒 Your 2027 keepers (KP committed of 10), 💰 Keeper economy 2027, 💬 new in league chat.
  Per owner, per week, on the phone. Not yet: drops/series timing, reactions, card lines from Claude (next reel steps).
- 2026-11-25 · v0.3.1 · ESPN still names Joe's team "Reilly's RaMPaGe" and divisions differ from the registry: backend matches teams to owners through every registry alias (Match, Team, Standings), and Team shows ESPN's division.
- 2026-11-25 · v0.3 · Tabs built. ⚔️ **Match**: week stepper, your game (scores, records, projections, players left), lineups side by side by slot
  (points, opponent, kickoff, stat line, injury), bench, every game of the week (tap to open); live week refreshes every minute.
  🏈 **Team**: any owner's ESPN roster (starters / bench / IR, season pts + avg, how acquired, injuries) with 🔒 keeper tags,
  keeper contracts table (KP 2026–28, franchise tag, cut penalties) from gold `data/Keeper_Contracts.csv` → derived `league-data.js`
  (`tools/build_data.py`), Message button, trade-center teaser. 💬 **Chat**: league room + DMs with any owner, 8-second refresh,
  unread badge on the tab, delete your own (commish can delete league messages; nobody reads others' DMs). Home: your-game card.
  Backend v0.3: `week`, `rosters` (signed-in only: the league is private), `chat`/`chatsend`/`chatdel`, Chat tab; reads skip the lock;
  per-owner send limit replaces the global one.
- 2026-11-25 · backend v0.2.2 · Run setup check makes Mike a fresh passphrase every time until he has signed in once (he closed the first alert before copying it).
- 2026-11-25 · v0.2.1 · 🛡️ Real SPL shield logo (from Mike): header crest (→ Home), browser tab favicon, iPhone Home Screen icon (180), Android/PWA icons (192/512 + maskable) on Night. Icons cache-busted `?v=2`, service worker cache `splhq-v2`. Already-installed Home Screen icons keep the old art until the owner removes and re-adds SPL HQ.
- 2026-11-25 · v0.2 · 🔑 Owner sign-in (Mike: Joe gets a real login, like every owner). Passphrases (WORD-WORD-123) stored as peppered HMAC
  (`PIN_PEPPER` auto-created), phones keep a device token, a new passphrase signs old phones out, sign-in pauses after 30 wrong guesses/hour.
  Owners tab seeded by Run setup check (Joe = commish, Mike = ops + commish); Mike's first passphrase shown once in that alert.
  Ops desk: owners list (set up / last signed in), Make one / Reset → passphrase shown once with Text it / Copy message. Questions + Ideas
  need sign-in and record the signed-in owner; Questions show only to commish/ops and reload earlier answers. App `API_URL` set. Backend logic v0.2.
- 2026-11-25 · v0.1 · Foundation: app shell (Stadium Lights, tabs Home · Match · Team · Chat · League, crest, Home Screen install, offline cache),
  📊 Standings live from ESPN 19583, 📋 Questions for Joe (answers → Answers tab + email), 💡 Ideas & feedback, 🛠️ Ops desk (health, Joe's answers),
  backend loader + logic v0.1 (health, standings, answers, feedback; ESPN reads only), smoke test, CLAUDE.md, runbook.
