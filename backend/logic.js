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
var VERSION = "0.2.2";
var SEASON = 2026;
var READ_LEAGUE = 19583;        // real SPL league: read-only (rosters, standings, schedule, history)
var WRITE_LEAGUE = 1722387564;  // "Testing MAFFL HQ": the ONLY league the backend may ever write to (until Joe signs off)
var ESPN_WRITES = false;        // kill switch: no ESPN writes exist in v0.1
var APP_URL = "https://spl-hq.github.io/";
var MAX_FAILS_PER_HOUR = 30; // league-wide wrong passphrases before sign-in pauses for the hour (signed-in phones keep working)

// Owners (names + teams only; contacts never live here). Seeded into the Owners tab by "Run setup check".
// role: owner | commish | ops (comma list). Joe = commissioner; Mike = co-commish + ops.
var OWNER_SEED = [
  ["reilly","Joe","Reeling RaMPaGe","commish"],["murello","Mike","Bad Attitude Gang","ops,commish"],
  ["farrington","Al","Farrington's FREELANCERS","owner"],["glen","Glen","Fluff Muffins","owner"],
  ["chappie","Drew","BlaKK BoCCes","owner"],["sikora","Pete","The Gunz","owner"],
  ["hoosier","Hoos","Hoosier's Dynamos","owner"],["patel","Amit","Cheater's Streakers","owner"],
  ["salerno","Owen","Ween's Machine","owner"],["moyer","Rich","Kimble's Finast","owner"],
  ["bucher","Seth","Los Beasters Big Sky","owner"],["smith","Matt","Tijuana Trojans","owner"]];

// Passphrases: two football words + 3 digits (GRONK-PISTOL-427, ~6 million). Case, spaces, dashes don't matter.
var WORDS_A = ["GRONK","BLITZ","PISTOL","HAIL","WILDCAT","SHOTGUN","NICKEL","DIME","REDZONE","AUDIBLE","SPIKE","LAMBEAU",
  "PYLON","STIFFARM","JUKE","SACK","PICKSIX","ONSIDE","FLEAFLICKER","BOOTLEG","FROZEN","TUNDRA","PRIMETIME","TURKEY",
  "GRIDIRON","TOUCHBACK","FUMBLE","WAIVER","BYEWEEK","SLEEPER","HANDCUFF","FLEX","STACK","BOOM","BUST","BULLDOZER",
  "TRUCK","HURDLE","BLINDSIDE","GOALLINE","HASHMARK","HUDDLE","ENDZONE","BOMB","COUNTER","CHAINGANG","DRAWPLAY",
  "FAIRCATCH","FIRSTDOWN","HAILMARY","HOTROUTE","JUMBO","LATERAL","PLAYBOOK","POCKET","QBSNEAK","REVERSE","ROOKIE",
  "SCRAMBLE","SNAP","SWEEP","TAILGATE","TRICKPLAY","WISHBONE","ZEBRA","SIDELINE","NITTANY","BEAVER","HAPPYVALLEY"];
var WORDS_B = ["HAMMER","TORNADO","EXPRESS","RAMPAGE","CANNON","THUNDER","STAMPEDE","LIGHTNING","BULLDOG","MACHINE",
  "ROCKET","BLIZZARD","GRIZZLY","HURRICANE","JACKPOT","WRECKER","DYNAMO","FURY","STALLION","TITAN","VORTEX","COMET",
  "AVALANCHE","RHINO","TANK","SPARTAN","VIKING","OUTLAW","MAVERICK","BANDIT","PANTHER","COBRA","FALCON","GLADIATOR",
  "JUGGERNAUT","DAGGER","HAYMAKER","SLINGSHOT","BRAWLER","FIREBALL","SNOWPLOW","GOLIATH","BISON","BRONCO","BUZZSAW",
  "CYCLONE","DRAGON","EAGLE","EARTHQUAKE","FREIGHTTRAIN","GHOST","HAWK","JAGUAR","KRAKEN","LION","MAMMOTH","MUSTANG",
  "PHANTOM","PIRATE","RAPTOR","SHARK","STORM","TIGER","TOMAHAWK","TYPHOON","WOLF","WOLVERINE","YETI"];

// ---------------------------------------------------------------- HTTP
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === "health") return json(health_(p.fresh === "1"));
    if (p.action === "standings") return json(standings_());
    return json({ ok: true, app: "SPL HQ", version: VERSION });
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
}

