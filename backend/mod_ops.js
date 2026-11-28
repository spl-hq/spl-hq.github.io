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
// Each robot explains itself on the Ops desk (Mike 11/28: tap a robot → what it does + what it did each run): does / when / reads / writes are
// plain English; msg = the start of the commit message it pushes (so the desk can match each run to what it changed).
var ROBOTS = [
  { file: "ledger-sync.yml", name: "Ledger sync", icon: "📒", every: 2, grace: 1.5, why: "pick ledger, trades, contracts → repo", msg: "Ledger sync",
    does: "Copies what the app decided into the repo's gold files: who owns which draft pick, approved trades (with drops), keeper contracts that moved with traded players, finished off-season drafts and the live SPL Draft board, closed league votes, final Signing Day declarations. Then rebuilds the app's data file.",
    when: "Every 2 hours (the watchdog runs it if GitHub's schedule skips), and when its own code changes.", reads: "The backend (the Sheet behind the app)", writes: "data/Draft_Pick_Ownership.csv, Trade_Log.csv, Keeper_Contracts.csv, Offseason_Drafts.csv, Draft_Picks.csv, League_Votes.csv, Keeper_Declarations.csv → league-data.js" },
  { file: "espn-history.yml", name: "ESPN history pull", icon: "🏈", every: 24, grace: 4, why: "finals + schedule from ESPN", anchor: { dow: 2, utc: 11.3 }, msg: "ESPN history pull", // + Tue 6:17 AM ET for the 7 AM Edition
    does: "Reads every SPL game ESPN has: final scores go into the history file, games still to play go into the schedule (the Up next and Match cards). Tuesday morning's run adds last week's finals before the Home cards turn over.",
    when: "Every morning at 6:17 AM ET (a must-run on Tuesday), and when its own code changes.", reads: "ESPN league 19583 (read only)", writes: "data/SPL_Matchups.csv, SPL_Schedule.csv → league-data.js" },
  { file: "espn-archive.yml", name: "ESPN archive pull", icon: "🗄️", every: 24 * 7, grace: 24, why: "past drafts, teams, rosters, trades from ESPN", msg: "ESPN archive pull",
    does: "Pulls everything ESPN keeps about past seasons: draft boards, team names, final rosters and transactions. Feeds History, the draft boards and player files.",
    when: "Once a week, and when its script or the Owner Registry changes.", reads: "ESPN league 19583, past seasons (read only)", writes: "data/ESPN_Draft_Boards.csv, ESPN_Season_Teams.csv, ESPN_Season_Rosters.csv, ESPN_Transactions.csv, docs/ESPN_ARCHIVE_REPORT.md" },
  { file: "card-lines.yml", name: "Card lines", icon: "✍️", every: 0, why: "follows each history pull", msg: "Card lines",
    does: "Claude writes the one-line takes on the Home cards for the newest final week (Power 3, results, rivalries). Once per week; without the CLAUDE_CODE_OAUTH_TOKEN secret it does nothing and the cards show plain facts.",
    when: "After every successful history pull, plus Tuesday 7:07 AM ET.", reads: "league-data.js (the week's facts)", writes: "data/Card_Lines.json → league-data.js" },
  { file: "build-data.yml", name: "Build league data", icon: "🧱", every: 0, why: "on every data/ change", msg: "Build league data",
    does: "Rebuilds the app's two data files from the gold CSVs whenever anything in data/ changes, so the app never runs on stale numbers.",
    when: "On every push that touches data/ (by a person or another robot).", reads: "Every gold CSV in data/", writes: "league-data.js, player-history.js" },
  { file: "checks.yml", name: "Checks (CI)", icon: "✅", every: 0, why: "on every app/backend push", msg: "",
    does: "Checks every push before anyone notices a problem: every backend file compiles and fits Apps Script's size limit, the backend smoke test (hundreds of checks), and the app's scripts compile. Red on main = something live is broken.",
    when: "On every push to main.", reads: "The pushed code", writes: "Nothing (pass / fail only)" }
];
// The backend's own robots (Apps Script, the hourly tick + on reads). log = Log-tab kinds that belong to each, shown on its page.
var JOBS = [
  { id: "tick", icon: "🐕", name: "Hourly watchdog", log: ["watchdog", "watchdog_error", "tick_error"],
    does: "Reads every GitHub robot's runs, runs any robot GitHub's schedule skipped, checks Pages = main, ESPN cookie age, GitHub token, Sheet size, and emails ops when a problem starts and when it clears (never every hour).",
    when: "Every hour (Apps Script trigger on tick). Without the trigger it rides the app's health pings." },
  { id: "backup", icon: "💾", name: "Sheet backup", log: ["backup_error"],
    does: "Zips every Sheet tab as CSV and emails it to the ops inbox, only when something changed since the last one. Restore steps: runbook §4d.",
    when: "Once a day, inside the hourly watchdog. Back up now on the desk any time." },
  { id: "trades", icon: "⏳", name: "Trade review clock", log: ["trade_approve", "tradehold", "review_error"],
    does: "Finishes trades whose review is over (24 h in season, 72 h off-season) with fewer than 6 vetoes: moves players and picks, writes ESPN, posts to chat. Holds a trade if a roster ends up over the limit until that owner picks a drop.",
    when: "Every hour, and whenever anyone opens trades or a desk." },
  { id: "votes", icon: "🗳️", name: "Vote closer", log: ["voteclose", "voteopen"],
    does: "Closes SPL Owners Votes at their deadline, counts them by the rule (rule change = 7 Yes; league matter = more Yes than No) and posts the result to league chat.",
    when: "Every hour, and whenever anyone opens votes." },
  { id: "keepers", icon: "🔒", name: "Signing Day clock", log: ["kauto", "kfinal", "kfinal_error", "kwindow"],
    does: "Opens Signing Day when the calendar says (tells the league once) and, once it's closed, makes everyone's latest declaration final and posts the results.",
    when: "Every hour, and on every ledger sync." },
  { id: "usage", icon: "👀", name: "Usage upkeep", log: ["usage_error"],
    does: "Trims usage rows older than 120 days and, after 7 AM ET, emails ops one recap of who was in yesterday.",
    when: "Every hour (the recap once a day)." }
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
    var x = { file: rb.file, name: rb.name, icon: rb.icon, why: rb.why, every: rb.every };
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
    var b0 = jsonProp_("OPS_BACKUP", {}).at;
    var R = robots_(true), ran = watchdog_(R), B = backup_(false), P = pages_(), K = cookie_(), S = sheetSize_(), H = health_(false), p = problems_(R, B, P, K, S, H);
    alert_(p);
    return { ok: true, ran: ran, backup: B.at === b0 ? "skip" : B.error ? "err" : B.sentAt === B.at ? "sent" : "same", problems: Object.keys(p).map(function (k) { return p[k]; }) };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
// 📓 Tick journal (Mike 11/28: "what did it do each run"): one compact line per tick, newest first, ~1.5 days. Script property (9 KB cap).
function tickJournal_(by, o, extra) {
  if (!o || o.busy) return;
  var e = { at: new Date().toISOString(), by: by, w: (o.ran || []).map(function (r) { return r.name + (r.ok ? "" : " ✗"); }), b: o.backup || "", p: (o.problems || []).map(function (t) { return String(t).slice(0, 90); }).slice(0, 3) };
  if (o.error) e.err = String(o.error).slice(0, 120);
  Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
  var log = jsonProp_("OPS_TICKLOG", []); log.unshift(e);
  while (log.length > 1 && JSON.stringify(log).length > 8000) log.pop();
  setProp_("OPS_TICKLOG", JSON.stringify(log.slice(0, 36)));
}
function maybeTick_() { // no trigger installed? ride the (cached-miss) health pings, at most every 70 min
  var t = jsonProp_("OPS_TICK", {}); if (hoursSince_(t.at) < 70 / 60) return;
  try { tickJournal_("lazy", ops_tick_("lazy")); } catch (e) { log_("tick_error", String(e)); }
}

// Ops desk feed (ops only). action "opsx" {run: "tick" | "backup"}.
function opsx_(me, b) {
  var did = null;
  if (b && b.run === "tick") { did = ops_tick_("desk"); tickJournal_("desk", did); }
  if (b && b.run === "backup") did = backup_(true);
  if (b && b.run === "robot") did = runRobot_(me, b.file);
  var R = robots_(!!(b && b.run)), B = jsonProp_("OPS_BACKUP", {}), P = jsonProp_("OPS_PAGES", {}), K = cookie_(), S = sheetSize_();
  return { ok: true, did: did, robots: R, backup: B, pages: P, cookie: K, sheet: S, tick: jsonProp_("OPS_TICK", {}),
    watchdog: jsonProp_("OPS_WATCHDOG", []), alerts: jsonProp_("OPS_ALERTS", {}), journal: jsonProp_("OPS_TICKLOG", []).slice(0, 1),
    jobs: JOBS.map(function (j) { return { id: j.id, icon: j.icon, name: j.name }; }) };
}
// ▶️ Run now from a robot's page (ops). Robots are safe to re-run; never one that's already running.
function runRobot_(me, file) {
  var rb = ROBOTS.filter(function (x) { return x.file === file; })[0]; if (!rb) return { ok: false, error: "No such robot" };
  if (!prop_("GH_TOKEN")) return { ok: false, error: "Add GH_TOKEN first (runbook §2)" };
  var cur = robots_(true).list.filter(function (x) { return x.file === file; })[0];
  if (cur && cur.running) return { ok: false, error: rb.name + " is already running" };
  var r = gh_("/actions/workflows/" + file + "/dispatches", { ref: "main" }), good = r.code === 204 || r.code === 200;
  log_(good ? "robot_run" : "robot_run_error", rb.name + " by " + me.owner + (good ? "" : " · " + r.code));
  if (good) { var h = jsonProp_("OPS_HANDRUN", []); h.unshift({ at: new Date().toISOString(), file: file, by: me.owner }); setProp_("OPS_HANDRUN", JSON.stringify(h.slice(0, 20))); CacheService.getScriptCache().remove("ops_robots"); CacheService.getScriptCache().remove("ops_rb_" + file); }
  return good ? { ok: true, name: rb.name } : { ok: false, error: "GitHub refused (" + r.code + ")" };
}

// 🔎 One robot's page (ops; action "oprobot" {id}). GitHub robots: the last 15 runs, each with what started it (schedule, watchdog,
// Run now, a push, another robot), how long it took, how it ended (the failing step if it failed) and what it changed (its commit's
// files, +/− lines). Backend robots: the tick journal + their Log-tab lines. Cached 5 min per robot; commit details 6 h by sha.
function oprobot_(me, b) {
  var id = String((b && b.id) || ""), rb = ROBOTS.filter(function (x) { return x.file === id; })[0], jb = JOBS.filter(function (x) { return x.id === id; })[0];
  if (jb) return jobPage_(jb);
  if (!rb) return { ok: false, error: "No such robot" };
  var c = CacheService.getScriptCache(), hit = b.fresh ? null : c.get("ops_rb_" + id); if (hit) return JSON.parse(hit);
  var info = { file: rb.file, name: rb.name, icon: rb.icon, does: rb.does, when: rb.when, reads: rb.reads, writes: rb.writes, every: rb.every };
  var r = gh_("/actions/workflows/" + id + "/runs?branch=main&per_page=15");
  if (r.code !== 200 || !r.json) return { ok: true, robot: info, error: r.code === 401 ? "GitHub token refused (401)" : !prop_("GH_TOKEN") ? "Add GH_TOKEN so the desk can read GitHub (runbook §2)" : "GitHub " + (r.code || r.error), runs: [] };
  var runs = r.json.workflow_runs || [], wd = jsonProp_("OPS_WATCHDOG", []), hand = jsonProp_("OPS_HANDRUN", []);
  var near = function (list, at, f) { var t = new Date(at).getTime(); return list.some(function (x) { return (!f || x.file === f) && Math.abs(new Date(x.at).getTime() - t) < 10 * 6e4; }); };
  var commits = [];
  if (rb.msg && runs.length) {
    var since = runs[runs.length - 1].created_at, cr = gh_("/commits?sha=main&author=" + encodeURIComponent("spl-hq-robot@users.noreply.github.com") + "&since=" + since + "&per_page=100");
    commits = cr.code === 200 && Array.isArray(cr.json) ? cr.json.map(function (k) { return { sha: k.sha, at: k.commit && (k.commit.committer || k.commit.author || {}).date, msg: k.commit && k.commit.message || "" }; }) : [];
  }
  var jobsCalls = 0, filesCalls = 0;
  var out = runs.map(function (u) {
    var start = u.run_started_at || u.created_at, end = u.status === "completed" ? u.updated_at : null;
    var x = { at: u.created_at, status: u.status, result: u.conclusion || "", url: u.html_url, secs: end ? Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000)) : null, event: u.event };
    x.how = u.event === "schedule" ? "schedule" : u.event === "workflow_run" ? "after" : u.event === "push" ? "push" :
      u.event === "workflow_dispatch" ? (near(hand, u.created_at, id) ? "hand" : near(wd.filter(function (w) { return w.name === rb.name; }), u.created_at) ? "watchdog" : "dispatch") : u.event;
    if (u.event === "push" && u.head_commit) x.cause = String(u.head_commit.message || "").split("\n")[0].slice(0, 120);
    if (u.conclusion === "failure" && jobsCalls < 3) { jobsCalls++; var jr = gh_("/actions/runs/" + u.id + "/jobs");
      if (jr.code === 200 && jr.json) (jr.json.jobs || []).forEach(function (j) { (j.steps || []).forEach(function (st) { if (st.conclusion === "failure" && !x.failStep) x.failStep = st.name; }); }); }
    if (u.status === "completed") {
      var t0 = new Date(start).getTime() - 6e4, t1 = new Date(end).getTime() + 3 * 6e4;
      var mine = commits.filter(function (k) { var t = new Date(k.at).getTime(); return t >= t0 && t <= t1 && (k.msg.indexOf(rb.msg) === 0 || /^Rebuild league-data/.test(k.msg)); });
      x.commits = mine.map(function (k) {
        var key = "ops_cm_" + k.sha.slice(0, 12), got = c.get(key), d = got ? JSON.parse(got) : null;
        if (!d && filesCalls < 8) { filesCalls++; var kr = gh_("/commits/" + k.sha);
          if (kr.code === 200 && kr.json) { d = { files: (kr.json.files || []).slice(0, 12).map(function (f) { return { f: f.filename, a: f.additions, d: f.deletions }; }) }; try { c.put(key, JSON.stringify(d), 21600); } catch (e) {} } }
        return { sha: k.sha.slice(0, 7), msg: k.msg.split("\n")[0].slice(0, 120), url: "https://github.com/" + REPO + "/commit/" + k.sha, files: d ? d.files : null };
      });
    }
    return x;
  });
  var res = { ok: true, robot: info, runs: out, at: new Date().toISOString() };
  try { c.put("ops_rb_" + id, JSON.stringify(res), 300); } catch (e) {}
  return res;
}
function jobPage_(jb) {
  var lines = [], want = {}; jb.log.forEach(function (k) { want[k] = 1; });
  try { lines = rows_("Log").slice(-600).filter(function (r) { return want[r.kind] && (r.kind !== "trade_approve" || / by review$/.test(r.detail)); }).reverse().slice(0, 25)
    .map(function (r) { return { at: r.ts instanceof Date ? r.ts.toISOString() : String(r.ts), kind: r.kind, detail: String(r.detail || "") }; }); } catch (e) {}
  return { ok: true, job: { id: jb.id, icon: jb.icon, name: jb.name, does: jb.does, when: jb.when }, journal: jsonProp_("OPS_TICKLOG", []), log: lines,
    tick: jsonProp_("OPS_TICK", {}), backup: jsonProp_("OPS_BACKUP", {}) };
}

