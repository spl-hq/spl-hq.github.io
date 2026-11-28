// Smoke test for backend/logic.js with mocked Apps Script services. Run: node tests/backend_smoke.js
// Required before every backend push (CLAUDE.md). Exits non-zero on any failure.
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "backend", "logic.js"), "utf8");
// The backend core loads its parts (backend/mod_*.js) from GitHub main at runtime; here they come from the working tree.
const parts = {}; fs.readdirSync(path.join(__dirname, "..", "backend")).filter(f => /^mod_\w+\.js$/.test(f))
  .forEach(f => { parts[f.replace(/\.js$/, "")] = fs.readFileSync(path.join(__dirname, "..", "backend", f), "utf8"); });
let partFetches = 0;
// 🛠️ WS7 GitHub + Pages fakes: robots' runs, workflow dispatches, the live app vs main.
const GH = { runs: {}, dispatched: [], code: 200, live: "0.14", main: "0.14", exp: "2027-11-26 12:00:00 UTC" };
const iso = h => new Date(Date.now() - h * 3.6e6).toISOString();
const ghRun = (h, conclusion, event) => ({ created_at: iso(h), status: "completed", conclusion: conclusion || "success", event: event || "schedule", html_url: "https://github.com/run/" + h });
const ghFetch = (url, o) => {
  const d = /actions\/workflows\/([\w.-]+)\/(runs|dispatches)/.exec(url);
  if (d && d[2] === "dispatches") { GH.dispatched.push(d[1]); return { getResponseCode: () => 204, getContentText: () => "", getAllHeaders: () => ({}) }; }
  const runs = GH.runs[d[1]] || [ghRun(1)];
  return { getResponseCode: () => GH.code, getContentText: () => JSON.stringify({ workflow_runs: runs }), getAllHeaders: () => ({ "GitHub-Authentication-Token-Expiration": GH.exp }) };
};
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

function makeEnv(props, espn) {
  const sheets = {}, mails = [], cache = {}, alerts = [];
  const mkSheet = (name) => ({ name, rows: [], appendRow(r) { this.rows.push(r); }, setFrozenRows() {}, deleteRow(i) { this.rows.splice(i - 1, 1); },
    getRange(r, c, nr, nc) { const s = this; return { setValues(v) { v.forEach((vr, j) => { const row = (s.rows[r - 1 + j] || []).slice(); vr.forEach((x, i) => { row[c - 1 + i] = x; }); s.rows[r - 1 + j] = row; }); } }; },
    getLastColumn() { return this.rows[0] ? this.rows[0].length : 0; },
    getLastRow() { return this.rows.length; }, getName() { return this.name; },
    getDataRange() { const s = this; return { getValues() { return s.rows.map(r => r.slice()); } }; } });
  sheets.Sheet1 = mkSheet("Sheet1");
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)), getSheets: () => Object.values(sheets),
    deleteSheet: s => { delete sheets[s.name]; }, getName: () => "SPL HQ App" };
  const G = {
    SpreadsheetApp: { getActive: () => ss, getUi: () => ({ alert: m => { alerts.push(m); } }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { getUuid: () => require("crypto").randomUUID(), sleep: () => {}, newBlob: (t, ty, n) => ({ t, n }), zip: (b, n) => ({ zip: n, files: b.map(x => x.n) }),
      computeHmacSha256Signature: (t, k) => Array.from(require("crypto").createHmac("sha256", k).update(t).digest()).map(b => b > 127 ? b - 256 : b) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 99, sendEmail: (to, s, b) => mails.push(typeof to === "object" ? { to: to.to, s: to.subject, b: to.body, att: to.attachments } : { to, s, b }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "spl.hq.ops@gmail.com" }) },
    UrlFetchApp: { fetch: (url, o) => { const m = /raw\.githubusercontent\.com\/spl-hq\/spl-hq\.github\.io\/main\/backend\/(mod_\w+)\.js/.exec(url);
      if (m) { partFetches++; return { getResponseCode: () => 200, getContentText: () => parts[m[1]] }; }
      if (/api\.github\.com/.test(url)) return ghFetch(url, o);
      if (/spl-hq\.github\.io\/\?|main\/index\.html/.test(url)) { const v = /raw\.githubusercontent/.test(url) ? GH.main : GH.live; return { getResponseCode: () => 200, getContentText: () => 'var APP_VERSION = "' + v + '";' }; }
      const g = /raw\.githubusercontent\.com\/spl-hq\/spl-hq\.github\.io\/main\/data\/([\w.]+)\?/.exec(url); // gold CSVs from the working tree
      if (g) return { getResponseCode: () => 200, getContentText: () => fs.readFileSync(path.join(__dirname, "..", "data", g[1]), "utf8") };
      return espn(url, o); } }
  };
  const M = {};
  new Function(...Object.keys(G), "M", src)(...Object.values(G), M);
  const out = r => JSON.parse(r.t);
  return { M, sheets, mails, alerts, props, get: p => out(M.doGet({ parameter: p })), post: b => out(M.doPost({ postData: { contents: JSON.stringify(b) } })) };
}
const espnOk = (url) => {
  if (/kona_player_info/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ players: [
    { player: { id: 1, fullName: "Bijan Robinson", defaultPositionId: 2, proTeamId: 1, draftRanksByRankType: { PPR: { rank: 1 } } } },
    { player: { id: 2, fullName: "Ja'Marr Chase", defaultPositionId: 3, proTeamId: 4, draftRanksByRankType: { PPR: { rank: 2 } } } },
    { player: { id: 3, fullName: "Some Kicker", defaultPositionId: 5, proTeamId: 4, draftRanksByRankType: { PPR: { rank: 3 } } } }] }) };
  if (/proTeamSchedules/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ settings: { proTeams: [{ id: 2, proGamesByScoringPeriod: { 12: [{ homeProTeamId: 2, awayProTeamId: 21, date: 1 }] } }] } }) };
  const lid = /leagues\/(\d+)/.exec(url)[1];
  const pl = (name, pos, team, slot, pts) => ({ lineupSlotId: slot, acquisitionType: "DRAFT", playerPoolEntry: { appliedStatTotal: pts, player: { fullName: name, defaultPositionId: pos, proTeamId: team,
    stats: [{ scoringPeriodId: 12, statSourceId: 0, appliedTotal: pts, stats: { 53: 5, 58: 7, 42: 80 } }, { scoringPeriodId: 0, statSourceId: 0, appliedTotal: pts * 10, appliedAverage: pts }] } } });
  const roster = { entries: [pl("Josh Allen", 1, 2, 0, 24.5), pl("Bench Guy", 3, 21, 20, 3)] };
  const roster2 = { entries: [pl("Omarion Hampton", 2, 24, 2, 12), pl("Chris Olave", 3, 18, 4, 9)] };
  if (lid === "19583" && /mMatchupScore|mRoster/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({
    scoringPeriodId: 12, status: { currentMatchupPeriod: 12 }, settings: { scheduleSettings: { matchupPeriodCount: 14 } },
    teams: [{ id: 1, name: "Bad Attitude Gang", record: { overall: { wins: 9, losses: 3 } }, roster }, { id: 2, name: "Reilly's RaMPaGe", record: { overall: { wins: 8, losses: 4 } }, roster: roster2 }],
    schedule: [{ matchupPeriodId: 12, winner: "UNDECIDED", home: { teamId: 1, totalPoints: 24.5, rosterForCurrentScoringPeriod: roster }, away: { teamId: 2, totalPoints: 20, rosterForCurrentScoringPeriod: roster } },
               { matchupPeriodId: 11, home: { teamId: 1 }, away: { teamId: 2 } }] }) };
  const body = lid === "19583"
    ? { scoringPeriodId: 13, status: { currentMatchupPeriod: 12 }, settings: { name: "SPL", scheduleSettings: { divisions: [{ id: 0, name: "East Coast" }] } },
        teams: [{ id: 1, name: "Bad Attitude Gang", divisionId: 0, playoffSeed: 1, record: { overall: { wins: 9, losses: 3, pointsFor: 1500.44 } } },
                { id: 2, name: "Reeling RaMPaGe", divisionId: 0, playoffSeed: 2, record: { overall: { wins: 8, losses: 4, pointsFor: 1400 } } }] }
    : { settings: { name: "Testing MAFFL HQ" }, teams: [{ id: 1 }, { id: 2 }] };
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
};

// 1 · no cookies → setup message, still answers
let e = makeEnv({}, espnOk);
let h = e.get({ action: "health" });
ok(h.ok && h.version && h.espnRead.ok === false && h.espnRead.setup === true, "health without cookies reports SETUP");
ok(h.healthy === false, "not healthy without ESPN");

// 2 · cookies → both leagues read
e = makeEnv({ ESPN_S2: "abc", SWID: "XYZ" }, espnOk);
h = e.get({ action: "health", fresh: "1" });
ok(h.espnRead.ok && h.espnRead.teams === 2 && h.espnRead.name === "SPL", "reads SPL 19583");
ok(h.espnTest.ok && h.espnTest.name === "Testing MAFFL HQ", "reads test league");
ok(h.healthy === true, "healthy with Sheet + ESPN");
ok(h.espnWrites === false, "ESPN writes off");

// 3 · standings
const s = e.get({ action: "standings" });
ok(s.ok && s.teams.length === 2 && s.teams[0].div === "East Coast" && s.teams[0].pf === 1500.4, "standings shape");

