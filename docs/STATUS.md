# SPL HQ — Status

_Read first. Newest on top._ **Last updated:** 2026-11-25 by Claude (chat)

## Now
- **v0.2: real sign-in.** Backend deployed and healthy (11/25: Sheet ✅, SPL 19583 ✅ 12 teams, test league ✅ 4 teams). Next: Mike runs SPL HQ → Run setup check (seeds owners + shows his passphrase once) → signs in → Ops desk → makes Joe's passphrase → texts it.
- Trade center live in test mode. Next: ESPN execution on the test league (mirror SPL rosters there, then the commish trade write), drops + reactions for the reel.
- Next: Joe answers the 📋 Questions in the app → sign-in + desks + chat → pick-only trade center → ESPN trades on the test league → demo to Joe.

## Open questions (in the app: League → 📋 Questions)
ESPN co-commish · test-league demo · traded keeper contracts · pick seasons · trade approval + review window · key dates · chat · Al vs James Farrington · Joe's #1 wish.

## Recently shipped
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
