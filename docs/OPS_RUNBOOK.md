# SPL HQ — Ops runbook

_Owner: Mike (ops). Last updated 2026-11-26 (v0.16, backend v0.12.0 · WS7)._ Keep this current whenever a secret, tab, robot or switch is added.

## 1. The pieces

| Piece | Where | Who has access |
|---|---|---|
| App (GitHub Pages) | `https://spl-hq.github.io/` ← repo `spl-hq/spl-hq.github.io`, branch `main`, root | GitHub org `spl-hq` (Mike via `maffl-commish`; Joe later) |
| Backend | Apps Script project **SPL HQ Backend**, bound to Sheet **SPL HQ App** | Google account `spl.hq.ops@gmail.com` (Mike; use its own Chrome profile) |
| Database | Sheet **SPL HQ App** (tabs: Answers, Feedback, Log; more as features land) | Same; shared to Mike's personal Gmail as editor |
| ESPN | Reads SPL `19583`; writes only test league `1722387564` | Mike's ESPN login (cookies) |

## 2. Secrets (never in the repo)

| Name | Where | Purpose |
|---|---|---|
| `ESPN_S2`, `SWID` | Apps Script → Project Settings → Script properties **and** GitHub repo → Settings → Secrets → Actions | ESPN reads/writes. Expire ~yearly: the Ops desk shows ❌ with "ESPN said 401" |
| `PIN_PEPPER` | Script properties (auto-created) | Secret for passphrase hashes + device tokens. Never change |
| `ESPN_WRITES` | Script properties (set by the Ops desk switch) | `on` lets the app write to the ESPN **test league** (mirror rosters, demo trades). Anything else = off |
| `ESPN_TRADE_TYPE` | Script properties (optional) | Overrides the ESPN transaction type of the commish trade write (default `TRADE_PROPOSAL`). Only touch if ESPN refuses the demo trade |
| `OPS_EMAIL` | Script properties (optional) | Extra address(es) copied on answer/feedback emails and ops alerts, e.g. Mike's personal Gmail |
| `GH_TOKEN` | Script properties | Lets the hourly watchdog read the robots' runs and run a robot GitHub's schedule skipped. **Fine-grained token**: github.com → Settings → Developer settings → Fine-grained tokens → Generate · Resource owner **spl-hq** · Only select repositories: `spl-hq.github.io` · Repository permissions: **Actions: Read and write** (nothing else) · Expiration 1 year. The Ops desk counts down to its expiry and emails 14 days ahead |
| `CLAUDE_CODE_OAUTH_TOKEN` | GitHub repo secret | Card lines robot (`claude setup-token`) |
| `OPS_*`, `ESPN_S2_SEEN` | Script properties (made by the backend) | Watchdog state: last tick, backup, Pages check, alerts sent, when these ESPN cookies were first seen. Safe to delete (they rebuild) |

## 3. First deploy (one time)

1. In the **SPL HQ Ops** Chrome profile, open the Sheet → Extensions → Apps Script.
2. Delete everything in `Code.gs`, paste the contents of `backend/Code.gs` from the repo, click 💾 Save.
3. **Deploy → New deployment** → ⚙️ gear next to "Select type" → **Web app**.
   Description `SPL HQ v1` · Execute as **Me** · Who has access **Anyone** → **Deploy**.
