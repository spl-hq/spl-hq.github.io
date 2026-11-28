# SPL HQ — Status

_Read first. Newest on top._ **Last updated:** 2026-11-28 by Claude (chat, v0.27.6 History ↔ Draft links + draft recaps; v0.27.5 Saved/Done card actions; v0.27.0: 🍂 off-season switch; before it v0.26.7 no off-season button)


## Now
- **🍂 Off-season switch live (v0.27, backend v0.21.0):** 📥 Commish desk + 🛠️ Ops desk → 🍂 Season / off-season → *Switch to off-season*. Gold nudge (desk card + Home Needs you)
  once ESPN has no games left; nothing flips by itself. **Mike:** try 👁️ *Preview off-season* on the Ops desk (your phone only) before Joe flips it.
- **🚀 Getting Joe in (Mike 11/27, ready):** backend healthy (Sheet ✅, SPL 19583 ✅, test league ✅, ESPN writes off, 1 of 12 signed up).
  ① Preview first: 🛠️ Desk → 📥 Commish · Joe's view (exactly his desk, no test/robot tools). ② 🛠️ Ops desk → 🔑 Passphrases → Joe → Make one →
  Text it (the message has the link, the Add to Home Screen tip and "a one-minute tour shows you around"). ③ Joe signs in → the welcome tour
  runs once (2 cards + 8 stops, his 📥 Commish desk included). ④ His Desk shows **8 questions** (refreshed 11/27). ⑤ Watch 🛠️ Ops desk →
  📋 Joe's answers + 💡 Feedback. If he needs it again: Ops desk → 👋 Welcome tour → Replay for them → Joe.
- **WS7 ops ready-check (v0.16, backend v0.12.0):** audit in `docs/OPS_AUDIT_2026-11-26.md`. Big find: **GitHub's schedule has never fired on this repo**, so the backend's new hourly watchdog now runs late robots itself. **Mike, three one-time steps (runbook):** ① Script property `GH_TOKEN` (fine-grained, this repo, Actions read+write, 1 yr) ② Apps Script ⏰ trigger on `tick`, hourly ③ UptimeRobot on `?action=health`. Then Ops desk → 🤖 Robots & watchdog should read ✅ all good. ESPN writes are ON (test league): off after the demo.
- **Reel v0.14 (backend v0.11.0): no Pulse, the cards are the update.** Catalog: `docs/SPL_REEL_SERIES.md` (after MAFFL REEL_SERIES v2.1). **Mike: add the GitHub secret `CLAUDE_CODE_OAUTH_TOKEN`** (`claude setup-token`) so Claude writes the card lines; then Actions → Card lines → Run workflow. Until then the cards show plain facts.
- **WS5 ready to try (v0.13, backend v0.10.0):** the 4-team ESPN test league mirrors Mike, Joe, Al and Glen's real SPL rosters, and approved trades between them move on ESPN by themselves. **Mike:** Ops desk → 🏈 ESPN test league → turn writes on → 🪞 Mirror SPL rosters (a quiet day: locked players may refuse). Then the demo: `docs/SPL_DEMO_SCRIPT.md`. **Not run yet:** ESPN writes ship off and the mirror only runs when Mike taps it (Thanksgiving: run it before the 12:30 kickoff or wait for Tue). Trade body now matches MAFFL's proven call exactly (`mod_espn.js`, APP_DESIGN §10b).
- **🔒 Keeper Signing Day live (v0.17):** try it: 📥 Desk → Commish · Joe's view → 🔒 Keeper Signing Day → 🧪 Rehearse it, then League → Keepers → build a plan → Declare. Wipe from the same card when done.
- **WS3 live (v0.11 → v0.21):** 🗓️ Off-season hub + Divisional + Slot + 🎯 **Shoot Out** draft rooms; the app goes into **off-season mode** when Joe or Mike flips the 🍂 switch on their desk (v0.27, never automatic). Try it: League → Off-season → 🧪 Rehearse Shoot Out (2026's real table). **Launch plan (Mike 11/27):** show Joe, then the league goes live after the 2026 season (`LIVE_SEASON` = 2027 in the app; desks see in-season prompts now). SPL Draft room ✅ v0.22 (League → Drafts → SPL Draft; commish: Off-season → 🧪 Rehearse SPL Draft). Next WS3: ESPN writes for the draft (key the board into ESPN's offline draft) + Seed 3 / Shoot Out ESPN `/schedule` write (capture the LM Tools call; until then the commish sets Week 14 by hand).
- **v0.2: real sign-in.** Backend deployed and healthy (11/25: Sheet ✅, SPL 19583 ✅ 12 teams, test league ✅ 4 teams). Next: Mike runs SPL HQ → Run setup check (seeds owners + shows his passphrase once) → signs in → Ops desk → makes Joe's passphrase → texts it.
- Trade center live in test mode. Next: ESPN execution on the test league (mirror SPL rosters there, then the commish trade write), drops + reactions for the reel.
- Next: Joe answers the 📋 Questions in the app → sign-in + desks + chat → pick-only trade center → ESPN trades on the test league → demo to Joe.

