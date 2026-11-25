/** @OnlyCurrentDoc */
/**
 * SPL HQ — backend LOADER (Google Apps Script, bound to the "SPL HQ App" Sheet owned by spl.hq.ops@gmail.com).
 *
 * This is the ONLY file pasted into Apps Script. It fetches the real backend (backend/logic.js on main),
 * caches it 5 minutes, keeps a 6-hour last-good copy, and runs it. Backend changes ship by pushing logic.js:
 * nobody re-pastes or redeploys.
 *
 * Deploy once: Deploy → New deployment → Web app · Execute as: Me · Who has access: Anyone.
 * Updating THIS file (rare): paste, Save, Deploy → Manage deployments → ✏️ → Version: New version → Deploy.
 *
 * Safety: @OnlyCurrentDoc limits Sheet access to this one spreadsheet. Only the spl-hq GitHub org owners
 * (and Claude sessions they start) can push to main.
 */
var LOGIC_URL = "https://raw.githubusercontent.com/spl-hq/spl-hq.github.io/main/backend/logic.js";

function logic_(fresh) {
  var cache = CacheService.getScriptCache(), src = fresh ? null : cache.get("logic"), M, res = null, got = false;
  if (!src) {
    try { res = UrlFetchApp.fetch(LOGIC_URL + "?t=" + Date.now(), { muteHttpExceptions: true }); } catch (e) {}
    if (res && res.getResponseCode() === 200) { src = res.getContentText(); got = true; }
  }
  if (src) {
    try { M = {}; (new Function("M", src))(M); if (!M.doPost) throw new Error("no doPost");
      if (got && src.length < 95000) { cache.put("logic", src, 300); cache.put("logic_last", src, 21600); } return M; }
    catch (e) { cache.remove("logic"); }
  }
  var last = cache.get("logic_last");
  if (!last) throw new Error("Couldn't load logic.js" + (res ? " (" + res.getResponseCode() + ")" : ""));
  M = {}; (new Function("M", last))(M); return M;
}

function doGet(e) { return logic_().doGet(e); }
function doPost(e) { return logic_().doPost(e); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu("SPL HQ")
    .addItem("Run setup check", "menuCheck")
    .addItem("Load latest logic now", "menuReload")
    .addToUi();
}
function menuCheck() { logic_().menuCheck(); }
function menuReload() {
  CacheService.getScriptCache().remove("logic");
  SpreadsheetApp.getUi().alert("Loaded SPL HQ logic v" + logic_(true).VERSION + " from the repo.");
}
// The 15-minute robot. Add later: Apps Script → Triggers (⏰) → Add Trigger → tick · Time-driven · Minutes timer · Every 15 minutes.
function tick() { logic_().tick(); }

// Never called. Listing the services lets Google ask for these permissions once,
// because code loaded at runtime can't be scanned for them.
function scopes_() {
  SpreadsheetApp.getActive(); MailApp.sendEmail("", "", ""); Session.getEffectiveUser().getEmail();
  CacheService.getScriptCache(); LockService.getScriptLock(); UrlFetchApp.fetch("");
  ContentService.createTextOutput(""); Utilities.getUuid(); PropertiesService.getScriptProperties();
}