// Body is sent as text/plain JSON (avoids a CORS preflight from GitHub Pages).
// Sign-in: {action:"login", pin} → device token. Every other POST carries {token}.
function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json({ ok: false, error: "bad json" }); }
  if (b.action !== "login" && b.action !== "me" && b.action !== "desk" && !rate_()) return json({ ok: false, error: "Too many requests this hour. Try again later." });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return json({ ok: false, busy: true, error: "The league server is busy. Try again in a few seconds." }); }
  try {
    if (b.action === "login") return json(login_(b.pin));
    var me = auth_(b.token); if (!me) return json({ ok: false, auth: true, error: "Please sign in again." });
    switch (b.action) {
      case "me":       return json({ ok: true, me: pub_(me), myAnswers: myAnswers_(me.owner) });
      case "answers":  return json(saveAnswers_(me, b));
      case "feedback": return json(saveFeedback_(me, b));
      case "desk":     return json(isRole_(me, "commish") || isRole_(me, "ops") ? desk_(me) : { ok: false, error: "Commish only" });
      case "issue":    return json(isRole_(me, "ops") || isRole_(me, "commish") ? issue_(me, b.owner) : { ok: false, error: "Commish only" });
      default:         return json({ ok: false, error: "unknown action" });
    }
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
  finally { lock.releaseLock(); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------------------------------------------------------- Sheet helpers
var HEADS = {
  Owners:   ["owner", "name", "team", "role", "pin_hash", "salt", "issued_ts", "issued_by", "last_seen"],
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
function setRow_(name, idx, obj) { // idx = 0-based data row (row idx+2 in the Sheet)
  var sh = sheet_(name), h = HEADS[name];
  sh.getRange(idx + 2, 1, 1, h.length).setValues([h.map(function (k) { var v = obj[k]; return typeof v === "string" ? safe_(v) : (v == null ? "" : v); })]);
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
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function opsEmails_() {
  var list = [Session.getEffectiveUser().getEmail()], extra = prop_("OPS_EMAIL");
  if (extra) list = list.concat(String(extra).split(/[,\s]+/));
  return list.filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(",");
}
function mail_(subject, body) {
  try { if (MailApp.getRemainingDailyQuota() > 5) MailApp.sendEmail(opsEmails_(), subject, body); } catch (e) { log_("mail_error", String(e)); }
}

// ---------------------------------------------------------------- Owners, passphrases, device tokens
function hex_(bytes) { return bytes.map(function (b) { return ("0" + ((b + 256) % 256).toString(16)).slice(-2); }).join(""); }
function hmac_(text, key) { return hex_(Utilities.computeHmacSha256Signature(text, key)); }
function pepper_() { // secret in Script properties, made on first use. NEVER rotate casually: it invalidates every passphrase and phone.
  var k = prop_("PIN_PEPPER"); if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); setProp_("PIN_PEPPER", k); } return k;
}
function normPin_(pin) { return String(pin || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function hash_(salt, pin) { return "h2:" + hmac_(salt + ":" + normPin_(pin), pepper_()); }
function token_(o) { return o.owner + "." + hmac_("tok:" + o.salt + ":" + o.owner, pepper_()).slice(0, 40); }
function newPhrase_() {
  var a = WORDS_A[Math.floor(Math.random() * WORDS_A.length)], b = WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
  return a + "-" + b + "-" + (100 + Math.floor(Math.random() * 900));
}
function owners_() { return rows_("Owners"); }
function seedOwners_() {
  var have = {}; owners_().forEach(function (o) { have[o.owner] = 1; }); var added = 0;
  OWNER_SEED.forEach(function (r) { if (!have[r[0]]) { append_("Owners", [r[0], r[1], r[2], r[3], "", "", "", "", ""]); added++; } });
  return added;
}
function isRole_(o, r) { return String(o.role || "").split(/[,\s]+/).indexOf(r) >= 0; }
function pub_(o) { return { owner: o.owner, name: o.name, team: o.team, role: String(o.role || "owner") }; }
function auth_(token) {
  var t = String(token || ""), id = t.split(".")[0]; if (!id || t.indexOf(".") < 0) return null;
  var o = owners_().filter(function (x) { return x.owner === id && x.pin_hash; })[0];
  return o && token_(o) === t ? o : null;
}
function login_(pin) {
  var c = CacheService.getScriptCache(), fk = "fails:" + Math.floor(Date.now() / 3.6e6), fails = Number(c.get(fk) || 0);
  if (fails >= MAX_FAILS_PER_HOUR) return { ok: false, error: "Sign-in is paused for a bit (too many wrong passphrases). Try again within the hour." };
  if (normPin_(pin).length < 6) return { ok: false, error: "Type your passphrase, like GRONK-PISTOL-427." };
  var list = owners_(), hit = -1;
  list.forEach(function (o, i) { if (hit < 0 && o.pin_hash && o.salt && hash_(o.salt, pin) === o.pin_hash) hit = i; });
  if (hit < 0) {
    c.put(fk, String(fails + 1), 3700);
    if (fails + 1 === MAX_FAILS_PER_HOUR) mail_("SPL HQ · sign-in paused", "30 wrong passphrases this hour; sign-in is paused until the hour turns. Signed-in phones keep working.");
    return { ok: false, error: "That passphrase didn't match. Check it and try again." };
  }
  var o = list[hit]; o.last_seen = new Date(); setRow_("Owners", hit, o);
  log_("login", o.owner);
  return { ok: true, token: token_(o), me: pub_(o), myAnswers: myAnswers_(o.owner) };
}
function issue_(by, ownerId) {
  var list = owners_(), idx = -1; list.forEach(function (o, i) { if (o.owner === ownerId) idx = i; });
  if (idx < 0) return { ok: false, error: "Unknown owner" };
  var o = list[idx], phrase = newPhrase_();
  o.salt = Utilities.getUuid(); o.pin_hash = hash_(o.salt, phrase); o.issued_ts = new Date(); o.issued_by = by.owner;
  setRow_("Owners", idx, o);
  log_("issue", by.owner + " → " + o.owner);
  return { ok: true, owner: o.owner, name: o.name, phrase: phrase };
}

// ---------------------------------------------------------------- Questions for the commish + feedback
function saveAnswers_(me, b) {
  var who = me.owner;
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
  mail_("SPL HQ · " + me.name + " answered " + items.length + " question" + (items.length > 1 ? "s" : ""),
    lines.join("\n\n") + "\n\nAll answers: the app's Ops desk, or the Answers tab in the SPL HQ App Sheet.\n" + APP_URL + "#ops");
  return { ok: true, saved: items.length, myAnswers: myAnswers_(who) };
}
function saveFeedback_(me, b) {
  var note = clip_(b.note, 2000), mood = clip_(b.mood, 20), kind = /^(idea|bug|like|question)$/.test(b.kind) ? b.kind : "idea";
  if (!note.trim() && !mood) return { ok: false, error: "Write a note first." };
  append_("Feedback", [new Date(), me.owner, kind, mood, note, clip_(b.where, 60)]);
  mail_("SPL HQ · feedback from " + me.name + (mood ? " (" + mood + ")" : ""), note + "\n\n" + APP_URL + "#ops");
  return { ok: true };
}
function myAnswers_(who) {
  var out = {}; rows_("Answers").forEach(function (r) { if (r.who === who) out[r.qid] = { choice: r.choice, note: r.note, ts: r.ts }; }); return out;
}
function desk_(me) {
  var latest = {}, total = 0;
  rows_("Answers").forEach(function (r) { total++; latest[r.who + ":" + r.qid] = { who: r.who, qid: r.qid, choice: r.choice, note: r.note, ts: r.ts }; });
  var fb = rows_("Feedback").slice(-20).reverse().map(function (r) { return { who: r.who, kind: r.kind, mood: r.mood, note: r.note, ts: r.ts }; });
  var owners = owners_().map(function (o) { return { owner: o.owner, name: o.name, team: o.team, role: String(o.role || "owner"), hasPass: !!o.pin_hash,
    issued: o.issued_ts || null, lastSeen: o.last_seen || null }; });
  return { ok: true, total: total, answers: Object.keys(latest).map(function (k) { return latest[k]; }), feedback: fb, owners: owners };
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
  try { var os = owners_(); out.owners = os.length; out.signedUp = os.filter(function (o) { return o.pin_hash; }).length; } catch (e) {}
  out.healthy = out.sheet && out.espnRead.ok;
  try { c.put("health", JSON.stringify(out), 300); } catch (e) {}
  return out;
}
function menuCheck() {
  var added = seedOwners_(), boot = "";
  var mike = owners_().filter(function (o) { return o.owner === "murello"; })[0];
  // Until Mike has signed in once, every setup check makes him a fresh passphrase (the alert is easy to close by accident).
  if (mike && (!mike.pin_hash || !mike.last_seen)) { var r = issue_({ owner: "setup" }, "murello"); boot = "\n\n🔑 Mike's passphrase (write it down now):\n" + r.phrase + "\n\nSign in at " + APP_URL + "\nMissed it? Run this check again: it makes a new one until you've signed in."; }
  var h = health_(true);
  var line = function (x) { return x.ok ? "✅ " + x.name + " (" + x.teams + " teams)" : "❌ " + x.error; };
  SpreadsheetApp.getUi().alert("SPL HQ logic v" + VERSION +
    "\n\nSheet: " + (h.sheet ? "✅ " + h.sheetName : "❌") + (added ? " · added " + added + " owners" : "") +
    "\nESPN · SPL " + READ_LEAGUE + " (read): " + line(h.espnRead) +
    "\nESPN · test " + WRITE_LEAGUE + ": " + line(h.espnTest) +
    "\nEmails left today: " + h.mailLeft + boot);
}
function tick() { /* v0.1: nothing scheduled yet */ }

// ---------------------------------------------------------------- exports for the loader
M.VERSION = VERSION; M.doGet = doGet; M.doPost = doPost; M.menuCheck = menuCheck; M.tick = tick;
