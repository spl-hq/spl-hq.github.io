/**
 * SPL HQ — backend part mod_trades.js (trade center: players + picks + keeper contracts).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB. Pattern: MAFFL _ops/apps-script/logic.js parts_ (WS6).
 */

// ---------------------------------------------------------------- 🔁 Trade center: players + draft picks + keeper contracts
// Flow: PROPOSED → (to) ACCEPTED / DECLINED · (from) WITHDRAWN. ACCEPTED = on the trade wire for review (rulebook D, Mike 11/28):
// 24 h in season, 72 h off-season. Owners not in the trade can veto; 6 vetoes → VETOED. Review over → APPROVED and processed by itself
// (tradeTick_). The commish steps in only if needed: approve early or negate (with a reason). A counter declines the original.
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
      fromSends: o.giveO, toSends: o.getO, by: o.by, drops: parseJ_(o.drops) }; }), drafts: draftLedger_(), keepers: keepLedger_(), votes: voteLedger_() };
}
function offers_() { return rows_("Offers").map(function (r) { r.giveO = parseJ_(r.give); r.getO = parseJ_(r.get); return r; }); }
function parseJ_(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }
function pub_offer_(r) { var o = pub_offer0_(r);
  o.drops = parseJ_(r.drops); o.drops.from = o.drops.from || []; o.drops.to = o.drops.to || [];
  if (r.status === "ACCEPTED") { o.reviewEnds = new Date(reviewEnds_(r)).toISOString(); o.vetoes = vetoesOf_(r.offer_id); o.vetoNeed = VETO_KILL; o.challenged = !!r.challenge_ts; o.hold = holdOf_(r); }
  if (r.status === "VETOED") o.vetoes = vetoesOf_(r.offer_id);
  return o; }
