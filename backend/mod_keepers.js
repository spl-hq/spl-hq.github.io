/**
 * SPL HQ — backend part mod_keepers.js (🔒 Keeper Signing Day: scenarios + declarations).
 * Evaluated by logic.js (parts_) inside the core's own scope. Pushing it = deploying it. Bump VERSION in logic.js with any change here.
 *
 * Constitution §J (data/SPL_Rulebook.md): 10 KP a season · Three Keeper Max on Signing Day · year-one price = round in the last SPL Draft
 * (R1 10 · R2 8 · R3 6 · R4–5 4 · R6–8 3 · R9+ / undrafted 2), +1 KP each later year · 1–3 year contracts, no extensions ·
 * Franchise Tag = year-one KP + the owner's 1st every year of the tag (F years) · terminating a contract on Signing Day costs
 * 0.5 × the KP scheduled for each remaining year (Cap Penalty), and comes off the 10 KP first.
 *
 *   Scenarios (KeeperPlans tab): each owner's private what-ifs for a season, up to 3, saved with his sign-in (any phone).
 *   Window (Script property KEEPER_WINDOW): {season, mode test|live, status open|closed, closes YYYY-MM-DD, by, ts, done}.
 *     A desk role opens it (rehearsal or live) from the Commish desk; it closes when the desk closes it, or by itself after `closes`
 *     (checked by the ledger robot's every-2-hours call, keepFinalize_). Closing makes the latest declarations "final".
 *   Declarations (KeeperDecl tab): owner picks a scenario and declares; the server re-prices everything from gold (data/ CSVs on
 *     main) and the owner's ESPN roster, checks the cap + the max, posts to league chat. Changeable until close (old one "replaced").
 *     No declaration by the close = carried contracts stand, nothing new.
 *   Robot: ledger_() carries final declarations → tools/ledger_sync.py writes data/Keeper_Declarations.csv and (live only) the new
 *     contracts + terminations into data/Keeper_Contracts.csv. Rehearsals go to data/test/ and never touch the real contracts.
 */
