/**
 * SPL HQ — backend part mod_social.js (chat, reactions, votes, settings, contacts, owner emails).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB. Pattern: MAFFL _ops/apps-script/logic.js parts_ (WS6).
 */

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
// 🔥 Reel reactions (WS4): one tap per owner per emoji per shared card; tap again to take it back. Keys come from the app
// (season-week:card id), never shown raw. Each series has its own tray (MAFFL REEL); this is every emoji any tray uses.
var REACTS = ["🔥", "😂", "😬", "👏", "💀", "🐐", "😱", "🥱", "🤡", "🏆", "🧠", "🤯", "👀", "💸", "🤑", "📈", "😤", "🙏", "🥶", "🫡"];
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
// 🗳️ Votes (Game of the Week, quizzes, polls): one per owner per ref, locked once cast (MAFFL commish 11/7). Results only
// come back to an owner who has voted, or once the vote has closed. Game of the Week closes Thursday 5 PM ET of that week.
var WEEK1_TUE = Date.UTC(2026, 8, 15, 12); // Tuesday after NFL Week 1 (2026), 7 AM ET: the Edition drop
function closesAt_(ref) { var m = /^gotw:(\d{4})-(\d+)$/.exec(ref); return m ? WEEK1_TUE + (Number(m[2]) - 1) * 7 * 864e5 + 58 * 3600e3 : 0; }
function social_(me, b) {
  var out = { ok: true, reacts: b.keys ? reacts_(b.keys).reacts : {}, votes: {}, emojis: REACTS };
  var want = {}; (Array.isArray(b.refs) ? b.refs : []).slice(0, 40).forEach(function (k) { k = reactKey_(k); if (k) want[k] = 1; });
  if (!Object.keys(want).length) return out;
  var all = {}; rows_("Votes").forEach(function (r) { var k = String(r.ref); if (!want[k]) return; (all[k] = all[k] || []).push(r); });
  Object.keys(want).forEach(function (k) { var list = all[k] || [], mine = list.filter(function (r) { return String(r.owner) === me.owner; })[0], c = closesAt_(k), closed = c && Date.now() > c;
    var v = out.votes[k] = { mine: mine ? String(mine.choice) : "", total: list.length, closes: c ? new Date(c).toISOString() : "", closed: !!closed };
    if (mine || closed) { v.counts = {}; list.forEach(function (r) { v.counts[r.choice] = (v.counts[r.choice] || 0) + 1; }); } });
  return out;
}
function vote_(me, b) {
  var k = reactKey_(b.ref), choice = clip_(b.choice, 60).trim(); if (!k || !choice) return { ok: false, error: "Unknown vote" };
  var c = closesAt_(k); if (c && Date.now() > c) return { ok: false, error: "Voting has closed." };
  if (rows_("Votes").some(function (r) { return String(r.ref) === k && String(r.owner) === me.owner; })) return { ok: false, error: "Your vote is in. Votes can't be changed." };
  append_("Votes", [new Date(), k, me.owner, choice]);
  return social_(me, { refs: [k] });
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