function pub_offer0_(r) { return { id: r.offer_id, ts: r.ts, from: r.from, to: r.to, give: r.giveO, get: r.getO, note: r.note, status: r.status, updated: r.updated_ts, reason: r.reason, by: r.by, mode: r.mode, espn: r.espn, espnNote: r.espn_note, counterOf: r.counter_of }; }
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
  tradeTick_();
  var picks = seedPicks_(), all = offers_(), desk = isRole_(me, "commish") || isRole_(me, "ops");
  var mine = all.filter(function (r) { return r.from === me.owner || r.to === me.owner || (desk && r.status === "ACCEPTED") || r.status === "APPROVED" || r.status === "ACCEPTED" || r.status === "VETOED"; });
  // contracts follow their player through approved trades
  var moves = []; all.filter(function (r) { return r.status === "APPROVED"; }).forEach(function (r) {
    (r.giveO.players || []).forEach(function (p) { moves.push({ player: p.n, to: r.to, at: r.updated_ts }); });
    (r.getO.players || []).forEach(function (p) { moves.push({ player: p.n, to: r.from, at: r.updated_ts }); }); });
  var rl = rules_();
  return { ok: true, mode: TRADE_MODE, rosterMax: ROSTER_MAX, reviewH: reviewH_(), vetoKill: VETO_KILL, seasons: rl.pickSeasons, rounds: PICK_ROUNDS, rules: rl,
    picks: picks.map(function (p) { return { pid: p.pid, season: Number(p.season), round: Number(p.round), original: p.original, owner: p.owner, via: p.via }; }),
    offers: mine.map(function (r) { var o = pub_offer_(r); if (desk && r.status === "ACCEPTED") o.lock = deskLock_(me, r); return o; }).reverse().slice(0, 80), moves: moves, block: block_() };
}
function offer_(me, b) {
  var to = String(b.to || ""); if (!oid_(to) || to === me.owner) return { ok: false, error: "Pick a team to trade with." };
  var give = cleanSide_(b.give), get = cleanSide_(b.get);
  if (!(give.players.length + give.picks.length) || !(get.players.length + get.picks.length)) return { ok: false, error: "Both sides need at least one player or pick." };
  var picks = seedPicks_(), e1 = checkSide_(me.owner, give, picks) || checkSide_(to, get, picks); if (e1) return { ok: false, error: e1 };
  var dropsFrom = cleanDrops_(b.drops), e2 = rosterRoom_(me.owner, give.players, get.players, dropsFrom); if (e2) return { ok: false, error: e2, needDrops: true };
  var all = offers_(), sig = JSON.stringify([me.owner, to, give, get]);
  var dup = all.filter(function (r) { return r.status === "PROPOSED" && JSON.stringify([r.from, r.to, r.giveO, r.getO]) === sig; })[0];
  if (dup) return { ok: true, offer: pub_offer_(dup), dup: true };
  var id = "T" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), now = new Date();
  if (b.counterOf) { var oi = -1; all.forEach(function (r, i) { if (r.offer_id === b.counterOf && r.status === "PROPOSED" && r.to === me.owner) oi = i; });
    if (oi >= 0) { var o = all[oi]; o.status = "DECLINED"; o.reason = "Countered"; o.updated_ts = now; o.by = me.owner; setRow_("Offers", oi, o); } }
  append_("Offers", [id, now, me.owner, to, JSON.stringify(give), JSON.stringify(get), clip_(b.note, 300), "PROPOSED", now, "", me.owner, TRADE_MODE, "", clip_(b.counterOf, 20), "", "", JSON.stringify({ from: dropsFrom, to: [] }), ""]);
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
    var dr = parseJ_(r.drops), dropsTo = cleanDrops_(b.drops), e2 = rosterRoom_(r.to, r.getO.players, r.giveO.players, dropsTo); if (e2) return { ok: false, error: e2, needDrops: true };
    r.drops = JSON.stringify({ from: dr.from || [], to: dropsTo });
    r.status = "ACCEPTED"; r.review_ends = new Date(now.getTime() + reviewH_() * 36e5);
  } else return { ok: false, error: "Unknown answer" };
  r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  var o = findOffer_(b.id).row, room = dmRoom_(o.from, o.to);
  var ends = o.review_ends ? whenTxt_(o.review_ends) : "";
  botPost_(room, { accept: "✅ " + me.name + " accepted. It's on the trade wire for review until " + ends + " ET, then it goes through.", decline: "❌ " + me.name + " declined" + (o.reason ? ": “" + o.reason + "”" : "."), withdraw: "↩️ " + me.name + " withdrew the offer." }[d], o.offer_id);
  if (d === "accept") {
    botPost_("league", "🤝 On the trade wire: " + oName_(o.from) + " sends " + sideText_(o.giveO) + " · " + oName_(o.to) + " sends " + sideText_(o.getO) + dropText_(o) +
      ". It goes through " + ends + " ET unless " + VETO_KILL + " owners veto it (Team → Trades).", o.offer_id);
    mail_("SPL HQ · trade on the wire", oName_(o.from) + " sends " + sideText_(o.giveO) + "\n" + oName_(o.to) + " sends " + sideText_(o.getO) + "\n\nReview ends " + ends + " ET. " + APP_URL + "#trades");
  }
  if (d === "accept" || d === "decline") notify_(o.from, d === "accept" ? "accepted" : "declined", me.name + (d === "accept" ? " accepted your trade" : " declined your offer"),
    "You send " + sideText_(o.giveO) + "\n" + me.name + " sends " + sideText_(o.getO) + (d === "accept" ? "\n\nIt's on the trade wire until " + ends + " ET, then it goes through unless " + VETO_KILL + " owners veto it." : (o.reason ? "\n\n“" + o.reason + "”" : "")));
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
  if (d === "negate") { if (!String(b.reason || "").trim()) return { ok: false, error: "Give a reason for the league." };
    r.status = "NEGATED"; r.reason = clip_(b.reason, 200); r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
    var nt = "🚫 Trade negated by the commish: “" + r.reason + "”"; botPost_("league", nt, r.offer_id); botPost_(dmRoom_(r.from, r.to), nt, r.offer_id);
    [r.from, r.to].forEach(function (id) { notify_(id, "commish", "Trade negated", nt); }); log_("trade_negate", r.offer_id + " by " + me.owner); return { ok: true };
  }
  if (d !== "approve") return { ok: false, error: "Unknown decision" };
  var res = approveTrade_(f, me, bothDesk ? " (commish-to-commish trade, approved by " + me.name + ")" : " (approved early by " + me.name + ")");
  return res.ok ? { ok: true } : res;
}
// Process a trade: picks move, contracts travel (they follow the APPROVED row), ESPN gets the players + drops, the league is told.
// `me` = the commish who approved early, or { owner: "review", name: "the review" } from tradeTick_.
function approveTrade_(f, me, how) {
  var r = f.row, now = new Date(), picks = seedPicks_(), err = checkSide_(r.from, r.giveO, picks) || checkSide_(r.to, r.getO, picks);
  if (err) return { ok: false, error: "Can't approve: " + err };
  var move = function (pid, to) { picks.forEach(function (p, i) { if (p.pid === pid) { p.owner = to; p.updated_ts = now; p.via = r.offer_id; setRow_("Picks", i, p); } }); };
  (r.giveO.picks || []).forEach(function (pid) { move(pid, r.to); }); (r.getO.picks || []).forEach(function (pid) { move(pid, r.from); });
  r.status = "APPROVED"; var ew = espnTrade_(r, me); r.espn = ew.espn; r.espn_note = clip_(ew.note, 300);
  var gi = r.giveO, ge = r.getO; r.updated_ts = now; r.by = me.owner; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  var txt = "✅ Trade done" + (how || "") + ": " + oName_(r.from) + " gets " + sideText_(ge) + " · " + oName_(r.to) + " gets " + sideText_(gi) + dropText_(r);
  if (r.espn === "done") txt += " · 🏈 done on ESPN" + (r.mode === "test" ? " (test league)" : "");
  botPost_("league", txt, r.offer_id); botPost_(dmRoom_(r.from, r.to), txt, r.offer_id);
  [r.from, r.to].forEach(function (id) { notify_(id, "commish", "Trade done", txt); });
  log_("trade_approve", r.offer_id + " by " + me.owner);
  return { ok: true };
}

