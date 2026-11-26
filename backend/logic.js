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
var VERSION = "0.10.1";
var SEASON = 2026;
var READ_LEAGUE = 19583;        // real SPL league: read-only (rosters, standings, schedule, history)
var WRITE_LEAGUE = 1722387564;  // "Testing MAFFL HQ": the ONLY league the backend may ever write to (until Joe signs off)
var ESPN_WRITES = false;        // code default: off. Ops turns writes on/off from the Ops desk (Script property ESPN_WRITES = "on"); test league only
// 🔁 Trade center. TRADE_MODE "test" = demo trades: nothing is owed on ESPN and Ops can wipe them all. "live" after Joe signs off.
// Defaults until Joe answers the in-app questions: 2027 picks only, 17 rounds, contracts travel with the player, commish approves.
var TRADE_MODE = "test";
var PICK_ROUNDS = 17, FIRST_PICK_SEASON = SEASON + 1;
// League rules the app runs on come from Joe's answers in the app (League → Questions), with these defaults until he answers.
var PICK_YEARS_OF = { "Next season only": 1, "2 seasons": 2, "3 seasons": 3, "No limit": 3 };
// Latest answer from either commish (Joe or Mike) wins; the Answers tab keeps every answer with who gave it.
function joeAnswer_(qid) { var cm = {}; owners_().forEach(function (o) { if (isRole_(o, "commish")) cm[o.owner] = 1; });
  var a = null; rows_("Answers").forEach(function (r) { if (cm[r.who] && r.qid === qid && r.choice) a = String(r.choice); }); return a; }
