// ---------------------------------------------------------------- 👀 Usage (Mike 11/28: "monitor Joe's usage, how much he's clicking and on what")
// First-party only: the app keeps a small queue of what a signed-in owner opens and taps and posts it here in batches ("track").
// No Google Analytics or any third-party script (CLAUDE.md: no runtime fetches but our own backend), and since every owner signs
// in, each row already knows who it was. Rows land in the Usage tab:
//   open  = the app opened (or came back after 30+ min away) · what = "app" (Home Screen) | "browser"
//   view  = one visit to a screen, logged when it ends · where = screen (hash name) · n = seconds on it
//   tap   = a button / chip / link · what = its label (≤ 40 chars) · where = the screen it was on
// Typed text is never sent. Ops reads it on the Ops desk (action "usage", ops only).
// Upkeep (robot, hourly tick): rows older than USAGE_KEEP_D days are trimmed; ops gets one email the first time each owner opens
// the app, and a morning digest of yesterday's visits by everyone but ops (nothing on a quiet day).
HEADS.Usage = ["ts", "who", "kind", "what", "where", "n"];
var USAGE_KEEP_D = 120, USAGE_MAX_BATCH = 60;

function track_(me, b) {
  var ev = Array.isArray(b && b.ev) ? b.ev.slice(0, USAGE_MAX_BATCH) : [], now = Date.now(), rows = [];
  ev.forEach(function (e) {
    if (!e || !/^(open|view|tap)$/.test(e.k)) return;
    var t = Number(e.t); if (!(t > now - 7 * 864e5 && t <= now + 6e4)) t = now; // a phone with a wrong clock or an old queue
    rows.push([new Date(t), me.owner, e.k, safe_(clip_(e.w, 40)), safe_(clip_(e.s, 30)), Math.max(0, Math.min(3600, Math.round(Number(e.n) || 0)))]);
  });
  var n = rows.length; // one Sheet write per batch, not one per event (Mike: don't slow the site)
  if (n) { var sh = sheet_("Usage"); sh.getRange(sh.getLastRow() + 1, 1, n, HEADS.Usage.length).setValues(rows); dirty_("Usage"); }
  if (n && !isRole_(me, "ops")) {
    var first = jsonProp_("USAGE_FIRST", {});
    if (!first[me.owner]) {
      first[me.owner] = new Date().toISOString(); setProp_("USAGE_FIRST", JSON.stringify(first));
      mail_("SPL HQ · " + me.name + " just opened the app for the first time", me.name + " (" + me.team + ") is in SPL HQ now.\n\nWatch what he looks at: " + APP_URL + "#ops → 👀 Who's using it");
    }
  }
  return { ok: true, n: n };
}

