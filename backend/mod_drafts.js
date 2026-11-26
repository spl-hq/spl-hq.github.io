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
  var p = sel[last]; dirty_("DraftPicks"); sheet_("DraftPicks").deleteRow(last + 2);
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
