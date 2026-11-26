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
var VERSION = "0.6";
var SEASON = 2026;
var READ_LEAGUE = 19583;        // real SPL league: read-only (rosters, standings, schedule, history)
var WRITE_LEAGUE = 1722387564;  // "Testing MAFFL HQ": the ONLY league the backend may ever write to (until Joe signs off)
var ESPN_WRITES = false;        // kill switch: no ESPN writes yet (approved trades become a "Do on ESPN" step)
// 🔁 Trade center. TRADE_MODE "test" = demo trades: nothing is owed on ESPN and Ops can wipe them all. "live" after Joe signs off.
// Defaults until Joe answers the in-app questions: 2027 picks only, 17 rounds, contracts travel with the player, commish approves.
var TRADE_MODE = "test";
var PICK_ROUNDS = 17, FIRST_PICK_SEASON = SEASON + 1;
// League rules the app runs on come from Joe's answers in the app (League → Questions), with these defaults until he answers.
var PICK_YEARS_OF = { "Next season only": 1, "2 seasons": 2, "3 seasons": 3, "No limit": 3 };
function joeAnswer_(qid) { var a = null; rows_("Answers").forEach(function (r) { if (r.who === "reilly" && r.qid === qid && r.choice) a = String(r.choice); }); return a; }
function rules_() {
  var py = joeAnswer_("pick_years"), kt = joeAnswer_("keeper_travels"), n = PICK_YEARS_OF[py] || 1, seasons = [];
  for (var i = 0; i < n; i++) seasons.push(FIRST_PICK_SEASON + i);
  return { pickSeasons: seasons, pickYearsFrom: py ? "Joe" : "default", contracts: /resets/i.test(kt || "") ? "resets" : "travels", contractsFrom: kt ? "Joe" : "default" };
}
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
    if (p.action === "ledger") return json(ledger_());
    return json({ ok: true, app: "SPL HQ", version: VERSION });
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
}

// Body is sent as text/plain JSON (avoids a CORS preflight from GitHub Pages).
// Sign-in: {action:"login", pin} → device token. Every other POST carries {token}.
var READS = { me: 1, desk: 1, week: 1, rosters: 1, chat: 1, trades: 1, settings: 1, contacts: 1 }; // never wait on the script lock
var WRITES = { pickfix: 1, answers: 1, feedback: 1, chatsend: 1, chatdel: 1, issue: 1, offer: 1, respond: 1, tradeact: 1, savesettings: 1 }; // rate-limited per owner
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
      case "trades":   return json(trades_(me));
      case "settings": return json(settings_(me));
      case "savesettings": return json(saveSettings_(me, b));
      case "contacts": return json(contacts_());
      case "offer":    return json(offer_(me, b));
      case "respond":  return json(respond_(me, b));
      case "tradeact": return json(desk ? tradeAct_(me, b) : { ok: false, error: "Commish only" });
      case "pickfix":  return json(desk ? pickFix_(me, b) : { ok: false, error: "Commish only" });
      case "wipetrades": return json(isRole_(me, "ops") ? wipeTrades_(me) : { ok: false, error: "Ops only" });
      default:         return json({ ok: false, error: "unknown action" });
    }
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
  finally { if (lock) lock.releaseLock(); }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------------------------------------------------------- Sheet helpers