function rules_() {
  var py = joeAnswer_("pick_years"), kt = joeAnswer_("keeper_travels"), n = PICK_YEARS_OF[py] || 1, seasons = [];
  for (var i = 0; i < n; i++) seasons.push(FIRST_PICK_SEASON + i);
  return { pickSeasons: seasons, pickYearsFrom: py ? "commish" : "default", contracts: /resets/i.test(kt || "") ? "resets" : "travels", contractsFrom: kt ? "commish" : "default" };
}
var APP_URL = "https://spl-hq.github.io/";
// 📥 Desks + roles (WS1, Mike 11/26). Joe (commish) runs the Commish desk. Mike (ops + commish) sees it as "Joe's view", read-only,
// except where the rules need him: trades Joe is in (no self-approval) and backup once a trade has waited BACKUP_WAIT_H on Joe.
var BACKUP_WAIT_H = 48;
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
var READS = { testleague: 1, me: 1, desk: 1, week: 1, rosters: 1, chat: 1, trades: 1, settings: 1, contacts: 1, drafts: 1, reacts: 1 }; // never wait on the script lock
var WRITES = { pickfix: 1, answers: 1, feedback: 1, chatsend: 1, chatdel: 1, issue: 1, offer: 1, respond: 1, tradeact: 1, savesettings: 1, draftpick: 1, draftopen: 1, react: 1 }; // rate-limited per owner
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
      case "pickfix":  return json(!desk ? { ok: false, error: "Commish only" } : isBackup_(me) ? { ok: false, error: "Pick fixes are Joe's call (read-only in Joe's view)." } : pickFix_(me, b));
      case "drafts":   return json(drafts_(me));
      case "reacts":   return json(reacts_(b.keys));
      case "react":    return json(react_(me, b));
      case "draftpick": return json(draftPick_(me, b, desk));
      case "draftopen": return json(desk ? draftOpen_(me, b) : { ok: false, error: "Commish only" });
      case "draftundo": return json(desk ? draftUndo_(me, b) : { ok: false, error: "Commish only" });
      case "draftcancel": return json(desk ? draftCancel_(me, b) : { ok: false, error: "Commish only" });
      case "draftwipe": return json(isRole_(me, "ops") ? draftWipe_(me) : { ok: false, error: "Ops only" });
      case "testleague": return json(isRole_(me, "ops") ? testDesk_() : { ok: false, error: "Ops only" });
      case "mirror":   return json(isRole_(me, "ops") ? mirror_(me, b) : { ok: false, error: "Ops only" });
      case "espnwrites": return json(isRole_(me, "ops") ? espnSwitch_(me, b) : { ok: false, error: "Ops only" });
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
  Offers:   ["offer_id", "ts", "from", "to", "give", "get", "note", "status", "updated_ts", "reason", "by", "mode", "espn", "counter_of", "espn_note"],
  Picks:    ["pid", "season", "round", "original", "owner", "updated_ts", "via"],
  Drafts:   ["draft_id", "ts", "kind", "season", "mode", "status", "order", "note", "by", "updated_ts"],
  DraftPicks: ["draft_id", "n", "owner", "choice", "ts", "by", "note"],
  Reactions: ["ts", "key", "owner", "emoji"],
  EspnLog:  ["ts", "by", "kind", "ref", "items", "code", "msg"]
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
function isBackup_(o) { return isRole_(o, "ops"); } // Mike: commish powers only as backup on Joe's desk
// Why `me` can't approve/negate this accepted trade right now ("" = can act).
function deskLock_(me, r) {
  if (!(isRole_(me, "commish") || isRole_(me, "ops"))) return "Commish only";
  var byId = {}; owners_().forEach(function (o) { byId[o.owner] = o; });
  var desk = function (id) { var o = byId[id]; return o && (isRole_(o, "commish") || isRole_(o, "ops")); };
  var mine = r.from === me.owner || r.to === me.owner;
  if (mine && !(desk(r.from) && desk(r.to))) return "You're in this trade: the other commish approves it.";
  if (!isBackup_(me) || mine) return "";
  var primaryIn = [r.from, r.to].some(function (id) { var o = byId[id]; return o && isRole_(o, "commish") && !isBackup_(o); });
  if (primaryIn) return "";
  var h = (Date.now() - new Date(r.updated_ts || r.ts).getTime()) / 36e5;
  return h >= BACKUP_WAIT_H ? "" : "Joe's call. You can step in as backup after " + BACKUP_WAIT_H + " h (" + Math.ceil(BACKUP_WAIT_H - h) + " h to go).";
}
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
    review: offers_().filter(function (r) { return r.status === "ACCEPTED"; }).map(function (r) { var o = pub_offer_(r); o.lock = deskLock_(me, r); return o; }),
    backupWaitH: BACKUP_WAIT_H, espn: offs.filter(function (o) { return o.status === "APPROVED" && o.espn === "todo"; }),
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
            return { id: e.playerId || pl.id || null, n: pl.fullName || "?", pos: POS[pl.defaultPositionId] || "", tm: PRO[pl.proTeamId] || "FA", slot: SLOT[e.lineupSlotId] || "", so: SLOT_ORDER.indexOf(e.lineupSlotId),
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
// 🔥 Reel reactions (WS4): one tap per owner per emoji per league card; tap again to take it back. Keys come from the app
// (season-week:card id), never shown raw. Everyone signed in sees every reaction on league cards.
var REACTS = ["🔥", "😂", "😬", "👏", "💀", "🐐"];
function reactKey_(k) { k = String(k || ""); return /^[A-Za-z0-9:._,\-]{1,80}$/.test(k) ? k : ""; }
function reacts_(keys) {
  var want = {}; (Array.isArray(keys) ? keys : []).slice(0, 80).forEach(function (k) { k = reactKey_(k); if (k) want[k] = 1; });
  var out = {}; rows_("Reactions").forEach(function (r) { var k = String(r.key); if (!want[k] || REACTS.indexOf(String(r.emoji)) < 0) return;
    var m = out[k] = out[k] || {}; (m[r.emoji] = m[r.emoji] || []).push(String(r.owner)); });
  return { ok: true, reacts: out, emojis: REACTS };
}
function react_(me, b) {
  var k = reactKey_(b.key), em = String(b.emoji || ""); if (!k || REACTS.indexOf(em) < 0) return { ok: false, error: "Unknown reaction" };
  var sh = sheet_("Reactions"), list = rows_("Reactions"), idx = -1;
  list.forEach(function (r, i) { if (String(r.key) === k && String(r.owner) === me.owner && String(r.emoji) === em) idx = i; });
  if (idx >= 0) sh.deleteRow(idx + 2); else append_("Reactions", [new Date(), k, me.owner, em]);
  var r = reacts_([k]); return { ok: true, on: idx < 0, key: k, reacts: r.reacts[k] || {} };
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
var NOTIFY_KEYS = ["received", "countered", "accepted", "declined", "commish", "chat", "announce", "draft"];
var NOTIFY_DEFAULT_ON = { announce: true, draft: true }; // draft = "you're on the clock" (off-season drafts)
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
      fromSends: o.giveO, toSends: o.getO, by: o.by }; }), drafts: draftLedger_() };
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
function pub_offer_(r) { return { id: r.offer_id, ts: r.ts, from: r.from, to: r.to, give: r.giveO, get: r.getO, note: r.note, status: r.status, updated: r.updated_ts, reason: r.reason, by: r.by, mode: r.mode, espn: r.espn, espnNote: r.espn_note, counterOf: r.counter_of }; }
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
  return { players: (Array.isArray(side.players) ? side.players : []).slice(0, 10).map(function (p) { var o = { n: clip_(p.n, 60), pos: clip_(p.pos, 5), tm: clip_(p.tm, 4) }; if (Number(p.id) > 0) o.id = Number(p.id); return o; }),
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
    offers: mine.map(function (r) { var o = pub_offer_(r); if (desk && r.status === "ACCEPTED") o.lock = deskLock_(me, r); return o; }).reverse().slice(0, 80), moves: moves };
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
  var bothDesk = deskOf(r.from) && deskOf(r.to), lock = deskLock_(me, r);
  if (lock) return { ok: false, error: lock };
  if (d === "negate") { if (!String(b.reason || "").trim()) return { ok: false, error: "Give a reason for the league." }; r.status = "NEGATED"; r.reason = clip_(b.reason, 200); }
  else if (d === "approve") {
    var picks = seedPicks_(), err = checkSide_(r.from, r.giveO, picks) || checkSide_(r.to, r.getO, picks); if (err) return { ok: false, error: "Can't approve: " + err };
    var move = function (pid, to) { picks.forEach(function (p, i) { if (p.pid === pid) { p.owner = to; p.updated_ts = now; p.via = r.offer_id; setRow_("Picks", i, p); } }); };
    (r.giveO.picks || []).forEach(function (pid) { move(pid, r.to); }); (r.getO.picks || []).forEach(function (pid) { move(pid, r.from); });
    r.status = "APPROVED"; var ew = espnTrade_(r, me); r.espn = ew.espn; r.espn_note = clip_(ew.note, 300);
  } else return { ok: false, error: "Unknown decision" };
  var gi = r.giveO, ge = r.getO; r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  var txt = d === "approve" ? "✅ Trade approved" + (bothDesk ? " (commish-to-commish trade, approved by " + me.name + ")" : "") + ": " + oName_(r.from) + " gets " + sideText_(ge) + " · " + oName_(r.to) + " gets " + sideText_(gi)
                            : "🚫 Trade negated by the commish: “" + r.reason + "”";
  if (d === "approve" && r.espn === "done") txt += " · 🏈 done on ESPN" + (r.mode === "test" ? " (test league)" : "");
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