## History: what's missing
`docs/HISTORY_NEEDS.md`: what's on file, what robots will pull from ESPN (drafts 2006–25, transactions, team names, final rosters, retry 2020–21), and Mike's ranked list (keeper history 2019–23 first; then 2020–21 + 2004–05 if ESPN can't; pre-app trades; off-season drafts before 2024; ownership changes; payouts; rule changes; lore). Mike: drop the raw SPL Packet(s) as-is.

## ⚠️ Found in email, needs Joe/Mike (11/28)
- **Shoot Out:** the league voted it out in Jul 2025 (random Week 4 games instead, Joe confirmed in the 8/28/25 draft email), but the app
  (rulebook, SPL Calendar, Shoot Out Draft room, card-lines robot) still runs the 2023 Week 14 rules. Did 2026 play a Shoot Out? If not, retire it.
- **2005 champ:** History/GM Report say Seth; Glen signed his 2007 email "2005 SPL Champ" (and Rich in 2012 disputes Glen's "first" title).

## Open questions (in the app: 📥 Commish desk → 📋 Questions, rebaselined 11/26)
Joe sees 8 (history_gaps added 11/27): ESPN co-commish · test-league demo · **league veto vote in the app** (constitution: 24 h / 6 vetoes in season, 72 h challenge off-season) ·
**Mike's calls** (traded contracts travel, next-season picks only, Divisional Draft rules) · 2027 dates · move league talk to app chat · Joe's #1 wish.
Settled by Mike (retired, answers kept on the Ops desk): keeper_travels, pick_years, div_draft, al_name, trade_review, commish_trades; review_window + chat superseded.
Question cleanup done 11/27 (espn_lm now covers the SPL Draft load; chat_move covers division rooms, DMs and @ tags).

## Recently shipped
- 2026-11-28 · v0.27.6 · 📋 **History ↔ Draft boards linked, with draft highlights** (Mike: History had no draft link or summary). Each
  season page gets a **📋 The YYYY draft** card: No. 1 pick, Round 1 by position, first QB off the board, the champion's title draft (first
  two picks, keepers, how many of his picks were on the title roster), a late find (Rd 8+ pick still rostered at season's end), keepers +
  tags, traded picks (Packet boards only), then *Open the YYYY draft board ›*. Each era card gets a 📋 Drafts chip row ('06–'26, no 2020);
  each draft board gets a "🏆 X won YYYY · see the season ›" link back. Pick-order lines are skipped on ESPN keeper years (2013 etc.:
  keepers were keyed as early picks). All computed in the app from the boards + final rosters, so new boards show up by themselves (no robot).
  History now preloads player-history.js. SW `splhq-v94`.
- 2026-11-28 · v0.27.5 · ⭐/✓ **Saved + Done actions moved into the card** (Mike): each card in the sheet gets a top bar with ↩ *Back to Home* + ⭐ Save / ✓ Done instead of buttons under it. Fix: *Back to Home* was keyed to the Match screen's week (`WEEK`), so it vanished unless Match had been opened; now keyed to the Home week (`FEED_W`). Cards from a finished week say "Week N is over" (Home only builds the current week). sw cache v93.
- 2026-11-28 · v0.27.4 · 📋 **Joe's 3 questions redone** (Mike, before Joe's first login): 1) `history_gaps` (now active, rewritten: what the app
  already has, then a numbered "still missing" list; Drive share first), 2) **`espn_writes`** (new; replaces `espn_lm`): is he comfortable with the
  app writing to ESPN, needs Mike's team as co-commish, Mike built a test ESPN league to show it, nothing touches the real league until he says,
  3) `rules_rewrite` (2027 constitution around the app). `first_wish` + `veto_vote` parked (`later`). Intro card names the three; question text
  keeps its line breaks (pre-line). SW `splhq-v92`.
- 2026-11-28 · v0.27.3 · 📖 Rules → **📱 App · ESPN · Email** is now a side-by-side chart (Mike: wanted a comparison chart, and email as the third
  column: trades, draft picks, drafts, keepers and the GM Report all used to go by email). Columns ESPN · Email · App; ● do it here now, ○ used to
  happen here, ↻ updated for you. Trades row: App ●, Email ○, ESPN ↻ (dropped the confusing "trade on your ESPN roster = ESPN" row). SW `splhq-v91`.
- 2026-11-28 · v0.27.2 · 📖 Rules: new **📱 App or ESPN** tab (Mike: owner-facing "which site do I use for what", not commish detail). Side-by-side list
  by Every week / Trades / Off-season / Around the league, each row tagged App, ESPN or Both with one line of why; "rule of thumb" card on top
  (game day = ESPN, everything between the games = the app). Content is the `WHERE` array in index.html: list only what the app does today. SW `splhq-v90`.
- 2026-11-28 · v0.27.1 · 📖 Rules: **⚖️ vs ESPN tab removed** (Mike: it was build scaffolding for Mike + Joe, owners never see it). Rules is the
  rulebook only. Its open items became 4 **Questions for Joe**, parked as a "rulebook rewrite" batch (`later:`, visible on the Ops desk):
  `rules_rewrite` (2027 constitution written around the app), `playoff_rules` (tiebreaks + Seed 3/Seed 1 picks), `money_rules` (dues/prizes),
  `late_adds` (Week 14 add rule + the 2021 FAAB-payout note). `data/Rules_Conflicts.csv` retired; rulebook notes no longer cite C-ids. SW `splhq-v89`.
- 2026-11-28 · v0.27.0 (backend v0.21.0) · 🍂 **Off-season switch** (Mike: "we click the button, not automatic or date-based"). Backend: Script property
  `PHASE` {phase, by, at, season}; `setphase` (commish/ops only, confirm in the app) posts one league-chat line on the flip to the off-season (none
  going back); phase rides on `me` and public GET `?action=phase` (signed-out phones, future robots). App: `offSeason()` now reads the switch
  (the old "no games left on ESPN" test is just `bowlFinal()`, the nudge); phones re-check on open and when they come back to the foreground.
  Desk card on both desks (status, flip, *Back to the season*; Ops: 👁️ Preview on this phone only). **Off-season format:** Home: "off-season is open"
  card (14 days) + the existing off-season cards/budget; Match: 🏁 season-in-the-books recap (champ, runner-up, your finish) + playoffs link + final
  standings, weeks still browsable; Team: keepers lead the GM bar + 🍂 "Your off-season" card (keepers, Signing Day, picks owned); League: Drafts
  row in date order with each draft's date. Robots: card-lines not gated (the Bowl recap still gets written if Joe flips that night; no games =
  nothing new to write). Smoke +8. SW `splhq-v88`.
- 2026-11-28 · v0.26.7 · League tab: **off-season hero card removed** (Mike: no off-season button; the whole site gets formatted for the
  off-season instead). Shoot Out banner unchanged. SW `splhq-v87`.
- 2026-11-28 · v0.26.6 · 🏆 League tab: **ℹ️ Info moved to the top** (Mike), above Drafts and The league. Tour text follows. SW `splhq-v86`.
- 2026-11-28 · v0.26.5 · 🏆 **League tab tightened** (Mike): sections 🗓️ Drafts · 🏛️ The league (Draft boards, History, GM Report, Rivalries) ·
  ℹ️ Info (SPL Calendar, Rules). Tiles are compact rows (icon left, title + one-line sub, ellipsis instead of wrapping); subs shortened
  (draft subs: "On the clock", "🔴 Joe up"). Whole tab fits at 390×844 with room for the off-season card. Draft boards icon → 📋. Tour text updated. SW `splhq-v85`.