var HEADS = {
  Owners:   ["owner", "name", "team", "role", "pin_hash", "salt", "issued_ts", "issued_by", "last_seen", "handle", "email", "phone", "notify"],
  Answers:  ["ts", "who", "qid", "question", "choice", "note", "source"],
  Feedback: ["ts", "who", "kind", "mood", "note", "where"],
  Log:      ["ts", "kind", "detail"],
  Chat:     ["msg_id", "ts", "room", "owner", "text", "deleted", "ref"],
  Offers:   ["offer_id", "ts", "from", "to", "give", "get", "note", "status", "updated_ts", "reason", "by", "mode", "espn", "counter_of"],
  Picks:    ["pid", "season", "round", "original", "owner", "updated_ts", "via"]
};
function sheet_(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name); sh.appendRow(HEADS[name]); sh.setFrozenRows(1);
    var blank = ss.getSheetByName("Sheet1"); if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  }
  var h = HEADS[name], have = sh.getLastColumn ? sh.getLastColumn() : h.length;
  if (have && have < h.length) sh.getRange(1, have + 1, 1, h.length - have).setValues([h.slice(have)]); // new columns get their header
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
  var offs = rows_("Offers").map(function (r) { r.giveO = parseJ_(r.give); r.getO = parseJ_(r.get); return pub_offer_(r); });
  return { ok: true, total: total, answers: Object.keys(latest).map(function (k) { return latest[k]; }), feedback: fb, owners: owners, mode: TRADE_MODE,
    review: offs.filter(function (o) { return o.status === "ACCEPTED"; }), espn: offs.filter(function (o) { return o.status === "APPROVED" && o.espn === "todo"; }),
    recent: offs.filter(function (o) { return o.status === "APPROVED" || o.status === "NEGATED"; }).reverse().slice(0, 10) };
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
      return { id: r.msg_id, ts: r.ts, who: r.owner, text: r.deleted ? "" : String(r.text), del: !!r.deleted, ref: r.ref || "" }; });
  }
  return out;
}
function chatSend_(me, b) {
  if (!roomOk_(me, b.room)) return { ok: false, error: "Not your room" };
  var text = clip_(b.text, 500).trim(); if (!text) return { ok: false, error: "Type a message first." };
  var id = "M" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), now = new Date();
  append_("Chat", [id, now, b.room, me.owner, text, "", ""]);
  var dm = /^dm:(\w+),(\w+)$/.exec(b.room);
  if (dm) notify_(dm[1] === me.owner ? dm[2] : dm[1], "chat", "Message from " + me.name, text, b.room);
  else owners_().forEach(function (o) { if (o.owner !== me.owner && new RegExp("@" + handleOf_(o) + "\\b", "i").test(text)) notify_(o.owner, "chat", me.name + " mentioned you", text, b.room); });
  return { ok: true, msg: { id: id, ts: now, who: me.owner, text: text } };
}
function botPost_(room, text, ref) { // 🤖 HQ posts (trade cards) into a room
  append_("Chat", ["M" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), new Date(), room, "hq", clip_(text, 500), "", ref || ""]);
}
function chatDel_(me, b) {
  var list = rows_("Chat"), idx = -1; list.forEach(function (r, i) { if (r.msg_id === b.id) idx = i; });
  if (idx < 0) return { ok: false, error: "Message not found" };
  var r = list[idx], commish = isRole_(me, "commish") && r.room === "league";
  if (r.owner !== me.owner && !commish) return { ok: false, error: "You can only delete your own messages." };
  r.deleted = "Y"; setRow_("Chat", idx, r); log_("chatdel", me.owner + " " + r.msg_id);
  return { ok: true };
}



// ---------------------------------------------------------------- ⚙️ Settings, contacts, owner emails (MAFFL REEL §4b)
// Contacts live only in the Owners tab and only go to signed-in owners. Emails are opt-in per kind (announcements on by default).
var NOTIFY_KEYS = ["received", "countered", "accepted", "declined", "commish", "chat", "announce"];
var NOTIFY_DEFAULT_ON = { announce: true };
var OWNER_EMAILS = "live"; // "off" = never email owners; "live" = email owners who turned a kind on
function handleOf_(o) { return String(o.handle || o.name || o.owner).replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || o.owner; }
function notifyOf_(o) { var n = parseJ_(o.notify), out = {}; NOTIFY_KEYS.forEach(function (k) { out[k] = n[k] != null ? !!n[k] : !!NOTIFY_DEFAULT_ON[k]; }); return out; }
function settings_(me) { return { ok: true, handle: handleOf_(me), email: String(me.email || ""), phone: String(me.phone || ""), notify: notifyOf_(me) }; }
function saveSettings_(me, b) {
  var list = owners_(), idx = -1; list.forEach(function (o, i) { if (o.owner === me.owner) idx = i; });
  var o = list[idx], email = String(b.email || "").split(/[,;\s]+/).filter(Boolean).slice(0, 2);
  for (var i = 0; i < email.length; i++) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email[i])) return { ok: false, error: "That email doesn't look right: " + email[i] };
  var phone = String(b.phone || "").replace(/[^0-9+]/g, ""); if (phone && phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Mobile needs 10 digits." };
  if (b.handle != null) { var h = String(b.handle).replace(/^@/, "").trim();
    if (!/^[A-Za-z0-9]{2,20}$/.test(h)) return { ok: false, error: "Handle: 2–20 letters or numbers." };
    if (list.some(function (x) { return x.owner !== me.owner && handleOf_(x).toLowerCase() === h.toLowerCase(); })) return { ok: false, error: "@" + h + " is taken." };
    o.handle = h; }
  var n = {}; NOTIFY_KEYS.forEach(function (k) { n[k] = !!(b.notify || {})[k]; });
  o.email = email.join(", "); o.phone = phone; o.notify = JSON.stringify(n); setRow_("Owners", idx, o);
  log_("settings", me.owner);
  return settings_(o);
}
function contacts_() {
  return { ok: true, owners: owners_().map(function (o) { return { owner: o.owner, name: o.name, team: o.team, handle: handleOf_(o), email: String(o.email || ""), phone: String(o.phone || "") }; }) };
}
// One email to an owner who turned this kind on. Chat emails: at most one per room every 30 minutes.
function notify_(ownerId, kind, subject, body, room) {
  if (OWNER_EMAILS === "off") return;
  try {
    var o = owners_().filter(function (x) { return x.owner === ownerId; })[0]; if (!o || !o.email || !notifyOf_(o)[kind]) return;
    if (room) { var c = CacheService.getScriptCache(), k = "nchat:" + ownerId + ":" + room; if (c.get(k)) return; c.put(k, "1", 1800); }
    if (MailApp.getRemainingDailyQuota() <= 10) return; // keep the last 10 for ops alerts
    MailApp.sendEmail(String(o.email), "SPL HQ · " + subject, body + "\n\nOpen SPL HQ: " + APP_URL + "\n(Turn these off in SPL HQ → your initials → Settings.)");
  } catch (e) { log_("notify_error", String(e)); }
}

