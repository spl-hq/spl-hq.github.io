/**
 * SPL HQ — backend part mod_spldraft.js (the SPL Draft room, on the off-season draft engine in mod_drafts.js).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB.
 *
 * The SPL Draft (constitution §B, §F, §J): 17 rounds, snake, 12 slots in Slot Draft order. When the commish opens it the board is
 * built once and stored with the draft:
 *   · each cell's owner = the pick ledger (Picks tab) for that season/round/original owner, so traded picks land with their new owner;
 *   · a Franchise Tag costs the tagging owner's ORIGINAL 1st-round pick (every year of the tag) → that cell is skipped ("tag");
 *   · keepers fill each team's last empty cells (packet: "keepers fill each team's empty late-round slots") → skipped ("keeper").
 * Keepers come from gold Keeper_Contracts.csv on main (active, with KP for the draft season), i.e. after Signing Day's ledger run.
 * Every other cell is a turn. A pick = one player (from ESPN's player pool, or typed in when ESPN doesn't list him).
 * Noise control: league chat gets the open, each finished round and the end (not 190 posts); on-the-clock emails go out at most
 * once per 30 minutes per owner (notify_ room throttle), the Home card + room carry the rest.
 */
var SPL_ROUNDS = 17;
// Board cells: [owner, original owner, skip ("" | "keeper" | "tag"), keeper/tag player]. Index = overall pick − 1.
function splCells_(season, slots) {
  var S = String(season), led = {}; seedPicks_().forEach(function (p) { if (Number(p.season) === season) led[p.round + ":" + p.original] = p.owner; });
  var cells = [];
  for (var r = 1; r <= SPL_ROUNDS; r++) for (var i = 0; i < 12; i++) { var orig = slots[r % 2 ? i : 11 - i]; cells.push([led[r + ":" + orig] || orig, orig, "", ""]); }
  var cs = []; try { cs = contracts_().filter(function (c) { return c.status === "active" && c.kp[S] != null; }); } catch (e) { cs = []; }
  cs.filter(function (c) { return c.tag; }).forEach(function (c) { // the tag eats the owner's own 1st, wherever it sits now
    for (var k = 0; k < 12; k++) if (cells[k][1] === c.owner && !cells[k][2]) { cells[k][2] = "tag"; cells[k][3] = c.player; break; } });
  var by = {}; cs.forEach(function (c) { (by[c.owner] = by[c.owner] || []).push(c.player); });
  Object.keys(by).forEach(function (o) { var left = by[o].slice();
    for (var k = cells.length - 1; k >= 0 && left.length; k--) if (cells[k][0] === o && !cells[k][2]) { cells[k][2] = "keeper"; cells[k][3] = left.shift(); } });
  return cells;
}
function splState_(s, d) {
  var cells = d.cellsA || [], turnAt = [];
  cells.forEach(function (c, k) { if (!c[2]) turnAt.push(k); });
  s.rounds = SPL_ROUNDS; s.turns = turnAt.map(function (k) { return cells[k][0]; }); s.turnAt = turnAt;
  s.cells = cells.map(function (c, k) { var r = Math.floor(k / 12) + 1; return { n: k + 1, r: r, p: k % 12 + 1, owner: c[0], orig: c[1], skip: c[2], player: c[3] || "" }; });
  s.picks.forEach(function (p, i) { var c = s.cells[turnAt[i]]; if (c) { c.player = p.choice.player; c.pos = p.choice.pos || ""; c.tm = p.choice.tm || ""; c.by = p.by; } });
  s.clock = s.status === "open" ? s.turns[s.picks.length] || null : null;
  s.at = s.status === "open" ? s.cells[turnAt[s.picks.length]] || null : null;
  return s;
}
function splTaken_(s, name) { var n = pn_(name); return s.cells.filter(function (c) { return c.player && pn_(c.player) === n; })[0] || null; }
function splCheck_(s, who, c) {
  if (!c.player) return "Pick a player.";
  var t = splTaken_(s, c.player); if (t) return c.player + " is gone (" + (t.skip === "keeper" ? oName_(t.owner) + "'s keeper" : t.skip === "tag" ? oName_(t.orig) + "'s Franchise Tag" : "R" + t.r + "." + t.p + ", " + oName_(t.owner)) + ").";
  return "";
}
function splChoice_(b) { var c = b.choice || {}; return { player: clip_(c.player, 60).trim(), pos: clip_(c.pos, 5).trim().toUpperCase(), tm: clip_(c.tm, 4).trim().toUpperCase(), pid: Number(c.pid) || null }; }
// After a pick: a round summary when a round finishes (or the draft does).
function splAfterPick_(s, n) {
  var st = draftState_(findDraft_(s.id).row, rows_("DraftPicks")), cell = st.cells[st.turnAt[n - 1]], next = st.cells[st.turnAt[n]];
  if (!next || next.r !== cell.r) {
    var rs = st.cells.filter(function (c) { return c.r === cell.r; });
    botPost_("league", "📝 " + (s.mode === "test" ? "🧪 " : "") + s.season + " SPL Draft · Round " + cell.r + ": " + rs.map(function (c) { return oName_(c.owner) + " " + (c.skip ? "🔒" : "") + (c.player || "?"); }).join(" · ") + (next ? ". Round " + next.r + " is on: " + oName_(next.owner) + " picks." : ""), s.id);
  }
  return st;
}
// 🧑‍🤝‍🧑 The player pool: ESPN's draft ranks (PPR), cached 6 h. Read-only, the real league.
function splPool_() {
  try {
    return cacheJson_("splpool", 21600, function () {
      var f = { players: { filterStatus: { value: ["FREEAGENT", "WAIVERS", "ONTEAM"] }, filterSlotIds: { value: [0, 2, 4, 6, 16, 23] }, limit: 450,
        sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "PPR" } } };
      var d = espn_(READ_LEAGUE, "view=kona_player_info", { "X-Fantasy-Filter": JSON.stringify(f) });
      var list = (d.players || []).map(function (e) { var pl = e.player || e, rk = ((pl.draftRanksByRankType || {}).PPR || {}).rank;
        return { id: pl.id || e.id, n: pl.fullName || "", pos: POS[pl.defaultPositionId] || "", tm: PRO[pl.proTeamId] || "FA", rk: rk || 999 }; })
        .filter(function (p) { return p.n && p.pos && p.pos !== "K" && p.pos !== "P"; }).sort(function (a, b) { return a.rk - b.rk; });
      return { ok: true, at: new Date().toISOString(), season: SEASON, players: list.map(function (p) { return [p.id, p.n, p.pos, p.tm, p.rk]; }) };
    });
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
// Ledger: the finished board, one row per cell (picks + keepers + tags), for tools/ledger_sync.py → Draft_Picks.csv.
function splLedger_(s) { return s.cells.map(function (c) { return { r: c.r, p: c.p, n: c.n, owner: c.owner, orig: c.orig, skip: c.skip, player: c.player || "", pos: c.pos || "", tm: c.tm || "", by: c.by || "" }; }); }
