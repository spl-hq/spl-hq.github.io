#!/usr/bin/env python3
"""Ledger robot: copies the app's approved trades + live pick ledger into the repo's gold files, and moves keeper
contracts with traded players. Run by .github/workflows/ledger-sync.yml (every 2 hours + on demand). Safe to re-run:
picks + trade log are rewritten from the backend each time; contract moves are marked with [trade id] and applied once.

  live mode → data/Draft_Pick_Ownership.csv, data/Trade_Log.csv, data/Keeper_Contracts.csv (owner_id / status / notes)
  test mode → the same files under data/test/ (practice trades never touch the real files)
Rules come from the backend (Joe's answers in the app): contracts "travels" (owner changes) or "resets" (contract ends)."""
import csv, json, os, re, sys, urllib.request, datetime, shutil, io
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
api = re.search(r'var API_URL = "([^"]+)"', open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()).group(1)
with urllib.request.urlopen(urllib.request.Request(api + "?action=ledger", headers={"User-Agent": "spl-hq-ledger-robot"}), timeout=90) as r:
    L = json.loads(r.read().decode())
if not L.get("ok"): sys.exit("backend said: " + json.dumps(L)[:300])
mode, rules = L["mode"], L["rules"]
out = os.path.join(ROOT, "data") if mode == "live" else os.path.join(ROOT, "data", "test")
os.makedirs(out, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="minutes")
def write(path, header_lines, fields, rows):
    buf = io.StringIO()
    for h in header_lines: buf.write("# " + h + "\n")
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n"); w.writeheader(); w.writerows(rows)
    new = buf.getvalue()
    old = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
    strip = lambda t: "\n".join(l for l in t.splitlines() if not l.startswith("# Synced"))
    if strip(old) != strip(new): open(path, "w", encoding="utf-8").write(new); return True
    return False
tag = "" if mode == "live" else "TEST MODE (practice trades) -- "
picks = sorted(L["picks"], key=lambda p: (p["season"], p["round"], p["original"]))
ch1 = write(os.path.join(out, "Draft_Pick_Ownership.csv"),
    [tag + "Draft_Pick_Ownership.csv -- GOLD, robot-written by tools/ledger_sync.py from the app's pick ledger. Do not hand-edit:",
     "fix a pick in the app (Commish desk -> Pick ledger fix) and the robot copies it here.", f"Synced {stamp}. Seasons {rules['pickSeasons']} ({rules['pickYearsFrom']})."],
    ["season", "round", "original_owner_id", "current_owner_id", "via"],
    [{"season": p["season"], "round": p["round"], "original_owner_id": p["original"], "current_owner_id": p["owner"], "via": p["via"] if p["via"] != "seed" else ""} for p in picks])
def side(s):
    return "; ".join([pl["n"] for pl in (s or {}).get("players", [])] + [re.sub(r"^(\d+)-R(\d+)-(\w+)$", r"\1 R\2 (\3)", x) for x in (s or {}).get("picks", [])])
trades = sorted(L["trades"], key=lambda t: t["approved"])
ch2 = write(os.path.join(out, "Trade_Log.csv"),
    [tag + "Trade_Log.csv -- GOLD, robot-written by tools/ledger_sync.py: every trade approved in the app.", f"Synced {stamp}."],
    ["trade_id", "approved", "from_owner", "to_owner", "from_sends", "to_sends", "approved_by"],
    [{"trade_id": t["id"], "approved": t["approved"][:10], "from_owner": t["from"], "to_owner": t["to"], "from_sends": side(t["fromSends"]), "to_sends": side(t["toSends"]), "approved_by": t["by"]} for t in trades])
# Keeper contracts follow their players (live: the gold file; test: a copy under data/test/)
src = os.path.join(ROOT, "data", "Keeper_Contracts.csv"); dst = os.path.join(out, "Keeper_Contracts.csv")
if mode != "live" and not os.path.exists(dst): shutil.copy(src, dst)
lines = open(dst, encoding="utf-8").read().splitlines(True)
head = [l for l in lines if l.startswith("#")]; body = [l for l in lines if not l.startswith("#")]
rows = list(csv.DictReader(body)); fields = list(rows[0].keys()) if rows else []
moved = []
for t in trades:
    for giver, taker, s in ((t["from"], t["to"], t["fromSends"]), (t["to"], t["from"], t["toSends"])):
        for pl in (s or {}).get("players", []):
            for c in rows:
                if c["status"] == "active" and c["owner_id"] == giver and c["player"].lower() == pl["n"].lower() and f"[{t['id']}]" not in c["notes"]:
                    if rules["contracts"] == "resets": c["status"] = "terminated"; what = f"contract ended on trade to {taker}"
                    else: c["owner_id"] = taker; what = f"traded {giver} -> {taker}"
                    c["notes"] = (c["notes"] + " | " if c["notes"] else "") + f"[{t['id']}] {what} {t['approved'][:10]}"
                    moved.append(f"{c['player']}: {what} ({t['id']})")
if moved:
    buf = io.StringIO(); buf.writelines(head); w = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n"); w.writeheader(); w.writerows(rows)
    open(dst, "w", encoding="utf-8").write(buf.getvalue())
status = {"at": stamp, "mode": mode, "backend": L.get("version"), "trades": len(trades), "picks": len(picks), "rules": rules, "contractMoves": moved}
open(os.path.join(ROOT, "data", "ledger_status.json"), "w").write(json.dumps(status, indent=1) + "\n")
print(json.dumps(status, indent=1), "\nchanged:", ch1, ch2, bool(moved))