// ---------------------------------------------------------------- 👋 Welcome tour replay (Mike 11/27, after MAFFL REEL's desk control)
// The app shows the tour once per owner on their first visit. The Ops desk can replay it for one owner or everyone: a new stamp in
// Script property TOUR_STAMPS ({ owner: "T…", "*": "T…" }); "me" hands each owner the newest stamp that applies, and the app replays
// the tour once per stamp it hasn't seen, on whatever phone they open next. "T" + epoch ms, so stamps compare as strings.
function tourStampOf_(owner) { var t = jsonProp_("TOUR_STAMPS", {}), a = String(t[owner] || ""), b = String(t["*"] || ""); return a > b ? a : b; }
function tourReset_(me, b) {
  var who = String((b && b.target) || ""), t = jsonProp_("TOUR_STAMPS", {}), st = "T" + Date.now();
  if (who === "*") { setProp_("TOUR_STAMPS", JSON.stringify({ "*": st })); log_("tour", me.owner + " → everyone"); return { ok: true, n: owners_().length }; }
  var o = owners_().filter(function (x) { return x.owner === who; })[0]; if (!o) return { ok: false, error: "Pick an owner" };
  t[who] = st; setProp_("TOUR_STAMPS", JSON.stringify(t)); log_("tour", me.owner + " → " + who); return { ok: true, who: o.name };
}

