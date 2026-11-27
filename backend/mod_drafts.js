/**
 * SPL HQ — backend part mod_drafts.js (off-season draft engine).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB. Pattern: MAFFL _ops/apps-script/logic.js parts_ (WS6).
 */

// ---------------------------------------------------------------- 🗓️ Off-season drafts (WS3). One turn-based engine, one config per draft:
//   div  · Divisional Draft (constitution §E): 4 founders (order from last season) snake 1-2-3-4-4-3-2-1 to fill 4 divisions of 3.
//          A pick puts an unplaced owner into your own division, or assigns him to another founder's division (max one
//          assigned-in per division). If your division is already full you must assign; the one-assigned cap gives way only
//          when no legal move is left.
//   slot · Slot Draft (§F): all 12 owners in slot-draft order each claim an SPL Draft slot 1–12 (the SPL Draft is a snake).
//   shootout · SPL Shoot Out Draft (§K, Appendix Three): eve of Week 14, the current season. order = all 12 by seed after Week 13;
//          fixed = the Rule 1 matchups (playoff-berth deciders), computed in the app and confirmed by the commish when he opens it.
//          The best-seeded unmatched owner picks any unmatched opponent; the last two left are paired automatically (by "auto").
//          Week 14 on ESPN is set by the commish (LM Tools → Edit Schedule) until the /schedule write is captured.
//   spl  · the SPL Draft (17 rounds, snake, traded picks, keepers + tags skip their cells): mod_spldraft.js.
// mode "test" = rehearsal (anyone can watch, ops can wipe, robot writes data/test/); "live" = the real thing for that season.
// The on-the-clock owner picks; a commish (Joe or Mike) can enter a pick for him (recorded as "by"). Commish can undo the last pick.
var DRAFT_KINDS = { div: { name: "Divisional Draft", n: 4 }, slot: { name: "Slot Draft", n: 12 }, shootout: { name: "Shoot Out Draft", n: 12 }, spl: { name: "SPL Draft", n: 12 } };
function turns_(kind, order) { return kind === "div" ? order.concat(order.slice().reverse()) : order.slice(); }
function draftRows_() { return rows_("Drafts").map(function (d) { var o = parseJ_(d.order); d.fixedA = [];
  if (o && !Array.isArray(o) && Array.isArray(o.seeds)) { d.fixedA = Array.isArray(o.fixed) ? o.fixed : []; d.cellsA = Array.isArray(o.cells) ? o.cells : []; o = o.seeds; } // shootout: { seeds, fixed } · spl: { seeds, cells }
  d.orderA = Array.isArray(o) ? o : []; return d; }); }