- 2026-11-28 · v0.26.4 (backend v0.20.1) · 🎟️ **Pick ledger fix retired** (Mike: "we'll reconcile as necessary, no formal tool"). Card gone from the Commish desk; backend `pickfix` action + `pickFix_` removed (and its smoke tests). Pre-app pick trades get reconciled by hand in the Sheet Picks tab; the ledger robot copies them to gold as before. SW `splhq-v84`.
- 2026-11-28 · v0.26.3 · 💡 **Ideas moved off League into your settings** (Mike). League grid is now 6 tiles (even 3×2); the You screen (tap your initials)
  gets a 💡 Ideas & feedback card → the same send screen, which now backs out to Settings. Tour stops updated (League no longer mentions Ideas; 👤 You does). SW `splhq-v83`.
- 2026-11-28 · v0.26.2 (backend v0.20.0) · 👀 **Who's using it** (Mike: "monitor Joe's usage, what he's clicking"). First-party, no Google
  Analytics (CLAUDE.md: no third-party scripts; and since everyone signs in, our own log already knows it's Joe). App: each screen visit
  (with seconds on it) and every button/chip/link tap queue on the phone (never typed text, never signed-out visitors) and post as one
  `track` call a minute + one on going to the background (keepalive). One capture click listener, nothing on the render path, so no
  speed cost. Backend `mod_usage.js`: new Sheet tab `Usage` (ts, who, kind, what, where, n), one Sheet write per batch, `track` skips the
  script lock and the send limit. **Ops desk → 👀 Who's using it** (first section): per owner last seen, visits + minutes this week / 30
  days, where the time goes, what gets tapped, the latest 40 things; "Not in yet" list. **Robot (hourly tick):** ops emailed the first
  time each owner opens the app, a 7 AM ET recap of yesterday (non-ops, nothing on a quiet day), rows past 120 days trimmed. SW `splhq-v82`.
- 2026-11-28 · v0.26.1 · Roster rows: dropped "Joe's pick" (whose slot) from the drafted line, too much noise (Mike). SW `splhq-v81`.
- 2026-11-28 · v0.26 · backend v0.19.0 · 🏷️ **Trade block + roster rows rethought** (Mike). Roster rows drop season total points (useless) and
  keep **Avg** with the player's **position rank** under it (QB3, WR1: by pts/game across every SPL roster). The "Drafted / Waiver" line now says
  **how he got here**: 🔒 Kept · yr 2 of 3 · from Rd 6 '24 · Drafted Rd 2 '26 · #20 · Joe's pick · Waiver · Sep 17 · Trade · Oct 21 (ESPN's
  acquisition date, new `ad` in `rosters_`). The KP badge on roster rows is just the price now (the round moved to that line).
  **Trade block:** ＋ Block on each of your players (optional "looking for" note) → new Sheet tab `Block`, `blockset` action, `block` in the
  trades feed; one line to league chat when someone goes on. The league sees it on Trades (🏷️ Trade block card, Trade › per team), other
  teams' rosters (🏷️ Block tag + note), the trade grid (gold outline) and the player file. **Not gated by the trade deadline** while in test
  mode (Mike: so Joe can see it); `BLOCK_DEADLINE` in mod_trades.js is the switch for launch. Smoke test +5. SW `splhq-v80`.
- 2026-11-28 · v0.25.16 · 📚 **The Road Show split** (Mike): 2006–12 stays The Road Show; **2013–18 = The Parity Years** (six seasons, six
  different champions). No milestones in 2013–18 yet (the Gmail Packet sweep should add some). Seasons with no runner-up on file (2003–05) say
  "SPL champion (runner-up not on file)" instead of "beat ?". SW `splhq-v79`.
- 2026-11-28 · v0.25.15 · 📚 Era renamed **The NFL.com Experiment** (2019–21, Mike). **Mike + Pete joined in 2006** as the expansion to 12 (Mike):
  registry `first_season` 2006 for both, the 2006 milestone says so. **History gaps → one short list for Joe** (`docs/HISTORY_NEEDS.md` top:
  his 2019 SPL Google Drive, 2020–21 NFL.com, 2003–05 + the 2005 champ, money, Shoot Out 2026, lore; Glen: 2012 keeper report + old GM Reports),
  same list in Joe's app question `history_gaps` (still `later`). Next: Claude sweeps the ~186 SPL attachment threads in Mike's Gmail first. SW `splhq-v78`.
