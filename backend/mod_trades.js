/**
 * SPL HQ — backend part mod_trades.js (trade center: players + picks + keeper contracts).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB. Pattern: MAFFL _ops/apps-script/logic.js parts_ (WS6).
 */

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
      fromSends: o.giveO, toSends: o.getO, by: o.by }; }), drafts: draftLedger_(), keepers: keepLedger_() };
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
    offers: mine.map(function (r) { var o = pub_offer_(r); if (desk && r.status === "ACCEPTED") o.lock = deskLock_(me, r); return o; }).reverse().slice(0, 80), moves: moves, block: block_() };
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
  var ss = SpreadsheetApp.getActive(); ["Offers", "Picks"].forEach(function (n) { var sh = ss.getSheetByName(n); if (sh) ss.deleteSheet(sh); delete SH_[n]; dirty_(n); });
  seedPicks_(); log_("wipetrades", me.owner); return { ok: true };
}

// ---------------------------------------------------------------- 🏷️ Trade block (Mike 11/28)
// An owner flags players he'd move, with an optional "looking for" note. The league sees every block on the Trades page, the
// roster pages and the trade grid; putting someone on posts one line to league chat. Rows are kept (on = Y/N) so re-listing
// updates the same row. Not gated by the trade deadline yet (test mode, Mike 11/28): BLOCK_DEADLINE gates it once live.
var BLOCK_DEADLINE = false;
function block_() {
  return rows_("Block").filter(function (r) { return r.on === "Y"; }).map(function (r) {
    return { owner: r.owner, n: r.player, pos: r.pos, tm: r.tm, note: r.note, at: r.updated_ts || r.ts }; });
}
function blockSet_(me, b) {
  var name = clip_(b.player, 60), on = !!b.on; if (!name) return { ok: false, error: "Which player?" };
  var all = rows_("Block"), idx = -1; all.forEach(function (r, i) { if (r.owner === me.owner && String(r.player).toLowerCase() === name.toLowerCase()) idx = i; });
  var now = new Date();
  if (!on) { if (idx >= 0) { var x = all[idx]; x.on = "N"; x.updated_ts = now; setRow_("Block", idx, x); } log_("block", me.owner + " - " + name); return { ok: true, block: block_() }; }
  var p = (rosterOf_(me.owner) || []).filter(function (x) { return String(x.n).toLowerCase() === name.toLowerCase(); })[0];
  if (!p) return { ok: false, error: name + " isn't on your ESPN roster." };
  var note = clip_(b.note, 140), was = idx >= 0 && all[idx].on === "Y";
  if (idx >= 0) { var r = all[idx]; r.on = "Y"; r.note = note; r.pos = p.pos; r.tm = p.tm; r.updated_ts = now; setRow_("Block", idx, r); }
  else append_("Block", [me.owner, p.n, p.pos, p.tm, note, "Y", now, now]);
  if (!was) botPost_("league", "🏷️ " + (TRADE_MODE === "test" ? "🧪 " : "") + me.name + " put " + p.n + " (" + p.pos + ", " + p.tm + ") on the trade block" + (note ? ": “" + note + "”" : "") + ". SPL HQ → Team → Trades.", "block:" + me.owner);
  log_("block", me.owner + " + " + p.n);
  return { ok: true, block: block_() };
}
