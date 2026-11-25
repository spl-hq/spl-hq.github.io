# SPL HQ — Ops runbook

_Owner: Mike (ops). Last updated 2026-11-25 (v0.1)._ Keep this current whenever a secret, tab, robot or switch is added.

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

## 4. Everyday

- **Is it working?** App → League → 🛠️ Ops desk (backend version, Sheet, ESPN read + test league, emails left, Joe's answers).
- **Backend change:** Claude pushes `backend/logic.js`; live in ≤5 min. Force it: Sheet → SPL HQ → Load latest logic now.
- **Loader change (rare):** paste the new `backend/Code.gs`, Save, Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy.
  The URL stays the same.
- **Cookies expired:** copy fresh `espn_s2` / `SWID` from Chrome (fantasy.espn.com → F12 → Application → Cookies) into
  Script properties and GitHub secrets.

## 5. Uptime monitor (after first deploy)
UptimeRobot (free) → New monitor → Keyword → URL `<API_URL>?action=health` → keyword `"healthy":true` → alert to Mike's phone.

## 6. Rollback
- Backend: `git revert` the commit and push; the loader picks it up in 5 min. A logic.js that doesn't compile falls back to the 6-hour last-good copy automatically.
- App: `git revert` and push; Pages redeploys in ~1 min.
- Sheet data: File → Version history.