// 4 · setup check seeds owners + bootstraps Mike's passphrase (shown once)
e.M.menuCheck();
ok(e.sheets.Owners && e.sheets.Owners.rows.length === 13, "12 owners seeded");
const phrase = (/\n([A-Z]+-[A-Z]+-\d{3})\n/.exec(e.alerts[0]) || [])[1];
ok(!!phrase, "Mike's passphrase shown in the setup alert");
e.M.menuCheck(); const phrase2 = (/\n([A-Z]+-[A-Z]+-\d{3})\n/.exec(e.alerts[1]) || [])[1];
ok(e.sheets.Owners.rows.length === 13 && phrase2, "second check before Mike signs in: no dupes, fresh passphrase");
ok(!e.post({ action: "login", pin: phrase }).ok, "the missed passphrase no longer works");
ok(!JSON.stringify(e.sheets.Owners.rows).includes(phrase2), "passphrase never stored in plain text");

// 5 · sign-in
let r = e.post({ action: "login", pin: "wrong-wrong-111" });
ok(!r.ok, "wrong passphrase refused");
r = e.post({ action: "login", pin: phrase2.toLowerCase().replace(/-/g, " ") });
ok(r.ok && r.me.owner === "murello" && /ops/.test(r.me.role), "Mike signs in (case/dashes ignored)");
const mike = r.token;
e.M.menuCheck(); ok(!/passphrase/.test(e.alerts[2]), "after Mike signs in, setup check leaves his passphrase alone");
ok(e.post({ action: "me", token: "murello.bogus" }).auth === true, "bad token refused");
ok(e.post({ action: "answers", items: [{ qid: "x", choice: "y" }] }).auth === true, "answers need sign-in");

// 6 · Mike issues Joe a passphrase from the desk; Joe signs in
r = e.post({ action: "issue", token: mike, owner: "reilly" });
ok(r.ok && /^[A-Z]+-[A-Z]+-\d{3}$/.test(r.phrase), "issue Joe's passphrase");
const joePhrase = r.phrase;
r = e.post({ action: "login", pin: joePhrase });
ok(r.ok && r.me.name === "Joe" && r.me.role === "commish", "Joe signs in as commish");
const joe = r.token;
r = e.post({ action: "answers", token: joe, items: [{ qid: "pick_years", question: "How many?", choice: "2 seasons", note: "=SUM(A1)" }, { qid: "bad id!", choice: "x" }] });
ok(r.ok && r.saved === 1 && r.myAnswers.pick_years.choice === "2 seasons", "Joe's answers saved under his name");
ok(e.sheets.Answers.rows[1][1] === "reilly" && e.sheets.Answers.rows[1][5] === "'=SUM(A1)", "who from token + formula guard");
ok(e.mails.some(m => /Joe answered 1 question/.test(m.s)), "emails ops on answers");
r = e.post({ action: "me", token: joe });
ok(r.ok && r.myAnswers.pick_years, "Joe sees his earlier answers");

// 7 · re-issue signs the old phone out
const amit = (() => { e.post({ action: "issue", token: mike, owner: "patel" }); return null; })();
r = e.post({ action: "login", pin: "x" }); // noise
const plain = e.post({ action: "issue", token: joe, owner: "reilly" });
ok(plain.ok && e.post({ action: "me", token: joe }).auth === true, "new passphrase signs old phones out");

const joeP = e.post({ action: "issue", token: mike, owner: "reilly" }).phrase; const joeTok = e.post({ action: "login", pin: joeP }).token; const joe2 = () => joeTok;
// 8 · roles
const p2 = e.post({ action: "issue", token: mike, owner: "glen" }).phrase;
const glen = e.post({ action: "login", pin: p2 }).token;
ok(e.post({ action: "desk", token: glen }).ok === false, "regular owner can't open the desk");
ok(e.post({ action: "issue", token: glen, owner: "reilly" }).ok === false, "regular owner can't issue passphrases");
r = e.post({ action: "desk", token: mike });
ok(r.ok && r.owners.length === 12 && r.answers.length === 1 && r.owners.filter(o => o.hasPass).length === 4, "desk shows owners + answers");
ok(!JSON.stringify(r).includes("pin_hash") && !JSON.stringify(r).includes("salt"), "desk never leaks hashes");

// 9 · feedback
r = e.post({ action: "feedback", token: glen, mood: "👍 Good", note: "nice" });
ok(r.ok && e.sheets.Feedback.rows[1][1] === "glen", "feedback saved under the signed-in owner");
ok(e.post({ action: "nope", token: mike }).ok === false, "unknown action refused");
h = e.get({ action: "health", fresh: "1" });
ok(h.owners === 12 && h.signedUp === 4, "health counts owners with passphrases");

// 10 · Match + Team from ESPN (signed in)
r = e.post({ action: "week", token: glen });
ok(r.ok && r.week === 12 && r.games.length === 1 && r.games[0].home.owner === "murello" && r.games[0].away.owner === "reilly", "week: one game, owners matched by team name");
ok(r.games[0].home.players[0].n === "Josh Allen" && r.games[0].home.players[0].opp === "vs PHI" && r.games[0].home.players[1].slot === "BE", "week: lineup order, opponent, bench");
ok(e.post({ action: "week" }).auth === true, "week needs sign-in");
r = e.post({ action: "rosters", token: glen });
ok(r.ok && r.teams.length === 2 && r.teams[0].players[0].sp === 245 && r.teams[0].players[0].avg === 24.5 && r.teams[1].owner === "reilly", "rosters: season points + owners");

// 11 · chat
r = e.post({ action: "chatsend", token: glen, room: "league", text: "=1+1 trash talk" });
ok(r.ok && e.sheets.Chat.rows[1][4] === "'=1+1 trash talk", "league message saved, formula-guarded");
ok(!e.post({ action: "chatsend", token: glen, room: "dm:murello,reilly", text: "hi" }).ok, "can't post in someone else's DM");
ok(!e.post({ action: "chatsend", token: glen, room: "dm:reilly,glen", text: "hi" }).ok, "DM room ids must be sorted");
ok(e.post({ action: "chatsend", token: glen, room: "dm:glen,reilly", text: "trade?" }).ok, "DM to Joe");
r = e.post({ action: "chat", token: joe2(), room: "dm:glen,reilly" });
ok(r.ok && r.msgs.length === 1 && r.msgs[0].who === "glen" && r.rooms.length === 2, "Joe reads the DM + sees both rooms");
r = e.post({ action: "chat", token: mike, room: "dm:glen,reilly" });
ok(!r.ok, "Mike can't read Glen and Joe's DM");
r = e.post({ action: "chat", token: mike });
ok(r.ok && r.rooms.length === 1 && r.rooms[0].room === "league", "Mike sees only the league room");
const mid = e.sheets.Chat.rows[1][0];
ok(!e.post({ action: "chatdel", token: e.post({ action: "login", pin: (e.post({ action: "issue", token: mike, owner: "smith" })).phrase }).token, id: mid }).ok, "can't delete someone else's message");
ok(e.post({ action: "chatdel", token: mike, id: mid }).ok, "commish deletes a league message");
ok(e.post({ action: "chat", token: glen, room: "league" }).msgs[0].del === true, "deleted shows as deleted");