// ---------------------------------------------------------------- 🏈 ESPN writes (WS5). Test league only until Joe signs off.
// The test league has 4 teams (Mike 11/26: no need for 12): each mirrors one SPL team's real roster (commish drops + adds), so demo
// trades between those 4 owners run on ESPN with real SPL players. Mike's own ESPN team maps to him (his SWID); the other
// test teams map to the rest of DEMO_OWNERS in team-id order. Rules: writes go only to WRITE_LEAGUE; ops switch in Script property
// ESPN_WRITES ("on"); every write is one POST (never retried: a retry can apply twice), logged in EspnLog, then read back.
var DEMO_OWNERS = ["murello", "reilly", "farrington", "glen"]; // Mike, Joe, Al (East Coast) + Glen
var ESPN_TRADE_TYPE = "TRADE_PROPOSAL"; // LM trade, EXECUTE: MAFFL APP_DESIGN §10b, proven 11/25 on this test league. Script property ESPN_TRADE_TYPE overrides
// MAFFL's exact body (mod_espn.js espnWriteTest_): executes at once, several players + both directions in one call.
function lmTrade_(teamId, sp, items, comment) { return { isLeagueManager: true, teamId: teamId, type: prop_("ESPN_TRADE_TYPE") || ESPN_TRADE_TYPE, memberId: swid_(), scoringPeriodId: sp, executionType: "EXECUTE",
  items: items, expirationDate: null, comment: comment, isActingAsTeamOwner: false, skipTransactionCounters: false }; }