4. Google asks for permissions: **Authorize access** → pick spl.hq.ops@gmail.com → "Google hasn't verified this app" →
   **Advanced** → **Go to SPL HQ Backend (unsafe)** → **Allow**. (It's your own script; that warning is normal.)
5. Copy the **Web app URL** (ends in `/exec`). Send it to Claude: it goes into `API_URL` in `index.html`.
6. Back in the Sheet, reload the page → new menu **SPL HQ → Run setup check**. It should show ✅ for the Sheet and both ESPN leagues.

## 3b. Passphrases
- **Bootstrap:** Sheet → SPL HQ → **Run setup check** seeds the Owners tab and, the first time, shows **Mike's passphrase once** in the alert.
- **Everyone else:** sign in → League → 🛠️ Ops desk → owner → **Make one** (or **Reset**) → passphrase shown once → **Text it**.
  Only a peppered hash is stored. Reset = new passphrase and every old phone is signed out.
- `PIN_PEPPER` (Script property, auto-made): **never delete or change it** — every passphrase and phone stops working.
- Roles: Owners tab → `role` column (`owner`, `commish`, `ops`, comma-separated). Edit by hand in the Sheet if needed.

## 4. Everyday

- **Is it working?** App → League → 🛠️ Ops desk (backend version, Sheet, ESPN read + test league, emails left, Joe's answers).
- **Backend change:** Claude pushes `backend/logic.js` and/or a `backend/mod_*.js` part (with a VERSION bump); live in ≤5 min. Force it: Sheet → SPL HQ → Load latest logic now.
- **Loader change (rare):** paste the new `backend/Code.gs`, Save, Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy.
  The URL stays the same.
- **Cookies expired:** copy fresh `espn_s2` / `SWID` from Chrome (fantasy.espn.com → F12 → Application → Cookies) into
  Script properties and GitHub secrets.

## 4b. Robots (automated upkeep)
**Who watches the robots (WS7):** the backend's hourly **watchdog** (`backend/mod_ops.js`, Apps Script trigger on `tick`). Every hour it
asks GitHub how each robot did, **runs any robot GitHub's own schedule skipped** (GitHub's cron had never fired on this repo by 11/26: new
repos are known for it), backs up the Sheet, checks Pages, ESPN cookie age, the GitHub token and Sheet size, and **emails ops when a problem
starts and again when all is clear** (never hourly nagging). Everything shows on Ops desk → 🤖 Robots & watchdog. A failed robot is never
retried blindly: fix the cause, then Run workflow (or wait for the next interval).
- **Install the trigger (one time, desktop browser, ops Chrome profile):** Sheet → Extensions → Apps Script → ⏰ Triggers → Add Trigger →
  function `tick` · deployment Head · Time-driven · Hour timer · Every hour → Save. Until then the watchdog rides the health pings (app opens,
  UptimeRobot), and the desk shows it gold.
- Adding a robot: add its workflow to `ROBOTS` in `backend/mod_ops.js` (`every` hours > 0 = the watchdog keeps it on time).
| Robot | When | Does | If it fails |
|---|---|---|---|
| `Ledger sync` (GitHub Action) | Every 2 h; on change or by hand | Backend `?action=ledger` → `data/Draft_Pick_Ownership.csv`, `data/Trade_Log.csv`, keeper contracts follow trades (test mode → `data/test/`) → `league-data.js` | GitHub emails the org owner; Ops desk "Ledger robot" turns red after 36 h. Usual cause: backend down (check `?action=health`) |
| `ESPN history pull` (GitHub Action) | Daily ~6 AM ET (Tuesday adds last week's finals); also on change or by hand | ESPN 19583 finals → `data/SPL_Matchups.csv` (gold) + the games still to play → `data/SPL_Schedule.csv` (gold, feeds 🗓️ Up next) → `league-data.js` | GitHub emails the org owner; Ops desk "History robot" turns red when its own pull stamp is 2+ days old. Usual cause: ESPN cookies expired → refresh the `ESPN_S2`/`SWID` secrets |
| `Card lines` (GitHub Action) | After every history pull + Tue 7:07 AM ET backstop; by hand (Run workflow, tick **force** to rewrite a week) | `tools/card_lines.py`: newest finished week → facts from gold → Claude writes the reel card lines (needs GitHub secret **`CLAUDE_CODE_OAUTH_TOKEN`**, from `claude setup-token` on Mike's subscription) → `data/Card_Lines.json` (gold, once per week, kept) → `league-data.js` | No token: nothing written, cards show plain facts (Ops desk says so). Token set but Claude failed: nothing published, Action goes red, GitHub emails. Fix the token, Run workflow |

## 4c. ESPN test league (WS5)
- Ops desk → **🏈 ESPN test league**: writes switch, each of the 4 test teams vs its SPL roster, **🪞 Mirror SPL rosters**, ESPN write log (Sheet tab `EspnLog`).
- Test team names: Mirror renames them to the real SPL team + " (test)" (backend `testName_`; short fallback `SHORT_TEAM`).
- Mapping: Mike's own ESPN team = Mike; the other 3 by ESPN team id = Joe, Al, Glen (`DEMO_OWNERS` in `backend/mod_espn.js`).
- Reset after a demo: Mirror again + Wipe test trades. Mirror on a day without games (locked players can be refused).
- A trade ESPN refused shows on the Commish desk under **Do on ESPN** with ESPN's reason. Never re-run it blindly: check ESPN first (it may be pending), then do it by hand and tap ✓ Done on ESPN.

## 4d. Sheet backup (daily, automatic)
The watchdog emails a zip of every tab as CSV to **spl.hq.ops@gmail.com only** (never OPS_EMAIL), once a day when anything changed.
Subject `SPL HQ backup YYYY-MM-DD · N tabs · N rows`. Ops desk → Back up now sends one on demand. **Restore a tab:** open the Sheet → that
tab → File → Import → Upload the tab's CSV → Replace current sheet. Small slips: File → Version history is faster. Never forward these
emails (the Owners tab has contacts and passphrase hashes).

## 5. Uptime monitor (the one outside watcher)
The watchdog lives inside the backend, so it can't report the backend itself being down. UptimeRobot (free) → New monitor → Keyword →
URL `<API_URL>?action=health` (the app's `API_URL`) → keyword `"healthy":true` → every 5 min → alert to Mike's phone (UptimeRobot app).
Its pings also keep the watchdog running if the hourly trigger is ever missing.

## 5b. Before sharing with a new owner (launch checklist)
Ops desk all blue: 🩺 System ✅ · 🤖 Robots ✅ (GH_TOKEN set, trigger installed, nothing red) · UptimeRobot green · ESPN writes **off** unless
demoing · a backup email in the ops inbox · CI green on the last push. Bus factor: Joe joins the `spl-hq` GitHub org as a second owner
after the demo, and the ops Google account has Mike's phone + a recovery email.

## 6. Rollback
- Backend: `git revert` the commit and push; the loader picks it up in 5 min. A logic.js or part that doesn't compile falls back to the 6-hour last-good copy automatically (a broken part also emails ops, once an hour). CI (Actions → Checks) goes red on the push.
- App: `git revert` and push; Pages redeploys in ~1 min.
- Sheet data: File → Version history.
