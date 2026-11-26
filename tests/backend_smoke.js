// Smoke test for backend/logic.js with mocked Apps Script services. Run: node tests/backend_smoke.js
// Required before every backend push (CLAUDE.md). Exits non-zero on any failure.
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "backend", "logic.js"), "utf8");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

function makeEnv(props, espn) {
  const sheets = {}, mails = [], cache = {}, alerts = [];
  const mkSheet = (name) => ({ name, rows: [], appendRow(r) { this.rows.push(r); }, setFrozenRows() {}, deleteRow(i) { this.rows.splice(i - 1, 1); },
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

// 14 · ledger feed for the robot + commish pick fixes
let L = e.get({ action: "ledger" });
ok(L.ok && L.mode === "test" && L.picks.length === 2 * 12 * 17 && Array.isArray(L.trades), "ledger feed: picks + approved trades + rules");
ok(!JSON.stringify(L).includes("let's deal") && !JSON.stringify(L).includes("@example.com"), "ledger feed carries no notes or contacts");
ok(e.post({ action: "pickfix", token: glen, pid: "2027-R1-smith", to: "glen", reason: "x" }).error === "Commish only", "owners can't fix picks");
ok(/Joe's call/.test(e.post({ action: "pickfix", token: mike, pid: "2027-R1-smith", to: "glen", reason: "x" }).error), "pick fixes are Joe's (Mike read-only)");
ok(e.post({ action: "pickfix", token: joeTok, pid: "2027-R1-smith", to: "glen" }).error.includes("reason"), "pick fix needs a reason");
ok(e.post({ action: "pickfix", token: joeTok, pid: "2027-R1-smith", to: "glen", reason: "Traded in August" }).ok, "commish moves a pick");
L = e.get({ action: "ledger" });
ok(L.picks.find(p => p.pid === "2027-R1-smith").owner === "glen" && /^fix:reilly/.test(L.picks.find(p => p.pid === "2027-R1-smith").via), "fix shows in the ledger with who did it");
ok(e.sheets.Chat.rows.some(r => r[2] === "league" && /Pick ledger fix/.test(r[4])), "league told about the fix");
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
r = e.post({ action: "settings", token: glen }); ok(r.notify.draft === false || r.notify.draft === true, "draft notify key exists");
ok(e.post({ action: "settings", token: owen }).notify.draft === true, "on-the-clock emails on by default");

// 5b · 🔥 reel reactions (WS4)
r = e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "🔥" }); ok(r.ok && r.on && r.reacts["🔥"].join() === "glen", "Glen reacts 🔥");
e.post({ action: "react", token: owen, key: "2026-12:slate", emoji: "🔥" }); e.post({ action: "react", token: owen, key: "2026-12:high", emoji: "😂" });
r = e.post({ action: "reacts", token: mike, keys: ["2026-12:slate", "2026-12:high", "nope"] });
ok(r.ok && r.reacts["2026-12:slate"]["🔥"].length === 2 && r.reacts["2026-12:high"]["😂"][0] === "salerno" && !r.reacts.nope, "everyone sees reactions by card");
r = e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "🔥" }); ok(r.ok && !r.on && r.reacts["🔥"].join() === "salerno", "tap again takes it back");
ok(e.post({ action: "react", token: glen, key: "2026-12:slate", emoji: "💩" }).ok === false, "only the reel's emojis");
ok(e.post({ action: "react", token: glen, key: "=HYPERLINK(1)", emoji: "🔥" }).ok === false, "bad card keys refused");
ok(e.post({ action: "react", key: "2026-12:slate", emoji: "🔥" }).ok === false, "signed-in only");