function writesOn_() { return ESPN_WRITES || prop_("ESPN_WRITES") === "on"; }
function swid_() { var m = /SWID=(\{[^}]+\})/.exec(cookies_()); return m ? m[1] : ""; }
function espnPost_(kind, ref, body, by) {
  if (!writesOn_()) throw new Error("ESPN writes are off (Ops desk → Test league).");
  if (WRITE_LEAGUE === READ_LEAGUE && TRADE_MODE !== "live") throw new Error("Writes to the real league need Joe's sign-off.");
  var url = "https://lm-api-writes.fantasy.espn.com/apis/v3/games/ffl/seasons/" + SEASON + "/segments/0/leagues/" + WRITE_LEAGUE + "/transactions/";
  var r = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(body), headers: { Cookie: cookies_() }, muteHttpExceptions: true });
  var code = r.getResponseCode(), txt = String(r.getContentText() || ""), msg = "";
  try { var j = JSON.parse(txt); msg = (j.messages || []).join(" ") || ((j.details || [])[0] || {}).message || j.status || ""; } catch (e) { msg = txt.slice(0, 120); }
  try { append_("EspnLog", [new Date(), by || "", kind, ref || "", clip_(JSON.stringify(body.items), 400), code, clip_(msg || txt, 300)]); } catch (e) {}
  return { ok: code >= 200 && code < 300, code: code, msg: clip_(msg, 160) };
}
// The test league as SPL sees it: each team mapped to its SPL owner, players with ESPN ids.
function testLeague_() {
  var d = espn_(WRITE_LEAGUE, "view=mTeam&view=mRoster&view=mSettings&view=mStatus"), sw = "";
  try { sw = swid_().toUpperCase(); } catch (e) {}
  var teams = (d.teams || []).slice().sort(function (a, b) { return a.id - b.id; }), map = {}, left = DEMO_OWNERS.slice();
  var mine = teams.filter(function (t) { return (t.owners || []).some(function (o) { return String(o).toUpperCase() === sw; }); })[0];
  if (mine && left.indexOf("murello") >= 0) { map[mine.id] = "murello"; left.splice(left.indexOf("murello"), 1); }
  if (WRITE_LEAGUE === READ_LEAGUE) { var own = teamOwners_(); teams.forEach(function (t) { map[t.id] = own[norm_(teamName_(t))] || ""; }); }
  teams.forEach(function (t) { if (!map[t.id] && left.length) map[t.id] = left.shift(); });
  return { sp: (d.status || {}).latestScoringPeriod || d.scoringPeriodId || 1, name: (d.settings || {}).name || "", teams: teams.map(function (t) {
    return { id: t.id, team: teamName_(t), owner: map[t.id] || "", players: (((t.roster || {}).entries) || []).map(function (e) {
      var pl = (e.playerPoolEntry || {}).player || {}; return { id: e.playerId || pl.id, n: pl.fullName || "?", pos: POS[pl.defaultPositionId] || "" }; }) }; }) };
}
function splRosters_() { // fresh SPL rosters with ESPN ids, by owner
  var d = espn_(READ_LEAGUE, "view=mTeam&view=mRoster"), own = teamOwners_(), out = {};
  (d.teams || []).forEach(function (tm) { var o = own[norm_(teamName_(tm))]; if (o) out[o] = (((tm.roster || {}).entries) || []).map(function (e) {
    var pl = (e.playerPoolEntry || {}).player || {}; return { id: e.playerId || pl.id, n: pl.fullName || "?", pos: POS[pl.defaultPositionId] || "" }; }); });
  return out;
}
// 🪞 Mirror plan, per demo team: drops = players no demo team wants (freed first), moves = wanted players sitting on another test team
// (moved with the proven LM trade write, so they never pass through waivers), adds = wanted players not on any test team (commish add).
function mirrorPlan_(tl, spl) {
  var demo = tl.teams.filter(function (t) { return t.owner; }), wanted = {}, where = {};
  demo.forEach(function (t) { (spl[t.owner] || []).forEach(function (p) { wanted[p.id] = t.id; }); });
  tl.teams.forEach(function (t) { t.players.forEach(function (p) { where[p.id] = t.id; }); });
  return demo.map(function (t) {
    var want = spl[t.owner] || [], here = want.filter(function (p) { return where[p.id] === t.id; });
    return { teamId: t.id, team: t.team, owner: t.owner, name: oName_(t.owner), have: t.players.length, want: want.length, match: here.length,
      drops: t.players.filter(function (p) { return !wanted[p.id]; }),
      moves: want.filter(function (p) { return where[p.id] && where[p.id] !== t.id; }).map(function (p) { return { id: p.id, n: p.n, from: where[p.id] }; }),
      adds: want.filter(function (p) { return !where[p.id]; }) };
  });
}
function testDesk_() {
  var tl = testLeague_(), plan = mirrorPlan_(tl, splRosters_());
  var log = []; try { log = rows_("EspnLog").slice(-12).reverse().map(function (r) { return { ts: r.ts, by: r.by, kind: r.kind, ref: r.ref, items: r.items, code: r.code, msg: r.msg }; }); } catch (e) {}
  return { ok: true, league: WRITE_LEAGUE, name: tl.name, week: tl.sp, writes: writesOn_(), tradeType: prop_("ESPN_TRADE_TYPE") || ESPN_TRADE_TYPE, demo: DEMO_OWNERS,
    teams: plan.map(function (p) { return { teamId: p.teamId, team: p.team, owner: p.owner, have: p.have, want: p.want, match: p.match, drops: p.drops.length, moves: p.moves.length, adds: p.adds.length,
      moveNames: p.moves.slice(0, 30).map(function (x) { return x.n; }),
      dropNames: p.drops.slice(0, 30).map(function (x) { return x.n; }), addNames: p.adds.slice(0, 30).map(function (x) { return x.n; }) }; }), log: log };
}
// One step per call so each stays short: "drops" on every team first, then "moves", then "adds". Ops only. One player per add/drop;
// a team's moves go in one LM trade write. Never retried; each step reads the test league back.
function mirror_(me, b) {
  var step = b.step === "adds" || b.step === "moves" ? b.step : "drops", tl = testLeague_(), plan = mirrorPlan_(tl, splRosters_()).filter(function (p) { return p.owner === b.owner; })[0];
  if (!plan) return { ok: false, error: "No test team for " + oName_(b.owner) };
  var sw = swid_(), done = 0, fails = [];
  if (step === "moves") { if (plan.moves.length) {
    var r0 = espnPost_("mirror-moves", plan.owner, lmTrade_(plan.teamId, tl.sp, plan.moves.slice(0, 30).map(function (p) { return { playerId: p.id, type: "TRADE", fromTeamId: p.from, toTeamId: plan.teamId }; }), "SPL HQ mirror"), me.owner);
    if (r0.ok) done = plan.moves.length; else fails.push("move " + plan.moves.length + " players (" + (r0.msg || r0.code) + ")"); }
  } else plan[step].slice(0, 30).forEach(function (p) {
    var it = step === "drops" ? { playerId: p.id, type: "DROP", fromTeamId: plan.teamId } : { playerId: p.id, type: "ADD", toTeamId: plan.teamId };
    var r = espnPost_("mirror-" + step, plan.owner, { isLeagueManager: true, teamId: plan.teamId, type: "FREEAGENT", memberId: sw, scoringPeriodId: tl.sp, executionType: "EXECUTE", items: [it] }, me.owner);
    if (r.ok) done++; else fails.push(p.n + " (" + (r.msg || r.code) + ")");
  });
  var after = mirrorPlan_(testLeague_(), splRosters_()).filter(function (p) { return p.owner === b.owner; })[0];
  log_("mirror", me.owner + " " + b.owner + " " + step + " ok " + done + " fail " + fails.length);
  return { ok: true, step: step, owner: b.owner, sent: done, fails: fails, left: after ? after[step].length : null, match: after ? after.match : null, want: after ? after.want : null };
}
// 🔁 Approved trade → ESPN (test league): players whose two owners both have a test team. One POST, then read back.
// Returns { espn: "done" | "todo" | "test" | "none", note }.
function espnTrade_(r, me) {
  var players = (r.giveO.players || []).map(function (p) { return { p: p, from: r.from, to: r.to }; }).concat((r.getO.players || []).map(function (p) { return { p: p, from: r.to, to: r.from }; }));
  if (!players.length) return { espn: "none", note: "" };
  var demo = DEMO_OWNERS.indexOf(r.from) >= 0 && DEMO_OWNERS.indexOf(r.to) >= 0;
  var real = WRITE_LEAGUE === READ_LEAGUE; if (real) demo = true; // after sign-off every SPL team is on the write league
  if (r.mode === "test" && real) return { espn: "test", note: "" }; // practice trades never touch the real league
  if (r.mode !== "test" && !real) return { espn: "todo", note: "" }; // real trade, writes still point at the test league
  if (!writesOn_() || !demo) return { espn: r.mode === "test" ? "test" : "todo", note: r.mode === "test" ? (demo ? "ESPN writes are off" : "Not a test-league team") : "" };
  try {
    var tl = testLeague_(), teamOf = {}; tl.teams.forEach(function (t) { if (t.owner) teamOf[t.owner] = t; });
    var items = [], miss = [];
    players.forEach(function (x) { var t = teamOf[x.from], hit = t && t.players.filter(function (q) { return (x.p.id && q.id === x.p.id) || norm_(q.n) === norm_(x.p.n); })[0];
      if (!hit || !teamOf[x.to]) miss.push(x.p.n); else items.push({ playerId: hit.id, type: "TRADE", fromTeamId: t.id, toTeamId: teamOf[x.to].id, n: hit.n }); });
    if (miss.length) return { espn: "todo", note: "Not on the test team (re-mirror): " + miss.join(", ") };
    var res = espnPost_("trade", r.offer_id, lmTrade_(items[0].fromTeamId, tl.sp, items.map(function (i) { return { playerId: i.playerId, type: "TRADE", fromTeamId: i.fromTeamId, toTeamId: i.toTeamId }; }), "SPL HQ " + r.offer_id), me.owner);
    var back = testLeague_(), on = {}; back.teams.forEach(function (t) { t.players.forEach(function (q) { on[q.id] = t.id; }); });
    var moved = items.filter(function (i) { return on[i.playerId] === i.toTeamId; });
    if (moved.length === items.length) return { espn: "done", note: "Moved on ESPN test league " + WRITE_LEAGUE };
    return { espn: "todo", note: (res.ok ? "ESPN took it but " : "ESPN said " + res.code + (res.msg ? " (" + res.msg + ")" : "") + ": ") + (items.length - moved.length) + " of " + items.length + " players not moved. Check ESPN (a proposal may be pending) before doing it by hand." };
  } catch (e) { return { espn: "todo", note: "ESPN write failed: " + String(e.message || e).slice(0, 140) }; }
}
function espnSwitch_(me, b) { setProp_("ESPN_WRITES", b.on ? "on" : "off"); CacheService.getScriptCache().remove("health"); log_("espnwrites", me.owner + " " + (b.on ? "on" : "off")); return { ok: true, writes: writesOn_() }; }