// 🍂 Season phase (Mike 11/28): the whole app formats itself for the off-season, but only when the commish (Joe) or ops (Mike) flips the
// switch on their desk. Never automatic, never date-based. One Script property PHASE {phase, by, at, season}; every phone reads it with
// `me` (signed in) or GET ?action=phase (signed out, robots). Flipping to the off-season posts one line to league chat.
function phase_() { var p = jsonProp_("PHASE", null); return p && (p.phase === "offseason" || p.phase === "season") ? p : { phase: "season", by: "", at: "" }; }
function setPhase_(me, b) {
  var to = b && (b.phase === "offseason" || b.phase === "season") ? b.phase : "";
  if (!to) return { ok: false, error: "Pick off-season or season" };
  var cur = phase_(); if (cur.phase === to) return { ok: true, phase: cur, same: true };
  var p = { phase: to, by: me.owner, at: new Date().toISOString(), season: Number(b.season) || "" };
  setProp_("PHASE", JSON.stringify(p)); log_("phase", me.owner + " → " + to);
  if (to === "offseason") try { botPost_("league", "🍂 The off-season is open" + (p.season ? " (" + p.season + ")" : "") + ". SPL HQ now leads with keepers, picks and the off-season calendar.", "phase:" + p.at); } catch (e) {}
  return { ok: true, phase: p };
}