// ---------------------------------------------------------------- 🔁 Trade center: players + draft picks + keeper contracts
// Flow: PROPOSED → (to) ACCEPTED / DECLINED · (from) WITHDRAWN → commish APPROVED / NEGATED. A counter declines the original.
// Players are checked against live ESPN rosters (READ_LEAGUE); picks against the Picks tab (live ledger, seeded once);
// a keeper contract travels with its player. Nobody approves a trade they're in.
function oid_(id) { return OWNER_SEED.filter(function (r) { return r[0] === id; })[0]; }
function oName_(id) { var r = oid_(id); return r ? r[1] : id; }
// Every tradeable season gets its 17 rounds × 12 picks the first time it's needed (seasons follow Joe's pick_years answer).
function seedPicks_() {
  var have = rows_("Picks"), got = {}, now = new Date(), added = 0; have.forEach(function (p) { got[p.season] = 1; });
  rules_().pickSeasons.forEach(function (y) { if (got[y]) return;
    for (var r = 1; r <= PICK_ROUNDS; r++) OWNER_SEED.forEach(function (o) { append_("Picks", [y + "-R" + r + "-" + o[0], y, r, o[0], o[0], now, "seed"]); added++; }); });
  return added ? rows_("Picks") : have;
}
// 🧾 Ledger feed for the ledger-sync robot (GitHub Action): approved trades + the live pick ledger + the rules in force.
// League-level facts only (no notes, contacts or DMs); the robot writes them into the repo's gold files.
function ledger_() {
  var r = rules_(), picks = seedPicks_();
  return { ok: true, version: VERSION, mode: TRADE_MODE, at: new Date().toISOString(), rules: r,
    picks: picks.map(function (p) { return { pid: p.pid, season: Number(p.season), round: Number(p.round), original: p.original, owner: p.owner, via: p.via, updated: p.updated_ts }; }),
    trades: offers_().filter(function (o) { return o.status === "APPROVED"; }).map(function (o) { return { id: o.offer_id, approved: o.updated_ts, from: o.from, to: o.to, mode: o.mode,
      fromSends: o.giveO, toSends: o.getO, by: o.by }; }) };
}
// Commish fix for the pick ledger (a pick traded before the app existed, a typo): move one pick, with a reason. Logged + posted.
function pickFix_(me, b) {
  var picks = seedPicks_(), idx = -1; picks.forEach(function (p, i) { if (p.pid === b.pid) idx = i; });
  if (idx < 0) return { ok: false, error: "Unknown pick" }; if (!oid_(b.to)) return { ok: false, error: "Pick an owner" };
  if (!String(b.reason || "").trim()) return { ok: false, error: "Give a reason (the league sees it)." };
  var p = picks[idx], from = p.owner; if (from === b.to) return { ok: false, error: "Already theirs." };
  p.owner = b.to; p.updated_ts = new Date(); p.via = "fix:" + me.owner; setRow_("Picks", idx, p);
  botPost_("league", "🎟️ Pick ledger fix: " + p.season + " round " + p.round + " (" + oName_(p.original) + "'s) now belongs to " + oName_(b.to) + " · “" + clip_(b.reason, 160) + "” (" + me.name + ")", "");
  log_("pickfix", me.owner + " " + p.pid + " " + from + "→" + b.to + " " + clip_(b.reason, 160));
  return { ok: true };
}
function offers_() { return rows_("Offers").map(function (r) { r.giveO = parseJ_(r.give); r.getO = parseJ_(r.get); return r; }); }
function parseJ_(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }
function pub_offer_(r) { return { id: r.offer_id, ts: r.ts, from: r.from, to: r.to, give: r.giveO, get: r.getO, note: r.note, status: r.status, updated: r.updated_ts, reason: r.reason, by: r.by, mode: r.mode, espn: r.espn, counterOf: r.counter_of }; }
function rosterOf_(id) { var t = rosters_().teams.filter(function (x) { return x.owner === id; })[0]; return t ? t.players : null; }
function sideText_(side) {
  var a = (side.players || []).map(function (p) { return p.n; }).concat((side.picks || []).map(function (pid) { var m = /^(\d+)-R(\d+)-(\w+)$/.exec(pid); return m ? "'" + m[1].slice(2) + " R" + m[2] + (m[3] ? " (" + oName_(m[3]) + ")" : "") : pid; }));
  return a.length ? a.join(", ") : "nothing";
}
// Is this side still the owner's to give? Returns an error string or "".
function checkSide_(ownerId, side, picks) {
  var players = side.players || [], pk = side.picks || [];
  if (players.length > 10 || pk.length > 10) return "Too many pieces in one trade.";
  if (players.length) {
    var ro = rosterOf_(ownerId); if (!ro) return "Couldn't read " + oName_(ownerId) + "'s roster on ESPN.";
    for (var i = 0; i < players.length; i++) if (!ro.some(function (p) { return p.n === players[i].n; })) return players[i].n + " isn't on " + oName_(ownerId) + "'s ESPN roster.";
  }
  for (var j = 0; j < pk.length; j++) {
    var row = picks.filter(function (x) { return x.pid === pk[j]; })[0];
    if (!row) return "Unknown pick " + pk[j] + ".";
    if (row.owner !== ownerId) return oName_(ownerId) + " doesn't own that " + row.season + " round " + row.round + " pick.";
    if (Number(row.round) === 1 && row.original === ownerId && tagYear_(ownerId, String(row.season))) return oName_(ownerId) + " holds a franchise tag in " + row.season + ", so their own 1st can't be traded.";
  }
  return "";
}
function tagYear_(ownerId, y) { return (TAGS_ || []).some(function (t) { return t[0] === ownerId && t[1] === y; }); }
var TAGS_ = []; // [owner, season] franchise-tag years that lock that owner's own 1st (none for 2027 in the 2026 Keeper Matrix)
function cleanSide_(side) {
  side = side || {};
  return { players: (Array.isArray(side.players) ? side.players : []).slice(0, 10).map(function (p) { return { n: clip_(p.n, 60), pos: clip_(p.pos, 5), tm: clip_(p.tm, 4) }; }),
    picks: (Array.isArray(side.picks) ? side.picks : []).slice(0, 10).map(function (x) { return clip_(x, 30); }) };
}
function trades_(me) {
  var picks = seedPicks_(), all = offers_(), desk = isRole_(me, "commish") || isRole_(me, "ops");
  var mine = all.filter(function (r) { return r.from === me.owner || r.to === me.owner || (desk && r.status === "ACCEPTED") || r.status === "APPROVED" || r.status === "ACCEPTED"; });
  // contracts follow their player through approved trades
  var moves = []; all.filter(function (r) { return r.status === "APPROVED"; }).forEach(function (r) {
    (r.giveO.players || []).forEach(function (p) { moves.push({ player: p.n, to: r.to, at: r.updated_ts }); });
    (r.getO.players || []).forEach(function (p) { moves.push({ player: p.n, to: r.from, at: r.updated_ts }); }); });
  var rl = rules_();
  return { ok: true, mode: TRADE_MODE, seasons: rl.pickSeasons, rounds: PICK_ROUNDS, rules: rl,
    picks: picks.map(function (p) { return { pid: p.pid, season: Number(p.season), round: Number(p.round), original: p.original, owner: p.owner, via: p.via }; }),
    offers: mine.map(pub_offer_).reverse().slice(0, 80), moves: moves };
}
function offer_(me, b) {
  var to = String(b.to || ""); if (!oid_(to) || to === me.owner) return { ok: false, error: "Pick a team to trade with." };
  var give = cleanSide_(b.give), get = cleanSide_(b.get);
  if (!(give.players.length + give.picks.length) || !(get.players.length + get.picks.length)) return { ok: false, error: "Both sides need at least one player or pick." };
  var picks = seedPicks_(), e1 = checkSide_(me.owner, give, picks) || checkSide_(to, get, picks); if (e1) return { ok: false, error: e1 };
  var all = offers_(), sig = JSON.stringify([me.owner, to, give, get]);
  var dup = all.filter(function (r) { return r.status === "PROPOSED" && JSON.stringify([r.from, r.to, r.giveO, r.getO]) === sig; })[0];
  if (dup) return { ok: true, offer: pub_offer_(dup), dup: true };
  var id = "T" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), now = new Date();
  if (b.counterOf) { var oi = -1; all.forEach(function (r, i) { if (r.offer_id === b.counterOf && r.status === "PROPOSED" && r.to === me.owner) oi = i; });
    if (oi >= 0) { var o = all[oi]; o.status = "DECLINED"; o.reason = "Countered"; o.updated_ts = now; o.by = me.owner; setRow_("Offers", oi, o); } }
  append_("Offers", [id, now, me.owner, to, JSON.stringify(give), JSON.stringify(get), clip_(b.note, 300), "PROPOSED", now, "", me.owner, TRADE_MODE, "", clip_(b.counterOf, 20)]);
  botPost_(dmRoom_(me.owner, to), "🔁 " + (b.counterOf ? "Counter" : "Trade offer") + " from " + me.name + ": sends " + sideText_(give) + " · gets " + sideText_(get) + (b.note ? " · “" + clip_(b.note, 120) + "”" : ""), id);
  notify_(to, b.counterOf ? "countered" : "received", (b.counterOf ? "Counter-offer from " : "Trade offer from ") + me.name, me.name + " sends " + sideText_(give) + "\nYou send " + sideText_(get) + (b.note ? "\n\n“" + clip_(b.note, 300) + "”" : ""));
  log_("offer", id + " " + me.owner + "→" + to);
  return { ok: true, offer: { id: id, from: me.owner, to: to, give: give, get: get, status: "PROPOSED", ts: now } };
}
function dmRoom_(a, b) { var x = [a, b].sort(); return "dm:" + x[0] + "," + x[1]; }
function findOffer_(id) { var all = offers_(), i = -1; all.forEach(function (r, k) { if (r.offer_id === id) i = k; }); return i < 0 ? null : { row: all[i], idx: i }; }
function respond_(me, b) {
  var f = findOffer_(b.id); if (!f) return { ok: false, error: "Offer not found" };
  var r = f.row, d = b.decision, now = new Date();
  if (r.status !== "PROPOSED") return { ok: false, error: "That offer is already " + String(r.status).toLowerCase() + "." };
  if (d === "withdraw") { if (r.from !== me.owner) return { ok: false, error: "Only the sender can withdraw." }; r.status = "WITHDRAWN"; }
  else if (d === "decline") { if (r.to !== me.owner) return { ok: false, error: "Not your offer to answer." }; r.status = "DECLINED"; r.reason = clip_(b.reason, 200); }
  else if (d === "accept") {
    if (r.to !== me.owner) return { ok: false, error: "Not your offer to answer." };
    var picks = seedPicks_(), err = checkSide_(r.from, r.giveO, picks) || checkSide_(r.to, r.getO, picks); if (err) return { ok: false, error: err };
    r.status = "ACCEPTED";
  } else return { ok: false, error: "Unknown answer" };
  r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  var o = findOffer_(b.id).row, room = dmRoom_(o.from, o.to);
  botPost_(room, { accept: "✅ " + me.name + " accepted. It goes to the commish for approval.", decline: "❌ " + me.name + " declined" + (o.reason ? ": “" + o.reason + "”" : "."), withdraw: "↩️ " + me.name + " withdrew the offer." }[d], o.offer_id);
  if (d === "accept") {
    botPost_("league", "🤝 Trade agreed, waiting on the commish: " + oName_(o.from) + " sends " + sideText_(o.giveO) + " · " + oName_(o.to) + " sends " + sideText_(o.getO), o.offer_id);
    mail_("SPL HQ · trade waiting on the commish", oName_(o.from) + " sends " + sideText_(o.giveO) + "\n" + oName_(o.to) + " sends " + sideText_(o.getO) + "\n\nApprove or negate: " + APP_URL + "#desk");
  }
  if (d === "accept" || d === "decline") notify_(o.from, d === "accept" ? "accepted" : "declined", me.name + (d === "accept" ? " accepted your trade" : " declined your offer"),
    "You send " + sideText_(o.giveO) + "\n" + me.name + " sends " + sideText_(o.getO) + (d === "accept" ? "\n\nIt goes to the commish for approval." : (o.reason ? "\n\n“" + o.reason + "”" : "")));
  log_("respond", o.offer_id + " " + d + " by " + me.owner);
  return { ok: true, offer: pub_offer_(o) };
}
function tradeAct_(me, b) {
  var f = findOffer_(b.id); if (!f) return { ok: false, error: "Offer not found" };
  var r = f.row, d = b.decision, now = new Date();
  if (d === "espndone") { if (r.status !== "APPROVED" || r.espn !== "todo") return { ok: false, error: "Nothing to do on ESPN for this one." }; r.espn = "done"; r.updated_ts = now; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r); log_("espndone", r.offer_id + " by " + me.owner); return { ok: true }; }
  if (r.status !== "ACCEPTED") return { ok: false, error: "Only accepted trades wait on the commish." };
  // Nobody approves their own trade. A Joe ↔ Mike trade has no neutral commish: either may approve, and the league card says so
  // (until Joe answers the "commish_trades" question in the app).
  var deskOf = function (id) { var o = owners_().filter(function (x) { return x.owner === id; })[0]; return o && (isRole_(o, "commish") || isRole_(o, "ops")); };
  var bothDesk = deskOf(r.from) && deskOf(r.to);
  if ((r.from === me.owner || r.to === me.owner) && !bothDesk) return { ok: false, error: "You're in this trade: the other commish approves it." };
  if (d === "negate") { if (!String(b.reason || "").trim()) return { ok: false, error: "Give a reason for the league." }; r.status = "NEGATED"; r.reason = clip_(b.reason, 200); }
  else if (d === "approve") {
    var picks = seedPicks_(), err = checkSide_(r.from, r.giveO, picks) || checkSide_(r.to, r.getO, picks); if (err) return { ok: false, error: "Can't approve: " + err };
    var move = function (pid, to) { picks.forEach(function (p, i) { if (p.pid === pid) { p.owner = to; p.updated_ts = now; p.via = r.offer_id; setRow_("Picks", i, p); } }); };
    (r.giveO.picks || []).forEach(function (pid) { move(pid, r.to); }); (r.getO.picks || []).forEach(function (pid) { move(pid, r.from); });
    r.status = "APPROVED"; r.espn = r.mode === "test" ? "test" : ((r.giveO.players || []).length + (r.getO.players || []).length ? "todo" : "none");
  } else return { ok: false, error: "Unknown decision" };
  var gi = r.giveO, ge = r.getO; r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  var txt = d === "approve" ? "✅ Trade approved" + (bothDesk ? " (commish-to-commish trade, approved by " + me.name + ")" : "") + ": " + oName_(r.from) + " gets " + sideText_(ge) + " · " + oName_(r.to) + " gets " + sideText_(gi)
                            : "🚫 Trade negated by the commish: “" + r.reason + "”";
  botPost_("league", txt, r.offer_id); botPost_(dmRoom_(r.from, r.to), txt, r.offer_id);
  [r.from, r.to].forEach(function (id) { notify_(id, "commish", "Trade " + (d === "approve" ? "approved" : "negated"), txt); });
  log_("trade_" + d, r.offer_id + " by " + me.owner);
  return { ok: true };
}
function wipeTrades_(me) {
  if (TRADE_MODE !== "test") return { ok: false, error: "Only test trades can be wiped." };
  var ss = SpreadsheetApp.getActive(); ["Offers", "Picks"].forEach(function (n) { var sh = ss.getSheetByName(n); if (sh) ss.deleteSheet(sh); });
  seedPicks_(); log_("wipetrades", me.owner); return { ok: true };
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
