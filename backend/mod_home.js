/**
 * SPL HQ — backend part mod_home.js (🏠 Home: your ⭐ Saved and ✓ Done cards follow your sign-in, not your phone; Mike 11/28).
 * Evaluated by logic.js (parts_) inside the core's own scope: every function and var here is callable by plain name from every
 * other file. Pushing it = deploying it. Bump VERSION in logic.js with any change here. Keep under ~90 KB.
 *
 * HomeCards tab: one row per (owner, kind, week, card id). kind: pin (⭐ Saved) · clr (✓ Done). html = the card as it looked when
 * it was swiped (the app built it, values already escaped; only its own owner ever gets it back). Unsave / un-done deletes the row.
 * Done rows older than HOME_KEEP_DAYS are trimmed on write (the app shows Done for 7 days; the extra days keep that week's
 * cards off Home on every phone).
 */
var HOME_KINDS = { pin: 1, clr: 1 }, HOME_KEEP_DAYS = 30, HOME_MAX = 200;

function homeGet_(me) {
  var out = [];
  rows_("HomeCards").forEach(function (r) {
    if (String(r.owner) !== me.owner) return;
    out.push({ kind: String(r.kind), w: Number(r.w) || 0, id: String(r.id), at: Number(r.at) || 0, html: String(r.html || "") });
  });
  out.sort(function (a, b) { return b.at - a.at; });
  return { ok: true, cards: out };
}

// {kind, w, id, on, html, at}: on = put it there, off = take it out. Safe to re-send (upsert by key).
// {items: [...]} sends a batch (a phone's first sync, or swipes made offline), applied in order.
function homeMark_(me, b) {
  if (!Array.isArray(b.items)) return homeOne_(me, b);
  var n = 0; b.items.slice(0, 150).forEach(function (x) { if (x && homeOne_(me, x).ok) n++; }); return { ok: true, n: n };
}
function homeOne_(me, b) {
  var kind = String(b.kind || ""), id = clip_(b.id, 160), w = Math.max(0, Math.min(99, Number(b.w) || 0));
  if (!HOME_KINDS[kind] || !id) return { ok: false, error: "bad card" };
  var at = Number(b.at) || Date.now(); if (at > Date.now() + 864e5) at = Date.now();
  var sh = sheet_("HomeCards"), rows = rows_("HomeCards"), cut = Date.now() - HOME_KEEP_DAYS * 864e5, del = [], hit = -1, mine = 0;
  rows.forEach(function (r, i) {
    if (String(r.owner) !== me.owner) return;
    if (String(r.kind) === kind && Number(r.w) === w && String(r.id) === id) { if (hit < 0) hit = i; else del.push(i); return; }
    if (String(r.kind) === "clr" && Number(r.at) < cut) del.push(i); else mine++;
  });
  if (b.on) {
    var row = { owner: me.owner, kind: kind, w: w, id: id, at: at, html: clip_(b.html, 40000), ts: new Date() };
    if (hit >= 0) setRow_("HomeCards", hit, row);
    else if (mine >= HOME_MAX) return { ok: false, error: "Saved + Done are full: clear a few first." };
    else append_("HomeCards", HEADS.HomeCards.map(function (k) { return row[k]; }));
  } else if (hit >= 0) del.push(hit);
  del.sort(function (a, c) { return c - a; }).forEach(function (i) { sh.deleteRow(i + 2); }); if (del.length) dirty_("HomeCards");
  return { ok: true };
}