// ---------------------------------------------------------------- ⏳ Trade review + 🚫 vetoes (rulebook D, Mike 11/28)
// In season: 24 h on the wire, 6 vetoes from owners not in the trade kill it. Off-season: final after 72 h unless an owner
// challenges; a challenge (the first veto) keeps the vote open at least 24 h. Vetoes are public (names on the trade) and can be taken back
// while the review runs. Hourly tick + every trades/desk read process trades whose review is over.
var REVIEW_H = { season: 24, offseason: 72 }, VETO_KILL = 6, CHALLENGE_MIN_H = 24, ROSTER_MAX = 17; // 17 = 10 starters + 7 bench (IR not counted)
function reviewH_() { return phase_().phase === "offseason" ? REVIEW_H.offseason : REVIEW_H.season; }
function reviewEnds_(r) { return r.review_ends ? new Date(r.review_ends).getTime() : new Date(r.updated_ts || r.ts).getTime() + REVIEW_H.season * 36e5; }
function whenTxt_(d) { return Utilities.formatDate(new Date(d), "America/New_York", "EEE MMM d, h:mm a"); }
function vetoesOf_(id) { var bl = ballots_("trade:" + id); return Object.keys(bl).filter(function (o) { return bl[o].choice === "veto"; }); }
function holdOf_(r) { return /^HOLD:/.test(String(r.espn_note || "")) ? String(r.espn_note).slice(5) : ""; }
function tradeVeto_(me, b) {
  var f = findOffer_(String(b.id || "")); if (!f) return { ok: false, error: "Trade not found" };
  var r = f.row, now = new Date();
  if (r.status !== "ACCEPTED") return { ok: false, error: "That trade isn't in review any more." };
  if (r.from === me.owner || r.to === me.owner) return { ok: false, error: "You're in this trade." };
  if (now.getTime() >= reviewEnds_(r)) return { ok: false, error: "The review is over." };
  var on = !!b.on, had = vetoesOf_(r.offer_id).indexOf(me.owner) >= 0; if (on === had) return { ok: true, vetoes: vetoesOf_(r.offer_id) };
  ballot_("trade:" + r.offer_id, me.owner, on ? "veto" : "off");
  var v = vetoesOf_(r.offer_id), deal = oName_(r.from) + " ⇄ " + oName_(r.to);
  if (on && !r.challenge_ts) { // the first veto opens the vote: the league hears about it
    r.challenge_ts = now; var min = now.getTime() + CHALLENGE_MIN_H * 36e5; if (phase_().phase === "offseason" && reviewEnds_(r) < min) r.review_ends = new Date(min);
    delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r); f = findOffer_(r.offer_id); r = f.row;
    botPost_("league", "🚫 Veto vote on the " + deal + " trade: " + me.name + " wants it vetoed. " + VETO_KILL + " vetoes kill it; vote by " + whenTxt_(reviewEnds_(r)) + " ET in Team → Trades.", r.offer_id);
    [r.from, r.to].forEach(function (id) { notify_(id, "commish", "Veto vote on your trade", me.name + " started a veto vote on your trade with " + oName_(id === r.from ? r.to : r.from) + ". " + VETO_KILL + " vetoes kill it."); });
  }
  if (v.length >= VETO_KILL) {
    r.status = "VETOED"; r.reason = v.length + " vetoes: " + v.map(oName_).join(", "); r.updated_ts = now; r.by = "league"; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
    var t = "🚫 Trade vetoed by the league (" + v.length + " vetoes): " + deal + ". Nothing moves.";
    botPost_("league", t, r.offer_id); botPost_(dmRoom_(r.from, r.to), t, r.offer_id); [r.from, r.to].forEach(function (id) { notify_(id, "commish", "Trade vetoed", t); });
  }
  log_("veto", r.offer_id + " " + me.owner + " " + (on ? "on" : "off") + " = " + v.length);
  return { ok: true, vetoes: v, status: v.length >= VETO_KILL ? "VETOED" : "ACCEPTED" };
}
// Review over → process. If a side is now over the roster limit (a pickup since), the trade holds until that owner picks a drop (tradeDrops_).
function tradeTick_() {
  var lock = LockService.getScriptLock(); if (lock.tryLock && !lock.tryLock(2000)) return 0;
  var n = 0, review = { owner: "review", name: "the review" };
  try {
    offers_().forEach(function (r, i) {
      if (r.status !== "ACCEPTED" || Date.now() < reviewEnds_(r)) return;
      var dr = parseJ_(r.drops), hold = rosterRoom_(r.from, r.giveO.players, r.getO.players, dr.from || []) ? r.from : rosterRoom_(r.to, r.getO.players, r.giveO.players, dr.to || []) ? r.to : "";
      if (hold) { if (holdOf_(r) !== hold) { r.espn_note = "HOLD:" + hold; delete r.giveO; delete r.getO; setRow_("Offers", i, r);
          notify_(hold, "commish", "Pick a drop to finish your trade", "Your trade is through review, but your roster is over " + ROSTER_MAX + " now. Pick who you'll drop: " + APP_URL + "#trades");
          botPost_(dmRoom_(r.from, r.to), "⏸️ Review's over. " + oName_(hold) + " is over the roster limit now and picks a drop, then it goes through.", r.offer_id); }
        return; }
      if (approveTrade_({ row: r, idx: i }, review, "").ok) n++;
    });
  } finally { if (lock.releaseLock) lock.releaseLock(); }
  return n;
}
// The held owner picks his drops (or changes the ones he chose): saved, and processed right away if the review is over.
function tradeDrops_(me, b) {
  var f = findOffer_(String(b.id || "")); if (!f) return { ok: false, error: "Trade not found" };
  var r = f.row; if (r.status !== "ACCEPTED") return { ok: false, error: "That trade isn't open." };
  var side = me.owner === r.from ? "from" : me.owner === r.to ? "to" : ""; if (!side) return { ok: false, error: "Not your trade." };
  var drops = cleanDrops_(b.drops), dr = parseJ_(r.drops), out = side === "from" ? r.giveO.players : r.getO.players, inn = side === "from" ? r.getO.players : r.giveO.players;
  var e = rosterRoom_(me.owner, out, inn, drops); if (e) return { ok: false, error: e, needDrops: true };
  dr[side] = drops; r.drops = JSON.stringify(dr); if (holdOf_(r) === me.owner) r.espn_note = ""; var gi = r.giveO, ge = r.getO; delete r.giveO; delete r.getO; setRow_("Offers", f.idx, r);
  log_("tradedrops", r.offer_id + " " + me.owner);
  if (Date.now() >= reviewEnds_(r)) { r.giveO = gi; r.getO = ge; var x = approveTrade_(findOffer_(r.offer_id), { owner: "review", name: "the review" }, ""); if (!x.ok) return x; }
  return { ok: true };
}
// 📏 Roster room: after the trade (players out, players in, minus drops) a team must fit ROSTER_MAX (IR not counted). "" = fits.
function cleanDrops_(list) { return (Array.isArray(list) ? list : []).slice(0, 10).map(function (p) { var o = { n: clip_(p.n, 60), pos: clip_(p.pos, 5), tm: clip_(p.tm, 4) }; if (Number(p.id) > 0) o.id = Number(p.id); return o; }); }
function rosterRoom_(ownerId, out, inn, drops) {
  var ro = rosterOf_(ownerId); if (!ro || !ro.length) return ""; // no ESPN roster (off-season reset): nothing to check
  var act = ro.filter(function (p) { return p.slot !== "IR"; }), outN = (out || []).filter(function (p) { return act.some(function (q) { return q.n === p.n; }); }).length;
  for (var i = 0; i < (drops || []).length; i++) {
    var d = drops[i]; if (!act.some(function (q) { return q.n === d.n; })) return d.n + " isn't on " + oName_(ownerId) + "'s active roster to drop.";
    if ((out || []).some(function (q) { return q.n === d.n; })) return d.n + " is in the trade, so he can't be a drop too.";
  }
  var after = act.length - outN + (inn || []).length, over = after - ROSTER_MAX - (drops || []).length;
  return over > 0 ? oName_(ownerId) + " would have " + after + " players (max " + ROSTER_MAX + "): pick " + over + " more to drop." : "";
}
function dropText_(r) { var d = parseJ_(r.drops), l = (d.from || []).map(function (p) { return oName_(r.from) + " drops " + p.n; }).concat((d.to || []).map(function (p) { return oName_(r.to) + " drops " + p.n; })); return l.length ? " · " + l.join(" · ") : ""; }

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
