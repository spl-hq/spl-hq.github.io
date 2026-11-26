/**
 * SPL HQ — backend LOGIC (core). Loaded at runtime by the stable loader (backend/Code.gs) from GitHub main.
 * Ship a backend change = edit this file + bump VERSION + push to main. Live within ~5 minutes, no redeploy.
 * Plan: docs/SPL_REEL_PLAN.md · rules: CLAUDE.md · ops: docs/OPS_RUNBOOK.md
 *
 * Contract with the loader: this file runs as the body of `function (M) { ... }` and must export doGet, doPost,
 * menuCheck and tick on M (bottom). Keep it and every backend/mod_*.js part under ~90 KB (CacheService limit; see parts_).
 * Rules: no secrets in the repo (cookies live in Script properties); every Sheet write is formula-guarded;
 * ESPN writes only ever go to WRITE_LEAGUE.
 */
var VERSION = "0.12.0";
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
    if (p.action === "health") { var hh = health_(p.fresh === "1"); maybeTick_(); return json(hh); } // no tick trigger yet? the health pings drive it (mod_ops)
    if (p.action === "standings") return json(standings_());
    if (p.action === "ledger") return json(ledger_());
    return json({ ok: true, app: "SPL HQ", version: VERSION });
  } catch (err) { return json({ ok: false, error: String(err && err.message || err) }); }
}

// Body is sent as text/plain JSON (avoids a CORS preflight from GitHub Pages).
// Sign-in: {action:"login", pin} → device token. Every other POST carries {token}.
var READS = { testleague: 1, me: 1, desk: 1, week: 1, rosters: 1, chat: 1, trades: 1, settings: 1, contacts: 1, drafts: 1, reacts: 1, social: 1, opsx: 1 }; // never wait on the script lock (opsx takes it itself when it runs the tick)
var WRITES = { pickfix: 1, answers: 1, feedback: 1, chatsend: 1, chatdel: 1, issue: 1, offer: 1, respond: 1, tradeact: 1, savesettings: 1, draftpick: 1, draftopen: 1, react: 1, vote: 1 }; // rate-limited per owner
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
      case "social":   return json(social_(me, b));
      case "vote":     return json(vote_(me, b));
      case "draftpick": return json(draftPick_(me, b, desk));
      case "draftopen": return json(desk ? draftOpen_(me, b) : { ok: false, error: "Commish only" });
      case "draftundo": return json(desk ? draftUndo_(me, b) : { ok: false, error: "Commish only" });
      case "draftcancel": return json(desk ? draftCancel_(me, b) : { ok: false, error: "Commish only" });
      case "draftwipe": return json(isRole_(me, "ops") ? draftWipe_(me) : { ok: false, error: "Ops only" });
      case "testleague": return json(isRole_(me, "ops") ? testDesk_() : { ok: false, error: "Ops only" });
      case "mirror":   return json(isRole_(me, "ops") ? mirror_(me, b) : { ok: false, error: "Ops only" });
      case "espnwrites": return json(isRole_(me, "ops") ? espnSwitch_(me, b) : { ok: false, error: "Ops only" });
      case "wipetrades": return json(isRole_(me, "ops") ? wipeTrades_(me) : { ok: false, error: "Ops only" });
      case "opsx":     return json(isRole_(me, "ops") ? opsx_(me, b) : { ok: false, error: "Ops only" });
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
  EspnLog:  ["ts", "by", "kind", "ref", "items", "code", "msg"],
  Votes:     ["ts", "ref", "owner", "choice"]
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
function tick() { ops_tick_("trigger"); } // hourly Apps Script trigger (runbook §4b): watchdog, backup, checks, alerts (mod_ops)

// ---------------------------------------------------------------- parts: the rest of the backend, in this same scope
// logic.js is the CORE (config, routing, Sheet helpers, sign-in, questions, health). The other parts live next to it as
// backend/mod_*.js and are evaluated HERE, inside this function scope, so every function stays callable by plain name across
// files. Why: Apps Script caches a file only under ~95 KB and logic.js had reached 83 KB (MAFFL hit the same wall at 91 KB;
// this is its pattern, WS6). Each part is cached 5 min under VERSION (bump VERSION when you change any part) with a 6-hour
// last-good copy; a part that won't compile is skipped for its last good copy and ops is emailed (once an hour).
var REPO = "spl-hq/spl-hq.github.io";
var PARTS = ["mod_espn", "mod_social", "mod_trades", "mod_drafts", "mod_ops"];
function compiles_(src) { try { new Function(src); return true; } catch (e) { return false; } }
function badPush_(name, r) {
  if (!r || r.getResponseCode() !== 200) return; var c = CacheService.getScriptCache(); if (c.get("badpush_" + name)) return; c.put("badpush_" + name, "1", 3600);
  mail_("SPL HQ: backend/" + name + ".js on main doesn't compile", "The backend is running the last good copy of " + name + ".js (kept 6 hours). Revert or fix the last push to backend/" + name + ".js.");
}
function parts_() {
  var c = CacheService.getScriptCache(), out = [];
  PARTS.forEach(function (p) {
    var k = "part_" + p + "@" + VERSION, src = c.get(k);
    if (!src) {
      var r = null; try { r = UrlFetchApp.fetch("https://raw.githubusercontent.com/" + REPO + "/main/backend/" + p + ".js?t=" + Date.now(), { muteHttpExceptions: true }); } catch (e) {}
      if (r && r.getResponseCode() === 200 && compiles_(r.getContentText())) { src = r.getContentText(); if (src.length < 95000) { c.put(k, src, 300); c.put("part_last_" + p, src, 21600); } }
      else { src = c.get("part_last_" + p); if (!src) throw new Error("Couldn't load " + p + ".js (" + (r ? r.getResponseCode() : "network") + ")"); badPush_(p, r); }
    }
    out.push(src);
  });
  return out.join("\n;\n");
}
eval(parts_()); // direct eval at the top level of this scope: the parts' functions and vars join it

// ---------------------------------------------------------------- exports for the loader
M.VERSION = VERSION; M.doGet = doGet; M.doPost = doPost; M.menuCheck = menuCheck; M.tick = tick;