HEADS.KeeperPlans = ["owner", "season", "plans", "updated_ts"];
HEADS.KeeperDecl = ["decl_id", "ts", "season", "mode", "owner", "items", "kp", "by", "status", "note"];
var KEEP_MAX = 3, KEEP_CAP = 10, KEEP_SCEN = 3;
function kpRound_(r) { r = Number(r) || 0; return !r ? 2 : r === 1 ? 10 : r === 2 ? 8 : r === 3 ? 6 : r <= 5 ? 4 : r <= 8 ? 3 : 2; }
function pn_(s) { return String(s || "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/[^a-z0-9]/g, ""); }

// ---- gold from main (the robots keep it current), cached 10 min
function csv_(text) {
  var rows = [], row = [], f = "", q = false, t = String(text || "");
  for (var i = 0; i < t.length; i++) { var ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(f); f = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += ch; }
  if (f || row.length) { row.push(f); rows.push(row); }
  rows = rows.filter(function (r) { return r.length > 1 && String(r[0]).charAt(0) !== "#"; });
  var h = rows.shift() || []; return rows.map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j] == null ? "" : r[j]; }); return o; });
}
function gold_(file) {
  return cacheJson_("gold_" + file, 600, function () {
    var r = UrlFetchApp.fetch("https://raw.githubusercontent.com/" + REPO + "/main/data/" + file + "?t=" + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error("Couldn't read " + file + " (" + r.getResponseCode() + ")");
    return csv_(r.getContentText());
  });
}
function seasonsOf_(s) { var o = {}; String(s || "").split("|").forEach(function (p) { var kv = p.split(":"); if (kv.length === 2 && kv[0]) o[kv[0]] = kv[1] === "F" ? "F" : Number(kv[1]); }); return o; }
function contracts_() {
  return gold_("Keeper_Contracts.csv").map(function (r) { return { id: r.contract_id, owner: r.owner_id, player: r.player, pos: r.position, signed: Number(r.signed_season),
    term: Number(r.term_years), tag: r.is_franchise_tag === "Y", kp: seasonsOf_(r.kp_by_season), pen: seasonsOf_(r.cap_penalty_by_season), status: r.status }; });
}
function draftRound_(name, season) { var n = pn_(name), p = gold_("Draft_Picks.csv").filter(function (d) { return Number(d.season) === season && pn_(d.player) === n; })[0]; return p ? Number(p.round) : 0; }

// ---- window
function kwin_() {
  var w = parseJ_(prop_("KEEPER_WINDOW")); if (!w || !w.season) return null;
  if (w.status === "open" && w.closes && Date.now() > new Date(w.closes + "T23:59:59-05:00").getTime()) w.status = "closed"; // closes by itself at midnight ET
  return w;
}
function setKwin_(w) { setProp_("KEEPER_WINDOW", JSON.stringify(w)); }
function kwindow_(me, b) {
  var op = String(b.op || ""), w = kwin_();
  if (op === "open") {
    var mode = b.mode === "live" ? "live" : "test", season = Number(b.season) || SEASON + 1, closes = /^\d{4}-\d{2}-\d{2}$/.test(String(b.closes || "")) ? String(b.closes) : "";
    if (w && w.status === "open") return { ok: false, error: "Signing Day is already open (" + (w.mode === "test" ? "rehearsal" : "live") + " " + w.season + "). Close it first." };
    if (mode === "live" && rows_("KeeperDecl").some(function (r) { return Number(r.season) === season && r.mode === "live" && r.status === "final"; }))
      return { ok: false, error: "The " + season + " Signing Day is already done." };
    w = { season: season, mode: mode, status: "open", closes: closes, by: me.owner, ts: new Date().toISOString(), done: false }; setKwin_(w);
    botPost_("league", "🔒 " + (mode === "test" ? "🧪 Rehearsal: " : "") + season + " Keeper Signing Day is open" + (closes ? " until " + closes : "") + ". Plan + declare: SPL HQ → League → Keepers. 10 KP, three keepers max.", "keep:" + season);
    if (mode === "live") owners_().forEach(function (o) { notify_(o.owner, "announce", season + " Keeper Signing Day is open", "Declare your " + season + " keepers in SPL HQ" + (closes ? " by " + closes : "") + ".\n\n" + APP_URL + "#keepers"); });
    log_("kwindow", "open " + mode + " " + season + " by " + me.owner); return { ok: true, window: w };
  }
  if (!w) return { ok: false, error: "Signing Day isn't open." };
  if (op === "close") { w.status = "closed"; setKwin_(w); keepFinalize_(me.name); log_("kwindow", "close by " + me.owner); return { ok: true, window: kwin_() }; }
  if (op === "wipe") { // ops: clear a rehearsal (rows stay, marked wiped)
    if (w.mode !== "test") return { ok: false, error: "Only rehearsals can be wiped." };
    var n = 0; rows_("KeeperDecl").forEach(function (r, i) { if (r.mode === "test" && (r.status === "in" || r.status === "final")) { r.status = "wiped"; setRow_("KeeperDecl", i, r); n++; } });
    setProp_("KEEPER_WINDOW", ""); log_("kwindow", "wipe " + n + " by " + me.owner); return { ok: true, wiped: n };
  }
  return { ok: false, error: "Unknown step" };
}
// Closed window → latest declarations become final, one league post. Safe to call any time (robot calls it every 2 h via ledger_).
function keepFinalize_(byName) {
  var w = kwin_(); if (!w || w.status !== "closed" || w.done) return;
  var all = rows_("KeeperDecl"), last = {};
  all.forEach(function (r, i) { if (Number(r.season) === w.season && r.mode === w.mode && r.status === "in") last[r.owner] = i; });
  var n = 0, keepers = 0, tags = 0, cuts = 0;
  Object.keys(last).forEach(function (o) { var r = all[last[o]], it = parseJ_(r.items); r.status = "final"; setRow_("KeeperDecl", last[o], r); n++;
    keepers += (it.keep || []).length + (it.signs || []).length; tags += (it.signs || []).filter(function (s) { return s.tag; }).length; cuts += (it.cuts || []).length; });
  w.done = true; w.status = "closed"; w.closedAt = new Date().toISOString(); setKwin_(w);
  botPost_("league", "🏁 " + (w.mode === "test" ? "🧪 Rehearsal " : "") + w.season + " Signing Day is done" + (byName ? " (closed by " + byName + ")" : "") + ": " + n + " of 12 declared · " + keepers + " keepers · " +
    tags + " tag" + (tags === 1 ? "" : "s") + " · " + cuts + " terminated. No declaration = carried contracts stand. Results: League → Keepers.", "keep:" + w.season);
  log_("kfinal", w.mode + " " + w.season + " " + n + " declarations");
}

// ---- the board for one owner and season: what he carries, what he owes, what he could sign
function board_(owner, season) {
  var all = contracts_(), mine = all.filter(function (c) { return c.owner === owner; }), S = String(season);
  var carried = mine.filter(function (c) { return c.status === "active" && c.kp[S] != null; });
  var penalty = mine.filter(function (c) { return c.status !== "active" && typeof c.pen[S] === "number"; }).reduce(function (s, c) { return s + c.pen[S]; }, 0);
  return { all: all, carried: carried, penalty: penalty };
}
// Why this player can't get a new contract this Signing Day ("" = he can).
function blocked_(all, name, season, owner) {
  var n = pn_(name), cs = all.filter(function (c) { return pn_(c.player) === n; }).sort(function (a, b) { return b.signed - a.signed; }), S = String(season);
  for (var i = 0; i < cs.length; i++) { var c = cs[i], last = c.signed + c.term - 1;
    if (c.status === "active" && c.kp[S] != null) return c.owner === owner ? "already under contract with you" : "under contract with " + oName_(c.owner);
    if (c.status === "active" && last === season - 1) return "contract just ran out (no extensions)";
    if (c.status !== "active" && c.pen[S] != null) return "contract terminated: back in the draft pool"; }
  return "";
}
function kpNum_(v) { return typeof v === "number" ? v : 0; }
// Price + check a declaration. d = {cuts:[contract ids], signs:[{player, term, tag}]}. Returns {ok, items, kp, errors, warns}.
function price_(owner, season, d) {
  var B = board_(owner, season), S = String(season), errors = [], warns = [], ros = null;
  try { var R = rosters_(); if (R && R.ok) { var t = (R.teams || []).filter(function (x) { return x.owner === owner; })[0]; if (t) { ros = {}; t.players.forEach(function (p) { ros[pn_(p.n)] = p; }); } } } catch (e) {}
  if (!ros) warns.push("ESPN roster not checked (ESPN didn't answer)");
  var cutIds = (Array.isArray(d.cuts) ? d.cuts : []).map(String), keep = [], cuts = [], signs = [], kp = B.penalty;
  B.carried.forEach(function (c) {
    if (cutIds.indexOf(c.id) >= 0) { var pen = {}; Object.keys(c.kp).forEach(function (y) { if (+y >= season && typeof c.kp[y] === "number") pen[y] = c.kp[y] / 2; });
      cuts.push({ cid: c.id, player: c.player, pen: pen }); kp += kpNum_(pen[S]); }
    else { keep.push({ cid: c.id, player: c.player, pos: c.pos, kp: c.kp[S], tag: c.tag }); kp += kpNum_(c.kp[S]); }
  });
  cutIds.forEach(function (id) { if (!B.carried.some(function (c) { return c.id === id; })) errors.push("Unknown contract " + id); });
  var tagHeld = keep.some(function (k) { return k.kp === "F"; }), seen = {};
  (Array.isArray(d.signs) ? d.signs : []).slice(0, 6).forEach(function (s) {
    var name = clip_(s && s.player, 60).trim(), term = Number(s && s.term), tag = !!(s && s.tag); if (!name) return;
    if (seen[pn_(name)]) return; seen[pn_(name)] = 1;
    if (!(term >= 1 && term <= 3)) { errors.push(name + ": pick a 1, 2 or 3-year contract"); return; }
    var why = blocked_(B.all, name, season, owner); if (why) { errors.push(name + ": " + why); return; }
    var rp = ros ? ros[pn_(name)] : null; if (ros && !rp) { errors.push(name + " isn't on your ESPN roster"); return; }
    if (rp && /Free agent|Waiver/.test(rp.acq || "")) warns.push(name + " was added off waivers/free agency: only keepable if added by Week 14");
    if (tag && tagHeld) { errors.push(name + ": you already hold a Franchise Tag (it takes your 1st)"); return; }
    if (tag) tagHeld = true;
    var round = draftRound_(name, season - 1), y1 = kpRound_(round), sched = {};
    for (var k = 0; k < term; k++) sched[String(season + k)] = tag ? (k ? "F" : y1) : y1 + k;
    signs.push({ player: rp ? rp.n : name, pos: rp ? rp.pos : "", round: round, term: term, tag: tag, y1: y1, kp: sched }); kp += y1;
  });
  var count = keep.length + signs.length;
  if (count > KEEP_MAX) errors.push(count + " keepers: the max is " + KEEP_MAX + " (terminate one or sign fewer)");
  if (kp > KEEP_CAP) errors.push(kp + " KP: over the 10 KP cap by " + (kp - KEEP_CAP));
  return { ok: !errors.length, items: { keep: keep, cuts: cuts, signs: signs, penalty: B.penalty, firstLost: tagHeld }, kp: kp, count: count, errors: errors, warns: warns };
}
function declText_(it) {
  var parts = (it.keep || []).map(function (k) { return k.player + " (" + (k.kp === "F" ? "tag" : k.kp) + ")"; })
    .concat((it.signs || []).map(function (s) { return "🆕 " + s.player + " " + (s.tag ? "🏷️ tag " : "") + s.term + "-yr (" + s.y1 + ")"; }));
  var cuts = (it.cuts || []).map(function (c) { var p = c.pen[Object.keys(c.pen).sort()[0]]; return c.player + (p ? " (−" + p + " penalty)" : ""); });
  return (parts.length ? parts.join(", ") : "no keepers") + (cuts.length ? " · ✂️ terminated " + cuts.join(", ") : "");
}

// ---- actions
function pubDecl_(r) { return { id: r.decl_id, ts: r.ts, season: Number(r.season), mode: r.mode, owner: r.owner, items: parseJ_(r.items), kp: Number(r.kp), by: r.by, status: r.status }; }
function keepers_(me, b) { // read: window, my scenarios, every live-or-final declaration for the window's season + mode
  var w = kwin_(), season = Number(b && b.season) || (w ? w.season : SEASON + 1), plans = null;
  rows_("KeeperPlans").forEach(function (r) { if (r.owner === me.owner && Number(r.season) === season) plans = parseJ_(r.plans); });
  var mode = w && Number(w.season) === season ? w.mode : "live";
  var decls = rows_("KeeperDecl").filter(function (r) { return Number(r.season) === season && r.mode === mode && (r.status === "in" || r.status === "final"); }).map(pubDecl_);
  var last = {}; decls.forEach(function (x) { last[x.owner] = x; });
  return { ok: true, season: season, window: w, plans: Array.isArray(plans) ? plans : [], decls: Object.keys(last).map(function (k) { return last[k]; }) };
}
function kplans_(me, b) {
  var season = Number(b.season) || SEASON + 1, plans = Array.isArray(b.plans) ? b.plans.slice(0, KEEP_SCEN) : [];
  plans = plans.map(function (p, i) { return { name: clip_(p && p.name, 24) || "Plan " + "ABC"[i], cuts: (Array.isArray(p && p.cuts) ? p.cuts : []).slice(0, 6).map(function (x) { return clip_(x, 60); }),
    signs: (Array.isArray(p && p.signs) ? p.signs : []).slice(0, 6).map(function (s) { return { player: clip_(s && s.player, 60), pos: clip_(s && s.pos, 6), round: Number(s && s.round) || 0, term: Math.min(3, Math.max(1, Number(s && s.term) || 1)), tag: !!(s && s.tag) }; }) }; });
  var str = JSON.stringify(plans), list = rows_("KeeperPlans"), idx = -1;
  list.forEach(function (r, i) { if (r.owner === me.owner && Number(r.season) === season) idx = i; });
  if (idx < 0) append_("KeeperPlans", [me.owner, season, str, new Date()]); else setRow_("KeeperPlans", idx, { owner: me.owner, season: season, plans: str, updated_ts: new Date() });
  return { ok: true, plans: plans };
}
function kdeclare_(me, b, desk) {
  var w = kwin_(); if (!w || w.status !== "open") return { ok: false, error: "Signing Day isn't open." };
  var who = b.owner && b.owner !== me.owner ? String(b.owner) : me.owner;
  if (who !== me.owner && !desk) return { ok: false, error: "You can only declare your own keepers." };
  if (!oid_(who)) return { ok: false, error: "Unknown owner" };
  var p = price_(who, w.season, { cuts: b.cuts, signs: b.signs });
  if (b.check) return { ok: true, check: true, valid: p.ok, items: p.items, kp: p.kp, count: p.count, errors: p.errors, warns: p.warns };
  if (!p.ok) return { ok: false, error: p.errors.join(" · "), errors: p.errors, warns: p.warns };
  var list = rows_("KeeperDecl"), had = false;
  list.forEach(function (r, i) { if (Number(r.season) === w.season && r.mode === w.mode && r.owner === who && r.status === "in") { r.status = "replaced"; setRow_("KeeperDecl", i, r); had = true; } });
  var id = "K" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
  append_("KeeperDecl", [id, new Date(), w.season, w.mode, who, JSON.stringify(p.items), p.kp, me.owner, "in", clip_(b.note, 200)]);
  botPost_("league", "🔒 " + (w.mode === "test" ? "🧪 " : "") + oName_(who) + (had ? " changed his " : " declared his ") + w.season + " keepers: " + declText_(p.items) + " · " + p.kp + " of 10 KP" +
    (p.items.firstLost ? " · 🏷️ no 1st" : "") + (me.owner !== who ? " (entered by " + me.name + ")" : "") + ".", id);
  if (w.mode === "live") owners_().forEach(function (o) { if (isRole_(o, "commish") && o.owner !== who && o.owner !== me.owner)
    notify_(o.owner, "commish", oName_(who) + (had ? " changed his " : " declared his ") + w.season + " keepers", oName_(who) + ": " + declText_(p.items) + " · " + p.kp + " of 10 KP.\n\nSigning Day board: " + APP_URL + "#keepers=@league"); });
  log_("kdeclare", id + " " + who + " " + w.mode + " " + w.season + " " + p.kp + "KP by " + me.owner);
  return { ok: true, id: id, items: p.items, kp: p.kp, warns: p.warns, state: keepers_(me, { season: w.season }) };
}
function keepLedger_() { // final declarations for the robot (league facts only); finalizes a window that closed by date
  try { keepFinalize_(""); } catch (e) { log_("kfinal_error", String(e)); }
  return rows_("KeeperDecl").filter(function (r) { return r.status === "final"; }).map(pubDecl_);
}