function cleanRow_(r) { delete r.orderA; delete r.fixedA; delete r.cellsA; return r; }
// Shoot Out: who is matched (Rule 1 pairs + picks), whose turn it is, and the Week 14 pairs.
function shootState_(s, fixed) {
  var opp = {}; fixed.forEach(function (p) { opp[p[0]] = p[1]; opp[p[1]] = p[0]; });
  s.picks.forEach(function (p) { opp[p.owner] = p.choice.opp; opp[p.choice.opp] = p.owner; });
  var open = s.order.filter(function (id) { return !opp[id]; }), total = (s.order.length - 2 * fixed.length) / 2;
  s.fixed = fixed.map(function (p) { return { a: p[0], b: p[1], why: p[2] || "" }; }); s.opp = opp; s.unmatched = open;
  s.pairs = s.fixed.map(function (p) { return [p.a, p.b, "rule1"]; }).concat(s.picks.map(function (p) { return [p.owner, p.choice.opp, p.by === "auto" ? "last two" : "pick"]; }));
  s.clock = s.status === "open" ? open[0] || null : null;
  s.turns = s.picks.map(function (p) { return p.owner; }); if (s.clock) s.turns.push(s.clock); while (s.turns.length < total) s.turns.push(null);
  return s;
}
function draftState_(d, sel) {
  var picks = sel.filter(function (p) { return p.draft_id === d.draft_id; }).map(function (p) { return { n: Number(p.n), owner: p.owner, choice: parseJ_(p.choice), ts: p.ts, by: p.by }; })
    .sort(function (a, b) { return a.n - b.n; });
  var turns = turns_(d.kind, d.orderA), s = { id: d.draft_id, kind: d.kind, name: (DRAFT_KINDS[d.kind] || {}).name || d.kind, season: Number(d.season), mode: d.mode,
    status: d.status, order: d.orderA, turns: turns, picks: picks, ts: d.ts, by: d.by, updated: d.updated_ts };
  s.clock = s.status === "open" ? turns[picks.length] || null : null;
  if (d.kind === "div") { s.divs = {}; s.assigned = {}; d.orderA.forEach(function (f) { s.divs[f] = [f]; s.assigned[f] = 0; });
    picks.forEach(function (p) { if (s.divs[p.choice.into]) { s.divs[p.choice.into].push(p.choice.pick); if (p.choice.into !== p.owner) s.assigned[p.choice.into]++; } }); }
  if (d.kind === "slot") { s.slots = {}; picks.forEach(function (p) { s.slots[p.choice.slot] = p.owner; }); }
  if (d.kind === "shootout") shootState_(s, d.fixedA || []);
  if (d.kind === "spl") splState_(s, d);
  return s;
}
function drafts_(me) {
  var sel = rows_("DraftPicks");
  return { ok: true, kinds: DRAFT_KINDS, drafts: draftRows_().filter(function (d) { return d.status !== "cancelled"; }).map(function (d) { return draftState_(d, sel); }).reverse().slice(0, 12) };
}
function findDraft_(id) { var all = draftRows_(), i = -1; all.forEach(function (d, k) { if (d.draft_id === id) i = k; }); return i < 0 ? null : { row: all[i], idx: i }; }
function draftOpen_(me, b) {
  var kind = String(b.kind || ""), K = DRAFT_KINDS[kind]; if (!K) return { ok: false, error: "Unknown draft" };
  var mode = b.mode === "live" ? "live" : "test", season = Number(b.season) || (kind === "shootout" ? SEASON : SEASON + 1), cells = null, order = Array.isArray(b.order) ? b.order.map(String) : [];
  if (order.length !== K.n || order.some(function (id, i) { return !oid_(id) || order.indexOf(id) !== i; })) return { ok: false, error: K.name + " needs " + K.n + " different owners in order." };
  var fixed = [];
  if (kind === "shootout") { var seen = {};
    fixed = (Array.isArray(b.fixed) ? b.fixed : []).map(function (p) { return [String((p || [])[0] || ""), String((p || [])[1] || ""), clip_((p || [])[2], 120)]; });
    for (var i = 0; i < fixed.length; i++) { var a = fixed[i][0], c = fixed[i][1];
      if (order.indexOf(a) < 0 || order.indexOf(c) < 0 || a === c) return { ok: false, error: "Each Rule 1 matchup needs two different owners." };
      if (seen[a] || seen[c]) return { ok: false, error: oName_(seen[a] ? a : c) + " is in two Rule 1 matchups." }; seen[a] = seen[c] = 1; }
    if (order.length - 2 * fixed.length < 2) return { ok: false, error: "Leave at least two teams for the draft." }; }
  if (kind === "spl") cells = splCells_(season, order);
  if (draftRows_().some(function (d) { return d.kind === kind && d.mode === mode && Number(d.season) === season && (d.status === "open" || (mode === "live" && d.status === "done")); }))
    return { ok: false, error: "There's already " + (mode === "live" ? "a " : "a rehearsal ") + season + " " + K.name + " " + (mode === "live" ? "(cancel it first)" : "open") + "." };
  var id = "D" + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), now = new Date();
  append_("Drafts", [id, now, kind, season, mode, "open", JSON.stringify(kind === "shootout" ? { seeds: order, fixed: fixed } : kind === "spl" ? { seeds: order, cells: cells } : order), clip_(b.note, 200), me.owner, now]);
  var first = order[0];
  if (kind === "spl") first = (cells.filter(function (c) { return !c[2]; })[0] || [order[0]])[0];
  if (kind === "shootout") { var mt = {}; fixed.forEach(function (p) { mt[p[0]] = mt[p[1]] = 1; }); first = order.filter(function (x) { return !mt[x]; })[0];
    if (fixed.length) botPost_("league", "🎯 " + (mode === "test" ? "🧪 " : "") + "Rule 1 matchups (they decide playoff spots): " + fixed.map(function (p) { return oName_(p[0]) + " vs " + oName_(p[1]); }).join(" · ") + ".", id); }
  botPost_("league", "🗓️ " + (mode === "test" ? "🧪 Rehearsal: " : "") + "The " + season + " " + K.name + " is open! First up: " + oName_(first) + ". Draft room: SPL HQ → League → Drafts." +
    (kind === "spl" ? " " + cells.filter(function (c) { return c[2] === "keeper"; }).length + " keepers and " + cells.filter(function (c) { return c[2] === "tag"; }).length + " Franchise Tag pick(s) are already on the board." : ""), id);
  onClock_(first, K.name, season, mode, id);
  log_("draftopen", id + " " + kind + " " + mode + " " + season + " by " + me.owner);
  return { ok: true, id: id };
}
function onClock_(who, name, season, mode, id, quiet) { // quiet (SPL Draft): at most one email per owner per 30 min
  notify_(who, "draft", "You're on the clock: " + season + " " + name + (mode === "test" ? " (rehearsal)" : ""), "It's your pick in the " + season + " " + name + ".\n\nDraft room: " + APP_URL + "#droom=" + id, quiet ? "draft:" + id : undefined);
}
// Is this choice legal for the turn? Returns an error string or "".
function draftCheck_(s, who, c) {
  if (s.kind === "spl") return splCheck_(s, who, c);
  if (s.kind === "shootout") { if (!oid_(c.opp) || s.order.indexOf(c.opp) < 0) return "Pick an opponent."; if (c.opp === who) return "Pick someone else.";
    if (s.opp[c.opp]) return oName_(c.opp) + " already has a Week 14 opponent (" + oName_(s.opp[c.opp]) + ")."; return ""; }
  if (s.kind === "slot") { var k = Number(c.slot); if (!(k >= 1 && k <= 12) || k !== Math.floor(k)) return "Pick a slot from 1 to 12."; if (s.slots[k]) return "Slot " + k + " is taken (" + oName_(s.slots[k]) + ")."; return ""; }
  var placed = {}; Object.keys(s.divs).forEach(function (f) { s.divs[f].forEach(function (x) { placed[x] = f; }); });
  if (!oid_(c.pick)) return "Pick an owner."; if (placed[c.pick]) return oName_(c.pick) + " is already in " + oName_(placed[c.pick]) + "'s division.";
  if (!s.divs[c.into]) return "Pick a division."; if (s.divs[c.into].length >= 3) return oName_(c.into) + "'s division is full.";
  if (c.into === who) return "";
  var ownOpen = s.divs[who].length < 3, other = Object.keys(s.divs).some(function (f) { return f !== who && s.divs[f].length < 3 && s.assigned[f] < 1; });
  if (s.assigned[c.into] >= 1 && (ownOpen || other)) return oName_(c.into) + " already has an owner assigned to his division (one each).";
  return "";
}
function choiceText_(s, who, c) { return s.kind === "spl" ? "takes " + c.player + (c.pos ? " (" + c.pos + ")" : "") : s.kind === "shootout" ? "picks " + oName_(c.opp) + " for Week 14" : s.kind === "slot" ? "takes slot " + c.slot : c.into === who ? "takes " + oName_(c.pick) + " into his division" : "assigns " + oName_(c.pick) + " to " + oName_(c.into) + "'s division"; }
function draftPick_(me, b, desk) {
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var s = draftState_(f.row, rows_("DraftPicks")); if (s.status !== "open") return { ok: false, error: "This draft is " + s.status + "." };
  if (b.n != null && Number(b.n) !== s.picks.length + 1) return { ok: false, error: "That pick was already made. Refreshing." , stale: true };
  var who = s.clock; if (who !== me.owner && !desk) return { ok: false, error: oName_(who) + " is on the clock." };
  var c = s.kind === "spl" ? splChoice_(b) : s.kind === "slot" ? { slot: Number((b.choice || {}).slot) } : s.kind === "shootout" ? { opp: String((b.choice || {}).opp || "") } : { pick: String((b.choice || {}).pick || ""), into: String((b.choice || {}).into || "") };
  var err = draftCheck_(s, who, c); if (err) return { ok: false, error: err };
  var n = s.picks.length + 1, now = new Date();
  append_("DraftPicks", [s.id, n, who, JSON.stringify(c), now, me.owner, ""]);
  var done = n === s.turns.length, nxt = s.turns[n], auto = null;
  if (s.kind === "shootout") { var left = s.unmatched.filter(function (x) { return x !== who && x !== c.opp; });
    if (left.length === 2) { auto = { owner: left[0], opp: left[1] }; append_("DraftPicks", [s.id, n + 1, left[0], JSON.stringify({ opp: left[1] }), now, "auto", "last two"]); }
    done = left.length <= 2; nxt = done ? null : left[0]; }
  if (s.kind !== "spl") botPost_("league", "🗓️ " + (s.mode === "test" ? "🧪 " : "") + s.name + " · pick " + n + ": " + oName_(who) + " " + choiceText_(s, who, c) + (me.owner !== who ? " (entered by " + me.name + ")" : "") +
    (auto ? ". That leaves " + oName_(auto.owner) + " vs " + oName_(auto.opp) + "." : "") + (done ? "" : ". On the clock: " + oName_(nxt) + "."), s.id);
  if (done) { var r = cleanRow_(f.row); r.status = "done"; r.updated_ts = now; setRow_("Drafts", f.idx, r);
    if (s.kind === "spl") { splAfterPick_(s, n); splEspnAfterPick_(me, s, n); botPost_("league", "🏁 " + (s.mode === "test" ? "🧪 Rehearsal " : "") + "The " + s.season + " SPL Draft is in the books. Every board: SPL HQ → League → Drafts.", s.id); } else
    if (s.kind === "shootout") { var fin = draftState_(findDraft_(s.id).row, rows_("DraftPicks"));
      botPost_("league", "🏁 " + (s.mode === "test" ? "🧪 Rehearsal " : "") + s.season + " Shoot Out, Week 14: " + fin.pairs.map(function (p) { return oName_(p[0]) + " vs " + oName_(p[1]); }).join(" · ") + ". Highest score takes the Shoot Out pot.", s.id); }
    else botPost_("league", "🏁 " + (s.mode === "test" ? "🧪 Rehearsal " : "") + s.season + " " + s.name + " is done. Results: SPL HQ → League → Off-season.", s.id); }
  else { var r2 = cleanRow_(f.row); r2.updated_ts = now; setRow_("Drafts", f.idx, r2); if (s.kind === "spl") { splAfterPick_(s, n); splEspnAfterPick_(me, s, n); } onClock_(nxt, s.name, s.season, s.mode, s.id, s.kind === "spl"); }
  log_("draftpick", s.id + " #" + n + " " + who + " " + JSON.stringify(c) + " by " + me.owner);
  return { ok: true, draft: draftState_(findDraft_(s.id).row, rows_("DraftPicks")) };
}
function draftUndo_(me, b) { // commish: take back the last pick (reopens a finished draft)
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var sel = rows_("DraftPicks"), last = -1; sel.forEach(function (p, i) { if (p.draft_id === f.row.draft_id && (last < 0 || Number(p.n) > Number(sel[last].n))) last = i; });
  if (last < 0) return { ok: false, error: "No picks to undo." };
  if (f.row.status === "cancelled") return { ok: false, error: "This draft was cancelled." };
  var p = sel[last]; dirty_("DraftPicks");
  if (p.by === "auto") { var prev = -1; sel.forEach(function (q, i) { if (q.draft_id === p.draft_id && Number(q.n) === Number(p.n) - 1) prev = i; });
    sheet_("DraftPicks").deleteRow(last + 2); if (prev >= 0) { sheet_("DraftPicks").deleteRow(prev + 2); p = sel[prev]; } }
  else sheet_("DraftPicks").deleteRow(last + 2);
  var r = cleanRow_(f.row); r.status = "open"; r.updated_ts = new Date(); setRow_("Drafts", f.idx, r);
  botPost_("league", "↩️ " + (r.mode === "test" ? "🧪 " : "") + (DRAFT_KINDS[r.kind] || {}).name + ": pick " + p.n + " (" + oName_(p.owner) + ") taken back by " + me.name + ". " + oName_(p.owner) + " is on the clock again.", r.draft_id);
  log_("draftundo", r.draft_id + " #" + p.n + " by " + me.owner);
  return { ok: true };
}
function draftCancel_(me, b) {
  var f = findDraft_(String(b.id || "")); if (!f) return { ok: false, error: "Draft not found" };
  var r = cleanRow_(f.row); if (r.status === "cancelled") return { ok: true };
  r.status = "cancelled"; r.updated_ts = new Date(); setRow_("Drafts", f.idx, r);
  botPost_("league", "🗓️ " + (r.mode === "test" ? "🧪 Rehearsal " : "") + r.season + " " + (DRAFT_KINDS[r.kind] || {}).name + " cancelled by " + me.name + ".", r.draft_id);
  log_("draftcancel", r.draft_id + " by " + me.owner); return { ok: true };
}
function draftWipe_(me) { // ops: clear every rehearsal (cancelled = hidden; picks stay in the Sheet for the record)
  var n = 0; draftRows_().forEach(function (r, i) { if (r.mode === "test" && r.status !== "cancelled") { cleanRow_(r); r.status = "cancelled"; r.updated_ts = new Date(); setRow_("Drafts", i, r); n++; } });
  log_("draftwipe", n + " by " + me.owner); return { ok: true, cleared: n };
}
function draftLedger_() { // finished drafts for the robot (league facts only)
  var sel = rows_("DraftPicks");
  return draftRows_().filter(function (d) { return d.status === "done"; }).map(function (d) { var s = draftState_(d, sel);
    return { id: s.id, kind: s.kind, season: s.season, mode: s.mode, done: s.updated, order: s.order, picks: s.picks.map(function (p) { return { n: p.n, owner: p.owner, choice: p.choice, by: p.by }; }), divs: s.divs || null, slots: s.slots || null, fixed: s.fixed || null, pairs: s.pairs || null, board: s.kind === "spl" ? splLedger_(s) : null }; });
}
