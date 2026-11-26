// Smoke test for backend/logic.js with mocked Apps Script services. Run: node tests/backend_smoke.js
// Required before every backend push (CLAUDE.md). Exits non-zero on any failure.
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "backend", "logic.js"), "utf8");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

function makeEnv(props, espn) {
  const sheets = {}, mails = [], cache = {}, alerts = [];
  const mkSheet = (name) => ({ name, rows: [], appendRow(r) { this.rows.push(r); }, setFrozenRows() {},
    getRange(r, c, nr, nc) { const s = this; return { setValues(v) { const row = (s.rows[r - 1] || []).slice(); v[0].forEach((x, i) => { row[c - 1 + i] = x; }); s.rows[r - 1] = row; } }; },
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
    Utilities: { getUuid: () => require("crypto").randomUUID(),
      computeHmacSha256Signature: (t, k) => Array.from(require("crypto").createHmac("sha256", k).update(t).digest()).map(b => b > 127 ? b - 256 : b) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 99, sendEmail: (to, s, b) => mails.push({ to, s, b }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "spl.hq.ops@gmail.com" }) },
    UrlFetchApp: { fetch: (url, o) => espn(url, o) }
  };
  const M = {};
  new Function(...Object.keys(G), "M", src)(...Object.values(G), M);
  const out = r => JSON.parse(r.t);
  return { M, sheets, mails, alerts, props, get: p => out(M.doGet({ parameter: p })), post: b => out(M.doPost({ postData: { contents: JSON.stringify(b) } })) };
}
const espnOk = (url) => {
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
ok(t.ok && t.mode === "test" && t.rules.pickYearsFrom === "Joe" && t.seasons.join() === "2027,2028" && t.picks.length === 2 * 12 * 17 && t.picks.every(p => p.owner === p.original), "pick seasons follow Joe's answer (2 seasons): 2027 + 2028 seeded");
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
ok(t.offers.find(o => o.id === g.offer.id).espn === "test", "test mode: nothing owed on ESPN");
ok(e.sheets.Chat.rows.some(r => r[2] === "league" && /Trade approved/.test(r[4])), "league chat announces it");
r = e.post({ action: "tradeact", token: joeTok, id: tid, decision: "approve" });
ok(r.ok && e.sheets.Chat.rows.some(x => /commish-to-commish trade, approved by Joe/.test(x[4])), "Mike↔Joe trade: approvable, flagged to the league");
// counter
const c1 = e.post({ action: "offer", token: glen, to: "reilly", give: { picks: ["2027-R4-glen"] }, get: { players: [{ n: "Omarion Hampton" }] } });
const c2 = e.post({ action: "offer", token: joeTok, to: "glen", counterOf: c1.offer.id, give: { players: [{ n: "Chris Olave" }] }, get: { picks: ["2027-R4-glen", "2027-R5-glen"] } });
ok(c2.ok && e.post({ action: "trades", token: glen }).offers.find(o => o.id === c1.offer.id).reason === "Countered", "counter declines the original");
ok(e.post({ action: "respond", token: glen, id: c2.offer.id, decision: "withdraw" }).ok === false, "only the sender withdraws");
ok(e.post({ action: "respond", token: joeTok, id: c2.offer.id, decision: "withdraw" }).ok, "Joe withdraws his counter");
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

// 14 · ledger feed for the robot + commish pick fixes
let L = e.get({ action: "ledger" });
ok(L.ok && L.mode === "test" && L.picks.length === 2 * 12 * 17 && Array.isArray(L.trades), "ledger feed: picks + approved trades + rules");
ok(!JSON.stringify(L).includes("let's deal") && !JSON.stringify(L).includes("@example.com"), "ledger feed carries no notes or contacts");
ok(e.post({ action: "pickfix", token: glen, pid: "2027-R1-smith", to: "glen", reason: "x" }).error === "Commish only", "owners can't fix picks");
ok(e.post({ action: "pickfix", token: mike, pid: "2027-R1-smith", to: "glen" }).error.includes("reason"), "pick fix needs a reason");
ok(e.post({ action: "pickfix", token: mike, pid: "2027-R1-smith", to: "glen", reason: "Traded in August" }).ok, "commish moves a pick");
L = e.get({ action: "ledger" });
ok(L.picks.find(p => p.pid === "2027-R1-smith").owner === "glen" && /^fix:murello/.test(L.picks.find(p => p.pid === "2027-R1-smith").via), "fix shows in the ledger with who did it");
ok(e.sheets.Chat.rows.some(r => r[2] === "league" && /Pick ledger fix/.test(r[4])), "league told about the fix");
// Joe answers "Contract resets" → rule flips
e.post({ action: "answers", token: joeTok, items: [{ qid: "keeper_travels", question: "q", choice: "Contract resets" }] });
ok(e.get({ action: "ledger" }).rules.contracts === "resets", "contract rule follows Joe's answer");

// 6 · ESPN 401 surfaces as an error, not a crash
e = makeEnv({ ESPN_S2: "abc", SWID: "{XYZ}" }, () => ({ getResponseCode: () => 401, getContentText: () => "" }));
h = e.get({ action: "health" });
ok(h.ok && h.espnRead.ok === false && /401/.test(h.espnRead.error), "ESPN 401 reported");

// 7 · size limit for the loader cache
ok(src.length < 90000, "logic.js under 90 KB (" + src.length + ")");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