// 6b · 🏈 WS5: 4-team test league mirrors 4 SPL rosters; approved demo trades execute on ESPN (test league only) + read back
{
  const SPL = { "Bad Attitude Gang": [1, 2], "Reilly's RaMPaGe": [3, 4], "Farrington's FREELANCERS": [5], "Fluff Muffins": [6], "Tijuana Trojans": [7] };
  const NAMES = { 1: "Josh Allen", 2: "Bijan Robinson", 3: "Chris Olave", 4: "Sam LaPorta", 5: "Derrick Henry", 6: "Puka Nacua", 7: "Smith Guy", 9: "Junk One", 10: "Junk Two" };
  const T = { 1: [9, 3], 2: [], 3: [10], 4: [] }; // test league before the mirror (team 3 = Mike's SWID)
  const posts = []; let rejectTrades = false;
  const ent = id => ({ playerId: id, lineupSlotId: 20, playerPoolEntry: { player: { id, fullName: NAMES[id], defaultPositionId: 2, proTeamId: 2, stats: [] } } });
  const mock = (url, o) => {
    const res = (code, b) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(b) });
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
    return res(200, { scoringPeriodId: 13, settings: { name: "Testing MAFFL HQ" }, teams: [4, 3, 2, 1].map(id => ({ id, name: "Test " + id, owners: id === 3 ? ["{XYZ}"] : ["{OTHER}"], roster: { entries: T[id].map(ent) } })) });
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
  ok(byO("reilly").drops === 1 && byO("reilly").adds === 1 && byO("reilly").match === 1 && byO("murello").adds === 2, "mirror plan: drop what SPL doesn't have, add what it does");
  ok(d.writes === false && w.post({ action: "mirror", token: wm, owner: "reilly", step: "drops" }).ok === false && posts.length === 0, "writes off: nothing sent");
  ok(w.post({ action: "espnwrites", token: wj, on: true }).ok === false, "only ops flips the ESPN switch");
  ok(w.post({ action: "espnwrites", token: wm, on: true }).writes === true, "Mike turns ESPN writes on");
  ["murello", "reilly", "farrington", "glen"].forEach(o => w.post({ action: "mirror", token: wm, owner: o, step: "drops" }));
  let last; ["murello", "reilly", "farrington", "glen"].forEach(o => { last = w.post({ action: "mirror", token: wm, owner: o, step: "adds" }); });
  ok(last.ok && last.left === 0 && last.match === 1, "mirror step reads back what's left");
  d = w.post({ action: "testleague", token: wm });
  ok(d.teams.every(x => x.match === x.want && x.drops === 0 && x.adds === 0), "after the mirror every test team matches its SPL roster");
  ok(posts.every(b => b.isLeagueManager === true && b.executionType === "EXECUTE" && b.items.length === 1 && b.memberId === "{XYZ}"), "commish moves, one player per write, no retries");
  ok(w.sheets.EspnLog.rows.length === posts.length + 1, "every write logged");
  // Demo trade: Mike's Allen for Joe's Olave → Joe accepts → Joe approves (commish-to-commish) → ESPN moves it, read back
  let o = w.post({ action: "offer", token: wm, to: "reilly", give: { players: [{ n: "Josh Allen", id: 1 }] }, get: { players: [{ n: "Chris Olave" }] } });
  ok(o.ok && o.offer.give.players[0].id === 1, "offers keep the ESPN player id");
  w.post({ action: "respond", token: wj, id: o.offer.id, decision: "accept" });
  const before = posts.length;
  ok(w.post({ action: "tradeact", token: wj, id: o.offer.id, decision: "approve" }).ok, "Joe approves the demo trade");
  const tp = posts[before];
  ok(posts.length === before + 1 && tp.type === "TRADE_PROPOSAL" && tp.items.length === 2 && tp.items.every(i => i.type === "TRADE"), "one LM trade write, both players");
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
}
// 6 · ESPN 401 surfaces as an error, not a crash
e = makeEnv({ ESPN_S2: "abc", SWID: "{XYZ}" }, () => ({ getResponseCode: () => 401, getContentText: () => "" }));
h = e.get({ action: "health" });
ok(h.ok && h.espnRead.ok === false && /401/.test(h.espnRead.error), "ESPN 401 reported");

// 7 · size limit for the loader cache
ok(src.length < 90000, "logic.js under 90 KB (" + src.length + ")");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
