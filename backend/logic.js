/**
 * SPL HQ — backend LOGIC (core). Loaded at runtime by the stable loader (backend/Code.gs) from GitHub main.
 * Ship a backend change = edit this file + bump VERSION + push to main. Live within ~5 minutes, no redeploy.
 * Plan: docs/SPL_REEL_PLAN.md · rules: CLAUDE.md · ops: docs/OPS_RUNBOOK.md
 *
 * Contract with the loader: this file runs as the body of `function (M) { ... }` and must export doGet, doPost,
 * menuCheck and tick on M (bottom). Keep it under ~90 KB (CacheService limit).
 * Rules: no secrets in the repo (cookies live in Script properties); every Sheet write is formula-guarded;
 * ESPN writes only ever go to WRITE_LEAGUE.
 */
var VERSION = "0.1";
var SEASON = 2026;
var READ_LEAGUE = 19583;        // real SPL league: read-only (rosters, standings, schedule, history)
var WRITE_LEAGUE = 1722387564;  // "Testing MAFFL HQ": the ONLY league the backend may ever write to (until Joe signs off)
var ESPN_WRITES = false;        // kill switch: no ESPN writes exist in v0.1
var APP_URL = "https://spl-hq.github.io/";

// ---------------------------------------------------------------- HTTP
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === "health") return json(health_(p.fresh === "1"));
    if (p.action === "standings") return json(standings_());
    if (p.action === "answers") return json(answers_());
    return json({ ok: true, app: "SPL HQ", version: VERSION });
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
}

// Body is sent as text/plain JSON (avoids a CORS preflight from GitHub Pages).
function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json({ ok: false, error: "bad json" }); }
  if (!rate_()) return json({ ok: false, error: "Too many submissions this hour. Try again later." });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json({ ok: false, busy: true, error: "The league server is busy. Try again in a few seconds." }); }
  try {
    switch (b.action) {
      case "answers":  return json(saveAnswers_(b));
      case "feedback": return json(saveFeedback_(b));
      default:         return json({ ok: false, error: "unknown action" });
    }
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
  finally { lock.releaseLock(); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------------------------------------------------------- Sheet helpers
var HEADS = {
  Answers:  ["ts", "who", "qid", "question", "choice", "note", "source"],
  Feedback: ["ts", "who", "kind", "mood", "note", "where"],
  Log:      ["ts", "kind", "detail"]
};
function sheet_(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name); sh.appendRow(HEADS[name]); sh.setFrozenRows(1);
    var blank = ss.getSheetByName("Sheet1"); if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  }
  return sh;
}
function rows_(name) {
  var sh = sheet_(name), v = sh.getDataRange().getValues(), h = v.shift();
  return v.map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o; });
}
function safe_(s) { s = String(s == null ? "" : s); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function clip_(s, n) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, n); }
function append_(name, row) { sheet_(name).appendRow(row.map(function (v) { return typeof v === "string" ? safe_(v) : v; })); }
function log_(kind, detail) { try { append_("Log", [new Date(), kind, clip_(detail, 500)]); } catch (e) {} }
function rate_() {
  var c = CacheService.getScriptCache(), k = "rate:" + Math.floor(Date.now() / 3.6e6), n = Number(c.get(k) || 0);
  if (n >= 60) return false; c.put(k, String(n + 1), 3700); return true;
}
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function opsEmails_() {
  var list = [Session.getEffectiveUser().getEmail()], extra = prop_("OPS_EMAIL");
  if (extra) list = list.concat(String(extra).split(/[,\s]+/));
  return list.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(",");
}
function mail_(subject, body) {
  try { if (MailApp.getRemainingDailyQuota() > 5) MailApp.sendEmail(opsEmails_(), subject, body); } catch (e) { log_("mail_error", String(e)); }
}

// ---------------------------------------------------------------- Questions for Joe + feedback
var WHO = /^[a-z]{2,20}$/;
function saveAnswers_(b) {
  var who = String(b.who || "").toLowerCase(); if (!WHO.test(who)) return { ok: false, error: "Pick who you are first." };
  var items = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
  items = items.filter(function (it) { return it && /^[a-z0-9_]{1,30}$/.test(String(it.qid || "")) && (String(it.choice || "").trim() || String(it.note || "").trim()); });
  if (!items.length) return { ok: false, error: "Nothing to save yet: pick an answer or write a note." };
  var now = new Date(), lines = [];
  items.forEach(function (it) {
    var q = clip_(it.question, 300), c = clip_(it.choice, 200), n = clip_(it.note, 2000);
    append_("Answers", [now, who, String(it.qid), q, c, n, "app"]);
    lines.push("• " + q + "\n  → " + (c || "—") + (n ? "\n  “" + n + "”" : ""));
  });
  log_("answers", who + " answered " + items.length);
  mail_("SPL HQ · " + who + " answered " + items.length + " question" + (items.length > 1 ? "s" : ""),
    lines.join("\n\n") + "\n\nAll answers: the Answers tab in the SPL HQ App Sheet.\n" + APP_URL + "#ops");
  return { ok: true, saved: items.length };
}
function saveFeedback_(b) {
  var who = String(b.who || "").toLowerCase(); if (!WHO.test(who)) who = "anon";
  var note = clip_(b.note, 2000), mood = clip_(b.mood, 20), kind = /^(idea|bug|like|question)$/.test(b.kind) ? b.kind : "idea";
  if (!note.trim() && !mood) return { ok: false, error: "Write a note first." };
  append_("Feedback", [new Date(), who, kind, mood, note, clip_(b.where, 60)]);
  mail_("SPL HQ · feedback from " + who + (mood ? " (" + mood + ")" : ""), note + "\n\n" + APP_URL + "#ops");
  return { ok: true };
}
function answers_() {
  var latest = {}, total = 0;
  rows_("Answers").forEach(function (r) { total++; latest[r.who + ":" + r.qid] = { who: r.who, qid: r.qid, choice: r.choice, note: r.note, ts: r.ts }; });
  var fb = rows_("Feedback").slice(-20).reverse().map(function (r) { return { who: r.who, kind: r.kind, mood: r.mood, note: r.note, ts: r.ts }; });
  return { ok: true, total: total, answers: Object.keys(latest).map(function (k) { return latest[k]; }), feedback: fb };
}

