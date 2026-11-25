// Smoke test for backend/logic.js with mocked Apps Script services. Run: node tests/backend_smoke.js
// Required before every backend push (CLAUDE.md). Exits non-zero on any failure.
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "backend", "logic.js"), "utf8");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

function makeEnv(props, espn) {
  const sheets = {}, mails = [], cache = {};
  const mkSheet = (name) => ({ name, rows: [], appendRow(r) { this.rows.push(r); }, setFrozenRows() {},
    getLastRow() { return this.rows.length; }, getName() { return this.name; },
    getDataRange() { const s = this; return { getValues() { return s.rows.map(r => r.slice()); } }; } });
  sheets.Sheet1 = mkSheet("Sheet1");
  const ss = { getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = mkSheet(n)), getSheets: () => Object.values(sheets),
    deleteSheet: s => { delete sheets[s.name]; }, getName: () => "SPL HQ App" };
  const G = {
    SpreadsheetApp: { getActive: () => ss, getUi: () => ({ alert() {} }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => 99, sendEmail: (to, s, b) => mails.push({ to, s, b }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "spl.hq.ops@gmail.com" }) },
    UrlFetchApp: { fetch: (url, o) => espn(url, o) }
  };
  const M = {};
  new Function(...Object.keys(G), "M", src)(...Object.values(G), M);
  const out = r => JSON.parse(r.t);
  return { M, sheets, mails, get: p => out(M.doGet({ parameter: p })), post: b => out(M.doPost({ postData: { contents: JSON.stringify(b) } })) };
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

// 4 · answers
let r = e.post({ action: "answers", who: "reilly", items: [{ qid: "pick_years", question: "How many?", choice: "2 seasons", note: "=SUM(A1)" }, { qid: "bad id!", choice: "x" }] });
ok(r.ok && r.saved === 1, "saves valid answers, drops bad qid");
ok(e.sheets.Answers && e.sheets.Answers.rows[1][5] === "'=SUM(A1)", "formula guard on notes");
ok(!e.sheets.Sheet1, "blank Sheet1 removed once real tabs exist");
ok(e.mails.length === 1 && /reilly answered 1 question/.test(e.mails[0].s), "emails ops on answers");
r = e.post({ action: "answers", who: "", items: [{ qid: "x", choice: "y" }] });
ok(!r.ok, "answers need who");
const a = e.get({ action: "answers" });
ok(a.ok && a.total === 1 && a.answers[0].choice === "2 seasons", "answers readback");

// 5 · feedback
r = e.post({ action: "feedback", who: "murello", mood: "👍 Good", note: "nice" });
ok(r.ok && e.sheets.Feedback.rows.length === 2, "feedback saved");
ok(e.post({ action: "nope" }).ok === false, "unknown action refused");

// 6 · ESPN 401 surfaces as an error, not a crash
e = makeEnv({ ESPN_S2: "abc", SWID: "{XYZ}" }, () => ({ getResponseCode: () => 401, getContentText: () => "" }));
h = e.get({ action: "health" });
ok(h.ok && h.espnRead.ok === false && /401/.test(h.espnRead.error), "ESPN 401 reported");

// 7 · size limit for the loader cache
ok(src.length < 90000, "logic.js under 90 KB (" + src.length + ")");

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
