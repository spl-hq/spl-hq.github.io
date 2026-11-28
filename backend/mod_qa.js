/**
 * SPL HQ — backend part mod_qa.js (📋 Q&A with Joe: Mike's running list of questions for the commish, Mike 11/28).
 * Evaluated by logic.js (parts_) inside the core's own scope. Pushing it = deploying it. Bump VERSION in logic.js with any change here.
 */

// Questions live in the Sheet (tab Questions), so Mike asks, parks, closes and re-asks from the 🛠️ Ops desk with no code change.
// Joe answers on his "Questions from the Ops Manager" screen (answers go to the Answers tab as before: saveAnswers_ in logic.js).
// status: open (Joe sees it) · parked (saved for later) · closed (done; kept with its answers). A question counts as answered when Joe's
// latest answer is newer than asked_ts ("Ask again" moves asked_ts, so he answers fresh). ord = the order Joe sees.
// QA_SEED = the questions the app shipped with (index.html QUESTIONS until 11/28), written into the tab the first time it's empty.
var QA_SEED = [
  ["espn_lm", "closed", 99, "Can the app do your ESPN typing?", "Approved trades, the draft board, playoff picks, Shoot Out matchups and your rulings go onto ESPN by themselves. ESPN only allows that from a league manager, so Mike's team needs co-commish on ESPN. Nothing changes on ESPN until you've seen it work.", ["Yes", "After I see it", "Let's talk"], "Mike 11/28: reworded around the test-league demo → espn_writes"],
  ["test_league", "closed", 99, "Will you join the test league as co-commish for the demo?", "We prove trades end to end in a throwaway 4-team ESPN league (your, Mike's, Al's and Glen's real rosters) first. Nothing touches the real SPL league until you sign off.", ["Yes, send the invite", "Show me first"], "Mike 11/27: cut, Mike demos it instead"],
  ["keeper_travels", "closed", 99, "When a player under a keeper contract is traded, what happens to the contract?", "", ["Contract travels as-is (KP, years)", "Contract resets", "Depends (explain below)"], "Mike: travels as-is → folded into mike_calls"],
  ["pick_years", "closed", 99, "How many seasons ahead can draft picks be traded?", "", ["Next season only", "2 seasons", "3 seasons", "No limit"], "Mike: next season only → folded into mike_calls"],
  ["trade_review", "closed", 99, "How should trade approval work?", "", ["I approve every trade", "Auto-approve after a review window", "League veto vote", "Other (explain)"], "Mike: league veto vote in the app → veto_vote"],
  ["review_window", "closed", 99, "If there's a review window, how long?", "", ["None", "12 hours", "24 hours", "48 hours"], "Constitution: 24 h in season, 72 h off-season → veto_vote"],
  ["deadlines", "parked", 99, "What are the 2027 dates? Winter Meeting, keeper deadline (Signing Day), Divisional + Slot drafts, SPL Draft, trade deadline.", "Dates lock buttons in the app, start the countdown cards and open the draft rooms. Rough is fine (\"first Saturday in August\"); you can change them anytime.", [], "Mike 11/27: ask after the season"],
  ["chat", "closed", 99, "Chat: should the app have league chat, or keep the group text?", "", ["Full league chat in the app", "Trade DMs only, keep the group text", "Not sure yet"], "League chat shipped → chat_move"],
  ["al_name", "closed", 99, "ESPN lists Al's team under \"James Farrington\". Same person?", "", ["Yes, Al = James", "No (explain)"], "Mike: yes, Al = James Farrington (registry confirmed)"],
  ["commish_trades", "closed", 99, "When you and Mike trade with each other, who approves it?", "", ["Either of us, flagged to the league", "A third owner (name below)", "League vote", "Auto-approve after the review window"], "Covered by veto_vote: your trades with Mike go to the league vote like any other"],
  ["div_draft", "closed", 99, "Divisional Draft: the app runs it like this. Right?", "", ["Yes, that's it", "Close (explain below)", "No (explain below)"], "Mike: yes → folded into mike_calls"],
  ["first_wish", "parked", 99, "If the app could do one thing for you as commish, what would it be?", "Your answer goes to the top of the build list.", [], "Mike 11/28: swapped off day one"],
  ["veto_vote", "closed", 99, "Trades go to a league vote in the app, by the constitution (6 vetoes kills it). OK?", "Same rule as always, finally enforced (ESPN needs 8). In season the vote runs 24 hours; off-season a trade is final after 72 hours unless challenged. Your trades with Mike go to the same vote.", ["Yes", "Yes, and I can overrule", "No, I approve every trade"], "Mike 11/28: replaced by trade_process (review window + owner vetoes, as the rulebook says)"],
  ["mike_calls", "closed", 99, "Mike made these calls for the app. Good with all three?", "1) A traded keeper keeps his contract as-is (KP, years left). 2) Only next season's picks can be traded (2027, 17 rounds). 3) Divisional Draft: the 4 drafters (best 2 to miss the playoffs, then the 2 wildcard losers) each start a division and snake 1-2-3-4-4-3-2-1; a pick takes an owner into your division or assigns him to another drafter's (one assigned-in per division); if your division is full, you must assign.", ["All good", "Change one (explain below)"], "Mike 11/27: his answers stand, Joe doesn't need to check them"],
  ["history_gaps", "open", 1, "The league's history is mostly back in one place. Can you help fill what's missing?", "The app now has every season 2003-2026: champions from Glen's GM Report, every ESPN game and draft board since 2006, the Packet's keeper matrices for 2019-26, and 2020-21 results from the league emails.\n\nStill missing:\n1) The SPL Google Drive you set up in 2019 (minutes, votes, binders, constitutions). Sharing it with Mike is the biggest help.\n2) 2020-21 on NFL.com: the 2020 draft board and 2021 records.\n3) 2003-05: who owned the first teams, records and runner-ups.\n4) Keeper history before 2019.\n5) Dues and payouts by year.\n6) Plaques, photos, stories.\n\nFiles, screenshots or memory all work.", ["I'll share the Drive with Mike", "I have some (sending to Mike)", "From memory (below)", "Don't have it"], ""],
  ["chat_move", "parked", 99, "League chat is live in the app. Move the league's talk here?", "League chat, a room for each division (it follows the Divisional Draft by itself), DMs with any owner, and @ tags (an owner can choose to get an email when he's tagged). Everyone gets it once they sign in. The group text can stay for whatever you like.", ["Yes, move the league here", "Both for now", "Keep the group text, app chat for trades"], "Mike 11/27: once a few owners are in"],
  ["rules_rewrite", "open", 3, "The constitution was written around ESPN. Rewrite it for 2027 around the app?", "Trades now go to a league vote in the app, keepers get declared on Signing Day in the app, the drafts run in the app, and the app could set playoff matchups on ESPN too. The 2023 draft still has ESPN doing all of that. Mike drafts a 2027 edition from the 2023 one plus your answers here, you mark it up, and the league votes it in at the Winter Meeting.", ["Yes, draft it", "Let's talk first", "Keep the 2023 one"], ""],
  ["playoff_rules", "parked", 99, "Do the playoffs still work the way the constitution says?", "Seeding: win %, then points, then head-to-head, then a coin flip (ESPN only uses points). Week 15: Seed 3 picks its opponent from Seeds 4, 5 or 6. Week 16: Seed 1 picks. ESPN can't do either, so the app would ask Seed 3 and Seed 1 and put the matchups on ESPN. Still the rule? Has someone been doing it by hand?", ["Yes, have the app run it", "The rule changed (explain below)", "Let's talk"], "Mike 11/28: rulebook rewrite batch (was the ⚖️ vs ESPN tab)"],
  ["money_rules", "parked", 99, "What are dues and prizes now?", "The constitution says dues go up 5% a year ($348 in 2026, $366 in 2027) and the weekly high score wins that week's free-agent fees. Since 2024 it looks like $400 flat, a set prize sheet and $40 a week. Which one goes in the 2027 rulebook?", ["$400 flat + the prize sheet", "Changing for 2027 (explain below)", "Let's talk"], "Mike 11/28: rulebook rewrite batch (was the ⚖️ vs ESPN tab)"],
  ["late_adds", "parked", 99, "After Week 14, can teams out of the playoffs still pick up free agents?", "The constitution says no, but ESPN doesn't stop them. The app can flag those adds; it can't block them on ESPN. Section I also still has the 2021 note about Boogie and Owen working out a FAAB payout. Drop it?", ["No adds: flag them", "That rule's gone", "Explain below"], "Mike 11/28: rulebook rewrite batch (was the ⚖️ vs ESPN tab)"],
  ["espn_writes", "open", 2, "Are you comfortable with the app making changes on ESPN for you?", "Today trades run on ESPN: owners send them there, the league votes there (ESPN needs 8 vetoes, the rulebook says 6), and ESPN moves the players. With the app, trades happen here instead: owners agree in the app, the league reviews and can veto here by the rulebook, then the app makes the trade on ESPN itself. It can also load the SPL Draft board, keepers included, onto ESPN after the draft, so nobody keys it in by hand. ESPN only lets a league manager do that, so Mike's team would need co-commish on the SPL league. Mike built a test ESPN league to show you: a trade gets approved in the app, lands on ESPN by itself, and the app reads ESPN back to check it. Nothing touches the real SPL league until you say so.", ["Yes, make Mike co-commish", "Show me the test league first", "Keep trades on ESPN", "Let's talk"], ""],
  ["trade_process", "open", 0, "This is how trades and league votes run in the app. Is that the SPL way?", "TRADES\n1) An owner accepts an offer. The trade goes on the trade wire for review: 24 hours in season, 72 off-season.\n2) Any owner not in it can tap 🚫 Veto. The first veto tells the league a veto vote is on. Names show on the trade.\n3) 6 vetoes kill it. Otherwise it goes through by itself when the review ends, and the app makes it on ESPN.\n4) You step in only if needed: Approve now, or Negate with a reason the league sees.\n5) If a trade puts a team over the roster limit, that owner picks his drop when he sends or accepts.\n\nLEAGUE VOTES\n6) You build an SPL Owners Vote on your desk (rule change or league matter). It goes to league chat and every owner's Home.\n7) Yes / No / Abstain, changeable until it closes. Rule changes need 7 Yes; other matters need more Yes than No.\n8) Owners can send a rule idea. You decide if it goes to a vote.\n\nOff-season: does a challenge work like this, and how long should the challenge vote stay open? (The app keeps it open at least 24 hours.)", ["That's it", "Close: tweaks below", "Let's talk"], ""]
]; // [qid, status, ord, question, why, choices, note]
var QA_SEED_ASKED = new Date("2026-11-01T12:00:00Z");
function qaSeed_() {
  if (rows_("Questions").length) return;
  var lock = LockService.getScriptLock(); if (lock.tryLock && !lock.tryLock(3000)) return;
  try { dirty_("Questions"); if (rows_("Questions").length) return; var now = new Date();
    QA_SEED.forEach(function (x) { append_("Questions", [x[0], now, "seed", x[3], x[4], JSON.stringify(x[5]), x[1], x[2], QA_SEED_ASKED, x[6], now]); });
  } finally { if (lock.releaseLock) lock.releaseLock(); }
}
var QA_ST = { open: 0, parked: 1, closed: 2 };
function qaRows_() { qaSeed_(); return rows_("Questions"); }
function pubQ_(r) {
  return { qid: String(r.qid), q: r.q, why: r.why, choices: Array.isArray(parseJ_(r.choices)) ? parseJ_(r.choices) : [], status: r.status, ord: Number(r.ord) || 0,
    asked: r.asked_ts ? new Date(r.asked_ts).toISOString() : "", ts: r.ts, by: r.by, note: r.note || "", updated: r.updated_ts };
}
function openQs_() { return qaRows_().filter(function (r) { return r.status === "open"; }).map(pubQ_).sort(function (a, b) { return a.ord - b.ord || new Date(a.ts) - new Date(b.ts); }); }
// Ops desk feed: every question + every desk owner's latest answer to it.
function qa_(me) {
  var qs = qaRows_().map(pubQ_), desk = {}, ans = {};
  owners_().forEach(function (o) { if (isRole_(o, "commish") || isRole_(o, "ops")) desk[o.owner] = isRole_(o, "ops") ? "ops" : "commish"; });
  rows_("Answers").forEach(function (a) { if (!desk[a.who]) return; var k = a.qid + ":" + a.who; ans[k] = { qid: String(a.qid), who: a.who, role: desk[a.who], choice: a.choice, note: a.note, ts: a.ts }; });
  return { ok: true, questions: qs.sort(function (a, b) { return QA_ST[a.status] - QA_ST[b.status] || a.ord - b.ord || new Date(b.ts) - new Date(a.ts); }),
    answers: Object.keys(ans).map(function (k) { return ans[k]; }), commish: Object.keys(desk).filter(function (id) { return desk[id] === "commish"; }) };
}
function qFind_(qid) { var all = qaRows_(), i = -1; all.forEach(function (r, k) { if (String(r.qid) === qid) i = k; }); return i < 0 ? null : { row: all[i], idx: i }; }
function qTell_(r, again) {
  commishIds_().forEach(function (c) { notify_(c, "commish", (again ? "Asked again: " : "New question from the Ops Manager: ") + clip_(r.q, 80),
    r.q + (r.why ? "\n\n" + r.why : "") + "\n\nAnswer it on your desk: " + APP_URL + "#joe"); });
}
function cleanChoices_(c) {
  var list = Array.isArray(c) ? c : String(c || "").split(/\n|,/);
  return list.map(function (x) { return clip_(x, 60).trim(); }).filter(Boolean).slice(0, 6);
}
// Ops: ask a new question (or save it parked), or edit one (text only; Joe's answers stay).
function qSave_(me, b) {
  var q = clip_(b.q, 300).trim(); if (q.length < 5) return { ok: false, error: "Write the question first." };
  var why = clip_(b.why, 1500), ch = cleanChoices_(b.choices), now = new Date();
  if (b.qid) { var f = qFind_(String(b.qid)); if (!f) return { ok: false, error: "Question not found" };
    var r = f.row; r.q = q; r.why = why; r.choices = JSON.stringify(ch); r.updated_ts = now; setRow_("Questions", f.idx, r); log_("qedit", r.qid + " " + me.owner); return { ok: true, qid: r.qid }; }
  var status = b.status === "parked" ? "parked" : "open", top = qaRows_().filter(function (x) { return x.status === "open"; }).reduce(function (m, x) { return Math.min(m, Number(x.ord) || 0); }, 0);
  var id = "q" + Date.now().toString(36);
  append_("Questions", [id, now, me.owner, q, why, JSON.stringify(ch), status, b.top ? top - 1 : 50, now, "", now]);
  if (status === "open") qTell_({ q: q, why: why }, false);
  log_("qask", id + " " + status + " " + me.owner);
  return { ok: true, qid: id };
}
// Ops: open (ask now) · park · close (with an optional note) · again (re-open and ask fresh) · top (first in Joe's list).
// Asking (open from parked/closed, or again) puts it first in Joe's list.
function qSet_(me, b) {
  var f = qFind_(String(b.qid || "")); if (!f) return { ok: false, error: "Question not found" };
  var r = f.row, op = String(b.op || ""), now = new Date(), was = r.status;
  var topOrd = function () { return qaRows_().filter(function (x) { return x.status === "open" && String(x.qid) !== String(r.qid); }).reduce(function (m, x) { return Math.min(m, Number(x.ord) || 0); }, 0) - 1; };
  if (op === "open" || op === "again") { if (op === "again") r.asked_ts = now; if (op === "again" || was !== "open") r.ord = topOrd(); r.status = "open"; }
  else if (op === "park") r.status = "parked";
  else if (op === "close") { r.status = "closed"; r.note = clip_(b.note, 300) || r.note; }
  else if (op === "top") r.ord = topOrd();
  else return { ok: false, error: "Unknown change" };
  r.updated_ts = now; setRow_("Questions", f.idx, r);
  if (op === "again" || (op === "open" && was !== "open")) qTell_(r, op === "again");
  log_("qset", r.qid + " " + op + " " + me.owner);
  return { ok: true };
}
