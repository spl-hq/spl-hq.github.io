// App check: every inline <script> in index.html compiles, plus sw.js and league-data.js. Run: node tests/app_check.js
// Runs in CI (.github/workflows/checks.yml). A syntax error in the inline script = a blank app on every owner's phone.
"use strict";
const fs = require("fs"), path = require("path"), root = path.join(__dirname, "..");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m, i = 0;
while ((m = re.exec(html))) { i++; const line = html.slice(0, m.index).split("\n").length;
  try { new Function(m[1]); ok(true, "index.html inline script #" + i + " (line " + line + ")"); }
  catch (e) { ok(false, "index.html inline script #" + i + " (line " + line + "): " + e.message); } }
ok(i > 0, "found inline scripts (" + i + ")");
["sw.js", "league-data.js", "player-history.js"].forEach(f => { try { new Function(fs.readFileSync(path.join(root, f), "utf8")); ok(true, f); } catch (e) { ok(false, f + ": " + e.message); } });
console.log(fails ? "\n" + fails + " FAILED" : "\nall passed"); process.exit(fails ? 1 : 0);
