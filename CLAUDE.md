# SPL HQ — rules for Claude (read first, every session)

SPL HQ is a phone-first app for Joe Reilly's State Penn League (SPL), served by GitHub Pages at
**https://spl-hq.github.io/** with a Google Apps Script backend bound to the "SPL HQ App" Sheet
(owned by `spl.hq.ops@gmail.com`). Plan and decision journal: `docs/SPL_REEL_PLAN.md`. Reel cards: `docs/SPL_REEL_SERIES.md` (no Pulse: the cards are the update). Ops: `docs/OPS_RUNBOOK.md`.
Status log: `docs/STATUS.md`. Modeled on MAFFL HQ's REEL (`maffl-commish/maffl`), but SPL's own repo, data and rules.

## Who decides
- **Joe** (commissioner) owns the league's rules, rulings and trade approvals.
- **Mike** (co-commish, ops) owns the infrastructure and directs the build. He works from his phone a lot,
  in voice-memo style: consolidate his input, don't pepper him with questions, he'll correct you.

## How work ships
- **Claude pushes straight to `main`** from chat (Mike, 11/25). Say "PR first" in a chat to get a pull request instead.
- **Pushing `backend/logic.js` or any `backend/mod_*.js` part = deploying the backend** (the loader picks it up within 5 minutes).
  Before any backend push: `node --check` on every backend file and `node tests/backend_smoke.js` must pass. Bump `VERSION` in
  logic.js with ANY backend change, parts included (parts are cached under VERSION). CI (`checks.yml`) re-runs all of it plus
  `tests/app_check.js` on every push: a red run on main is an alarm (it's already live), on a PR it's a gate.
- `backend/Code.gs` is the loader pasted into Apps Script by hand. Change it only when unavoidable, and tell Mike
  to re-paste + Deploy → Manage deployments → ✏️ → New version.
- Before any app push: syntax-check the inline script, and screenshot at **390 px** (iPhone, Home Screen standalone).
- Log every ship in `docs/STATUS.md` → Recently shipped (newest on top, dated). Record decisions in the plan's §0 journal.
- **Use the app to manage the app**: questions for Joe, feedback, ops status and approvals belong in the app
  (Sheet-backed), not in side channels.

## Automated upkeep (Mike 11/25)
The site keeps itself current: anything that changes with the season gets a robot, not a reminder. Every robot is a GitHub Action
or the Apps Script backend, is safe to re-run, shows its last run on the 🛠️ Ops desk, and fails loudly (GitHub emails the org owner
on a failed Action; backend problems email ops). When you add data that goes stale, add its robot in the same change.
Current robots: `checks.yml` (CI: backend syntax/size + smoke test + app check on every push); `build-data.yml` (any push touching `data/` → rebuild `league-data.js`); `espn-history.yml` (daily: ESPN finals → `data/SPL_Matchups.csv`, games still to play → `data/SPL_Schedule.csv` → `league-data.js`); `card-lines.yml` (after each history pull: Claude writes the reel card lines for the newest final week → `data/Card_Lines.json`, once per week; nothing without `CLAUDE_CODE_OAUTH_TOKEN`);
`ledger-sync.yml` (every 2 h: backend `?action=ledger` → `data/Draft_Pick_Ownership.csv`, `data/Trade_Log.csv`, keeper contracts follow
traded players in `data/Keeper_Contracts.csv`, finished off-season drafts → `data/Offseason_Drafts.csv`; test mode / rehearsals write `data/test/` instead). League rules the robots and app follow
(pick seasons, contracts travel/reset) come from Joe's answers in the app via backend `rules_()`; defaults until he answers.
Never hand-edit robot-written gold: fix at the source (the app) and let the robot copy it.

## Hard rules
- **Public repo = public data.** Never commit emails, phone numbers, payment handles, cookies, tokens or passphrases.
  Owner contacts live only in the Sheet. ESPN cookies live only in Apps Script Script properties + GitHub secrets.
- **ESPN writes go only to `WRITE_LEAGUE`** (test league 1722387564) until Joe signs off. `READ_LEAGUE` 19583 is the
  real SPL league: read-only. No retries on writes (a retry can apply twice); always read back.
- **Gold vs derived.** One authoritative CSV per fact in `data/` (gold, hand-edited or robot-appended). Anything
  generated from it (JS data files, embedded arrays) is derived: regenerated, never hand-edited, with a provenance header.
- **Owner Registry is the join key.** Resolve names by lookup against `data/SPL_Owner_Registry.csv` aliases, never fuzzy.
- Static history data is embedded in the app; the app may call **its own** backend. No other runtime fetches
  (no CDNs, no web fonts, no third-party APIs from the browser).
- Every Sheet write is formula-guarded (`safe_`). Every user string rendered in the app is escaped (`esc`).
- Structural layout changes (tabs, navigation, page architecture) need Mike's OK. Content inside existing elements doesn't.
- Keep each backend file under ~90 KB (Apps Script cache limit). The backend is split MAFFL-style: `logic.js` (core) evaluates
  `PARTS` (`mod_espn`, `mod_social`, `mod_trades`, `mod_drafts`) in its own scope; new areas get their own `mod_*.js` + a PARTS entry.

## Look and feel — "Nittany" (Penn State blue + white, Mike 11/25; replaced Stadium Lights)
Nittany Navy `#041E42` (header bar, headings feel) · Beaver Blue `#1E407C` (buttons, accents, wins, your stuff) ·
Pugh Blue `#96BEE6` (small accents on navy) · White cards on `#F2F5FA` · Text `#0B1F3A` · Muted `#5D6E89` · Line `#D6DFEC` ·
Gold `#B88A2E` (Needs you, keeper tags, champions) · Red `#C8102E` (injuries, alerts only).
**Limestone gray layer** (Mike 11/26): page canvas `#E8EAED`, lines `#D9DCE0`, muted text `#5F666D`, tab bar `#F7F8F9` (inactive `#7A8288`),
Limestone `#A2AAAD` rule under the header. Gray = structure; blue = anything you tap, win or own. Lives in the "Limestone" block at the very end of `<style>` (delete it to revert).
The theme lives in the "Nittany" block at the end of the `<style>` (CSS variables `--lime` = Beaver Blue, `--night` = white).
Headings condensed uppercase 800; numbers monospace. Bottom tabs: Home · Match · Team · Chat · League. SPL crest top-left → Home.
Icons sit on Nittany Navy.
**Layout frame:** `body` is a full-height flex column (header · `main#view` scrolls · tab bar). Never `position:fixed` a bar over a scrolling page and never scroll `window`: scroll `#view` (iOS Home Screen apps float fixed bars and tint the status bar otherwise). Never park anything (even hidden/translated) under the status bar: iOS blurs whatever sits there. Hidden overlays use `display:none`. The frame height is set by the small fit script at the top of `<body>` (Home Screen apps under-report the height by the status bar); don't replace it with 100vh/100dvh.

## Layout
```
index.html            the app (single page, hash routes: #home #standings #rivalry #offseason #droom=ID #feedback …; desks #desk #ops #joe behind the header Desk button)
manifest.json sw.js   Home Screen install + offline cache (never caches the backend)
icons/                app icons
backend/Code.gs       loader pasted into Apps Script (rare changes)
backend/logic.js      backend core: config, routing, Sheet helpers, sign-in, questions, health; loads the parts (pushed = deployed)
backend/mod_*.js      backend parts: espn (reads + guarded writes), social (chat, reactions, votes, settings), trades, drafts (pushed = deployed)
tests/                backend_smoke.js (mocked Apps Script, loads the parts from the working tree) · app_check.js (inline scripts compile)
docs/MAFFL_PARITY.md  WS6: what to port MAFFL → SPL and hand back SPL → MAFFL
data/                 gold: Keeper_Contracts, Owner Registry, SPL_Matchups (robot), Draft_Picks, SPL_Rulebook.md,
                      Rules_Conflicts, Season_Calendar, Season_Results_Manual, Offseason_Drafts (robot), SPL_Schedule (robot), Card_Lines.json (robot) (any change → build-data.yml rebuilds league-data.js)
league-data.js        DERIVED from data/ by tools/build_data.py (never hand-edit)
docs/                 plan, runbook, status
```
