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
var VERSION = "0.3.1";
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
var READS = { me: 1, desk: 1, week: 1, rosters: 1, chat: 1 }; // never wait on the script lock
var WRITES = { answers: 1, feedback: 1, chatsend: 1, chatdel: 1, issue: 1 }; // rate-limited per owner
function doPost(e) {
  var b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json({ ok: false, error: "bad json" }); }
  var lock = null;
  try {
    if (b.action === "login") { lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (x) { lock = null; return json({ ok: false, busy: true, error: "The league server is busy. Try again in a few seconds." }); } return json(login_(b.pin)); }
    var me = auth_(b.token); if (!me) return json({ ok: false, auth: true, error: "Please sign in again." });
    if (WRITES[b.action] && !rate_(me.owner)) return json({ ok: false, error: "Slow down a little: too many sends this hour." });
    if (!READS[b.action]) { lock = LockService.getScriptLock(); try { lock.waitLock(10000); } catch (x) { lock = null; return json({ ok: false, busy: true, error: "The league server is busy. Try again in a few seconds." }); } }
    var desk = isRole_(me, "commish") || isRole_(me, "ops");
    switch (b.action) {
      case "me":       return json({ ok: true, me: pub_(me), myAnswers: myAnswers_(me.owner) });
      case "answers":  return json(saveAnswers_(me, b));
      case "feedback": return json(saveFeedback_(me, b));
      case "desk":     return json(desk ? desk_(me) : { ok: false, error: "Commish only" });
      case "issue":    return json(desk ? issue_(me, b.owner) : { ok: false, error: "Commish only" });
      case "week":     return json(week_(b.week));
      case "rosters":  return json(rosters_());
      case "chat":     return json(chat_(me, b));
      case "chatsend": return json(chatSend_(me, b));
      case "chatdel":  return json(chatDel_(me, b));
      default:         return json({ ok: false, error: "unknown action" });
    }
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
  finally { if (lock) lock.releaseLock(); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------------------------------------------------------- Sheet helpers
var HEADS = {
  Owners:   ["owner", "name", "team", "role", "pin_hash", "salt", "issued_ts", "issued_by", "last_seen"],
  Answers:  ["ts", "who", "qid", "question", "choice", "note", "source"],
  Feedback: ["ts", "who", "kind", "mood", "note", "where"],
  Log:      ["ts", "kind", "detail"],
  Chat:     ["msg_id", "ts", "room", "owner", "text", "deleted"]
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
function rate_(who) {
  var c = CacheService.getScriptCache(), k = "rate:" + who + ":" + Math.floor(Date.now() / 3.6e6), n = Number(c.get(k) || 0);
  if (n >= 150) return false; c.put(k, String(n + 1), 3700); return true;
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
  var c = CacheService.getScriptCache(), hit = c.get("standings2"); if (hit) return JSON.parse(hit);
  var d = espn_(READ_LEAGUE, "view=mTeam&view=mSettings");
  var divs = {}; (((d.settings || {}).scheduleSettings || {}).divisions || []).forEach(function (x) { divs[x.id] = x.name; });
  var teams = (d.teams || []).map(function (t) {
    var rec = (t.record || {}).overall || {};
    var nm = t.name || ((t.location || "") + " " + (t.nickname || "")).trim();
    return { id: t.id, name: nm, owner: teamOwners_()[norm_(nm)] || "", abbrev: t.abbrev || "",
      div: divs[t.divisionId] || "", w: rec.wins || 0, l: rec.losses || 0, t: rec.ties || 0,
      pf: Math.round((rec.pointsFor || 0) * 10) / 10, pa: Math.round((rec.pointsAgainst || 0) * 10) / 10,
      seed: t.playoffSeed || null, rank: t.rankCalculatedFinal || t.currentProjectedRank || null };
  });
  var out = { ok: true, league: READ_LEAGUE, name: (d.settings || {}).name || "", week: d.scoringPeriodId || null, at: new Date().toISOString(), teams: teams };
  try { c.put("standings2", JSON.stringify(out), 900); } catch (e) {}
  return out;
}

var POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 7: "P", 16: "D/ST" };
var PRO = { 1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU" };
var SLOT = { 0: "QB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE", 7: "OP", 16: "D/ST", 17: "K", 20: "BE", 21: "IR", 23: "FLEX" };
var SLOT_ORDER = [0, 7, 2, 4, 6, 3, 5, 23, 16, 17, 20, 21];
function norm_(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
// Every team name each owner has used (from data/SPL_Owner_Registry.csv aliases): ESPN still says "Reilly's RaMPaGe".
var TEAM_ALIASES = {"murello": ["Attitude Gang", "Bad Attitude Gang", "Michael Murello"], "reilly": ["Joseph Reilly", "Reeling RaMPaGe", "Reilly's RaMPaGe"], "farrington": ["Farrington's FREELANCERS", "James Farrington"], "glen": ["Fluff Muffins", "Glen Herold"], "chappie": ["BlaKK BoCCes", "Drew Chappie"], "sikora": ["Manayunk Gunz", "Pete Sikora", "The Gunz"], "hoosier": ["Craig Hoosier", "Hoosier's Dynamos"], "patel": ["Amit Patel", "Cheater's Streakers"], "salerno": ["Owen Salerno", "Ween's Machine", "owen salerno"], "moyer": ["Kimble's Finast", "Rich Moyer"], "bucher": ["Los Beasters Big Sky", "Seth Bucher"], "smith": ["Matthew Smith", "Tijuana Trojans"]};
function teamOwners_() { var m = {}; Object.keys(TEAM_ALIASES).forEach(function (id) { TEAM_ALIASES[id].forEach(function (n) { m[norm_(n)] = id; }); }); OWNER_SEED.forEach(function (r) { m[norm_(r[2])] = r[0]; }); try { owners_().forEach(function (o) { if (o.team) m[norm_(o.team)] = o.owner; }); } catch (e) {} return m; }
function teamName_(t) { return t.name || ((t.location || "") + " " + (t.nickname || "")).trim(); }
function cacheJson_(key, secs, fn) {
  var c = CacheService.getScriptCache(), hit = c.get(key); if (hit) return JSON.parse(hit);
  var out = fn(), str = JSON.stringify(out); if (str.length < 95000) { c.put(key, str, secs); c.put(key + ":last", str, 21600); }
  return out;
}
function proGames_(sp) {
  return cacheJson_("pro_" + SEASON + "_" + sp, 21600, function () {
    var out = {};
    try {
      var r = UrlFetchApp.fetch("https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/" + SEASON + "?view=proTeamSchedules_wl", { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) (((JSON.parse(r.getContentText()).settings || {}).proTeams) || []).forEach(function (t) {
        var g = ((t.proGamesByScoringPeriod || {})[sp] || [])[0]; if (!g) return;
        var home = g.homeProTeamId === t.id, o = home ? g.awayProTeamId : g.homeProTeamId;
        out[t.id] = { opp: (home ? "vs " : "@") + (PRO[o] || "?"), kick: g.date };
      });
    } catch (e) {}
    return out;
  });
}
// One short stat line from ESPN's raw stat map.
function statLine_(pos, st) {
  if (!st) return "";
  function v(id) { return Math.round(Number(st[id]) || 0); }
  var b = [];
  if (pos === "QB") { if (v(0)) b.push(v(1) + "/" + v(0) + ", " + v(3) + " yd"); if (v(4)) b.push(v(4) + " TD"); if (v(20)) b.push(v(20) + " INT"); if (v(24)) b.push(v(23) + "-" + v(24) + " rush"); if (v(25)) b.push(v(25) + " rush TD"); }
  else if (pos === "RB" || pos === "WR" || pos === "TE") {
    var ru = v(23) ? v(23) + "-" + v(24) + " rush" : "", rc = v(53) || v(58) ? v(53) + "/" + v(58) + " rec, " + v(42) + " yd" : "";
    (pos === "RB" ? [ru, rc] : [rc, ru]).forEach(function (x) { if (x) b.push(x); }); var td = v(25) + v(43); if (td) b.push(td + " TD");
  } else if (pos === "D/ST") { if (v(120) || v(99) || v(95)) b.push(v(120) + " PA"); if (v(99)) b.push(v(99) + " sk"); if (v(95)) b.push(v(95) + " INT"); if (v(105)) b.push(v(105) + " TD"); }
  if (v(72)) b.push(v(72) + " FUM");
  return b.join(" · ");
}
// ⚔️ A week of games with both lineups (Match tab). Current week cached 60 s; past weeks 6 h.
function week_(wk) {
  var cur = cacheJson_("curwk", 600, function () { var d = espn_(READ_LEAGUE, "view=mSettings"); return { mp: (d.status && d.status.currentMatchupPeriod) || d.scoringPeriodId || 1, sp: d.scoringPeriodId || 1, last: ((d.settings || {}).scheduleSettings || {}).matchupPeriodCount || 14 }; });
  wk = Math.floor(Number(wk) || cur.mp); if (wk < 1) wk = 1; if (wk > 17) wk = 17;
  var past = wk < cur.mp;
  return cacheJson_("wk_" + wk, past ? 21600 : 60, function () {
    var d = espn_(READ_LEAGUE, "view=mTeam&view=mMatchupScore&view=mBoxscore&view=mScoreboard&scoringPeriodId=" + wk + "&matchupPeriodId=" + wk);
    var names = {}, recs = {}, own = teamOwners_();
    (d.teams || []).forEach(function (t) { names[t.id] = teamName_(t); var r = (t.record || {}).overall || {}; recs[t.id] = (r.wins || 0) + "–" + (r.losses || 0) + (r.ties ? "–" + r.ties : ""); });
    var pro = proGames_(wk);
    function side(sd) {
      if (!sd) return null;
      var ents = ((sd.rosterForCurrentScoringPeriod || sd.rosterForMatchupPeriod || {}).entries) || [];
      var players = ents.map(function (e) {
        var pl = (e.playerPoolEntry || {}).player || {}, st = pl.stats || [];
        var act = st.filter(function (x) { return x.scoringPeriodId === wk && x.statSourceId === 0; })[0], prj = st.filter(function (x) { return x.scoringPeriodId === wk && x.statSourceId === 1; })[0];
        var pos = POS[pl.defaultPositionId] || "", pg = pro[pl.proTeamId] || null;
        return { n: pl.fullName || "?", pos: pos, slot: SLOT[e.lineupSlotId] || String(e.lineupSlotId), so: SLOT_ORDER.indexOf(e.lineupSlotId),
          tm: PRO[pl.proTeamId] || "", opp: pg ? pg.opp : (pl.proTeamId ? "BYE" : ""), kick: pg ? pg.kick : null,
          pts: Math.round(((act ? act.appliedTotal : (e.playerPoolEntry || {}).appliedStatTotal) || 0) * 100) / 100,
          proj: prj ? Math.round(prj.appliedTotal * 10) / 10 : null, played: !!act, st: act ? statLine_(pos, act.stats) : "",
          inj: pl.injuryStatus && pl.injuryStatus !== "ACTIVE" ? String(pl.injuryStatus).replace(/_/g, " ") : "" };
      }).sort(function (a, b) { return a.so - b.so; });
      var starters = players.filter(function (x) { return x.slot !== "BE" && x.slot !== "IR"; });
      var score = sd.totalPointsLive != null ? sd.totalPointsLive : (sd.totalPoints != null ? sd.totalPoints : starters.reduce(function (a, x) { return a + x.pts; }, 0));
      return { id: sd.teamId, team: names[sd.teamId] || ("Team " + sd.teamId), owner: own[norm_(names[sd.teamId])] || "", rec: recs[sd.teamId] || "",
        pts: Math.round(score * 100) / 100, proj: sd.totalProjectedPointsLive != null ? Math.round(sd.totalProjectedPointsLive * 10) / 10 : null,
        left: starters.filter(function (x) { return !x.played; }).length, players: players };
    }
    var games = (d.schedule || []).filter(function (g) { return g.matchupPeriodId === wk; }).map(function (g) {
      return { home: side(g.home), away: side(g.away), winner: g.winner || "UNDECIDED", playoff: g.playoffTierType && g.playoffTierType !== "NONE" ? g.playoffTierType : "" }; });
    return { ok: true, week: wk, current: cur.mp, last: cur.last, final: past, at: new Date().toISOString(), games: games };
  });
}
// 🏈 Every SPL roster (Team tab). Cached 30 min; last good copy 6 h if ESPN hiccups.
var ACQ = { DRAFT: "Drafted", ADD: "Waiver", TRADE: "Traded", FREEAGENT: "Free agent" };
function rosters_() {
  try {
    return cacheJson_("rosters", 1800, function () {
      var d = espn_(READ_LEAGUE, "view=mTeam&view=mRoster&view=mSettings"), own = teamOwners_(), divs = {};
      (((d.settings || {}).scheduleSettings || {}).divisions || []).forEach(function (x) { divs[x.id] = x.name; });
      return { ok: true, at: new Date().toISOString(), teams: (d.teams || []).map(function (tm) {
        var name = teamName_(tm), r = (tm.record || {}).overall || {};
        return { id: tm.id, team: name, owner: own[norm_(name)] || "", div: divs[tm.divisionId] || "", rec: (r.wins || 0) + "–" + (r.losses || 0) + (r.ties ? "–" + r.ties : ""),
          players: (((tm.roster || {}).entries) || []).map(function (e) {
            var ppe = e.playerPoolEntry || {}, pl = ppe.player || {}, st = pl.stats || [];
            var season = st.filter(function (x) { return x.scoringPeriodId === 0 && x.statSourceId === 0 && (!x.seasonId || x.seasonId === SEASON); })[0];
            return { n: pl.fullName || "?", pos: POS[pl.defaultPositionId] || "", tm: PRO[pl.proTeamId] || "FA", slot: SLOT[e.lineupSlotId] || "", so: SLOT_ORDER.indexOf(e.lineupSlotId),
              acq: ACQ[e.acquisitionType] || "", inj: pl.injuryStatus && pl.injuryStatus !== "ACTIVE" ? String(pl.injuryStatus).replace(/_/g, " ") : "",
              sp: season ? Math.round(season.appliedTotal * 10) / 10 : null, avg: season && season.appliedAverage != null ? Math.round(season.appliedAverage * 10) / 10 : null,
              own: pl.ownership && pl.ownership.percentOwned != null ? Math.round(pl.ownership.percentOwned) : null };
          }).sort(function (a, b) { return a.so - b.so || (b.sp || 0) - (a.sp || 0); }) };
      }) };
    });
  } catch (err) {
    var last = CacheService.getScriptCache().get("rosters:last"); if (last) { var o = JSON.parse(last); o.stale = true; return o; } throw err;
  }
}

// ---------------------------------------------------------------- 💬 Chat: league room + DMs
// Rooms: "league" (every owner) or "dm:<a>,<b>" (owner ids sorted). The commish can't read DMs.
function roomOk_(me, room) {
  if (room === "league") return true;
  var m = /^dm:([a-z]{2,20}),([a-z]{2,20})$/.exec(String(room || "")); if (!m || m[1] >= m[2]) return false;
  if (m[1] !== me.owner && m[2] !== me.owner) return false;
  var ids = OWNER_SEED.map(function (r) { return r[0]; }); return ids.indexOf(m[1]) >= 0 && ids.indexOf(m[2]) >= 0;
}
function chat_(me, b) {
  var all = rows_("Chat"), mine = all.filter(function (r) { return roomOk_(me, r.room); }), rooms = {};
  mine.forEach(function (r) { var x = rooms[r.room] = rooms[r.room] || { room: r.room, n: 0 }; x.n++; x.last = r.ts; x.who = r.owner; x.text = r.deleted ? "(deleted)" : String(r.text).slice(0, 80); });
  var out = { ok: true, rooms: Object.keys(rooms).map(function (k) { return rooms[k]; }), at: new Date().toISOString() };
  if (b.room) {
    if (!roomOk_(me, b.room)) return { ok: false, error: "Not your room" };
    var since = b.since ? new Date(b.since).getTime() : 0;
    out.room = b.room;
    out.msgs = mine.filter(function (r) { return r.room === b.room && (!since || new Date(r.ts).getTime() > since); }).slice(-150).map(function (r) {
      return { id: r.msg_id, ts: r.ts, who: r.owner, text: r.deleted ? "" : String(r.text), del: !!r.deleted }; });
  }
  return out;
}
function chatSend_(me, b) {
  if (!roomOk_(me, b.room)) return { ok: false, error: "Not your room" };
  var text = clip_(b.text, 500).trim(); if (!text) return { ok: false, error: "Type a message first." };
  var id = "M" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), now = new Date();
  append_("Chat", [id, now, b.room, me.owner, text, ""]);
  return { ok: true, msg: { id: id, ts: now, who: me.owner, text: text } };
}
function chatDel_(me, b) {
  var list = rows_("Chat"), idx = -1; list.forEach(function (r, i) { if (r.msg_id === b.id) idx = i; });
  if (idx < 0) return { ok: false, error: "Message not found" };
  var r = list[idx], commish = isRole_(me, "commish") && r.room === "league";
  if (r.owner !== me.owner && !commish) return { ok: false, error: "You can only delete your own messages." };
  r.deleted = "Y"; setRow_("Chat", idx, r); log_("chatdel", me.owner + " " + r.msg_id);
  return { ok: true };
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
