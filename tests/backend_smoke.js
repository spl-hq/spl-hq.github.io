// Smoke test for backend/logic.js with mocked Apps Script services. Run: node tests/backend_smoke.js
// Required before every backend push (CLAUDE.md). Exits non-zero on any failure.
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "backend", "logic.js"), "utf8");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

function makeEnv(props, espn) {
  const sheets = {}, mails = [], cache = {}, alerts = [];
  const mkSheet = (name) => ({ name, rows: [], appendRow(r) { this.rows.push(r); }, setFrozenRows() {},
    getRange(r, c, nr, nc) { const s = this; return { setValues(v) { s.rows[r - 1] = v[0].slice(); } }; },
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
  const lid = /leagues\/(\d+)/.exec(url)[1];
  const body = lid === "19583"
    ? { scoringPeriodId: 13, settings: { name: "SPL", scheduleSettings: { divisions: [{ id: 0, name: "East Coast" }] } },
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

// 6 · ESPN 401 surfaces as an error, not a crash
e = makeEnv({ ESPN_S2: "abc", SWID: "{XYZ}" }, () => ({ getResponseCode: () => 401, getContentText: () => "" }));
h = e.get({ action: "health" });
ok(h.ok && h.espnRead.ok === false && /401/.test(h.espnRead.error), "ESPN 401 reported");

// 7 · size limit for the loader cache
ok(src.length < 90000, "logic.js under 90 KB (" + src.length + ")");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