function usageRows_(days) {
  var since = Date.now() - days * 864e5;
  return rows_("Usage").filter(function (r) { return r.ts && new Date(r.ts).getTime() >= since; });
}
// Visits = opens. Minutes = seconds on screens. Top screens + taps over the window, plus each owner's latest 60 rows for the timeline.
function usage_(me, b) {
  var days = Math.max(1, Math.min(90, Number(b && b.days) || 30)), wk = Date.now() - 7 * 864e5, by = {};
  usageRows_(days).forEach(function (r) {
    var u = by[r.who] = by[r.who] || { owner: r.who, last: 0, opens: 0, opens7: 0, sec: 0, sec7: 0, taps: 0, days: {}, screens: {}, tapped: {}, recent: [] },
      t = new Date(r.ts).getTime(), n = Number(r.n) || 0;
    if (t > u.last) u.last = t;
    u.days[new Date(t - 5 * 3.6e6).toISOString().slice(0, 10)] = 1; // ET-ish day
    if (r.kind === "open") { u.opens++; if (t >= wk) u.opens7++; }
    if (r.kind === "view") { u.sec += n; if (t >= wk) u.sec7 += n; var s = u.screens[r.where] = u.screens[r.where] || { s: r.where, v: 0, sec: 0 }; s.v++; s.sec += n; }
    if (r.kind === "tap") { u.taps++; var k = (r.where ? r.where + " · " : "") + r.what; u.tapped[k] = (u.tapped[k] || 0) + 1; }
    u.recent.push({ t: t, k: r.kind, w: String(r.what || ""), s: String(r.where || ""), n: n });
  });
  var list = Object.keys(by).map(function (id) {
    var u = by[id], o = owners_().filter(function (x) { return x.owner === id; })[0] || {};
    return { owner: id, name: o.name || id, ops: isRole_(o, "ops"), last: new Date(u.last).toISOString(), opens: u.opens, opens7: u.opens7,
      min: Math.round(u.sec / 6) / 10, min7: Math.round(u.sec7 / 6) / 10, taps: u.taps, activeDays: Object.keys(u.days).length,
      screens: Object.keys(u.screens).map(function (k) { return u.screens[k]; }).sort(function (a, c) { return c.sec - a.sec || c.v - a.v; }).slice(0, 10),
      tapped: Object.keys(u.tapped).map(function (k) { return { w: k, n: u.tapped[k] }; }).sort(function (a, c) { return c.n - a.n; }).slice(0, 12),
      recent: u.recent.sort(function (a, c) { return c.t - a.t; }).slice(0, 60) };
  }).sort(function (a, c) { return (a.ops - c.ops) || (a.last < c.last ? 1 : -1); });
  var seen = {}; list.forEach(function (u) { seen[u.owner] = 1; });
  var never = owners_().filter(function (o) { return !seen[o.owner]; }).map(function (o) { return { owner: o.owner, name: o.name, hasPass: !!o.pin_hash }; });
  return { ok: true, days: days, owners: list, never: never };
}

// Robot (hourly tick): trim old rows, and after 7 AM ET send yesterday's digest once.
function usageTick_() {
  var sh = sheet_("Usage"), v = sh.getDataRange().getValues(), cut = Date.now() - USAGE_KEEP_D * 864e5, old = 0;
  for (var i = 1; i < v.length && v[i][0] && new Date(v[i][0]).getTime() < cut; i++) old++;
  if (old) { if (sh.deleteRows) sh.deleteRows(2, old); else for (var j = 0; j < old; j++) sh.deleteRow(2); dirty_("Usage"); }
  var et = new Date(Date.now() - 5 * 3.6e6), today = et.toISOString().slice(0, 10);
  if (et.getUTCHours() < 7 || prop_("USAGE_DIGEST") === today) return { trimmed: old };
  setProp_("USAGE_DIGEST", today);
  var y = new Date(et.getTime() - 864e5).toISOString().slice(0, 10), by = {}, lines = [];
  usageRows_(3).forEach(function (r) {
    if (new Date(new Date(r.ts).getTime() - 5 * 3.6e6).toISOString().slice(0, 10) !== y) return;
    var u = by[r.who] = by[r.who] || { opens: 0, sec: 0, taps: 0, scr: {} }, n = Number(r.n) || 0;
    if (r.kind === "open") u.opens++; if (r.kind === "tap") u.taps++; if (r.kind === "view") { u.sec += n; u.scr[r.where] = (u.scr[r.where] || 0) + n; }
  });
  owners_().forEach(function (o) {
    var u = by[o.owner]; if (!u || isRole_(o, "ops")) return;
    var top = Object.keys(u.scr).sort(function (a, c) { return u.scr[c] - u.scr[a]; }).slice(0, 4).map(function (s) { return s + " " + Math.max(1, Math.round(u.scr[s] / 60)) + "m"; });
    lines.push("• " + o.name + ": " + u.opens + " visit" + (u.opens === 1 ? "" : "s") + " · " + Math.round(u.sec / 60) + " min · " + u.taps + " taps" + (top.length ? " · " + top.join(", ") : ""));
  });
  if (lines.length) mail_("SPL HQ · who was in yesterday (" + lines.length + ")", lines.join("\n") + "\n\nDetails: " + APP_URL + "#ops → 👀 Who's using it");
  return { trimmed: old, digest: lines.length };
}
