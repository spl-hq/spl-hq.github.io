// ---------------------------------------------------------------- 🛠️ WS7 · Ops + robots (part of the backend; evaluated in logic.js's scope)
// The site keeps itself current (Mike 11/25), so the robots need a watcher that doesn't depend on the robots:
//   · tick() (hourly Apps Script trigger; falls back to riding health pings if the trigger isn't installed) runs ops_tick_():
//     ① watchdog: a robot GitHub's own schedule skipped (new repos: GitHub's cron often doesn't fire for days) is run by hand
//        through the GitHub API (needs Script property GH_TOKEN, a fine-grained token: this repo, Actions read + write only);
//     ② daily Sheet backup: every tab as CSV in a zip, emailed to the ops account only (never OPS_EMAIL), when anything changed;
//     ③ checks: ESPN cookie age, Pages serving what main says, Sheet size, GitHub token expiry, robots failing;
//     ④ alerts: ops is emailed when a problem appears and when everything is clear again (never every hour).
//   · ops action "opsx" feeds the Ops desk's 🤖 Robots card with all of it.
// Safe to re-run: the watchdog only runs a robot that hasn't run within its interval and isn't already running.
var ROBOTS = [
  { file: "ledger-sync.yml", name: "Ledger sync", every: 2, grace: 1.5, why: "pick ledger, trades, contracts → repo" },
  { file: "espn-history.yml", name: "ESPN history pull", every: 24, grace: 4, why: "finals + schedule from ESPN", anchor: { dow: 2, utc: 11.3 } }, // + Tue 6:17 AM ET for the 7 AM Edition
  { file: "card-lines.yml", name: "Card lines", every: 0, why: "follows each history pull" },
  { file: "build-data.yml", name: "Build league data", every: 0, why: "on every data/ change" },
  { file: "checks.yml", name: "Checks (CI)", every: 0, why: "on every app/backend push" }
];
var SHEET_CELL_LIMIT = 10000000;

function gh_(path, post) {
  var t = prop_("GH_TOKEN"), h = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "spl-hq-backend" };
  if (t) h.Authorization = "Bearer " + t;
  var o = { muteHttpExceptions: true, headers: h }, r;
  if (post) { o.method = "post"; o.contentType = "application/json"; o.payload = JSON.stringify(post); }
  try { r = UrlFetchApp.fetch("https://api.github.com/repos/" + REPO + path, o); } catch (e) { return { code: 0, json: null, error: String(e) }; }
  var txt = r.getContentText(), hd = r.getAllHeaders ? r.getAllHeaders() : {}, exp = null, js = null;
  Object.keys(hd || {}).forEach(function (k) { if (k.toLowerCase() === "github-authentication-token-expiration") exp = String(hd[k]); });
  try { js = txt ? JSON.parse(txt) : null; } catch (e) {}
  return { code: r.getResponseCode(), json: js, exp: exp };
}
function missedAnchor_(a, lastAt) { // a weekly must-run time (UTC day + hour): past it by 30 min with no run since → due
  if (!a) return false; var now = new Date(), t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); t.setTime(t.getTime() + a.utc * 3.6e6);
  return now.getUTCDay() === a.dow && now.getTime() > t.getTime() + 1.8e6 && (!lastAt || new Date(lastAt).getTime() < t.getTime());
}
function hoursSince_(ts) { return ts ? (Date.now() - new Date(ts).getTime()) / 3.6e6 : 1e9; }

// Each robot's last runs from GitHub (one call per robot; 2-min cache so the desk and the tick share it).
function robots_(fresh) {
  var c = CacheService.getScriptCache(), hit = fresh ? null : c.get("ops_robots"); if (hit) return JSON.parse(hit);
  var out = { at: new Date().toISOString(), token: !!prop_("GH_TOKEN"), tokenExp: null, list: [] }, err = null;
  ROBOTS.forEach(function (rb) {
    var r = gh_("/actions/workflows/" + rb.file + "/runs?branch=main&per_page=15");
    if (r.exp) out.tokenExp = r.exp;
    var x = { file: rb.file, name: rb.name, why: rb.why, every: rb.every };
    if (r.code !== 200 || !r.json) { x.error = r.code === 401 ? "GitHub token refused (401)" : r.code === 403 ? "GitHub said 403 (" + (out.token ? "token can't read Actions" : "add GH_TOKEN") + ")" : "GitHub " + (r.code || r.error); err = x.error; out.list.push(x); return; }
    var runs = r.json.workflow_runs || [];
    var done = runs.filter(function (u) { return u.status === "completed" && u.conclusion !== "cancelled" && u.conclusion !== "skipped"; });
    var last = runs[0], lastDone = done[0], lastOk = done.filter(function (u) { return u.conclusion === "success"; })[0];
    x.running = runs.some(function (u) { return u.status === "queued" || u.status === "in_progress" || u.status === "waiting"; });
    x.lastAt = last ? last.created_at : null; x.lastEvent = last ? last.event : null;
    x.okAt = lastOk ? lastOk.created_at : null;
    x.failing = !!(lastDone && lastDone.conclusion !== "success"); x.url = lastDone ? lastDone.html_url : null;
    x.failAt = x.failing ? lastDone.created_at : null;
    x.scheduled = runs.some(function (u) { return u.event === "schedule"; });
    x.watchdog = runs.filter(function (u) { return u.event === "workflow_dispatch" && hoursSince_(u.created_at) < 168; }).length;
    x.late = rb.every > 0 && !x.running && (hoursSince_(x.lastAt) > rb.every + rb.grace || missedAnchor_(rb.anchor, x.lastAt));
    out.list.push(x);
  });
  out.error = err;
  try { c.put("ops_robots", JSON.stringify(out), 120); } catch (e) {}
  return out;
}