// 12 · trade center: offer → accept → approve (no self-approval), picks move, chat cards
let t = e.post({ action: "trades", token: mike });
ok(t.ok && t.mode === "test" && t.rules.pickYearsFrom === "commish" && t.seasons.join() === "2027,2028" && t.picks.length === 2 * 12 * 17 && t.picks.every(p => p.owner === p.original), "pick seasons follow Joe's answer (2 seasons): 2027 + 2028 seeded");
ok(t.rules.contracts === "travels" && t.rules.contractsFrom === "default", "contracts travel by default");
r = e.post({ action: "offer", token: mike, to: "reilly", give: { players: [{ n: "Josh Allen" }], picks: ["2027-R1-murello"] }, get: { players: [{ n: "Chris Olave" }] }, note: "let's deal" });
ok(r.ok && r.offer.status === "PROPOSED", "Mike offers Allen + his 2027 1st for Olave");
const tid = r.offer.id;
ok(e.post({ action: "offer", token: mike, to: "reilly", give: { players: [{ n: "Chris Olave" }] }, get: { picks: ["2027-R2-reilly"] } }).error.includes("isn't on Mike"), "can't give a player you don't have");
ok(e.post({ action: "offer", token: mike, to: "reilly", give: { picks: ["2027-R1-glen"] }, get: { picks: ["2027-R2-reilly"] } }).error.includes("doesn't own"), "can't give a pick you don't own");
ok(e.post({ action: "offer", token: mike, to: "reilly", give: { picks: [] }, get: { picks: ["2027-R2-reilly"] } }).ok === false, "both sides need something");
ok(e.post({ action: "offer", token: mike, to: "reilly", give: { players: [{ n: "Josh Allen" }], picks: ["2027-R1-murello"] }, get: { players: [{ n: "Chris Olave" }] } }).dup === true, "double-tap returns the same offer");
ok(e.post({ action: "respond", token: glen, id: tid, decision: "accept" }).ok === false, "only Joe can answer");
ok(e.sheets.Chat.rows.some(r => r[3] === "hq" && r[2] === "dm:murello,reilly" && r[6] === tid), "offer card posted in the DM");
r = e.post({ action: "respond", token: joeTok, id: tid, decision: "accept" });
ok(r.ok && r.offer.status === "ACCEPTED", "Joe accepts");
ok(e.mails.some(m => /waiting on the commish/.test(m.s)), "ops emailed: trade waiting");
ok(e.post({ action: "tradeact", token: glen, id: tid, decision: "approve" }).error === "Commish only", "owners can't approve");
ok(e.post({ action: "tradeact", token: glen, id: tid, decision: "approve" }).error === "Commish only", "owners can't approve");
r = e.post({ action: "desk", token: joeTok }); ok(r.ok && r.review.length === 1, "trade shows on the commish desk");
ok(r.review[0].lock === "" && e.post({ action: "desk", token: mike }).review[0].lock === "", "Mike↔Joe trade: both may act (no neutral commish)");
// Joe is in it too: neither commish can approve their own → make Glen a commish? No: Mike vs Joe trades need a third. Use a Glen↔Joe trade for approval.
const g = e.post({ action: "offer", token: glen, to: "reilly", give: { picks: ["2027-R3-glen"] }, get: { picks: ["2027-R2-reilly"] } });
ok(g.ok, "Glen offers a pick swap to Joe");
e.post({ action: "respond", token: joeTok, id: g.offer.id, decision: "accept" });
ok(e.post({ action: "tradeact", token: joeTok, id: g.offer.id, decision: "approve" }).error.includes("You're in this trade"), "Joe can't approve his own trade with Glen");
ok(e.post({ action: "tradeact", token: mike, id: g.offer.id, decision: "negate" }).error.includes("reason"), "negate needs a reason");
r = e.post({ action: "tradeact", token: mike, id: g.offer.id, decision: "approve" });
ok(r.ok, "Mike approves Glen↔Joe");
t = e.post({ action: "trades", token: glen });
ok(t.picks.find(p => p.pid === "2027-R2-reilly").owner === "glen" && t.picks.find(p => p.pid === "2027-R3-glen").owner === "reilly", "picks moved on approval");
ok(t.offers.find(o => o.id === g.offer.id).espn === "none", "pick-only trade: nothing for ESPN");
ok(e.sheets.Chat.rows.some(r => r[2] === "league" && /Trade approved/.test(r[4])), "league chat announces it");
r = e.post({ action: "tradeact", token: joeTok, id: tid, decision: "approve" });
ok(r.ok && e.sheets.Chat.rows.some(x => /commish-to-commish trade, approved by Joe/.test(x[4])), "Mike↔Joe trade: approvable, flagged to the league");
// counter
// 🏷️ trade block
r = e.post({ action: "blockset", token: mike, player: "Josh Allen", on: true, note: "=need a WR" });
ok(r.ok && r.block.length === 1 && r.block[0].owner === "murello" && !/^=/.test(r.block[0].note), "block: list a player, note formula-guarded");
ok(e.post({ action: "blockset", token: mike, player: "Chris Olave", on: true }).error.includes("isn't on your"), "block: only your own players");
ok(e.post({ action: "blockset", token: mike, player: "Josh Allen", on: true, note: "WR2" }).block.length === 1, "block: re-listing updates the row");
ok(e.post({ action: "trades", token: glen }).block[0].n === "Josh Allen", "block: the league sees it on trades");
ok(e.post({ action: "blockset", token: mike, player: "Josh Allen", on: false }).block.length === 0, "block: take him off");
const c1 = e.post({ action: "offer", token: glen, to: "reilly", give: { picks: ["2027-R4-glen"] }, get: { players: [{ n: "Omarion Hampton" }] } });
const c2 = e.post({ action: "offer", token: joeTok, to: "glen", counterOf: c1.offer.id, give: { players: [{ n: "Chris Olave" }] }, get: { picks: ["2027-R4-glen", "2027-R5-glen"] } });
ok(c2.ok && e.post({ action: "trades", token: glen }).offers.find(o => o.id === c1.offer.id).reason === "Countered", "counter declines the original");
ok(e.post({ action: "respond", token: glen, id: c2.offer.id, decision: "withdraw" }).ok === false, "only the sender withdraws");
ok(e.post({ action: "respond", token: joeTok, id: c2.offer.id, decision: "withdraw" }).ok, "Joe withdraws his counter");
// WS1 · Joe's view: Mike is read-only on trades Joe isn't in, until they've waited BACKUP_WAIT_H on Joe
const sm = e.post({ action: "login", pin: e.post({ action: "issue", token: mike, owner: "smith" }).phrase }).token;
const b1 = e.post({ action: "offer", token: glen, to: "smith", give: { picks: ["2027-R6-glen"] }, get: { picks: ["2027-R6-smith"] } });
e.post({ action: "respond", token: sm, id: b1.offer.id, decision: "accept" });
ok(/backup after 48 h/.test(e.post({ action: "tradeact", token: mike, id: b1.offer.id, decision: "approve" }).error), "Mike can't approve Glen↔Smith yet: Joe's call");
r = e.post({ action: "desk", token: mike }); ok(/Joe's call/.test(r.review.find(o => o.id === b1.offer.id).lock) && r.backupWaitH === 48, "desk tells Mike why it's locked");
ok(e.post({ action: "desk", token: joeTok }).review.find(o => o.id === b1.offer.id).lock === "", "Joe can act on it");
ok(/Joe's call/.test(e.post({ action: "trades", token: mike }).offers.find(o => o.id === b1.offer.id).lock), "trades feed carries the lock (reel card count)");
const oc = e.sheets.Offers.rows[0].indexOf("updated_ts"), orow = e.sheets.Offers.rows.find(x => x[0] === b1.offer.id); orow[oc] = new Date(Date.now() - 49 * 36e5);
ok(e.post({ action: "tradeact", token: mike, id: b1.offer.id, decision: "approve" }).ok, "after 48 h Mike steps in as backup");
// wipe
ok(e.post({ action: "wipetrades", token: joeTok }).ok === false, "only ops wipes");
ok(e.post({ action: "wipetrades", token: mike }).ok && e.post({ action: "trades", token: mike }).offers.length === 0, "ops wipes test trades + reseeds picks");

// 13 · settings + contacts + opt-in emails
r = e.post({ action: "settings", token: glen });
ok(r.ok && r.handle === "Glen" && r.notify.announce === true && r.notify.received === false, "settings defaults: handle = short name, announcements on");
ok(e.post({ action: "savesettings", token: glen, email: "not-an-email", notify: {} }).ok === false, "bad email refused");
ok(e.post({ action: "savesettings", token: glen, handle: "Mike", email: "", notify: {} }).error.includes("taken"), "handles are unique");
r = e.post({ action: "savesettings", token: glen, handle: "Muffins", email: "glen@example.com, karina@example.com", phone: "(412) 555-0123", notify: { received: true, chat: true } });
ok(r.ok && r.handle === "Muffins" && r.email === "glen@example.com, karina@example.com" && r.phone === "4125550123" && r.notify.received && !r.notify.announce, "settings saved (2 emails, phone digits)");
ok(e.post({ action: "contacts" }).auth === true, "contacts need sign-in");
r = e.post({ action: "contacts", token: mike });
ok(r.ok && r.owners.find(o => o.owner === "glen").phone === "4125550123", "signed-in owners see contacts");
let before = e.mails.length;
e.post({ action: "offer", token: mike, to: "glen", give: { picks: ["2027-R9-murello"] }, get: { picks: ["2027-R9-glen"] } });
ok(e.mails.length === before + 1 && /Trade offer from Mike/.test(e.mails[e.mails.length - 1].s) && /glen@example.com/.test(e.mails[e.mails.length - 1].to), "Glen emailed: offer received");
before = e.mails.length;
e.post({ action: "chatsend", token: mike, room: "dm:glen,murello", text: "check your offers" });
e.post({ action: "chatsend", token: mike, room: "dm:glen,murello", text: "again" });
ok(e.mails.length === before + 1, "DM email once per 30 min");
before = e.mails.length;
e.post({ action: "chatsend", token: joeTok, room: "league", text: "hey @Muffins look" });
ok(e.mails.length === before + 1 && /Joe mentioned you/.test(e.mails[e.mails.length - 1].s), "@Muffins in league chat emails Glen");
// division rooms + @ Mentions (v0.18): Glen (North) sees the North room, Joe (East Coast) can't post there; the tag lands in Glen's mentions
ok(e.post({ action: "chat", token: glen }).div.room === "div:north", "Glen's division room is North");
ok(!e.post({ action: "chatsend", token: joeTok, room: "div:north", text: "hi" }).ok, "Joe can't post in the North room");
ok(e.post({ action: "chatsend", token: glen, room: "div:north", text: "North rules" }).ok, "Glen posts in his division room");
r = e.post({ action: "chat", token: glen });
ok(r.handles.glen === "Muffins" && r.mentions.some(m => m.who === "reilly" && m.room === "league"), "chat returns handles + Glen's @ mentions");
ok(!e.post({ action: "chat", token: joeTok }).mentions.some(m => /Muffins/.test(m.text)), "Joe's mentions don't include Glen's tag");

// 14 · ledger feed for the robot
let L = e.get({ action: "ledger" });
ok(L.ok && L.mode === "test" && L.picks.length === 2 * 12 * 17 && Array.isArray(L.trades), "ledger feed: picks + approved trades + rules");
ok(!JSON.stringify(L).includes("let's deal") && !JSON.stringify(L).includes("@example.com"), "ledger feed carries no notes or contacts");
// Joe answers "Contract resets" → rule flips
e.post({ action: "answers", token: joeTok, items: [{ qid: "keeper_travels", question: "q", choice: "Contract resets" }] });
ok(e.get({ action: "ledger" }).rules.contracts === "resets", "contract rule follows Joe's answer");

// 15 · 🗓️ off-season drafts (WS3): Divisional Draft + Slot Draft
const pete = e.post({ action: "login", pin: e.post({ action: "issue", token: mike, owner: "sikora" }).phrase }).token;
const hoos = e.post({ action: "login", pin: e.post({ action: "issue", token: mike, owner: "hoosier" }).phrase }).token;
const owen = e.post({ action: "login", pin: e.post({ action: "issue", token: mike, owner: "salerno" }).phrase }).token;
ok(e.post({ action: "draftopen", token: glen, kind: "div", order: ["murello", "salerno", "chappie", "hoosier"] }).error === "Commish only", "owners can't open a draft");
ok(/4 different owners/.test(e.post({ action: "draftopen", token: joeTok, kind: "div", order: ["murello", "murello", "chappie", "hoosier"] }).error), "div order needs 4 different owners");
r = e.post({ action: "draftopen", token: joeTok, kind: "div", mode: "test", season: 2027, order: ["murello", "salerno", "chappie", "hoosier"] });
ok(r.ok, "Joe opens a rehearsal Divisional Draft (2025's order)");
const dv = r.id;
ok(e.post({ action: "draftopen", token: joeTok, kind: "div", mode: "test", season: 2027, order: ["murello", "salerno", "chappie", "hoosier"] }).ok === false, "one open rehearsal per draft");
let D = e.post({ action: "drafts", token: glen }).drafts.find(x => x.id === dv);
ok(D && D.clock === "murello" && D.turns.join() === "murello,salerno,chappie,hoosier,hoosier,chappie,salerno,murello", "snake: the team who goes 4th also goes 5th");
ok(e.sheets.Chat.rows.some(x => x[6] === dv && /Rehearsal: The 2027 Divisional Draft is open/.test(x[4])), "league chat announces the draft");
ok(/Mike is on the clock/.test(e.post({ action: "draftpick", token: owen, id: dv, choice: { pick: "reilly", into: "salerno" } }).error), "can't pick out of turn");
ok(/already in/.test(e.post({ action: "draftpick", token: mike, id: dv, choice: { pick: "salerno", into: "murello" } }).error), "founders are already placed");
r = e.post({ action: "draftpick", token: mike, id: dv, n: 1, choice: { pick: "reilly", into: "murello" } });
ok(r.ok && r.draft.divs.murello.join() === "murello,reilly" && r.draft.clock === "salerno", "Mike takes Joe into his division");
ok(e.post({ action: "draftpick", token: mike, id: dv, n: 1, choice: { pick: "glen", into: "murello" } }).stale === true, "double tap: stale pick refused");
r = e.post({ action: "draftpick", token: owen, id: dv, choice: { pick: "glen", into: "chappie" } });
ok(r.ok && r.draft.assigned.chappie === 1, "Owen assigns Glen to Drew's division");
r = e.post({ action: "draftpick", token: joeTok, id: dv, choice: { pick: "farrington", into: "murello" } });
ok(r.ok && r.draft.divs.murello.length === 3 && e.sheets.Chat.rows.some(x => /Drew assigns Al to Mike's division \(entered by Joe\)/.test(x[4])), "commish enters Drew's pick (Drew isn't signed up yet)");
ok(/one each/.test(e.post({ action: "draftpick", token: hoos, id: dv, choice: { pick: "patel", into: "chappie" } }).error), "only one owner assigned into a division");
ok(/full/.test(e.post({ action: "draftpick", token: hoos, id: dv, choice: { pick: "patel", into: "murello" } }).error), "full division refused");
r = e.post({ action: "draftpick", token: hoos, id: dv, choice: { pick: "patel", into: "hoosier" } }); ok(r.ok && r.draft.clock === "hoosier", "Hoos #4, and goes again (4th also goes 5th)");
r = e.post({ action: "draftpick", token: hoos, id: dv, choice: { pick: "moyer", into: "hoosier" } }); ok(r.ok && r.draft.clock === "chappie", "Hoos #5");
ok(e.post({ action: "draftundo", token: glen, id: dv }).error === "Commish only", "owners can't undo");
ok(e.post({ action: "draftundo", token: joeTok, id: dv }).ok && e.post({ action: "drafts", token: glen }).drafts.find(x => x.id === dv).clock === "hoosier", "commish undoes the last pick");
e.post({ action: "draftpick", token: hoos, id: dv, choice: { pick: "moyer", into: "hoosier" } });
r = e.post({ action: "draftpick", token: joeTok, id: dv, choice: { pick: "smith", into: "chappie" } }); ok(r.ok, "Drew #6");
r = e.post({ action: "draftpick", token: owen, id: dv, choice: { pick: "bucher", into: "salerno" } }); ok(r.ok && r.draft.clock === "murello", "Owen #7");
ok(/full/.test(e.post({ action: "draftpick", token: mike, id: dv, choice: { pick: "sikora", into: "murello" } }).error), "Mike's division is full: he must assign");
r = e.post({ action: "draftpick", token: mike, id: dv, choice: { pick: "sikora", into: "salerno" } });
ok(r.ok && r.draft.status === "done" && r.draft.clock === null && Object.values(r.draft.divs).every(x => x.length === 3), "last pick fills the last slot: 4 divisions of 3");
ok(e.sheets.Chat.rows.some(x => /2027 Divisional Draft is done/.test(x[4])), "done posted");
// slot draft
const order12 = ["murello", "salerno", "moyer", "glen", "patel", "reilly", "chappie", "hoosier", "farrington", "bucher", "smith", "sikora"];
ok(/12 different/.test(e.post({ action: "draftopen", token: mike, kind: "slot", order: order12.slice(0, 11) }).error), "slot order needs all 12");
r = e.post({ action: "draftopen", token: mike, kind: "slot", mode: "test", order: order12 }); ok(r.ok, "Mike opens a rehearsal Slot Draft");
const sd = r.id;
ok(e.post({ action: "draftpick", token: mike, id: sd, choice: { slot: 13 } }).ok === false, "slots are 1–12");
ok(e.post({ action: "draftpick", token: mike, id: sd, choice: { slot: 1 } }).ok, "Mike takes slot 1");
ok(/taken/.test(e.post({ action: "draftpick", token: owen, id: sd, choice: { slot: 1 } }).error), "taken slot refused");
r = e.post({ action: "draftpick", token: owen, id: sd, choice: { slot: 12 } }); ok(r.ok && r.draft.slots[12] === "salerno", "Owen takes 12 (the 12/13 turn)");
ok(e.post({ action: "draftwipe", token: joeTok }).error === "Ops only", "only ops clears rehearsals");
L = e.get({ action: "ledger" });
ok(L.drafts.length === 1 && L.drafts[0].kind === "div" && L.drafts[0].mode === "test" && L.drafts[0].divs.salerno.join() === "salerno,glen,bucher,sikora".split(",").filter(x=>x!=="glen").join(), "ledger feed carries finished drafts");
r = e.post({ action: "draftwipe", token: mike }); ok(r.ok && r.cleared === 2 && e.post({ action: "drafts", token: mike }).drafts.length === 0, "ops clears rehearsals");
// 15a · 🎯 Shoot Out Draft (Appendix Three): Rule 1 pairs fixed, best seed left picks, last two auto-paired
ok(/two Rule 1/.test(e.post({ action: "draftopen", token: joeTok, kind: "shootout", mode: "test", season: 2026, order: order12, fixed: [["murello", "salerno"], ["salerno", "moyer"]] }).error), "an owner can't be in two Rule 1 matchups");
r = e.post({ action: "draftopen", token: joeTok, kind: "shootout", mode: "test", season: 2026, order: order12, fixed: [["salerno", "moyer", "East within 1 game + 50"]] });
ok(r.ok, "commish opens a rehearsal Shoot Out Draft with one Rule 1 matchup");
const so = r.id;
D = e.post({ action: "drafts", token: glen }).drafts.find(x => x.id === so);
ok(D.season === 2026 && D.clock === "murello" && D.turns.length === 5 && D.pairs.length === 1 && D.fixed[0].why, "Mike (seed 1) is up; 5 picks for the 10 unmatched");
ok(e.sheets.Chat.rows.some(x => x[6] === so && /Rule 1 matchups.*Owen vs/.test(x[4])), "league hears the Rule 1 matchups");
ok(/already has a Week 14 opponent/.test(e.post({ action: "draftpick", token: mike, id: so, choice: { opp: "moyer" } }).error), "Rule 1 teams can't be picked");
r = e.post({ action: "draftpick", token: mike, id: so, choice: { opp: "sikora" } }); ok(r.ok && r.draft.clock === "glen", "Mike picks Pete; Glen (next unmatched seed) is up");
ok(/Glen is on the clock/.test(e.post({ action: "draftpick", token: owen, id: so, choice: { opp: "patel" } }).error), "Rule 1 teams don't choose");
e.post({ action: "draftpick", token: glen, id: so, choice: { opp: "smith" } });
e.post({ action: "draftpick", token: joeTok, id: so, choice: { opp: "reilly" } }); // patel picks Joe (entered by Joe)
r = e.post({ action: "draftpick", token: joeTok, id: so, choice: { opp: "bucher" } }); // chappie picks bucher → hoosier vs farrington auto
ok(r.ok && r.draft.status === "done" && r.draft.pairs.length === 6 && r.draft.pairs[5].join() === "hoosier,farrington,last two", "last two are paired automatically and the draft closes");
ok(e.sheets.Chat.rows.some(x => x[6] === so && /Shoot Out, Week 14: .*Hoos vs Al/.test(x[4])), "league gets the Week 14 card");
ok(e.post({ action: "draftundo", token: joeTok, id: so }).ok && e.post({ action: "drafts", token: mike }).drafts.find(x => x.id === so).clock === "chappie", "undo takes back the auto pair with the pick before it");
L = e.get({ action: "ledger" }); ok(L.drafts.length === 0, "an open shoot out isn't in the ledger");
e.post({ action: "draftpick", token: joeTok, id: so, choice: { opp: "hoosier" } });
L = e.get({ action: "ledger" }); ok(L.drafts.length === 1 && L.drafts[0].kind === "shootout" && L.drafts[0].pairs.length === 6 && L.drafts[0].fixed.length === 1, "ledger feed carries the Shoot Out pairs");
e.post({ action: "draftwipe", token: mike });
r = e.post({ action: "settings", token: glen }); ok(r.notify.draft === false || r.notify.draft === true, "draft notify key exists");
ok(e.post({ action: "settings", token: owen }).notify.draft === true, "on-the-clock emails on by default");

// 15a2 · 📝 SPL Draft room (mod_spldraft): board from the pick ledger + keepers, 17-round snake, one player per turn
r = e.post({ action: "splpool", token: glen }); ok(r.ok && r.players.length === 2 && r.players[0][1] === "Bijan Robinson", "player pool: ESPN PPR ranks, no kickers");
r = e.post({ action: "draftopen", token: joeTok, kind: "spl", mode: "test", season: 2027, order: order12 }); ok(r.ok, "commish opens a rehearsal SPL Draft");
const sp = r.id;
D = e.post({ action: "drafts", token: glen }).drafts.find(x => x.id === sp);
const kc = D.cells.filter(c => c.skip === "keeper");
ok(D.cells.length === 204 && D.rounds === 17 && kc.length === 10 && D.turns.length === 194, "204 cells, the 10 carried 2027 keepers skip theirs: 194 turns");
const mk = kc.filter(c => c.owner === "murello").map(c => c.r);
ok(mk.length === 2 && mk.every(r => r >= 16), "Mike's 2 keepers fill his last two picks (rounds 16–17)");
ok(D.cells[12].orig === order12[11] && D.cells[23].orig === order12[0], "snake: round 2 runs 12 → 1");
ok(D.clock === D.cells[0].owner && D.at.n === 1, "the owner of pick 1 (per the pick ledger) is on the clock");
ok(e.sheets.Chat.rows.some(x => x[6] === sp && /10 keepers and 0 Franchise Tag/.test(x[4])), "league hears the board is set");
const tok = { murello: mike, salerno: owen, glen, hoosier: hoos, reilly: joeTok };
const pick = (pl, extra) => e.post(Object.assign({ action: "draftpick", token: joeTok, id: sp, choice: { player: pl, pos: "RB", tm: "ATL" } }, extra || {}));
ok(/is gone .*keeper/.test(pick("Brock Bowers").error), "a keeper can't be drafted");
r = pick("Bijan Robinson"); ok(r.ok && r.draft.cells[0].player === "Bijan Robinson" && r.draft.picks.length === 1, "commish enters pick 1");
ok(/is gone \(R1\.1/.test(pick("bijan  robinson").error), "same player twice refused (names normalized)");
{ const up = e.post({ action: "drafts", token: mike }).drafts.find(x => x.id === sp).clock, other = up === "glen" ? owen : glen;
  ok(/on the clock/.test(e.post({ action: "draftpick", token: other, id: sp, choice: { player: "X Y" } }).error), "can't pick out of turn"); }
for (let i = 2; i <= 12; i++) pick("Player " + i);
ok(e.sheets.Chat.rows.some(x => x[6] === sp && /SPL Draft · Round 1: .*Bijan Robinson/.test(x[4])) && !e.sheets.Chat.rows.some(x => x[6] === sp && /pick 2:/.test(x[4])), "one chat post per round, not per pick");
ok(e.post({ action: "draftundo", token: joeTok, id: sp }).ok && e.post({ action: "drafts", token: mike }).drafts.find(x => x.id === sp).picks.length === 11, "undo works on the SPL board");
e.post({ action: "draftwipe", token: mike });

// 15b · 🔒 Keeper Signing Day: scenarios + declarations (mod_keepers)
r = e.post({ action: "kplans", token: mike, season: 2027, plans: [{ name: "Keep both", signs: [{ player: "Bench Guy", term: 2 }] }, { name: "=Cut Bowers", cuts: ["C2025-murello-bowers"] }, {}, {}, {}, {}] });
ok(r.ok && r.plans.length === 5 && r.plans[2].name === "Plan C" && r.plans[4].name === "Plan E", "scenarios saved (max 5, named)");
r = e.post({ action: "keepers", token: mike, season: 2027 }); ok(r.ok && r.plans[1].name === "=Cut Bowers" && e.sheets.KeeperPlans.rows[1][2].indexOf("=Cut") > 0, "scenarios follow the sign-in (formula-guarded in the Sheet)");
ok(e.post({ action: "kdeclare", token: mike, signs: [] }).error === "Signing Day isn't open.", "no declaring before Signing Day opens");
ok(e.post({ action: "kwindow", token: glen, op: "open", mode: "test" }).ok === false, "owners can't open Signing Day");
r = e.post({ action: "kwindow", token: mike, op: "open", mode: "test", season: 2027, closes: "2099-09-01" }); ok(r.ok && r.window.status === "open", "desk opens a rehearsal Signing Day");
ok(e.sheets.Chat.rows.some(x => /Rehearsal: 2027 Keeper Signing Day is open/.test(x[4])), "league chat hears it's open");
r = e.post({ action: "kdeclare", token: mike, check: true, signs: [{ player: "Josh Allen", term: 1 }] });
ok(r.ok && !r.valid && r.kp === 18 && r.errors.some(x => /over the 10 KP cap by 8/.test(x)), "check: Allen (R1 = 10) on top of Bowers 5 + Shough 3 is over the cap");
r = e.post({ action: "kdeclare", token: mike, check: true, signs: [{ player: "Chris Olave", term: 1 }, { player: "Nobody Atall", term: 1 }] });
ok(r.errors.some(x => /Olave: contract just ran out/.test(x)) && r.errors.some(x => /Nobody Atall isn't on your ESPN roster/.test(x)), "no extensions + must be on your roster");
r = e.post({ action: "kdeclare", token: mike, signs: [{ player: "Josh Allen", term: 1 }] }); ok(!r.ok && /over the 10 KP cap/.test(r.error), "over-cap declaration refused");
r = e.post({ action: "kdeclare", token: mike, cuts: ["C2025-murello-bowers"], signs: [{ player: "Bench Guy", term: 2 }] });
ok(r.ok && r.kp === 7.5 && r.items.cuts[0].pen["2027"] === 2.5 && r.items.signs[0].kp["2028"] === 3 && r.items.keep[0].player === "Tyler Shough", "terminate Bowers (−2.5) + sign Bench Guy 2-yr (2 → 3): 7.5 KP");
ok(e.sheets.Chat.rows.some(x => /🧪 Mike declared his 2027 keepers: Tyler Shough \(3\), 🆕 Bench Guy 2-yr \(2\) · ✂️ terminated Brock Bowers \(−2.5 penalty\) · 7.5 of 10 KP/.test(x[4])), "declaration posted to league chat");
r = e.post({ action: "kdeclare", token: mike, signs: [{ player: "Bench Guy", term: 1, tag: true }, { player: "Josh Allen", term: 1 }] }); ok(!r.ok && /4 keepers|over the 10/.test(r.error), "three keeper max / cap hold on a change");
r = e.post({ action: "kdeclare", token: mike, signs: [{ player: "Bench Guy", term: 3, tag: true }] });
ok(r.ok && r.items.signs[0].kp["2028"] === "F" && r.items.firstLost && r.kp === 10, "Franchise Tag: year-one KP, then F years, no 1st");
ok(e.sheets.Chat.rows.some(x => /Mike changed his 2027 keepers/.test(x[4])), "a change says so");
ok(e.post({ action: "kdeclare", token: glen, owner: "murello", signs: [] }).ok === false, "owners can't declare for someone else");
r = e.post({ action: "keepers", token: glen }); ok(r.decls.length === 1 && r.decls[0].owner === "murello" && r.decls[0].kp === 10 && r.window.mode === "test", "everyone sees the board (latest declaration only)");
ok(e.get({ action: "ledger" }).keepers.length === 0, "nothing final while open");
r = e.post({ action: "kwindow", token: joeTok, op: "close" }); ok(r.ok && r.window.status === "closed" && r.window.done, "commish closes Signing Day");
ok(e.sheets.Chat.rows.some(x => /🏁 🧪 Rehearsal 2027 Signing Day is done \(closed by Joe\): 1 of 12 declared/.test(x[4])), "results posted once");
L = e.get({ action: "ledger" }); ok(L.keepers.length === 1 && L.keepers[0].status === "final" && L.keepers[0].mode === "test" && L.keepers[0].items.signs[0].tag, "ledger feed carries final declarations");
ok(e.post({ action: "kdeclare", token: mike, signs: [] }).error === "Signing Day isn't open.", "closed = no more changes");
ok(e.post({ action: "kwindow", token: joeTok, op: "wipe" }).error === "Ops only", "only ops wipes a rehearsal");
r = e.post({ action: "kwindow", token: mike, op: "wipe" }); ok(r.ok && r.wiped === 1 && e.get({ action: "ledger" }).keepers.length === 0 && !e.post({ action: "keepers", token: mike }).window, "ops wipes the rehearsal");

// 15c · 🔒 declaring opens by itself when the off-season starts (Season_Calendar 2027 offseason = Feb 15)
{ const realNow = Date.now; Date.now = () => Date.parse("2027-03-01T15:00:00Z");
  try { const k = makeEnv({}, espnOk); k.M.menuCheck(); const kp = k.post({ action: "issue", token: (() => { const m = /\n([A-Z]+-[A-Z]+-\d{3})\n/.exec(k.alerts[0]); return k.post({ action: "login", pin: m[1] }).token; })(), owner: "glen" }).phrase;
    const kg = k.post({ action: "login", pin: kp }).token, w = k.post({ action: "keepers", token: kg }).window;
    ok(w && w.auto && w.mode === "live" && w.status === "open" && w.season === 2027, "off-season start opens live declaring by itself");
    k.get({ action: "ledger" }); k.get({ action: "ledger" });
    ok(k.sheets.Chat.rows.filter(x => /off-season is here: 2027 keeper declaring is open/.test(x[4])).length === 1, "…and tells the league once");
  } finally { Date.now = realNow; } }
ok(!e.post({ action: "keepers", token: mike }).window, "before the off-season: nothing open");

// 5b · 🔥 reel reactions (WS4)
r = e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "🔥" }); ok(r.ok && r.on && r.reacts["🔥"].join() === "glen", "Glen reacts 🔥");
e.post({ action: "react", token: owen, key: "2026-12:slate", emoji: "🔥" }); e.post({ action: "react", token: owen, key: "2026-12:high", emoji: "😂" });
r = e.post({ action: "reacts", token: mike, keys: ["2026-12:slate", "2026-12:high", "nope"] });
ok(r.ok && r.reacts["2026-12:slate"]["🔥"].length === 2 && r.reacts["2026-12:high"]["😂"][0] === "salerno" && !r.reacts.nope, "everyone sees reactions by card");
r = e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "🔥" }); ok(r.ok && !r.on && r.reacts["🔥"].join() === "salerno", "tap again takes it back");
ok(e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "💩" }).ok === false, "only the reel's emojis");
ok(e.post({ action: "react", token: glen, key: "=HYPERLINK(1)", emoji: "🔥" }).ok === false, "bad card keys refused");
ok(e.post({ action: "react", key: "2026-12:slate", emoji: "🔥" }).ok === false, "signed-in only");

// 5c · 🗳️ votes (Game of the Week + quizzes): one per owner, locked, results only after you vote
r = e.post({ action: "social", token: glen, refs: ["quiz:2026-11"] }); ok(r.ok && r.votes["quiz:2026-11"].total === 0 && !r.votes["quiz:2026-11"].counts, "no results before you vote");
r = e.post({ action: "vote", token: owen, ref: "quiz:2026-11", choice: "patel" }); ok(r.ok && r.votes["quiz:2026-11"].mine === "patel" && r.votes["quiz:2026-11"].counts.patel === 1, "Owen votes and sees results");
ok(/can't be changed/.test(e.post({ action: "vote", token: owen, ref: "quiz:2026-11", choice: "glen" }).error), "votes are locked");
r = e.post({ action: "social", token: glen, refs: ["quiz:2026-11"], keys: ["2026-12:slate"] }); ok(r.votes["quiz:2026-11"].total === 1 && !r.votes["quiz:2026-11"].counts && r.reacts["2026-12:slate"], "Glen sees a count but not the split until he votes");
ok(/closed/.test(e.post({ action: "vote", token: glen, ref: "gotw:2026-2", choice: "a~b" }).error), "Game of the Week closes Thursday");
ok(e.post({ action: "react", token: glen, key: "2026-12:awards", emoji: "🏆" }).ok, "series trays: 🏆 allowed");


// 6b · 🏈 WS5: 4-team test league mirrors 4 SPL rosters; approved demo trades execute on ESPN (test league only) + read back
{
  const SPL = { "Bad Attitude Gang": [1, 2], "Reilly's RaMPaGe": [3, 4], "Farrington's FREELANCERS": [5], "Fluff Muffins": [6], "Tijuana Trojans": [7] };
  const NAMES = { 1: "Josh Allen", 2: "Bijan Robinson", 3: "Chris Olave", 4: "Sam LaPorta", 5: "Derrick Henry", 6: "Puka Nacua", 7: "Smith Guy", 9: "Junk One", 10: "Junk Two" };
  const T = { 1: [9], 2: [], 3: [10, 3], 4: [] }; // test league before the mirror (team 3 = Mike's SWID)
  const posts = []; let rejectTrades = false; const NAMES_T = {};
  const ent = id => ({ playerId: id, lineupSlotId: 20, playerPoolEntry: { player: { id, fullName: NAMES[id], defaultPositionId: 2, proTeamId: 2, stats: [] } } });
  const mock = (url, o) => {
    const res = (code, b) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(b) });
    if (o && o.method === "put") {
      const tid = +/teams\/(\d+)$/.exec(url)[1], b = JSON.parse(o.payload); posts.push(b);
      if (b.name.length > 24) return res(400, { messages: ["Team name too long"] });
      NAMES_T[tid] = b.name; return res(200, {});
    }
    if (o && o.method === "post") {
      ok(/lm-api-writes.*leagues\/1722387564\/transactions\/$/.test(url), "write goes only to the test league (" + url.split("/leagues/")[1] + ")");
      const b = JSON.parse(o.payload); posts.push(b);
      if (b.type !== "FREEAGENT" && rejectTrades) return res(409, { messages: ["Roster limit"] });
      const where = id => Object.keys(T).find(k => T[k].includes(id));
      for (const it of b.items) {
        if (it.type === "ADD" && where(it.playerId)) return res(409, { messages: ["Player already rostered"] });
        if (it.type === "DROP" || it.type === "TRADE") T[it.fromTeamId] = T[it.fromTeamId].filter(x => x !== it.playerId);
        if (it.type === "ADD" || it.type === "TRADE") T[it.toTeamId].push(it.playerId);
      }
      return res(200, { status: "EXECUTED" });
    }
    const lid = /leagues\/(\d+)/.exec(url)[1];
    if (lid === "19583") return res(200, { scoringPeriodId: 13, settings: { name: "SPL" }, teams: Object.keys(SPL).map((n, i) => ({ id: i + 1, name: n, roster: { entries: SPL[n].map(ent) } })) });
    return res(200, { scoringPeriodId: 13, settings: { name: "Testing MAFFL HQ" }, teams: [4, 3, 2, 1].map(id => ({ id, name: NAMES_T[id] || "Test " + id, owners: id === 3 ? ["{XYZ}"] : ["{OTHER}"], roster: { entries: T[id].map(ent) } })) });
  };
  const w = makeEnv({ ESPN_S2: "abc", SWID: "XYZ" }, mock);
  w.M.menuCheck(); const mp = (/\n([A-Z]+-[A-Z]+-\d{3})\n/.exec(w.alerts[0]) || [])[1];
  const wm = w.post({ action: "login", pin: mp }).token;
  const wj = w.post({ action: "login", pin: w.post({ action: "issue", token: wm, owner: "reilly" }).phrase }).token;
  const ws = w.post({ action: "login", pin: w.post({ action: "issue", token: wm, owner: "smith" }).phrase }).token;
  ok(w.post({ action: "testleague", token: wj }).ok === false, "test league desk is ops only");
  let d = w.post({ action: "testleague", token: wm });
  const byO = o => d.teams.find(x => x.owner === o);
  ok(d.ok && d.teams.length === 4 && byO("murello").teamId === 3 && byO("reilly").teamId === 1 && byO("farrington").teamId === 2 && byO("glen").teamId === 4, "4 test teams: Mike's own ESPN team = Mike, then Joe, Al, Glen by id");
  ok(byO("reilly").drops === 1 && byO("reilly").moves === 1 && byO("reilly").adds === 1 && byO("reilly").match === 0 && byO("murello").drops === 1 && byO("murello").adds === 2, "mirror plan: drop the unwanted, move SPL players sitting on another test team, add the rest");
  ok(d.writes === false && w.post({ action: "mirror", token: wm, owner: "reilly", step: "drops" }).ok === false && posts.length === 0, "writes off: nothing sent");
  ok(w.post({ action: "espnwrites", token: wj, on: true }).ok === false, "only ops flips the ESPN switch");
  ok(w.post({ action: "espnwrites", token: wm, on: true }).writes === true, "Mike turns ESPN writes on");
  ["murello", "reilly", "farrington", "glen"].forEach(o => w.post({ action: "mirror", token: wm, owner: o, step: "names" }));
  ok(!Object.keys(NAMES_T).length && !posts.some(b => b.name) && w.post({ action: "testleague", token: wm }).teams.every(t => !("rename" in t)), "test team names stay as ESPN has them: no rename write, nothing flagged");
  posts.length = 0;
  ["drops", "moves"].forEach(st => ["murello", "reilly", "farrington", "glen"].forEach(o => w.post({ action: "mirror", token: wm, owner: o, step: st })));
  ok(T[1].includes(3) && posts.some(b => b.type === "TRADE_PROPOSAL" && b.items[0].playerId === 3 && b.items[0].fromTeamId === 3 && b.items[0].toTeamId === 1), "Olave moved Mike's test team → Joe's by LM trade (no waivers)");
  let last; ["murello", "reilly", "farrington", "glen"].forEach(o => { last = w.post({ action: "mirror", token: wm, owner: o, step: "adds" }); });
  ok(last.ok && last.left === 0 && last.match === 1, "mirror step reads back what's left");
  d = w.post({ action: "testleague", token: wm });
  ok(d.teams.every(x => x.match === x.want && x.drops === 0 && x.adds === 0), "after the mirror every test team matches its SPL roster");
  ok(posts.every(b => b.isLeagueManager === true && b.executionType === "EXECUTE" && b.memberId === "{XYZ}") && posts.filter(b => b.type === "FREEAGENT").every(b => b.items.length === 1), "commish moves, one player per add/drop, no retries");
  ok(w.sheets.EspnLog.rows.length === posts.length + 1, "every write logged");
  // Demo trade: Mike's Allen for Joe's Olave → Joe accepts → Joe approves (commish-to-commish) → ESPN moves it, read back
  let o = w.post({ action: "offer", token: wm, to: "reilly", give: { players: [{ n: "Josh Allen", id: 1 }] }, get: { players: [{ n: "Chris Olave" }] } });
  ok(o.ok && o.offer.give.players[0].id === 1, "offers keep the ESPN player id");
  w.post({ action: "respond", token: wj, id: o.offer.id, decision: "accept" });
  const before = posts.length;
  ok(w.post({ action: "tradeact", token: wj, id: o.offer.id, decision: "approve" }).ok, "Joe approves the demo trade");
  const tp = posts[before];
  ok(posts.length === before + 1 && tp.type === "TRADE_PROPOSAL" && tp.items.length === 2 && tp.items.every(i => i.type === "TRADE") && tp.expirationDate === null && tp.isActingAsTeamOwner === false, "one LM trade write, both players, MAFFL's exact body");
  ok(T[1].includes(1) && T[3].includes(3), "players moved on the test league");
  let off = w.post({ action: "trades", token: wm }).offers.find(x => x.id === o.offer.id);
  ok(off.espn === "done" && /test league/.test(off.espnNote), "read back: done on ESPN");
  ok(w.sheets.Chat.rows.some(x => x[2] === "league" && /done on ESPN \(test league\)/.test(x[4])), "league card says it's done on ESPN");
  // ESPN refuses → Do-on-ESPN step with ESPN's reason, never retried
  rejectTrades = true;
  o = w.post({ action: "offer", token: wj, to: "murello", give: { players: [{ n: "Sam LaPorta" }] }, get: { players: [{ n: "Bijan Robinson" }] } });
  w.post({ action: "respond", token: wm, id: o.offer.id, decision: "accept" });
  const b2 = posts.length; w.post({ action: "tradeact", token: wm, id: o.offer.id, decision: "approve" });
  off = w.post({ action: "trades", token: wm }).offers.find(x => x.id === o.offer.id);
  ok(posts.length === b2 + 1 && off.espn === "todo" && /409.*Roster limit/.test(off.espnNote), "ESPN refuses: one try, Do-on-ESPN step with the reason");
  ok(w.post({ action: "desk", token: wj }).espn.some(x => x.id === o.offer.id), "it lands on the commish desk's Do on ESPN list");
  // a team not in the test league: nothing sent
  rejectTrades = false;
  o = w.post({ action: "offer", token: ws, to: "reilly", give: { players: [{ n: "Smith Guy" }] }, get: { players: [{ n: "Chris Olave" }] } });
  ok(o.ok, "Matt offers (not a test-league team)");
  w.post({ action: "respond", token: wj, id: o.offer.id, decision: "accept" }); const b3 = posts.length;
  ok(w.post({ action: "tradeact", token: wm, id: o.offer.id, decision: "approve" }).ok && posts.length === b3, "Matt isn't a test team: approved, nothing sent to ESPN");
  ok(w.post({ action: "trades", token: wm }).offers.find(x => x.id === o.offer.id).espn === "test", "…and nothing owed (test mode)");
  // 📝 SPL Draft board → ESPN (test league): proven LM adds, read ESPN first, never re-add, no team = skipped
  Object.assign(NAMES, { 21: "Rookie A", 22: "Rookie B", 23: "Rookie C" });
  const ord = ["reilly", "murello", "smith", "farrington", "glen", "chappie", "sikora", "hoosier", "patel", "salerno", "moyer", "bucher"];
  const dr = w.post({ action: "draftopen", token: wm, kind: "spl", mode: "test", season: 2027, order: ord }).id;
  const dp = (pl, pid) => w.post({ action: "draftpick", token: wm, id: dr, choice: { player: pl, pos: "RB", tm: "BUF", pid } });
  const p0 = posts.length; dp("Rookie A", 21); dp("Rookie B", 22); dp("Rookie C", 23);
  ok(posts.length === p0, "rehearsal picks don't write to ESPN by themselves");
  ok(w.post({ action: "draftespnsync", token: ws, id: dr }).ok === false, "only the desk loads the board");
  let es = w.post({ action: "draftespnsync", token: wm, id: dr });
  ok(es.ok && es.sent === 2 && T[1].includes(21) && T[3].includes(22) && es.status.noTeam >= 1, "Joe's + Mike's picks added to their test teams; Matt has no test team");
  ok(es.fails.some(f => /no ESPN id/.test(f)), "keepers ESPN can't find are flagged, not guessed");
  const p1 = posts.length; es = w.post({ action: "draftespnsync", token: wm, id: dr });
  ok(es.ok && posts.length === p1 && es.status.on === 2, "second load re-reads ESPN: nothing re-added");
  ok(w.post({ action: "draftespn", token: wj, id: dr }).status.on === 2, "desk sees the ESPN status");
}
// 6 · ESPN 401 surfaces as an error, not a crash
e = makeEnv({ ESPN_S2: "abc", SWID: "{XYZ}" }, () => ({ getResponseCode: () => 401, getContentText: () => "" }));
h = e.get({ action: "health" });
ok(h.ok && h.espnRead.ok === false && /401/.test(h.espnRead.error), "ESPN 401 reported");

// 🛠️ WS7 · ops robots: watchdog, backup, alerts, desk feed
{
  const signMike = (w) => { w.M.menuCheck(); const ph = (/\n([A-Z]+-[A-Z]+-\d{3})\n/.exec(w.alerts[w.alerts.length - 1]) || [])[1]; return w.post({ action: "login", pin: ph }).token; };
  const reset = () => { GH.runs = {}; GH.dispatched = []; GH.code = 200; GH.live = GH.main = "0.14"; };
  // lazy tick: no trigger yet → a health ping runs it once
  reset(); let w = makeEnv({ ESPN_S2: "abc", SWID: "{X}", GH_TOKEN: "t" }, espnOk);
  w.get({ action: "health", fresh: "1" });
  ok(JSON.parse(w.props.OPS_TICK).by === "lazy", "no trigger: the health ping runs the tick");
  const backups = w.mails.filter(m => /^SPL HQ backup/.test(m.s));
  ok(backups.length === 1 && backups[0].to === "spl.hq.ops@gmail.com" && backups[0].att[0].zip && backups[0].att[0].files.includes("Owners.csv"), "daily backup zip mailed to the ops account only");
  ok(!w.mails.some(m => /needs a look/.test(m.s)), "all green: no alert");
  w.get({ action: "health", fresh: "1" }); ok(w.mails.filter(m => /^SPL HQ backup/.test(m.s)).length === 1, "second ping within 70 min: no second tick / backup");
  // watchdog: ledger 5 h late + history 30 h late → run by hand once each; card lines (chained) left alone
  reset(); GH.runs["ledger-sync.yml"] = [ghRun(5, "success", "workflow_dispatch")]; GH.runs["espn-history.yml"] = [ghRun(30)]; GH.runs["card-lines.yml"] = [ghRun(200)];
  w.M.tick();
  ok(GH.dispatched.join() === "ledger-sync.yml,espn-history.yml", "watchdog runs the robots GitHub's schedule skipped (" + GH.dispatched.join() + ")");
  ok(JSON.parse(w.props.OPS_WATCHDOG).length === 2 && JSON.parse(w.props.OPS_TICK).by === "trigger", "watchdog log kept; tick by trigger");
  ok(w.sheets.Log.rows.some(r => r[1] === "watchdog"), "watchdog logged in the Log tab");
  GH.runs["ledger-sync.yml"] = [{ created_at: iso(0.1), status: "in_progress", event: "workflow_dispatch" }, ghRun(5)]; GH.dispatched = [];
  GH.runs["espn-history.yml"] = [ghRun(0.1, "success", "workflow_dispatch")];
  w.M.tick(); ok(GH.dispatched.length === 0, "never re-runs a robot that's running or just ran");
  // a failing robot: one email when it breaks, none while it stays broken, "all clear" when fixed
  const n0 = w.mails.length; GH.runs["ledger-sync.yml"] = [ghRun(1, "failure")];
  w.M.tick(); const al = w.mails.slice(n0).filter(m => /needs a look/.test(m.s));
  ok(al.length === 1 && /Ledger sync failed/.test(al[0].b) && GH.dispatched.length === 0, "robot failure → one alert email, no blind retry");
  w.M.tick(); ok(w.mails.slice(n0).filter(m => /needs a look/.test(m.s)).length === 1, "still failing: no repeat email");
  GH.runs["ledger-sync.yml"] = [ghRun(0.5)]; w.M.tick();
  ok(w.mails.slice(n0).some(m => /all clear/.test(m.s)), "fixed → all clear email");
  // no GH_TOKEN: can't run late robots → says so
  reset(); let w2 = makeEnv({ ESPN_S2: "abc", SWID: "{X}" }, espnOk); GH.runs["ledger-sync.yml"] = [ghRun(9)];
  w2.M.tick(); ok(GH.dispatched.length === 0 && w2.mails.some(m => /needs a look/.test(m.s) && /add GH_TOKEN/.test(m.b)), "no GH_TOKEN: late robot → alert asks for the token");
  // Pages stuck on an old app for > 1 h
  reset(); GH.live = "0.13"; w2.props.OPS_PAGES = JSON.stringify({ same: false, since: iso(2) }); w2.M.tick();
  ok(w2.mails.some(m => /Pages serves app v0\.13 but main is v0\.14/.test(m.b)), "Pages behind main for 2 h → alert");
  // ESPN cookie age: first seen now; a new cookie restarts the clock
  ok(/\|/.test(w2.props.ESPN_S2_SEEN), "cookie first-seen date recorded");
  w2.props.ESPN_S2_SEEN = w2.props.ESPN_S2_SEEN.split("|")[0] + "|" + iso(24 * 340); reset(); w2.M.tick();
  ok(w2.mails.some(m => /ESPN cookies are 340 days old/.test(m.b)), "old ESPN cookies → refresh alert");
  w2.props.ESPN_S2 = "new"; w2.M.tick(); ok(JSON.parse(JSON.stringify(w2.props.ESPN_S2_SEEN)).split("|")[1] > iso(1), "new cookies restart the clock");
  // desk feed: ops only
  reset(); const wm = signMike(w);
  const joeT = w.post({ action: "login", pin: w.post({ action: "issue", token: wm, owner: "reilly" }).phrase }).token;
  ok(w.post({ action: "opsx", token: joeT }).ok === false, "opsx is ops only");
  let x = w.post({ action: "opsx", token: wm });
  ok(x.ok && x.robots.list.length === 6 && x.robots.tokenExp === GH.exp && x.sheet.limit === 10000000 && x.cookie.set && x.tick.at, "Ops desk feed: robots, token expiry, sheet size, cookie, tick");
  const nb = w.mails.length; x = w.post({ action: "opsx", token: wm, run: "backup" });
  ok(x.did && x.did.sentAt && w.mails.length === nb + 1, "Back up now sends one");
  x = w.post({ action: "opsx", token: wm, run: "tick" }); ok(x.did && x.did.ok && JSON.parse(w.props.OPS_TICK).by === "desk", "Run checks now from the desk");
  // 👋 welcome tour replay: ops only; one owner, then everyone; "me" hands each owner the newest stamp that applies
  ok(w.post({ action: "tour", token: joeT, target: "*" }).ok === false, "tour replay is ops only");
  ok(w.post({ action: "me", token: joeT }).tour === "", "no tour stamp until ops replays it");
  ok(w.post({ action: "tour", token: wm, target: "nobody" }).ok === false, "tour replay needs a real owner");
  x = w.post({ action: "tour", token: wm, target: "reilly" }); const st1 = w.post({ action: "me", token: joeT }).tour;
  ok(x.ok && /^T\d+$/.test(st1) && w.post({ action: "me", token: wm }).tour === "", "replay for one owner stamps only him");
  x = w.post({ action: "tour", token: wm, target: "*" }); const st2 = w.post({ action: "me", token: wm }).tour;
  ok(x.ok && x.n > 0 && /^T\d+$/.test(st2) && w.post({ action: "me", token: joeT }).tour === st2, "replay for everyone stamps every owner");
  // 👀 usage: any owner posts what he opened/tapped; ops reads it; first open emails ops once; typed junk is dropped
  const t0 = Date.now(), nm = w.mails.length;
  x = w.post({ action: "track", token: joeT, ev: [{ k: "open", w: "app", t: t0 - 9000 }, { k: "view", s: "home", n: 42, t: t0 - 8000 }, { k: "tap", w: "Keepers", s: "team", t: t0 - 5000 }, { k: "view", s: "team", n: 30, t: t0 - 4000 }, { k: "evil", w: "x" }, { k: "tap", w: "=HYPERLINK(1)", s: "home" }] });
  ok(x.ok && x.n === 5, "track stores the known kinds only");
  ok(w.mails.length === nm + 1 && /Joe just opened/.test(w.mails[nm].s), "first open emails ops");
  w.post({ action: "track", token: joeT, ev: [{ k: "open", w: "app" }] }); ok(w.mails.length === nm + 1, "…only once");
  ok(w.post({ action: "usage", token: joeT }).ok === false, "usage is ops only");
  x = w.post({ action: "usage", token: wm }); const uj = x.owners.filter(u => u.owner === "reilly")[0];
  ok(x.ok && uj && uj.opens === 2 && uj.min === 1.2 && uj.taps === 2 && uj.screens[0].s === "home" && uj.tapped.some(t => t.w === "team · Keepers") && x.never.some(o => o.owner === "glen"), "Ops desk usage: visits, minutes, top screens + taps, never opened");
  ok(w.sheets.Usage.rows.some(r => r[3] === "'=HYPERLINK(1)"), "usage rows are formula-guarded");
  { const U = w.sheets.Usage.rows, yd = new Date(Date.now() - 5 * 3.6e6 - 864e5); yd.setUTCHours(17);
    U.splice(1, 0, [new Date(Date.now() - 200 * 864e5), "reilly", "open", "app", "", 0]); U.push([new Date(yd.getTime() + 5 * 3.6e6), "reilly", "view", "", "match", 300]);
    delete w.props.USAGE_DIGEST; const nd = w.mails.length; w.M.tick();
    ok(!U.some(r => r[0] instanceof Date && r[0].getTime() < Date.now() - 150 * 864e5), "usage robot trims rows past 120 days");
    const late = new Date(Date.now() - 5 * 3.6e6).getUTCHours() >= 7;
    ok(!late || w.mails.slice(nd).some(m => /who was in yesterday/.test(m.s) && /Joe: .*5 min.*match 5m/.test(m.b)), "morning digest of yesterday's visits (after 7 AM ET)"); }
  // 🍂 season phase: desk-only switch, public read, chat line on the off-season flip, never flips by itself
  ok(w.get({ action: "phase" }).phase.phase === "season", "phase starts as season");
  { const gT = w.post({ action: "login", pin: w.post({ action: "issue", token: wm, owner: "glen" }).phrase }).token;
    ok(w.post({ action: "setphase", token: gT, phase: "offseason" }).ok === false && w.get({ action: "phase" }).phase.phase === "season", "owners can't flip the phase"); }
  x = w.post({ action: "setphase", token: wm, phase: "bogus" }); ok(x.ok === false, "setphase rejects a bad phase");
  const flips = () => (w.sheets.Chat ? w.sheets.Chat.rows : []).filter(r => /off-season is open/.test(r[4])).length;
  x = w.post({ action: "setphase", token: wm, phase: "offseason", season: 2027 });
  ok(x.ok && x.phase.phase === "offseason" && x.phase.by === "murello", "ops flips to the off-season");
  ok(w.get({ action: "phase" }).phase.phase === "offseason" && w.post({ action: "me", token: joeT }).phase.phase === "offseason", "every phone reads it (GET + me)");
  ok(flips() === 1, "flip posts one line to league chat");
  ok(w.post({ action: "setphase", token: wm, phase: "offseason" }).same === true && flips() === 1, "flipping again is a no-op");
  x = w.post({ action: "setphase", token: wm, phase: "season" }); ok(x.ok && w.get({ action: "phase" }).phase.phase === "season" && flips() === 1, "back to the season, quietly");
  GH.code = 401; x = w.post({ action: "opsx", token: wm, run: "tick" });
  ok(/401/.test(x.robots.list[0].error), "GitHub token refused shows on the desk");
  reset();
}

// 7 · size limit for the loader cache
ok(src.length < 90000, "logic.js under 90 KB (" + src.length + ")");
Object.keys(parts).forEach(n => ok(parts[n].length < 90000, n + ".js under 90 KB (" + parts[n].length + ")"));
ok(partFetches > 0, "core loaded its parts (" + Object.keys(parts).join(", ") + ")");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
