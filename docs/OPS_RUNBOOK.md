# SPL HQ — Ops runbook

_Owner: Mike (ops). Last updated 2026-11-26 (v0.13)._ Keep this current whenever a secret, tab, robot or switch is added.

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
| `OPS_EMAIL` | Script properties (optional) | Extra address(es) copied on answer/feedback emails, e.g. Mike's personal Gmail |

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
- **Backend change:** Claude pushes `backend/logic.js`; live in ≤5 min. Force it: Sheet → SPL HQ → Load latest logic now.
- **Loader change (rare):** paste the new `backend/Code.gs`, Save, Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy.
  The URL stays the same.
- **Cookies expired:** copy fresh `espn_s2` / `SWID` from Chrome (fantasy.espn.com → F12 → Application → Cookies) into
  Script properties and GitHub secrets.

## 4b. Robots (automated upkeep)
| Robot | When | Does | If it fails |
|---|---|---|---|
| `Ledger sync` (GitHub Action) | Every 2 h; on change or by hand | Backend `?action=ledger` → `data/Draft_Pick_Ownership.csv`, `data/Trade_Log.csv`, keeper contracts follow trades (test mode → `data/test/`) → `league-data.js` | GitHub emails the org owner; Ops desk "Ledger robot" turns red after 36 h. Usual cause: backend down (check `?action=health`) |
| `ESPN history pull` (GitHub Action) | Daily ~6 AM ET (Tuesday adds last week's finals); also on change or by hand | ESPN 19583 finals → `data/SPL_Matchups.csv` (gold) + the games still to play → `data/SPL_Schedule.csv` (gold, feeds 🗓️ Up next) → `league-data.js` | GitHub emails the org owner; Ops desk "History robot" turns red after 9 days. Usual cause: ESPN cookies expired → refresh the `ESPN_S2`/`SWID` secrets |
| `Weekly Pulse` (GitHub Action) | After every history pull + Tue 9 AM ET backstop; by hand (Run workflow, tick **force** to rewrite the week) | `tools/pulse.py`: newest finished week → facts from gold → Claude writes the edition (needs GitHub secret **`CLAUDE_CODE_OAUTH_TOKEN`**, from `claude setup-token` on Mike's subscription) → `data/Weekly_Pulse.json` (gold) → `league-data.js` | No token: a plain template edition ships (Ops desk says "template"). Token set but Claude failed: template edition saved, Action goes red, GitHub emails. Fix the token, Run workflow with force |

## 4c. ESPN test league (WS5)
- Ops desk → **🏈 ESPN test league**: writes switch, each of the 4 test teams vs its SPL roster, **🪞 Mirror SPL rosters**, ESPN write log (Sheet tab `EspnLog`).
- Test team names: Mirror renames them to the real SPL team + " (test)" (backend `testName_`; short fallback `SHORT_TEAM`).
- Mapping: Mike's own ESPN team = Mike; the other 3 by ESPN team id = Joe, Al, Glen (`DEMO_OWNERS` in `backend/logic.js`).
- Reset after a demo: Mirror again + Wipe test trades. Mirror on a day without games (locked players can be refused).
- A trade ESPN refused shows on the Commish desk under **Do on ESPN** with ESPN's reason. Never re-run it blindly: check ESPN first (it may be pending), then do it by hand and tap ✓ Done on ESPN.

## 5. Uptime monitor (after first deploy)
UptimeRobot (free) → New monitor → Keyword → URL `<API_URL>?action=health` → keyword `"healthy":true` → alert to Mike's phone.

## 6. Rollback
- Backend: `git revert` the commit and push; the loader picks it up in 5 min. A logic.js that doesn't compile falls back to the 6-hour last-good copy automatically.
- App: `git revert` and push; Pages redeploys in ~1 min.
- Sheet data: File → Version history.