// ① Watchdog: run a robot GitHub's schedule skipped. Never one that's running or ran within its interval; failures alert instead.
function watchdog_(R) {
  var ran = [];
  if (!prop_("GH_TOKEN")) return ran;
  R.list.forEach(function (x) {
    if (!x.late || x.error) return;
    var r = gh_("/actions/workflows/" + x.file + "/dispatches", { ref: "main" });
    var good = r.code === 204 || r.code === 200;
    log_(good ? "watchdog" : "watchdog_error", x.name + (good ? " run by hand (last run " + Math.round(hoursSince_(x.lastAt)) + " h ago)" : " dispatch refused: " + r.code));
    ran.push({ name: x.name, ok: good, code: r.code });
  });
  if (ran.length) { var log = jsonProp_("OPS_WATCHDOG", []); ran.forEach(function (w) { log.unshift({ at: new Date().toISOString(), name: w.name, ok: w.ok }); }); setProp_("OPS_WATCHDOG", JSON.stringify(log.slice(0, 20))); CacheService.getScriptCache().remove("ops_robots"); }
  return ran;
}
function jsonProp_(k, d) { try { var v = prop_(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }

// ② Backup: every tab as CSV, zipped, emailed to the ops account (the Sheet's own Google account) once a day when anything changed.
function csv_(rows) {
  return rows.map(function (r) { return r.map(function (v) { v = v instanceof Date ? v.toISOString() : String(v == null ? "" : v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
}
function backup_(force) {
  var st = jsonProp_("OPS_BACKUP", {}); if (!force && hoursSince_(st.at) < 20) return st;
  try {
    var ss = SpreadsheetApp.getActive(), blobs = [], all = "", rows = 0, day = new Date().toISOString().slice(0, 10);
    ss.getSheets().forEach(function (s) { var v = s.getDataRange().getValues(), t = csv_(v); all += s.getName() + "\n" + t + "\n"; rows += Math.max(0, v.length - 1);
      blobs.push(Utilities.newBlob(t, "text/csv", s.getName() + ".csv")); });
    var hash = hmac_(all, "spl-backup").slice(0, 16);
    st = { at: new Date().toISOString(), tabs: blobs.length, rows: rows, sentAt: st.sentAt || null, hash: st.hash || null, error: null };
    if (force || hash !== st.hash) {
      MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: "SPL HQ backup " + day + " · " + st.tabs + " tabs · " + rows + " rows",
        body: "Daily backup of the SPL HQ App Sheet (sent only when something changed). Restore a tab: open the Sheet → that tab → File → Import → Upload the tab's CSV from this zip → Replace current sheet.\n\nKeep these emails; never forward them (the Owners tab has contacts and passphrase hashes).",
        attachments: [Utilities.zip(blobs, "spl-hq-backup-" + day + ".zip")] });
      st.sentAt = st.at; st.hash = hash;
    }
  } catch (e) { st = { at: new Date().toISOString(), sentAt: st.sentAt || null, hash: st.hash || null, error: String(e && e.message || e).slice(0, 200) }; log_("backup_error", st.error); }
  setProp_("OPS_BACKUP", JSON.stringify(st));
  return st;
}

// ③ Checks
function cookie_() { // ESPN cookies don't say when they expire (~a year after the login they came from): track when this pair was first seen.
  var s2 = prop_("ESPN_S2"); if (!s2) return { set: false };
  var key = hmac_("cookie", String(s2)).slice(0, 16), seen = String(prop_("ESPN_S2_SEEN") || "").split("|");
  if (seen[0] !== key) { seen = [key, new Date().toISOString()]; setProp_("ESPN_S2_SEEN", seen.join("|")); }
  var days = Math.floor(hoursSince_(seen[1]) / 24);
  return { set: true, since: seen[1], days: days, warn: days >= 300 };
}
function pages_() { // is GitHub Pages serving the app main says? (a stuck Pages build = owners on an old app)
  var v = function (url) { try { var r = UrlFetchApp.fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now(), { muteHttpExceptions: true });
    var m = r.getResponseCode() === 200 && /var APP_VERSION = "([^"]+)"/.exec(r.getContentText()); return m ? m[1] : null; } catch (e) { return null; } };
  var live = v(APP_URL), main = v("https://raw.githubusercontent.com/" + REPO + "/main/index.html"), st = jsonProp_("OPS_PAGES", {});
  var same = !!(live && main && live === main);
  if (same) st = { live: live, main: main, same: true, at: new Date().toISOString() };
  else st = { live: live, main: main, same: false, at: new Date().toISOString(), since: st.same === false && st.since ? st.since : new Date().toISOString() };
  setProp_("OPS_PAGES", JSON.stringify(st)); return st;
}
function sheetSize_() {
  var ss = SpreadsheetApp.getActive(), cells = 0, tabs = [];
  ss.getSheets().forEach(function (s) { var r = s.getMaxRows ? s.getMaxRows() : s.getLastRow(), c = s.getMaxColumns ? s.getMaxColumns() : s.getLastColumn();
    cells += r * c; tabs.push({ name: s.getName(), rows: Math.max(0, s.getLastRow() - 1) }); });
  tabs.sort(function (a, b) { return b.rows - a.rows; });
  return { cells: cells, limit: SHEET_CELL_LIMIT, pct: Math.round(cells / SHEET_CELL_LIMIT * 1000) / 10, tabs: tabs.slice(0, 5) };
}

// Problems: key → message. ④ emails on change only.
function problems_(R, B, P, K, S, H) {
  var p = {};
  R.list.forEach(function (x) {
    if (x.error) p["gh"] = "Can't read the robots from GitHub: " + x.error;
    else if (x.failing) p["fail:" + x.file] = x.name + " failed " + Math.round(hoursSince_(x.failAt)) + " h ago: " + x.url;
    else if (x.late && !R.token) p["late:" + x.file] = x.name + " hasn't run in " + Math.round(hoursSince_(x.lastAt)) + " h (GitHub skipped its schedule; add GH_TOKEN so the watchdog can run it)";
  });
  if (R.tokenExp && hoursSince_(R.tokenExp) > -24 * 14) p["ghexp"] = "GitHub token (GH_TOKEN) expires " + R.tokenExp + ": make a new one";
  if (B.error) p["backup"] = "Sheet backup failed: " + B.error;
  if (P.same === false && hoursSince_(P.since) > 1) p["pages"] = "GitHub Pages serves app v" + (P.live || "?") + " but main is v" + (P.main || "?") + " (since " + P.since + ")";
  if (K.set && K.days >= 330) p["cookie"] = "ESPN cookies are " + K.days + " days old: refresh them before they expire (runbook §4)";
  if (H && !H.espnRead.ok) p["espn"] = "ESPN read failed: " + H.espnRead.error;
  if (S.pct >= 50) p["sheet"] = "Sheet is " + S.pct + "% of Google's cell limit";
  return p;
}
function alert_(p) {
  var was = jsonProp_("OPS_ALERTS", {}), now = Object.keys(p), fresh = now.filter(function (k) { return !was[k]; });
  var cleared = Object.keys(was).filter(function (k) { return !p[k]; });
  if (fresh.length) mail_("SPL HQ: needs a look (" + fresh.length + ")", fresh.map(function (k) { return "• " + p[k]; }).join("\n") + "\n\nOps desk: " + APP_URL + "#ops");
  else if (cleared.length && !now.length) mail_("SPL HQ: all clear", "Fixed: " + cleared.map(function (k) { return was[k]; }).join("\n") + "\n\nEverything on the Ops desk is green again.");
  setProp_("OPS_ALERTS", JSON.stringify(p));
}

// The hourly robot. by = "trigger" (Apps Script trigger on tick) or "lazy" (riding a health ping when the trigger is missing).
function ops_tick_(by) {
  var lock = LockService.getScriptLock(); if (lock.tryLock && !lock.tryLock(1000)) return { ok: false, busy: true };
  try {
    setProp_("OPS_TICK", JSON.stringify({ at: new Date().toISOString(), by: by }));
    var R = robots_(true), ran = watchdog_(R), B = backup_(false), P = pages_(), K = cookie_(), S = sheetSize_(), H = health_(false);
    alert_(problems_(R, B, P, K, S, H));
    return { ok: true, ran: ran };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function maybeTick_() { // no trigger installed? ride the (cached-miss) health pings, at most every 70 min
  var t = jsonProp_("OPS_TICK", {}); if (hoursSince_(t.at) < 70 / 60) return;
  try { ops_tick_("lazy"); } catch (e) { log_("tick_error", String(e)); }
}

// Ops desk feed (ops only). action "opsx" {run: "tick" | "backup"}.
function opsx_(me, b) {
  var did = null;
  if (b && b.run === "tick") did = ops_tick_("desk");
  if (b && b.run === "backup") did = backup_(true);
  var R = robots_(!!(b && b.run)), B = jsonProp_("OPS_BACKUP", {}), P = jsonProp_("OPS_PAGES", {}), K = cookie_(), S = sheetSize_();
  return { ok: true, did: did, robots: R, backup: B, pages: P, cookie: K, sheet: S, tick: jsonProp_("OPS_TICK", {}),
    watchdog: jsonProp_("OPS_WATCHDOG", []), alerts: jsonProp_("OPS_ALERTS", {}) };
}
