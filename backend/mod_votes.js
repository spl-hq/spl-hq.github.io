/**
 * SPL HQ — backend part mod_votes.js (🗳️ league votes: rule changes + league matters, Yes / No / Abstain; 💡 rule ideas from owners;
 * the ballot box the trade vetoes use too). Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is
 * callable by plain name from every other file. Pushing it = deploying it. Bump VERSION in logic.js with any change here. Keep under ~90 KB.
 */

// ---------------------------------------------------------------- 🗳️ Ballot box (Mike 11/28)
// Ballots tab: one row per tap; the latest row per (ref, owner) counts, so a vote can change until it closes.
// refs: "matter:<id>" (Yes | No | Abstain) · "trade:<offer id>" (veto | off, see mod_trades.js).
function ballots_(ref) {
  var out = {}; rows_("Ballots").forEach(function (b) { if (String(b.ref) === ref) out[b.owner] = { choice: String(b.choice), ts: b.ts }; }); return out;
}
function ballot_(ref, owner, choice) { append_("Ballots", [new Date(), ref, owner, choice]); }

// ---------------------------------------------------------------- League votes ("matters")
// kind: rule (changes the rulebook: passes with 7 Yes, rulebook C.1) · matter (anything else the league decides: more Yes than No)
//       · practice (a dry run: counts nothing, changes nothing).
// status: idea (an owner's 💡, waiting on the commish) · open (voting until `closes`) · closed (result written) · declined (idea not put to a vote).
var VOTE_CHOICES = ["Yes", "No", "Abstain"], RULE_PASS = 7, VOTE_DAYS = [1, 3, 7];
function deskOwner_(o) { return isRole_(o, "commish") || isRole_(o, "ops"); }
function commishIds_() { return owners_().filter(function (o) { return isRole_(o, "commish") && !isRole_(o, "ops"); }).map(function (o) { return o.owner; }); }
function mOpen_(m) { return m.status === "open" && Date.now() < new Date(m.closes).getTime(); }
function tallyOf_(m) {
  var bl = ballots_("matter:" + m.mid), t = { Yes: 0, No: 0, Abstain: 0 }, who = {};
  Object.keys(bl).forEach(function (o) { var c = bl[o].choice; if (t[c] != null) { t[c]++; who[o] = c; } });
  return { t: t, who: who };
}
function resultOf_(m, t) {
  if (m.kind === "practice") return "Practice vote: " + t.Yes + " Yes · " + t.No + " No · " + t.Abstain + " Abstain. Nothing changes.";
  if (m.kind === "rule") return (t.Yes >= RULE_PASS ? "Passed" : "Failed") + ": " + t.Yes + " Yes (" + RULE_PASS + " needed) · " + t.No + " No · " + t.Abstain + " Abstain.";
  return (t.Yes > t.No ? "Passed" : "Failed") + ": " + t.Yes + " Yes · " + t.No + " No · " + t.Abstain + " Abstain.";
}
function pubMatter_(m, me) {
  var x = tallyOf_(m), open = mOpen_(m), desk = deskOwner_(me);
  return { id: m.mid, ts: m.ts, by: m.by, kind: m.kind, title: m.title, detail: m.detail, status: open ? "open" : m.status === "open" ? "closed" : m.status,
    closes: m.closes ? new Date(m.closes).toISOString() : "", tally: x.t, voted: Object.keys(x.who).length, mine: x.who[me.owner] || "",
    need: m.kind === "rule" ? RULE_PASS : 0, result: m.result || (open || m.status !== "open" ? "" : resultOf_(m, x.t)), note: m.note || "",
    who: (!open || desk) ? x.who : null }; // names show once a vote closes (the commish desk sees them as they come in)
}
function votes_(me) {
  votesTick_();
  var all = rows_("Matters").map(function (m) { return pubMatter_(m, me); }).reverse();
  var open = all.filter(function (m) { return m.status === "open"; }), ideas = all.filter(function (m) { return m.status === "idea"; });
  var past = all.filter(function (m) { return m.status === "closed" || m.status === "declined"; }).slice(0, 20);
  return { ok: true, open: open, ideas: ideas, past: past, choices: VOTE_CHOICES, rulePass: RULE_PASS, days: VOTE_DAYS };
}
function findMatter_(id) { var all = rows_("Matters"), i = -1; all.forEach(function (m, k) { if (m.mid === id) i = k; }); return i < 0 ? null : { row: all[i], idx: i }; }
function mvote_(me, b) {
  var f = findMatter_(String(b.id || "")); if (!f) return { ok: false, error: "Vote not found" };
  if (!mOpen_(f.row)) return { ok: false, error: "This vote is closed." };
  var c = String(b.choice || ""); if (VOTE_CHOICES.indexOf(c) < 0) return { ok: false, error: "Pick Yes, No or Abstain." };
  ballot_("matter:" + f.row.mid, me.owner, c); log_("mvote", f.row.mid + " " + me.owner);
  return { ok: true, matter: pubMatter_(f.row, me) };
}
// 💡 Any owner: a rule idea. It lands with the commish (desk) and in league chat so the league can talk it over; Joe decides whether it goes to a vote.
function ruleIdea_(me, b) {
  var title = clip_(b.title, 140).trim(), detail = clip_(b.detail, 1500).trim();
  if (title.length < 5) return { ok: false, error: "Say the idea in a line first." };
  var id = "V" + Date.now().toString(36).toUpperCase(), now = new Date();
  append_("Matters", [id, now, me.owner, "rule", title, detail, "idea", "", "", "", now, ""]);
  botPost_("league", "💡 Rule idea from " + me.name + ": “" + title + "”" + " · Talk it over here; the commish decides if it goes to a league vote.", id);
  commishIds_().forEach(function (c) { notify_(c, "commish", "Rule idea from " + me.name, title + (detail ? "\n\n" + detail : "") + "\n\nPut it to a vote from your Commish desk: " + APP_URL + "#desk"); });
  log_("ruleidea", id + " " + me.owner);
  return { ok: true, id: id };
}
// Commish / ops: open a vote (new, or from an idea), or decline an idea with a reason.
function voteOpen_(me, b) {
  var kind = /^(rule|matter|practice)$/.test(b.kind) ? b.kind : "matter", days = VOTE_DAYS.indexOf(Number(b.days)) >= 0 ? Number(b.days) : 3, now = new Date();
  var closes = new Date(now.getTime() + days * 864e5);
  if (b.id) {
    var f = findMatter_(String(b.id)); if (!f || f.row.status !== "idea") return { ok: false, error: "That idea isn't waiting on you." };
    var m = f.row;
    if (b.decline) { if (!String(b.reason || "").trim()) return { ok: false, error: "Give the league a reason." };
      m.status = "declined"; m.note = clip_(b.reason, 300); m.updated_ts = now; setRow_("Matters", f.idx, m);
      botPost_("league", "💡 Not going to a vote: “" + m.title + "” · " + m.note, m.mid); log_("voteno", m.mid + " " + me.owner); return { ok: true }; }
    m.kind = kind; m.status = "open"; m.opens = now; m.closes = closes; m.opened_by = me.owner; m.updated_ts = now;
    if (b.title) m.title = clip_(b.title, 140); if (b.detail != null) m.detail = clip_(b.detail, 1500);
    setRow_("Matters", f.idx, m); announceVote_(m); return { ok: true, id: m.mid };
  }
  var title = clip_(b.title, 140).trim(); if (title.length < 5) return { ok: false, error: "Write the question first." };
  var id = "V" + Date.now().toString(36).toUpperCase();
  append_("Matters", [id, now, me.owner, kind, title, clip_(b.detail, 1500), "open", now, closes, me.owner, now, ""]);
  announceVote_(findMatter_(id).row); return { ok: true, id: id };
}
function announceVote_(m) {
  var when = Utilities.formatDate(new Date(m.closes), "America/New_York", "EEE MMM d, h:mm a");
  var rule = m.kind === "rule" ? " Rule changes need " + RULE_PASS + " Yes." : m.kind === "practice" ? " (Practice: nothing changes.)" : "";
  botPost_("league", "🗳️ League vote: “" + m.title + "” · Yes, No or Abstain in League → Votes by " + when + " ET." + rule, m.mid);
  owners_().forEach(function (o) { notify_(o.owner, "announce", "League vote: " + m.title, (m.detail ? m.detail + "\n\n" : "") + "Vote Yes, No or Abstain by " + when + " ET." + rule + "\n\n" + APP_URL + "#votes"); });
  log_("voteopen", m.mid + " " + m.kind);
}
// Hourly tick + every votes read: votes past their close get their result written once, and the league is told.
function votesTick_() {
  var lock = LockService.getScriptLock(); if (lock.tryLock && !lock.tryLock(2000)) return 0;
  var n = 0;
  try {
    rows_("Matters").forEach(function (m, i) {
      if (m.status !== "open" || Date.now() < new Date(m.closes).getTime()) return;
      m.status = "closed"; m.result = resultOf_(m, tallyOf_(m).t); m.updated_ts = new Date(); setRow_("Matters", i, m); n++;
      botPost_("league", "🗳️ Vote closed: “" + m.title + "” · " + m.result, m.mid); log_("voteclose", m.mid + " · " + m.title + " · " + m.result);
    });
  } finally { if (lock.releaseLock) lock.releaseLock(); }
  return n;
}
// The first practice vote (Mike 11/28: "a sample league ruling vote to feel this out"). Ops only, once.
function votePractice_(me) {
  if (rows_("Matters").some(function (m) { return m.kind === "practice"; })) return { ok: false, error: "There's already a practice vote." };
  return voteOpen_(me, { kind: "practice", days: 7, title: "Practice vote: should an in-season trade's review stay at 24 hours?",
    detail: "A dry run of league voting in SPL HQ. Nothing changes whatever the result. Tap Yes, No or Abstain; you can change your vote until it closes." });
}
// 🧾 Closed votes for the ledger-sync robot → data/League_Votes.csv (rule changes + matters; practice votes stay out).
function voteLedger_() {
  return rows_("Matters").filter(function (m) { return m.status === "closed" && m.kind !== "practice"; }).map(function (m) {
    var t = tallyOf_(m).t; return { id: m.mid, closed: m.closes, kind: m.kind, title: m.title, yes: t.Yes, no: t.No, abstain: t.Abstain, result: m.result, by: m.by };
  });
}
