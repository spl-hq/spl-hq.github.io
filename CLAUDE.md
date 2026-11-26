# SPL HQ — rules for Claude (read first, every session)

SPL HQ is a phone-first app for Joe Reilly's State Penn League (SPL), served by GitHub Pages at
**https://spl-hq.github.io/** with a Google Apps Script backend bound to the "SPL HQ App" Sheet
(owned by `spl.hq.ops@gmail.com`). Plan and decision journal: `docs/SPL_REEL_PLAN.md`. Ops: `docs/OPS_RUNBOOK.md`.
Status log: `docs/STATUS.md`. Modeled on MAFFL HQ's REEL (`maffl-commish/maffl`), but SPL's own repo, data and rules.

## Who decides
- **Joe** (commissioner) owns the league's rules, rulings and trade approvals.
- **Mike** (co-commish, ops) owns the infrastructure and directs the build. He works from his phone a lot,
  in voice-memo style: consolidate his input, don't pepper him with questions, he'll correct you.

## How work ships
- **Claude pushes straight to `main`** from chat (Mike, 11/25). Say "PR first" in a chat to get a pull request instead.
- **Pushing `backend/logic.js` = deploying the backend** (the loader picks it up within 5 minutes). Before any backend push:
  `node --check backend/logic.js` and `node tests/backend_smoke.js` must pass. Bump `VERSION` in logic.js.
- `backend/Code.gs` is the loader pasted into Apps Script by hand. Change it only when unavoidable, and tell Mike
  to re-paste + Deploy → Manage deployments → ✏️ → New version.
- Before any app push: syntax-check the inline script, and screenshot at **390 px** (iPhone, Home Screen standalone).
- Log every ship in `docs/STATUS.md` → Recently shipped (newest on top, dated). Record decisions in the plan's §0 journal.
- **Use the app to manage the app**: questions for Joe, feedback, ops status and approvals belong in the app
  (Sheet-backed), not in side channels.

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
- Keep each backend file under ~90 KB (Apps Script cache limit); split into parts like MAFFL when it grows.

## Look and feel — "Nittany" (Penn State blue + white, Mike 11/25; replaced Stadium Lights)
Nittany Navy `#041E42` (header bar, headings feel) · Beaver Blue `#1E407C` (buttons, accents, wins, your stuff) ·
Pugh Blue `#96BEE6` (small accents on navy) · White cards on `#F2F5FA` · Text `#0B1F3A` · Muted `#5D6E89` · Line `#D6DFEC` ·
Gold `#B88A2E` (Needs you, keeper tags, champions) · Red `#C8102E` (injuries, alerts only).
The theme lives in the "Nittany" block at the end of the `<style>` (CSS variables `--lime` = Beaver Blue, `--night` = white).
Headings condensed uppercase 800; numbers monospace. Bottom tabs: Home · Match · Team · Chat · League. SPL crest top-left → Home.
Icons sit on Nittany Navy.

## Layout
```
index.html            the app (single page, hash routes: #home #standings #joe #feedback #ops …)
manifest.json sw.js   Home Screen install + offline cache (never caches the backend)
icons/                app icons
backend/Code.gs       loader pasted into Apps Script (rare changes)
backend/logic.js      backend core (pushed = deployed)
tests/                backend smoke test (mocked Apps Script)
data/                 gold CSVs (Keeper_Contracts, Owner Registry)
league-data.js        DERIVED from data/ by tools/build_data.py (never hand-edit)
docs/                 plan, runbook, status
```