// ---------------------------------------------------------------- 🗓️ Off-season drafts (WS3). One turn-based engine, one config per draft:
//   div  · Divisional Draft (constitution §E): 4 founders (order from last season) snake 1-2-3-4-4-3-2-1 to fill 4 divisions of 3.
//          A pick puts an unplaced owner into your own division, or assigns him to another founder's division (max one
//          assigned-in per division). If your division is already full you must assign; the one-assigned cap gives way only
//          when no legal move is left.
//   slot · Slot Draft (§F): all 12 owners in slot-draft order each claim an SPL Draft slot 1–12 (the SPL Draft is a snake).
// Coming next on the same engine: spl (the SPL Draft room) and shootout (Week 14 opponents).
// mode "test" = rehearsal (anyone can watch, ops can wipe, robot writes data/test/); "live" = the real thing for that season.
// The on-the-clock owner picks; a commish (Joe or Mike) can enter a pick for him (recorded as "by"). Commish can undo the last pick.
var DRAFT_KINDS = { div: { name: "Divisional Draft", n: 4 }, slot: { name: "Slot Draft", n: 12 } };
function turns_(kind, order) { return kind === "div" ? order.concat(order.slice().reverse()) : order.slice(); }
function draftRows_() { return rows_("Drafts").map(function (d) { d.orderA = parseJ_(d.order); if (!Array.isArray(d.orderA)) d.orderA = []; return d; }); }
function draftState_(d, sel) {
  var picks = sel.filter(function (p) { return p.draft_id === d.draft_id; }).map(function (p) { return { n: Number(p.n), owner: p.owner, choice: parseJ_(p.choice), ts: p.ts, by: p.by }; })
    .sort(function (a, b) { return a.n - b.n; });
  var turns = turns_(d.kind, d.orderA), s = { id: d.draft_id, kind: d.kind, name: (DRAFT_KINDS[d.kind] || {}).name || d.kind, season: Number(d.season), mode: d.mode,
    status: d.status, order: d.orderA, turns: turns, picks: picks, ts: d.ts, by: d.by, updated: d.updated_ts };
  s.clock = s.status === "open" ? turns[picks.length] || null : null;
  if (d.kind === "div") { s.divs = {}; s.assigned = {}; d.orderA.forEach(function (f) { s.divs[f] = [f]; s.assigned[f] = 0; });
    picks.forEach(function (p) { if (s.divs[p.choice.into]) { s.divs[p.choice.into].push(p.choice.pick); if (p.choice.into !== p.owner) s.assigned[p.choice.into]++; } }); }
  if (d.kind === "slot") { s.slots = {}; picks.forEach(function (p) { s.slots[p.choice.slot] = p.owner; }); }
  return s;
}
function drafts_(me) {
  var sel = rows_("DraftPicks");
  return { ok: true, kinds: DRAFT_KINDS, drafts: draftRows_().filter(function (d) { return d.status !== "cancelled"; }).map(function (d) { return draftState_(d, sel); }).reverse().slice(0, 12) };
}
function findDraft_(id) { var all = draftRows_(), i = -1; all.forEach(function (d, k) { if (d.draft_id === id) i = k; }); return i < 0 ? null : { row: all[i], idx: i }; }
function draftOpen_(me, b) {
  var kind = String(b.kind || ""), K = DRAFT_KINDS[kind]; if (!K) return { ok: false, error: "Unknown draft" };
  var mode = b.mode === "live" ? "live" : "test", season = Number(b.season) || SEASON + 1, order = Array.isArray(b.order) ? b.order.map(String) : [];
  if (order.length !== K.n || order.some(function (id, i) { return !oid_(id) || order.indexOf(id) !== i; })) return { ok: false, error: K.name + " needs " + K.n + " different owners in order." };
  if (draftRows_().some(function (d) { return d.kind === kind && d.mode === mode && Number(d.season) === season && (d.status === "open" || (mode === "live" && d.status === "done")); }))
    return { ok: false, error: "There's already " + (mode === "live" ? "a " : "a rehearsal ") + season + " " + K.name + " " + (mode === "live" ? "(cancel it first)" : "open") + "." };
  var id = "D" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), now = new Date();
  append_("Drafts", [id, now, kind, season, mode, "open", JSON.stringify(order), clip_(b.note, 200), me.owner, now]);
  var first = order[0];
  botPost_("league", "🗓️ " + (mode === "test" ? "🧪 Rehearsal: " : "") + "The " + season + " " + K.name + " is open! First up: " + oName_(first) + ". Draft room: SPL HQ → League → Off-season.", id);
  onClock_(first, K.name, season, mode, id);
  log_("draftopen", id + " " + kind + " " + mode + " " + season + " by " + me.owner);
  return { ok: true, id: id };
}
function onClock_(who, name, season, mode, id) {
  notify_(who, "draft", "You're on the clock: " + season + " " + name + (mode === "test" ? " (rehearsal)" : ""), "It's your pick in the " + season + " " + name + ".\n\nDraft room: " + APP_URL + "#droom=" + id);
}
// Is this choice legal for the turn? Returns an error string or "".
function draftCheck_(s, who, c) {
  if (s.kind === "slot") { var k = Number(c.slot); if (!(k >= 1 && k <= 12) || k !== Math.floor(k)) return "Pick a slot from 1 to 12."; if (s.slots[k]) return "Slot " + k + " is taken (" + oName_(s.slots[k]) + ")."; return ""; }
  var placed = {}; Object.keys(s.divs).forEach(function (f) { s.divs[f].forEach(function (x) { placed[x] = f; }); });
  if (!oid_(c.pick)) return "Pick an owner."; if (placed[c.pick]) return oName_(c.pick) + " is already in " + oName_(placed[c.pick]) + "'s division.";
  if (!s.divs[c.into]) return "Pick a division."; if (s.divs[c.into].length >= 3) return oName_(c.into) + "'s division is full.";
  if (c.into === who) return "";
  var ownOpen = s.divs[who].length < 3, other = Object.keys(s.divs).some(function (f) { return f !== who && s.divs[f].length < 3 && s.assigned[f] < 1; });
  if (s.assigned[c.into] >= 1 && (ownOpen || other)) return oName_(c.into) + " already has an owner assigned to his division (one each).";
  return "";
}
function choiceText_(s, who, c) { return s.kind === "slot" ? "takes slot " + c.slot : c.into === who ? "takes " + oName_(c.pick) + " into his division" : "assigns " + oName_(c.pick) + " to " + oName_(c.into) + "'s division"; }
function draftPick_(me, b, desk) {
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var s = draftState_(f.row, rows_("DraftPicks")); if (s.status !== "open") return { ok: false, error: "This draft is " + s.status + "." };
  if (b.n != null && Number(b.n) !== s.picks.length + 1) return { ok: false, error: "That pick was already made. Refreshing." , stale: true };
  var who = s.clock; if (who !== me.owner && !desk) return { ok: false, error: oName_(who) + " is on the clock." };
  var c = s.kind === "slot" ? { slot: Number((b.choice || {}).slot) } : { pick: String((b.choice || {}).pick || ""), into: String((b.choice || {}).into || "") };
  var err = draftCheck_(s, who, c); if (err) return { ok: false, error: err };
  var n = s.picks.length + 1, now = new Date();
  append_("DraftPicks", [s.id, n, who, JSON.stringify(c), now, me.owner, ""]);
  var done = n === s.turns.length, nxt = s.turns[n];
  botPost_("league", "🗓️ " + (s.mode === "test" ? "🧪 " : "") + s.name + " · pick " + n + ": " + oName_(who) + " " + choiceText_(s, who, c) + (me.owner !== who ? " (entered by " + me.name + ")" : "") +
    (done ? "" : ". On the clock: " + oName_(nxt) + "."), s.id);
  if (done) { var r = f.row; r.status = "done"; r.updated_ts = now; delete r.orderA; setRow_("Drafts", f.idx, r); botPost_("league", "🏁 " + (s.mode === "test" ? "🧪 Rehearsal " : "") + s.season + " " + s.name + " is done. Results: SPL HQ → League → Off-season.", s.id); }
  else { var r2 = f.row; r2.updated_ts = now; delete r2.orderA; setRow_("Drafts", f.idx, r2); onClock_(nxt, s.name, s.season, s.mode, s.id); }
  log_("draftpick", s.id + " #" + n + " " + who + " " + JSON.stringify(c) + " by " + me.owner);
  return { ok: true, draft: draftState_(findDraft_(s.id).row, rows_("DraftPicks")) };
}
function draftUndo_(me, b) { // commish: take back the last pick (reopens a finished draft)
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var sel = rows_("DraftPicks"), last = -1; sel.forEach(function (p, i) { if (p.draft_id === f.row.draft_id && (last < 0 || Number(p.n) > Number(sel[last].n))) last = i; });
  if (last < 0) return { ok: false, error: "No picks to undo." };
  if (f.row.status === "cancelled") return { ok: false, error: "This draft was cancelled." };
  var p = sel[last]; sheet_("DraftPicks").deleteRow(last + 2);
  var r = f.row; r.status = "open"; r.updated_ts = new Date(); delete r.orderA; setRow_("Drafts", f.idx, r);
  botPost_("league", "↩️ " + (r.mode === "test" ? "🧪 " : "") + (DRAFT_KINDS[r.kind] || {}).name + ": pick " + p.n + " (" + oName_(p.owner) + ") taken back by " + me.name + ". " + oName_(p.owner) + " is on the clock again.", r.draft_id);
  log_("draftundo", r.draft_id + " #" + p.n + " by " + me.owner);
  return { ok: true };
}
function draftCancel_(me, b) {
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var r = f.row; if (r.status === "cancelled") return { ok: true };
  r.status = "cancelled"; r.updated_ts = new Date(); delete r.orderA; setRow_("Drafts", f.idx, r);
  botPost_("league", "🗓️ " + (r.mode === "test" ? "🧪 Rehearsal " : "") + r.season + " " + (DRAFT_KINDS[r.kind] || {}).name + " cancelled by " + me.name + ".", r.draft_id);
  log_("draftcancel", r.draft_id + " by " + me.owner); return { ok: true };
}
function draftWipe_(me) { // ops: clear every rehearsal (cancelled = hidden; picks stay in the Sheet for the record)
  var n = 0; draftRows_().forEach(function (r, i) { if (r.mode === "test" && r.status !== "cancelled") { r.status = "cancelled"; r.updated_ts = new Date(); delete r.orderA; setRow_("Drafts", i, r); n++; } });
  log_("draftwipe", n + " by " + me.owner); return { ok: true, cleared: n };
}
function draftLedger_() { // finished drafts for the robot (league facts only)
  var sel = rows_("DraftPicks");
  return draftRows_().filter(function (d) { return d.status === "done"; }).map(function (d) { var s = draftState_(d, sel);
    return { id: s.id, kind: s.kind, season: s.season, mode: s.mode, done: s.updated, order: s.order, picks: s.picks.map(function (p) { return { n: p.n, owner: p.owner, choice: p.choice, by: p.by }; }), divs: s.divs || null, slots: s.slots || null }; });
}

// ---------------------------------------------------------------- Health (uptime monitor keyword: "healthy":true)
function health_(fresh) {
  var c = CacheService.getScriptCache(), hit = fresh ? null : c.get("health"); if (hit) return JSON.parse(hit);
  var out = { ok: true, version: VERSION, season: SEASON, at: new Date().toISOString(), sheet: false, mailLeft: null, espnWrites: false };
  try { var ss = SpreadsheetApp.getActive(); out.sheet = !!ss; out.sheetName = ss.getName(); out.tabs = ss.getSheets().map(function (s) { return s.getName(); }); } catch (e) { out.sheetError = String(e); }
  try { out.mailLeft = MailApp.getRemainingDailyQuota(); } catch (e) {}
  try { out.espnWrites = writesOn_(); } catch (e) {}
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
