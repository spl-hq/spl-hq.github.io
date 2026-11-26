/**
 * SPL HQ — backend part mod_espn.js (ESPN reads + guarded ESPN writes to WRITE_LEAGUE).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from
 * every other file, and this file can use every core helper. Pushing it = deploying it. Bump VERSION in logic.js with any
 * change here (parts are cached under VERSION). Keep under ~90 KB. Pattern: MAFFL _ops/apps-script/logic.js parts_ (WS6).
 */

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
function espnPost_(kind, ref, body, by, path, method) {
  if (!writesOn_()) throw new Error("ESPN writes are off (Ops desk → Test league).");
  if (WRITE_LEAGUE === READ_LEAGUE && TRADE_MODE !== "live") throw new Error("Writes to the real league need Joe's sign-off.");
  var url = "https://lm-api-writes.fantasy.espn.com/apis/v3/games/ffl/seasons/" + SEASON + "/segments/0/leagues/" + WRITE_LEAGUE + (path || "/transactions/");
  var r = UrlFetchApp.fetch(url, { method: method || "post", contentType: "application/json", payload: JSON.stringify(body), headers: { Cookie: cookies_() }, muteHttpExceptions: true });
  var code = r.getResponseCode(), txt = String(r.getContentText() || ""), msg = "";
  try { var j = JSON.parse(txt); msg = (j.messages || []).join(" ") || ((j.details || [])[0] || {}).message || j.status || ""; } catch (e) { msg = txt.slice(0, 120); }
  try { append_("EspnLog", [new Date(), by || "", kind, ref || "", clip_(JSON.stringify(body.items || body), 400), code, clip_(msg || txt, 300)]); } catch (e) {}
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
// 🏷️ Test team names = the real SPL team name + " (test)" (Mike 11/26), so ESPN reads like SPL without mixing it up with the real league.
// Team edit is an LM write (PUT …/teams/<id>, body {name}); not proven on MAFFL, so it's read back and logged. A rename is idempotent, so if
// ESPN refuses the long name the one fallback is a shorter one ("<first 15> TEST", within ESPN's 20-character names).
var SHORT_TEAM = { farrington: "FREELANCERS", murello: "Attitude Gang" }; // only if ESPN refuses the full name
function shortName_(owner) { return (SHORT_TEAM[owner] || oid_(owner)[2].slice(0, 13).trim()) + " (test)"; }
function testName_(owner) { var r = oid_(owner); return r ? r[2] + " (test)" : ""; }
function renameTeam_(me, plan) {
  var want = testName_(plan.owner); if (!want || plan.team === want) return { ok: true, name: plan.team, same: true };
  var tries = [want, shortName_(plan.owner)], res = null;
  for (var i = 0; i < tries.length; i++) {
    res = espnPost_("rename", plan.owner, { name: tries[i] }, me.owner, "/teams/" + plan.teamId, "put");
    var now = (testLeague_().teams.filter(function (t) { return t.id === plan.teamId; })[0] || {}).team;
    if (now === tries[i]) return { ok: true, name: now };
  }
  return { ok: false, error: "rename (" + (res.msg || res.code) + ")" };
}
// 🪞 Mirror plan, per demo team: drops = players no demo team wants (freed first), moves = wanted players sitting on another test team
// (moved with the proven LM trade write, so they never pass through waivers), adds = wanted players not on any test team (commish add).
function mirrorPlan_(tl, spl) {
  var demo = tl.teams.filter(function (t) { return t.owner; }), wanted = {}, where = {};
  demo.forEach(function (t) { (spl[t.owner] || []).forEach(function (p) { wanted[p.id] = t.id; }); });
  tl.teams.forEach(function (t) { t.players.forEach(function (p) { where[p.id] = t.id; }); });
  return demo.map(function (t) {
    var want = spl[t.owner] || [], here = want.filter(function (p) { return where[p.id] === t.id; });
    return { teamId: t.id, team: t.team, wantName: testName_(t.owner), rename: t.team !== testName_(t.owner) && t.team !== shortName_(t.owner), owner: t.owner, name: oName_(t.owner), have: t.players.length, want: want.length, match: here.length,
      drops: t.players.filter(function (p) { return !wanted[p.id]; }),
      moves: want.filter(function (p) { return where[p.id] && where[p.id] !== t.id; }).map(function (p) { return { id: p.id, n: p.n, from: where[p.id] }; }),
      adds: want.filter(function (p) { return !where[p.id]; }) };
  });
}
function testDesk_() {
  var tl = testLeague_(), plan = mirrorPlan_(tl, splRosters_());
  var log = []; try { log = rows_("EspnLog").slice(-12).reverse().map(function (r) { return { ts: r.ts, by: r.by, kind: r.kind, ref: r.ref, items: r.items, code: r.code, msg: r.msg }; }); } catch (e) {}
  return { ok: true, league: WRITE_LEAGUE, name: tl.name, week: tl.sp, writes: writesOn_(), tradeType: prop_("ESPN_TRADE_TYPE") || ESPN_TRADE_TYPE, demo: DEMO_OWNERS,
    teams: plan.map(function (p) { return { teamId: p.teamId, team: p.team, wantName: p.wantName, rename: p.rename, owner: p.owner, have: p.have, want: p.want, match: p.match, drops: p.drops.length, moves: p.moves.length, adds: p.adds.length,
      moveNames: p.moves.slice(0, 30).map(function (x) { return x.n; }),
      dropNames: p.drops.slice(0, 30).map(function (x) { return x.n; }), addNames: p.adds.slice(0, 30).map(function (x) { return x.n; }) }; }), log: log };
}
// One step per call so each stays short: "drops" on every team first, then "moves", then "adds". Ops only. One player per add/drop;
// a team's moves go in one LM trade write. Never retried; each step reads the test league back.
function mirror_(me, b) {
  if (b.step === "names") { var pl = mirrorPlan_(testLeague_(), {}).filter(function (p) { return p.owner === b.owner; })[0];
    if (!pl) return { ok: false, error: "No test team for " + oName_(b.owner) };
    var rn = renameTeam_(me, pl); log_("mirror", me.owner + " " + b.owner + " names " + (rn.ok ? "ok" : "fail"));
    return { ok: true, step: "names", owner: b.owner, sent: rn.same ? 0 : 1, fails: rn.ok ? [] : [rn.error], name: rn.name }; }
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
