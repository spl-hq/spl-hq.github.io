# SPL HQ — Status

_Read first. Newest on top._ **Last updated:** 2026-11-26 by Claude (chat, WS2)

## Now
- **v0.2: real sign-in.** Backend deployed and healthy (11/25: Sheet ✅, SPL 19583 ✅ 12 teams, test league ✅ 4 teams). Next: Mike runs SPL HQ → Run setup check (seeds owners + shows his passphrase once) → signs in → Ops desk → makes Joe's passphrase → texts it.
- Trade center live in test mode. Next: ESPN execution on the test league (mirror SPL rosters there, then the commish trade write), drops + reactions for the reel.
- Next: Joe answers the 📋 Questions in the app → sign-in + desks + chat → pick-only trade center → ESPN trades on the test league → demo to Joe.

## Open questions (in the app: League → 📋 Questions)
ESPN co-commish · test-league demo · traded keeper contracts · pick seasons · trade approval + review window · key dates · chat · Al vs James Farrington · Joe's #1 wish.

## Recently shipped
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