// ---------------------------------------------------------------- ESPN (reads only in v0.1)
function cookies_() {
  var p = PropertiesService.getScriptProperties();
  var s2 = String(p.getProperty("ESPN_S2") || "").trim(), swid = String(p.getProperty("SWID") || "").trim();
  if (!s2 || !swid) throw new Error("SETUP: add ESPN_S2 and SWID in Apps Script → Project Settings → Script properties");
  if (swid.charAt(0) !== "{") swid = "{" + swid + "}";
  return "espn_s2=" + s2 + "; SWID=" + swid;
}
function espn_(lid, query) {
  var url = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/" + SEASON + "/segments/0/leagues/" + lid + "?" + query;
  var r = UrlFetchApp.fetch(url, { headers: { Cookie: cookies_() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("ESPN said " + r.getResponseCode());
  return JSON.parse(r.getContentText());
}
function espnCheck_(lid) {
  try {
    var d = espn_(lid, "view=mSettings&view=mTeam");
    return { ok: true, league: lid, name: (d.settings || {}).name || "", teams: (d.teams || []).length, week: d.scoringPeriodId || null };
  } catch (e) { return { ok: false, league: lid, setup: /^SETUP/.test(e.message), error: String(e.message).replace(/^SETUP: /, "") }; }
}
function standings_() {
  var c = CacheService.getScriptCache(), hit = c.get("standings"); if (hit) return JSON.parse(hit);
  var d = espn_(READ_LEAGUE, "view=mTeam&view=mSettings");
  var divs = {}; (((d.settings || {}).scheduleSettings || {}).divisions || []).forEach(function (x) { divs[x.id] = x.name; });
  var teams = (d.teams || []).map(function (t) {
    var rec = (t.record || {}).overall || {};
    return { id: t.id, name: t.name || ((t.location || "") + " " + (t.nickname || "")).trim(), abbrev: t.abbrev || "",
      div: divs[t.divisionId] || "", w: rec.wins || 0, l: rec.losses || 0, t: rec.ties || 0,
      pf: Math.round((rec.pointsFor || 0) * 10) / 10, pa: Math.round((rec.pointsAgainst || 0) * 10) / 10,
      seed: t.playoffSeed || null, rank: t.rankCalculatedFinal || t.currentProjectedRank || null };
  });
  var out = { ok: true, league: READ_LEAGUE, name: (d.settings || {}).name || "", week: d.scoringPeriodId || null, at: new Date().toISOString(), teams: teams };
  try { c.put("standings", JSON.stringify(out), 900); } catch (e) {}
  return out;
}

// ---------------------------------------------------------------- Health (uptime monitor keyword: "healthy":true)
function health_(fresh) {
  var c = CacheService.getScriptCache(), hit = fresh ? null : c.get("health"); if (hit) return JSON.parse(hit);
  var out = { ok: true, version: VERSION, season: SEASON, at: new Date().toISOString(), sheet: false, mailLeft: null, espnWrites: ESPN_WRITES };
  try { var ss = SpreadsheetApp.getActive(); out.sheet = !!ss; out.sheetName = ss.getName(); out.tabs = ss.getSheets().map(function (s) { return s.getName(); }); } catch (e) { out.sheetError = String(e); }
  try { out.mailLeft = MailApp.getRemainingDailyQuota(); } catch (e) {}
  out.espnRead = espnCheck_(READ_LEAGUE);
  out.espnTest = espnCheck_(WRITE_LEAGUE);
  out.opsEmail = !!prop_("OPS_EMAIL");
  out.healthy = out.sheet && out.espnRead.ok;
  try { c.put("health", JSON.stringify(out), 300); } catch (e) {}
  return out;
}
function menuCheck() {
  var h = health_(true);
  var line = function (x) { return x.ok ? "✅ " + x.name + " (" + x.teams + " teams)" : "❌ " + x.error; };
  SpreadsheetApp.getUi().alert("SPL HQ logic v" + VERSION +
    "\n\nSheet: " + (h.sheet ? "✅ " + h.sheetName : "❌") +
    "\nESPN · SPL " + READ_LEAGUE + " (read): " + line(h.espnRead) +
    "\nESPN · test " + WRITE_LEAGUE + ": " + line(h.espnTest) +
    "\nEmails left today: " + h.mailLeft);
}
function tick() { /* v0.1: nothing scheduled yet */ }

// ---------------------------------------------------------------- exports for the loader
M.VERSION = VERSION; M.doGet = doGet; M.doPost = doPost; M.menuCheck = menuCheck; M.tick = tick;