- 2026-11-28 · v0.25.14 · 📚 **History by era + "How the league got here" from Gmail** (Mike: the timeline doesn't belong in Rules, the SPL
  Calendar covers dates; make it lore, MAFFL-style eras). Rules loses its 🗓️ Timeline tab (`#rules=timeline` falls back to the rulebook).
  New gold `data/League_Timeline.csv` (eras + milestones; milestones moved out of `Season_Calendar.csv`) → `timeline` in league-data.js.
  History: Trophy case, then one card per era (newest first): name, blurb, that era's champs, a folding 📜 How we got here, then its seasons.
  Draft eras: The Founding (2003–05) · The Road Show (2006–18) · The Paper Trail (2019–21) · The Modern SPL (2022–25) · The SPL HQ Era (2026–).
  16 new milestones from league email (Mike's Gmail): Mike takes the 11th seat + 12 teams/4 divisions (2006), Vegas draft at the Mirage (2006),
  online draft + Glen's wiki (2007), PSU draft weekend (2008), first GM Report (2011), rule votes on draft day (2012), NFL.com 2020–21,
  Divisional Draft, first constitution + COVID amendment, Signing Day → 10 days out, trophy rebuild (2020), back on ESPN (2022), Shoot Out fix +
  6/12/2023 constitution, State College draft (2023), flat fees (2024), **Week 14 Shoot Out scrapped (Jul 2025, Proposal A 7–4: random Week 4
  cross-division games, $100 to the SPL Bowl prize)**. SW `splhq-v77`.
- 2026-11-28 · v0.25.13 · ▦ **Draft boards grid fixes** (Mike): keepers moved to the **top**, right under each team name (🔒 rows, gold
  rule under them, no banner), rounds below. **Bug:** Grid ↔ Rounds didn't redraw (same hash, no hashchange) until you changed year; now
  `draftV` re-renders. **One scroller:** the grid now fills the screen below the chips (`fitHistGrid`, refit on resize / opening the note)
  and the page itself doesn't scroll in grid view; legend + notes folded into "ⓘ About this board" above the grid. SW `splhq-v76`.
- 2026-11-28 · v0.25.12 · 🔒 **Draft boards: keepers carved out** (Mike: use the keeper data as gold; keepers aren't part of a round, put
  them locked in at the bottom under each team). Grid: rounds first, then a gold **Keepers** band and K1…Kn rows under each team (🔒 + deal
  length, 🏷️ tag), tap → player file. Rounds view + owner view get a 🔒 Keepers card. Source: new `keep` in league-data.js from
  `Keeper_Matrix_History.csv` (2019–26; terminated rows are penalties so they're out; a matrix name re-drafted that season stays a pick;
  tags kept). ESPN-only years use ESPN's keeper flags (2013 only); 2006–12 and 2014–18 have no keeper record, so keepers there are ordinary
  picks (said on screen). ESPN boards now sit each pick under the team that made it (two in one round stack in the cell), round as ESPN
  logged it, with a note that Joe's ESPN entry may not be the real draft order. Empty rounds are skipped; unnumbered gold picks get their
  pick number from the team's slot. SW `splhq-v75`.
- 2026-11-28 · v0.25.11 · ⭐ **Power 3: one take + three tiles, not a paragraph** (Mike: "a blob of text"). Each team: rank · avatar · @name ▲▼ ·
  record, one take line under the name, then three tiles: **Form** (streak, L3) · **Points** (league rank, ± vs average) · **Next** (opponent,
  his record, H2H). Robot now writes `power3: [{owner, take}]` (one sentence ≤ 80 chars); until then the app picks the sharpest fact (tops a
  tied record on points, hasn't lost since Week N, best offense, big jump, stuck in a logjam). SW `splhq-v74`.
- 2026-11-28 · v0.25.10 · 📝 **Draft boards back to 2006** (Mike: "no draft data pre 2019?"). The screen only read gold `Draft_Picks.csv`
  (2019, 2021–26); ESPN's boards for **2006–2018** were already on file (`ESPN_Draft_Boards.csv`, in player files only). Now the year chips
  run 2026 → 2006: gold wins where it exists, ESPN fills the rest (`allDraft()`, rows from `player-history.js`, loaded on first visit and the
  screen redraws). ESPN rows carry position (`ph.d[8]`). ESPN only knows who made each pick, so the grid places those by pick number and
  "→ X" marks a pick made from someone else's slot; ESPN's slots are clean every year except 2013 (keepers placed in rounds 1–3, noted on
  screen). 🔒 keeper cells/tags on both views. Selected year chip scrolls into view. Still missing: 2020 (played off ESPN, no Packet board). SW `splhq-v73`.
- 2026-11-28 · v0.25.9 · ⭐ **Power 5 → Power 3, with a write-up per team** (Mike). Home's Edition card now ranks three teams; each row
  (rank · avatar · @name ▲▼ · PF + last 3 · record) gets a 2–3 sentence write-up under it. Card-lines robot (`tools/card_lines.py`) now writes
  `power3: [{owner, write}]` (≤ 260 chars, the one exception to the 110 rule); until it has a token the app builds the write-up from the numbers:
  streak + rank move, tied records and who's ahead on points, points rank vs the league average, next game with the all-time series. Old
  `power5` lines still supply the order. Card id stays `power5` so reactions keep their key. "You: #7" chip when you're not in it. SW `splhq-v72`.
- 2026-11-28 · v0.25.8 · ▦ **Draft boards get a grid** (Mike: great info, needs a grid). League → Draft boards → **▦ Grid | 📋 Rounds** toggle
  (Grid is the default; the choice is remembered). Same look as the SPL Draft room's grid: 12 slot columns × rounds, owner row + round column
  stay put, cells colored by position, pick number on each cell (snake), "→ Joe" on traded picks, 🏷️ tags in gold, grey = keeper slot (no
  pick on the board), your column/picks in blue, tap a player for his file. Slots are read off the overall pick numbers (majority vote per
  owner, since some old boards are loosely numbered). `build_data.py` now adds position (from ESPN boards / final rosters / Keeper Matrix)
  as `draft[8]`; 1190 of 1215 picks have one. D/ST names stay whole on both grids ("Bills D/ST"). SW `splhq-v71`.
- 2026-11-27 · v0.25.7 · 📇 Player file bars: your years now read at a glance (Mike: still couldn't read them): light-blue bar, blue label, and a
  "You" pill in place of your name; legend says so. SW `splhq-v70`.
- 2026-11-27 · v0.25.6 · 🔁 **Email trade sweep** (Mike: "go"): `data/Trade_History.csv` now holds **36 pre-app deals, 2009–2026** (96 rows) read from
  the trade-announcement threads in Mike's Gmail: e.g. Forte → Mos (2009), McCoy → Slappies (2010), A.J. Green ↔ Greg Little + picks (2012),
  Doug Martin + the six-round pick swap (2013), Michael Thomas + Brady ↔ the #4 and #21 (2017), Henry / Bell / McCaffrey (2019), Diggs + M. Williams (2021),
  Hurts (2025), Tracy (2025), McBride (2026). Every one lands on the player files ("Traded from Drew for 2019 R4 pick (Mike's) · Jul 19").
  Skipped: never-closed offers, the 2013 Decker deal (un-confirmed same day), image-only posts (Aug 1 2026 BAG ↔ Bocces). Open: the 2019 Bell deal drew
  an "I veto" from Craig (looks like a joke; kept); a few older threads not read yet; picks stay as text (no pick-ownership ledger for old years). SW `splhq-v69`.
- 2026-11-27 · v0.25.5 · 📇 Player file bars: your seasons no longer turn into unreadable blue pills (the bar used class `me`, which the
  header's "me" button style grabbed). Now `mine`: Beaver Blue bar + your name in blue. SW `splhq-v68`.
- 2026-11-27 · v0.25.4 · 🔁 **Pre-app trades: new gold `data/Trade_History.csv`** (Mike: "email often had trade info"). Trades made before SPL HQ, from the
  league's "SPL Trade Announcement" email threads (and later the Packet notes), one row per player/pick moved, grouped by `deal`. First deal:
  **Aug 19 2026, Seth → Owen: Trey McBride for J.J. McCarthy + Owen's 2026 R7** (league confirmed that night). `build_data.py` feeds it into
  player files ("Traded from Seth for J.J. McCarthy + 2026 R7 pick · Aug 19"); a later holder of a keeper deal reads "Took over his deal from …". SW `splhq-v67`.
- 2026-11-27 · v0.25.4 · 🚧 **GM Report → Coming soon** (Mike: wants it to look and feel like Glen's actual GM Report; talking to Joe first). League tile now "🎓 GM Report · Coming soon", `#gm` shows an under-construction card. The career-rankings screen is parked as `SCREENS.gmRankings` (no link to it). Tour's League stop says "the GM Report (coming soon)". SW `splhq-v67`.
- 2026-11-27 · v0.25.3 · 📇 **Player file history v2** (Mike: McBride looked kept by two owners at once; "make it a trend, not a blob").
  **Bug:** a gold keeper contract carries its *current* holder, so a deal Seth signed in 2024 and Owen got in a trade read "Kept by Owen … '24".
  Now Keeper Matrix rows are grouped by deal (start = season − (term − years left)); the signer gets "Kept on a 3-yr deal", a later holder gets
  "🔁 Came over from Seth with his deal". **New layout:** 4 tiles (seasons · owners · drafted/kept · titles with him), a bar per season of what he
  cost (R = round, n KP = kept, TAG, FA; bar on the KP scale, gold = won the SPL with him, scrolled to the latest), then one folding row per owner
  stint (latest open, 🏆 years on the row). **Now** falls back to the current season's owner from the matrix/draft before rosters load. SW `splhq-v66`.
- 2026-11-27 · v0.25.2 · 📋 **Joe's day-one questions cut to 3** (Mike): his one wish (now first), "Can the app do your ESPN typing?" (espn_lm reworded around saving him work) and a short veto vote. Retired: `test_league` (Mike demos it instead), `mike_calls` (Mike's answers stand). New `later:` flag holds `deadlines`, `chat_move`, `history_gaps` off Joe's list (Ops desk shows them greyed as Later); bring one back by adding it to `Q_ORDER` and removing `later`. SW `splhq-v65`.
- 2026-11-27 · v0.25.1 · 👋 **Tour + Joe's questions caught up with today's ships** (Mike: getting Joe in). Tour: GM desk stop covers keeper
  plans (up to 5, side by side, declare when the off-season opens); League stop = Drafts row (red live / gold on the clock), SPL Calendar, draft
  boards, champions, GM rankings, rivalries, rules, 💡 Ideas (fixed a doubled calendar line); Joe's 📥 Commish desk stop = folding sections that
  open when they need him (trades, Do on ESPN, drafts incl. load into ESPN, Signing Day, questions). Questions: `espn_lm` why adds the SPL Draft
  load; `chat_move` covers division rooms, DMs, @ tags. Passphrase text mentions the tour. League → History tile: "Champions since 2003". SW `splhq-v64`.
- 2026-11-27 · v0.25.0 (backend v0.18.0) · 💬 **@ mentions everywhere + division rooms** (Mike: "glean the MAFFL @ work"). **Composer:** an
  @ button and typing "@" both open chips of the owners in that room, filtered as you type; tap → "@Handle ". **Messages:** @Handles are
  tappable (→ that owner's team page), a message that tags you gets a gold edge, your own tag is gold-washed. **Inbox:** 💬 Chats | @ Mentions
  (every message that tags you, last 60 days, "new" until you look; backend `chat` now returns `mentions` + `handles`, `me` returns `handles`).
  **Rooms:** League · 🛡️ your division (new: `div:<slug>` rooms, membership from ESPN standings with a seed fallback, so the Divisional Draft
  reshuffles them by itself; @ emails only go to owners who can read the room) · DMs. **✉️ New message** pills drop anyone you already have a DM
  with (card hides when that's everyone). **Around the site:** cards name other owners as tappable @Handles (`who()`/`atO()`: Home trade
  offer/wire/review, league chat card, score bugs, tiles, pick wire, matchup + every-game rows). **Bug fix:** v0.24.1's `hqLink` had its
  `var to` swallowed by a comment, so any SPL HQ post broke the chat thread; fixed. Smoke +5 checks. SW `splhq-v63`.
- 2026-11-27 · v0.24.2 · 🗓️ **No Home cards for the SPL Draft** (Mike: everyone is in the draft room, 2-3 hours). `draftCards` skips
  kind `spl`: no ⏱️ on-the-clock, live or done cards (the done card also wrongly read "Divisions are set"). Divisional, Slot and Shoot Out keep
  their card cycle. Room, chat round posts and the 30-min on-the-clock email unchanged. SW `splhq-v62`.
- 2026-11-27 · v0.24.1 / backend 0.17.5 · 💬 **SPL HQ chat posts link to the right place** (Mike: every bot post said "Open trade", even draft
  openings/cancels). The button now follows the post's ref: trade → "Open trade", draft → "Open draft room", Signing Day → "Open keepers",
  anything else → no button. Draft-cancel posts carry no link (a cancelled room is hidden; old ones are suppressed too). SW `splhq-v61`.
- 2026-11-27 · v0.24.0 (backend v0.17.4) · 📥 **Commish desk gets the Ops desk treatment, minus the backend** (Mike). Joe's desk now folds like
  the Ops desk (Open all / Close all; a section that needs Joe opens itself: trades waiting, ESPN to-dos, open questions, a live draft):
  ⏳ Trades to approve · 🏈 Do on ESPN · 🗓️ **Drafts with full controls** (live drafts with Room / ↩ Undo / ✕ Cancel / 🏈 **Load into ESPN**
  (was ops-only), one **Open ›** per draft) · 🔒 Keeper Signing Day · 📋 Questions · 📜 Recent decisions. **Shielded from Joe:**
  rehearsals (no 🧪 Rehearse buttons, rehearsal drafts and Signing Day rehearsals hidden), robots, watchdog, test switches, the tour, "Mike can wipe"
  and robot wording; the test-mode banner is one line. Mike's "Joe's view" shows exactly that. **Ops desk** keeps every rehearsal control and gains
  its own 🔒 Keeper Signing Day section (rehearse / wipe moved there). **Test league: no more renames** (Mike: ESPN's names are fine): the mirror's
  names step is gone (backend answers a stale app's "names" call with nothing sent), the Ops card no longer flags teams to rename. Smoke updated. SW `splhq-v60`.
- 2026-11-27 · v0.23.8 · ⚖️ **Plans side by side, tighter** (Mike): last names only ("St. Brown", no Jr./III), one name per line, narrower columns
  so three plans fit at 390 px, "lost '27–'29" and "over by 8 KP" short forms. SW `splhq-v59`.
- 2026-11-27 · v0.23.7 · 🔒 **Keepers: big blue cap box → a slim strip** (Mike: clogging real estate). One line "2027: 8 / 10 KP · 2 of 3 kept",
  the Signing Day status under it, Rules on the right; red edge + one warning line when a plan is over the cap or the max. The grid already
  shows KP by year, so your keepers now start on the first screen. SW `splhq-v58`.
- 2026-11-27 · v0.23.6 · ⚖️ **Plans side by side** (Mike: compare was just KP by year, "I don't get it"). Now one column per plan (tap a plan's
  name to open it), rows: Keeping (names, 🆕, 🏷️) · Cutting (✂️) · 2027 KP used of 10 · 2028 / 2029 KP left · Your 1st (kept / lost '27…) ·
  Works? (✓ fits or ⚠ why not). Scrolls sideways past 3 plans. SW `splhq-v57`.
- 2026-11-27 · v0.23.5 (backend v0.17.3) · 🏈 **SPL Draft → ESPN is one batch after the draft** (Mike: "batch, not one at a time"). Live drafts no
  longer add each pick to ESPN as it's made; the desk's 🏈 Load into ESPN (gold once the draft is final) loads the whole board, picks + keepers,
  25 per call until done, re-runnable to finish or repair (reads ESPN first, never re-adds). SW `splhq-v56`.
- 2026-11-27 · v0.23.4 (backend v0.17.2) · 📅 **Off-season → SPL Calendar** (Mike: "is it just a calendar?"). League tile + screen renamed;
  the screen is now the league year in order: "Next up" with a countdown, then **this season** (trade deadline ✓, Shoot Out Draft, Shoot Out,
  Playoffs, SPL Bowl: dates from the calendar file, else the date their rule gives, marked ≈: NFL week Sundays, Shoot Out Draft = the
  Tuesday after Week 13) and **the next off-season** (off-season starts, Winter Meeting, Divisional, Slot, Signing Day, SPL Draft). Each row
  links where it has a page (draft room → 🔴 Live / Room, Your keepers, Trades, Rules, Match, Past champs); past rows greyed ✓; draft orders
  and the Shoot Out preview fold out under their event. Live/finished draft tiles dropped (the League Drafts row has them). `#calendar` works
  too (old `#offseason` links kept). Chat's "draft done" line points to League → Drafts. SW `splhq-v55`.
- 2026-11-27 · v0.23.3 · 🔒 **Keepers: one grid** (Mike: the 3-year outlook and "Your keepers" are the same thing). The keepers card is now the
  table: one row per keeper (carried, 🆕 new, ✂️ terminated as penalty, old penalties) with 2027 / 2028 / 2029 KP, ⋯ to terminate / change the
  deal / remove, "＋ Add a keeper" rows for open slots, then Total, KP left and Your 1st. Separate outlook card gone. SW `splhq-v54`.
- 2026-11-27 · v0.23.2 (backend v0.17.1) · 🔒 **Keepers v2.2** (Mike: lost rename/delete, compare unclear, wants year columns). Under the plan chips:
  **"Plan name: ✏️ Rename · ⧉ Copy · 🗑 Delete"** always visible (no more hidden ⋯). **⚖️ Compare your plans** is now a grid on the page (rows =
  plans, columns = 2027 / 2028 / 2029 KP left, keepers count, ⚠ over-cap reason, "no 1st"; tap a row to open that plan). Outlook columns read
  full years. **5 plans** (was 3; backend KEEP_SCEN 5). SW `splhq-v53`.
- 2026-11-27 · v0.23.1 · 🔎 **Search shows who's gone + ✕ on every search box** (Mike). SPL Draft room: searching a kept, tagged or drafted
  player shows him greyed with why ("🔒 Mike's keeper", "🏷️ Hoos's Franchise Tag", "Drafted 3.05 · Joe") instead of "no matches". Every
  input whose placeholder starts with "Search" (rules, keeper add, keeper market, draft room, any new one) gets a ✕ clear button by
  itself (MutationObserver wraps it; clearing fires the box's own input handler). SW `splhq-v52`.
- 2026-11-27 · v0.23.0 (backend v0.17.0) · 🗓️ **Draft controls on the desks, ▦ grid board, board → ESPN** (Mike). **Desks:** a 🗓️ Drafts card
  on Joe's 📥 Commish desk and Mike's 🛠️ Ops desk (first section, badge "🔴 N live"): every live draft (pick n of N, who's up and for how long,
  last pick) with Room · ↩ Undo · ✕ Cancel; Open a draft (🧪 Rehearse / Open real per kind; Shoot Out only in season, "real" only in its window);
  the last 4 finished; Clear all rehearsals (ops). Draft rooms and the Off-season hub no longer carry commish buttons (a line points to the
  desk; the commish can still enter a pick for an owner in the room). **▦ Grid** in the SPL Draft room: the Google-Sheet board, 12 slot
  columns × 17 rounds, owner row + round column stay put, cells colored by position (QB/RB/WR/TE/DST), 🔒 keepers + 🏷️ tag in gold,
  "→ Joe" on traded picks, the clock cell outlined and scrolled into view. **Board → ESPN** (`mod_spldraft.js`, new Sheet tab `DraftEspn`):
  every drafted player and keeper goes onto his owner's ESPN team with the proven LM add (roster mirror's call). Only `WRITE_LEAGUE` (test
  league: only Mike, Joe, Al, Glen have teams there) until Joe signs off. Reads ESPN first and only adds who isn't there (never a blind
  re-add), one POST per player, 25 per call, read back, every attempt logged. A **live** SPL Draft adds each pick right after it's made;
  the desk's 🏈 Load into ESPN works through the rest and shows "N of M on ESPN · why it failed". Players typed in by hand need an ESPN
  match (else flagged). Smoke +8. SW `splhq-v51`.
- 2026-11-27 · v0.22.1 (backend v0.16.1) · 🔒 **Keepers v2.1** (Mike's notes on the new screen). The first switch button is your **team name**
  (Bad Attitude Gang), not "Mine". **Plans are visible**: plan chips right on your keepers card + "＋ New plan" + ⚖️ Compare (⋯ with one plan),
  with a one-line nudge while you only have one. **📈 3-year outlook** is back: every keeper by '27/'28/'29, terminated ones as penalties,
  Total + KP left rows, "Your 1st" row with a tag. **Declaring opens by itself when the off-season starts** (Season_Calendar 2027 offseason =
  Feb 15) and closes on Signing Day (its date, else 10 days before the SPL Draft): backend `autoWin_` in mod_keepers, a commish open/close or a
  rehearsal still wins; the hourly tick + ledger robot post "the off-season is here: declaring is open" once and email owners. Until then the
  Declare button is hidden and the screen says when it opens. **Keeper market search**: type any name to search every roster (yours too) at any
  price; can't-keeps show why. Chat text now says Team → Keepers. SW `splhq-v50`.
- 2026-11-27 · v0.22.0 (backend v0.16.0) · 📝 **SPL Draft room + League tab cleanup** (Mike). New backend part `mod_spldraft.js` on the draft engine:
  17-round snake over the 12 Slot Draft slots; when the commish opens it the board is built once: each cell's owner from the pick ledger (traded
  picks land with their owner, "via X's pick"), a Franchise Tag eats the tagger's own 1st, keepers (active contracts with KP for that season,
  gold on main) fill each team's last open picks. 194 turns for 2027 as things stand (10 carried keepers). Room: on-the-clock card (round, pick
  r.pp, overall, your next picks), last 3 picks, **🎯 Pick** (ESPN's PPR draft ranks via new `splpool` read, cached 6 h; search + position
  chips; drafted/kept players drop out; "not on the list? type him in"), **📋 Board** (round by round, 🔒 keepers, 🏷️ tag, your cells shaded,
  scrolls to the clock), **🧢 Teams** (any team's haul + keepers, position counts). Commish enters picks for anyone, undo, cancel. Noise
  control: league chat gets one post per finished round (not 190), on-the-clock emails at most one per owner per 30 min. Commish "do on ESPN":
  key the board into ESPN's offline draft. 🤖 ledger-sync writes the finished live board into `Draft_Picks.csv` (rows `app <id>`, replaced as a
  block, never over hand rows; tags as FRANCHISE rows, keepers off the board like the paper boards); rehearsals → `data/test/Draft_Picks.csv`;
  the robot now also commits `player-history.js`. Opening order: the season's Slot Draft (gold, else a finished one in the app, else last
  season's finish). **League tab:** 🗓️ **Drafts** row on top, one button per draft (SPL Draft · Divisional · Slot · Shoot Out → newest live room,
  else newest rehearsal, else the calendar; 🔴 live, gold when you're on the clock) + "Every draft room" list; Standings, Trades and Keepers
  tiles removed (Trades + Keepers = GM desk); **Standings now sit at the bottom of Match**; Draft tile renamed Draft boards; draft rooms go back
  to League. Tour lines updated. Smoke +16. SW `splhq-v49`.
- 2026-11-27 · v0.21.2 · 🧭 GM desk: the selected button now points down (navy notch) onto a navy rule across the page, so Roster / Trades /
  Keepers reads as "you're in this section" (Mike). Same on the trade grid + builder. SW `splhq-v48`.
- 2026-11-27 · v0.21.1 · 📋 New question for Joe `history_gaps` (Mike: NFL.com's old leagues are gone, ask Joe): 2020 draft picks, 2021 playoff-team
  records, a few PF, 2003–05 records + runner-ups. Sits before "first wish"; header reads 📥 Desk · 8. SW `splhq-v48`.
- 2026-11-27 · v0.21.0 (backend v0.15.0) · 🎯 **Shoot Out Draft room + off-season mode** (Mike). New `shootout` kind on the one draft engine
  (`mod_drafts.js`): order = all 12 by seed after Week 13 (§G: 4 division leaders, best other record, most points of the rest, then the table);
  **Rule 1 matchups** (division-title + wildcard races within a game and 50 pts, the 3- and 4-team cases) computed in the app and confirmed by
  the commish (✕ drop, ＋ add, ↑ reorder; H2H/coin-flip tiebreaks not modeled); the best unmatched seed picks any unmatched team; the last two
  are paired automatically; undo takes the auto pair back with the pick before it. League chat gets the Rule 1 line, every pick and the final
  Week 14 card; Home gets the result card. Commish "do on ESPN" step: LM Tools → Edit Schedule (no `/schedule` write yet). Off-season hub shows
  "the Shoot Out as it stands" all season. 🤖 ledger-sync copies finished Shoot Outs into `Offseason_Drafts.csv` (pairs + `R1-n` rows).
  **Off-season mode** from gold (no switch, no new robot): when ESPN has no games left, League leads with a "🗓️ The 2027 off-season" hero (next event +
  countdown, then the next three) and Off-season is the first tile; Home gets the same "what's next" card. Shoot Out window (Week 13 final, 14 not):
  League banner + a needs-you "Open the Shoot Out Draft" for the commish. In-season owner prompts wait for `LIVE_SEASON` 2027. Smoke +13. SW `splhq-v46`.
- 2026-11-27 · v0.20.2 · 🏆 **2003–2005 + 2020–2021 in History.** 2020 + 2021 were on NFL.com: champions, runner-ups, playoff seeds and most
  records from the league emails (2021 Binder, Playoff Primer, payouts / FA report). New gold `GM_Report_2025.csv` from Glen's 2025 GM Report
  (EST. 2003): titles, playoff years, division titles per owner; adds 2003–05 champions + playoff teams. History tables with missing records
  order by how far each team went; no "runner-up ?" when unknown. Founded = 2003 in `Season_Calendar.csv`. Pryor + Chase Brown named (Mike). SW `splhq-v45`.
- 2026-11-27 · v0.20.0 · 👋 Tour: **2nd welcome card "It all lands on Home"** (Mike): ⚡ your move up top (your pick in the Shoot Out, Slot
  or Divisional draft, a trade offer, keepers to declare; gold stays first), 🗞️ every week of the season (Tue result/awards/Power 5/table,
  live game Sunday, who's next by Thursday, trades as they happen), 🎯 polls + trivia, 🗓️ off-season too. Cards 1/2 → 2/2 with Back;
  Home stop trimmed to how-to. **No "reel" anywhere owners read** (sign-in card, loading, end card, Saved/Done sheet, keepers note,
  veto question; card-lines robot prompt told never to say it); rule added to CLAUDE.md. **Home tab icon = tiny SPL crest.** SW `splhq-v39`.
- 2026-11-27 · v0.20.1 · 🔁 **ESPN trades + pickups in player files.** Archive robot fixed (transactions come from the season endpoint, not
  leagueHistory): 3,288 moves for 2018–19 + 2022–26 (2017 and earlier: ESPN keeps none; 2020–21 empty) → `ESPN_Transactions.csv`.
  `player-history.js` adds trades + pickups ("Traded Matt → Mike · Nov 9", "Picked up by …"). SW `splhq-v44`.
- 2026-11-27 · v0.20 (backend v0.14.2) · 🔒 **Keepers v2: calmer + the keeper market** (Mike: "clunky, messy, too much going on"). Your keepers
  (GM desk → Keepers) get a **Mine · Market · League** switch. **Mine** = one cap summary (KP left, 3 slot dots, Signing Day line, rules
  link) + three **slots** (carried · 🆕 new · ✂️ terminated · cap penalties) + one **Declare** button. Everything else is a tap away in a
  sheet: ⋯ on a carried keeper = terminate with the exact penalty; ⋯ on a new one = 1/2/3 years or 🏷️ tag, remove, player file;
  ＋ Add a keeper = your roster priced, fits first, can't-keeps greyed with the reason, search any last-year draftee; **Plans ▾** = switch,
  compare ('27–'29 left, no-1st), new/copy/rename/delete. **Declare** checks with the server, then a confirm sheet says it goes out to the
  league (chat + reel) and the commish (his desk; live declarations also email him), and that it can change until Signing Day closes.
  Declared = a read-only "✅ Declared" card with Change. 🔎 **Keeper market** (Mike): every keepable player on the other 11 rosters at
  ≤ N KP (default = your room; ≤2/3/4/6/8/10, position filter), best season first; players under contract show their contract price;
  tap = player file → Trade for him. Planned signings on someone else's roster show "trade for him first". **League** = Signing Day
  board, every team's committed cap (tap = read-only team; commish can enter an owner's keepers while it's open), every contract.
  Other teams are read-only now (no planning for them).
- 2026-11-27 · v0.19.5 · 🩹 **Injury tags short everywhere** (Mike: "we're good with O, Q, IR"). One app helper `injAb` turns ESPN's
  status into O / Q / D / P / IR / SSPD / DTD on Match (lineup row tag + tap-open line), Team roster, player file and the trade grid.
  Fixes the Match row tag too, which showed "I" for Injured Reserve (first letter). App-side only, no backend change. SW `splhq-v42`.
- 2026-11-27 · v0.19.4 · ⚔️ Match (Mike's live screenshot): **grey now only ever means projected**. The trailing team's big score and
  the trailing score in Every game were grey (read like projections): all scored numbers are navy now (winner still blue in final weeks).
  Dropped the "won this slot" tint behind lineup points (looked like the old in-progress chip, bumped the slot pill). SW `splhq-v41`.
- 2026-11-27 · v0.19.4 (backend v0.14.1) · 📚 **History round 1: ESPN archive + SPL Packet** (Mike: "as much as possible from ESPN", + the Packet).
  New robot `espn-archive.yml` (weekly + on script/registry change; in the watchdog's ROBOTS): 2006–2026 draft boards, team-seasons, final rosters,
  transactions → `data/ESPN_*.csv` + `docs/ESPN_ARCHIVE_REPORT.md`. Packet transcribed by Claude: SPL boards 2019 + 2021–25 into `Draft_Picks.csv`,
  every Keeper Matrix 2019–26 → `Keeper_Matrix_History.csv`, board trade notes → `Packet_Trade_Notes.csv`; registry aliases MOS = hoosier,
  NUD/NUDE = patel (ESPN-proven). New derived `player-history.js` (build_data.py; robots commit it) loaded by player files on demand: every draft
  2006–26, every keeper matrix line, final-roster stints. League → Draft gets 2019 + 2021–25 boards. Findings + what's left: `docs/HISTORY_NEEDS.md`.
  SW `splhq-v41`.
- 2026-11-27 · v0.19.3 · ⚔️ Match follow-up (Mike): **scored points are what pop** (bold navy, a size up); in-progress no longer gets a blue
  chip, just the same navy number with a small pulsing dot. **Finished players showing "Live" fixed** (Dak, Goff on Thanksgiving): "in
  progress" now needs stats AND a kickoff that already happened within the last 4 h; stats with a missing or future kickoff = Done. If
  Thursday players were getting a future kickoff, the backend's pro-schedule lookup (`proGames_`, keyed by matchup period) may be handing
  back the wrong week: check `kick` on a played player when signed in. SW `splhq-v40`.
- 2026-11-27 · v0.19.2 · ⚔️ **Match tab redesign** (Mike: "no idea what numbers are actual and which are projected… a blob of text").
  Actual vs projected now look different everywhere: **scored = solid navy number**, **in progress = blue chip**, **projected = grey
  italic in a dashed box** (key above the lineups). Scoreboard: status pill (LIVE / FINAL / NOT STARTED / UPCOMING), big "points scored"
  number per side, a bar showing scored inside the projected finish, "Proj 130.9 · 5 of 9 played", 📈 Projected finish line ("Mike by 0.1").
  Lineups: one row per slot with both sides' points next to the slot so they line up; short names (J. Allen), opponent + kickoff / Live /
  Done; red injury letter; the side winning the slot gets a light tint; tap a row for the full line (full name, stat line, pts vs proj
  +/−; the name opens the 📇 player file); Scored + proj totals at the bottom. Every game: labeled PTS / PROJ columns, "N players to go", your game shaded. Final weeks drop
  all projections. Data unchanged (no backend change). SW `splhq-v39`.
- 2026-11-27 · v0.19.1 · 👋 Tour (Mike): **‹ Back** on every stop (stop 1 → back to the welcome card; ✕ still ends it). The Desk stop is now Joe's: "📥 Your Commish desk" (trades to approve, the questions waiting on him, opening the drafts + Signing Day), shown to commish only; ops (Mike) gets no desk stop. SW `splhq-v38`.
- 2026-11-27 · v0.19.1 · 📇 **Player files + desk header** (Mike: header wasted space, button info weak, players should be clickable).
  **Header:** big blue team card gone; "GM desk · Mike" + team name + a chip line (record · rank of 12 · division rank · streak · next game), from gold
  history/schedule so it draws instantly. 🧢 dropped. **Buttons now say something:** Roster = PF per week + injury line (gold "1 hurt starter");
  Trades = needs-you/open offers/picks + trade deadline status; Keepers = KP left · keepers of 3 + Signing Day countdown (or "Declare now").
  Someone else's team gets the same compact header. **📇 Player file:** tap any player on the Team roster or the trade grid → sheet with
  📍 Now (owner, slot, how acquired, season pts, per game, rank at his position on SPL rosters), 🔒 Keeper status next season (contract KP by
  year, or the price + why/why not), 📜 In the SPL (every draft pick: who, round, pick, whose slot · every keeper contract + tag · terminations +
  penalties · approved trades in the app), and Trade for him / their roster. **Gap:** gold draft boards = 2026 only; 2019–2025 live in the SPL
  Packet and need adding to `data/Draft_Picks.csv`. Fixed `gmStand` picking the oldest season (history isn't sorted). SW `splhq-v38`.
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
  🗓️ Timeline (`data/Season_Calendar.csv`: 2027 off-season dates + how the league got here).
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
