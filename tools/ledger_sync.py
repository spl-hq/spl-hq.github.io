#!/usr/bin/env python3
"""Ledger robot: copies the app's approved trades + live pick ledger into the repo's gold files, and moves keeper
contracts with traded players. Run by .github/workflows/ledger-sync.yml (every 2 hours + on demand). Safe to re-run:
picks + trade log are rewritten from the backend each time; contract moves are marked with [trade id] and applied once.

  live mode → data/Draft_Pick_Ownership.csv, data/Trade_Log.csv, data/Keeper_Contracts.csv (owner_id / status / notes)
  test mode → the same files under data/test/ (practice trades never touch the real files)
  drafts    → data/Offseason_Drafts.csv (finished live drafts) · data/test/Offseason_Drafts.csv (finished rehearsals)
  SPL Draft → data/Draft_Picks.csv (the finished live board, rows marked "app <draft id>", replaced as a block; a season that already
              has hand-entered rows is left alone) · rehearsals → data/test/Draft_Picks.csv
  keepers   → data/Keeper_Declarations.csv (final Signing Day declarations) and, live only, the new contracts + terminations in
              data/Keeper_Contracts.csv (marked [decl id], applied once) · rehearsals → data/test/Keeper_Declarations.csv only
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
    ["trade_id", "approved", "from_owner", "to_owner", "from_sends", "to_sends", "drops", "approved_by"],
    [{"trade_id": t["id"], "approved": t["approved"][:10], "from_owner": t["from"], "to_owner": t["to"], "from_sends": side(t["fromSends"]), "to_sends": side(t["toSends"]),
      "drops": "; ".join([t["from"] + " drops " + d["n"] for d in (t.get("drops") or {}).get("from", [])] + [t["to"] + " drops " + d["n"] for d in (t.get("drops") or {}).get("to", [])]),
      "approved_by": t["by"]} for t in trades])
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
# 🗓️ Off-season drafts (Divisional + Slot): every finished draft, one row per pick. A draft's own mode decides the folder
# (live → data/, rehearsal → data/test/), independent of the trade mode.
drafts = L.get("drafts", [])
def dchoice(d, p):
    c = p["choice"]
    if d["kind"] == "slot": return f"slot {c['slot']}", "", str(c["slot"])
    if d["kind"] == "shootout": return ("paired (last two) with " if p["by"] == "auto" else "picks ") + c["opp"], "", c["opp"]
    return ("takes " if c["into"] == p["owner"] else "assigns ") + c["pick"], c["into"], c["pick"]
ch3 = False
for m, folder in (("live", os.path.join(ROOT, "data")), ("test", os.path.join(ROOT, "data", "test"))):
    ds = sorted([d for d in drafts if d["mode"] == m and d["kind"] != "spl"], key=lambda d: (d["season"], d["kind"], d["done"]))
    if m == "test" and not ds and not os.path.exists(os.path.join(folder, "Offseason_Drafts.csv")): continue
    os.makedirs(folder, exist_ok=True)
    rows_ = []
    for d in ds:
        for i, fx in enumerate(d.get("fixed") or []):  # Shoot Out Rule 1 matchups (set when the draft opened)
            rows_.append({"season": d["season"], "draft": d["kind"], "draft_id": d["id"], "pick": f"R1-{i + 1}", "owner_id": fx["a"], "choice": "Rule 1 vs " + fx["b"] + (f" ({fx['why']})" if fx.get("why") else ""),
                          "division_of": "", "value": fx["b"], "entered_by": "", "finished": str(d["done"])[:10]})
        for p in d["picks"]:
            what, into, val = dchoice(d, p)
            rows_.append({"season": d["season"], "draft": d["kind"], "draft_id": d["id"], "pick": p["n"], "owner_id": p["owner"], "choice": what,
                          "division_of": into, "value": val, "entered_by": p["by"] if p["by"] not in (p["owner"], "auto") else "", "finished": str(d["done"])[:10]})
    ch3 = write(os.path.join(folder, "Offseason_Drafts.csv"),
        [("TEST MODE (rehearsals) -- " if m == "test" else "") + "Offseason_Drafts.csv -- GOLD, robot-written by tools/ledger_sync.py from the app's draft rooms",
         "(League -> Off-season). Do not hand-edit: undo/redo picks in the app and the robot copies them here.",
         "draft: div = Divisional Draft (division_of = the founder whose division the owner joins; value = that owner) | slot = Slot Draft (value = SPL Draft slot)"
         " | shootout = Shoot Out Draft (value = Week 14 opponent; pick R1-n = Rule 1 matchup).",
         f"Synced {stamp}."],
        ["season", "draft", "draft_id", "pick", "owner_id", "choice", "division_of", "value", "entered_by", "finished"], rows_) or ch3
# 📝 SPL Draft: the finished board → Draft_Picks.csv (keepers stay off the board, as on the paper boards; a Franchise Tag
# keeps its row with player blank and player_raw FRANCHISE, like 2026's). Live: replace this season's "app" rows; never touch hand rows.
DP_FIELDS = ["season", "round", "pick_in_round", "overall_pick", "owner_id", "original_owner_id", "player", "player_raw", "is_keeper", "is_franchise", "needs_review", "notes"]
def board_rows(d):
    out = []
    for c in d["board"]:
        if c["skip"] == "keeper": continue
        tag = c["skip"] == "tag"
        out.append({"season": d["season"], "round": c["r"], "pick_in_round": c["p"], "overall_pick": c["n"], "owner_id": c["owner"], "original_owner_id": c["orig"],
                    "player": "" if tag else c["player"], "player_raw": "FRANCHISE" if tag else c["player"], "is_keeper": "N", "is_franchise": "Y" if tag else "N", "needs_review": "N",
                    "notes": f"app {d['id']}" + (f" · Franchise Tag ({c['player']})" if tag else "") + (f" · {c['pos']} {c['tm']}".rstrip() if not tag and (c.get("pos") or c.get("tm")) else "")
                             + (" · entered by " + c["by"] if c.get("by") and c["by"] != c["owner"] else "")})
    return out
ch5 = False
for m, folder in (("live", os.path.join(ROOT, "data")), ("test", os.path.join(ROOT, "data", "test"))):
    sp = [d for d in drafts if d["mode"] == m and d["kind"] == "spl" and d.get("board")]
    path = os.path.join(folder, "Draft_Picks.csv")
    if m == "test":
        if not sp and not os.path.exists(path): continue
        rows_ = [r for d in sorted(sp, key=lambda d: (d["season"], d["done"])) for r in board_rows(d)]
        ch5 = write(path, ["TEST MODE (rehearsals) -- Draft_Picks.csv -- robot-written by tools/ledger_sync.py from the app's SPL Draft room. Do not hand-edit.",
                           f"Synced {stamp}."], DP_FIELDS, rows_) or ch5
        continue
    if not sp: continue
    lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
    head = [l for l in lines if l.startswith("#")]
    rows = list(csv.DictReader([l for l in lines if not l.startswith("#")]))
    for d in sp:
        y = str(d["season"])
        if any(r["season"] == y and not r["notes"].startswith("app ") for r in rows):
            print(f"SPL Draft {d['id']}: {y} already has hand-entered rows in Draft_Picks.csv; left alone"); continue
        rows = [r for r in rows if not (r["season"] == y and r["notes"].startswith("app "))] + board_rows(d)
    buf = io.StringIO(); buf.writelines(head); w = csv.DictWriter(buf, fieldnames=DP_FIELDS, lineterminator="\n"); w.writeheader(); w.writerows(rows)
    if buf.getvalue() != "".join(lines): open(path, "w", encoding="utf-8").write(buf.getvalue()); ch5 = True
# 🔒 Keeper Signing Day: final declarations (the backend finalizes when the window closes). Rehearsals never touch contracts.
keeps = L.get("keepers", [])
pipes = lambda d: "|".join(f"{y}:{(int(v) if isinstance(v, float) and v.is_integer() else v)}" for y, v in sorted(d.items()))
ch4, signed = False, []
for m, folder in (("live", os.path.join(ROOT, "data")), ("test", os.path.join(ROOT, "data", "test"))):
    ks = sorted([k for k in keeps if k["mode"] == m], key=lambda k: (k["season"], k["owner"]))
    path = os.path.join(folder, "Keeper_Declarations.csv")
    if not ks and not os.path.exists(path): continue
    os.makedirs(folder, exist_ok=True)
    rows_ = []
    for k in ks:
        it, base = k["items"], {"season": k["season"], "decl_id": k["id"], "owner_id": k["owner"], "declared": str(k["ts"])[:10], "entered_by": k["by"] if k["by"] != k["owner"] else ""}
        for x in it.get("keep", []): rows_.append(dict(base, action="keep", player=x["player"], contract_id=x["cid"], term="", kp_this_season=x["kp"], kp_by_season="", cap_penalty_by_season=""))
        for x in it.get("signs", []): rows_.append(dict(base, action="tag" if x["tag"] else "sign", player=x["player"], contract_id="", term=x["term"], kp_this_season=x["y1"], kp_by_season=pipes(x["kp"]), cap_penalty_by_season=""))
        for x in it.get("cuts", []): rows_.append(dict(base, action="terminate", player=x["player"], contract_id=x["cid"], term="", kp_this_season="", kp_by_season="", cap_penalty_by_season=pipes(x["pen"])))
    ch4 = write(path, [("TEST MODE (rehearsals) -- " if m == "test" else "") + "Keeper_Declarations.csv -- GOLD, robot-written by tools/ledger_sync.py: every final Signing Day",
        "declaration made in the app (League -> Keepers). Do not hand-edit. No row for an owner = he didn't declare (carried contracts stand).", f"Synced {stamp}."],
        ["season", "decl_id", "owner_id", "action", "player", "contract_id", "term", "kp_this_season", "kp_by_season", "cap_penalty_by_season", "declared", "entered_by"], rows_) or ch4
    if m != "live" or not ks: continue
    # live: new contracts + terminations into the real gold file, once each
    kpath = os.path.join(ROOT, "data", "Keeper_Contracts.csv"); klines = open(kpath, encoding="utf-8").read().splitlines(True)
    khead = [l for l in klines if l.startswith("#")]; krows = list(csv.DictReader([l for l in klines if not l.startswith("#")])); kf = list(krows[0].keys())
    ids = {c["contract_id"] for c in krows}
    for k in ks:
        for x in k["items"].get("cuts", []):
            for c in krows:
                if c["contract_id"] == x["cid"] and f"[{k['id']}]" not in c["notes"]:
                    c["status"], c["cap_penalty_by_season"] = "terminated", pipes(x["pen"])
                    c["notes"] = (c["notes"] + " | " if c["notes"] else "") + f"[{k['id']}] terminated on {k['season']} Signing Day"; signed.append(f"✂️ {c['player']} ({k['owner']})")
        for x in k["items"].get("signs", []):
            cid = f"C{k['season']}-{k['owner']}-" + re.sub(r"[^a-z0-9]", "", x["player"].lower().replace(" jr", "").split(" ")[-1] if " " in x["player"] else x["player"].lower())
            if cid in ids: continue
            ids.add(cid); signed.append(f"🆕 {x['player']} ({k['owner']})")
            krows.append({**{f: "" for f in kf}, "contract_id": cid, "owner_id": k["owner"], "player": x["player"], "position": x.get("pos", ""), "signed_season": k["season"], "term_years": x["term"],
                          "year1_kp": x["y1"], "kp_by_season": pipes(x["kp"]), "is_franchise_tag": "Y" if x["tag"] else "N", "status": "active", "notes": f"[{k['id']}] signed on {k['season']} Signing Day"})
    if signed:
        buf = io.StringIO(); buf.writelines(khead); w = csv.DictWriter(buf, fieldnames=kf, lineterminator="\n"); w.writeheader(); w.writerows(krows)
        open(kpath, "w", encoding="utf-8").write(buf.getvalue())
# 🗳️ League votes (Mike 11/28): every closed vote (rule changes + league matters; practice votes never leave the app) → data/League_Votes.csv.
votes = sorted(L.get("votes") or [], key=lambda v: str(v["closed"]))
ch6 = write(os.path.join(ROOT, "data", "League_Votes.csv"),
    ["League_Votes.csv -- GOLD, robot-written by tools/ledger_sync.py: every league vote that closed in the app (Yes / No / Abstain).",
     "kind: rule = rulebook change (7 Yes passes) | matter = other league business (more Yes than No). A passed rule still gets written into data/SPL_Rulebook.md by hand.", f"Synced {stamp}."],
    ["vote_id", "closed", "kind", "question", "yes", "no", "abstain", "result", "raised_by"],
    [{"vote_id": v["id"], "closed": str(v["closed"])[:10], "kind": v["kind"], "question": v["title"], "yes": v["yes"], "no": v["no"], "abstain": v["abstain"], "result": v["result"], "raised_by": v["by"]} for v in votes]) if votes else False
status = {"at": stamp, "votes": len(votes), "keeperDecls": len(keeps), "signingDay": signed, "drafts": len(drafts), "mode": mode, "backend": L.get("version"), "trades": len(trades), "picks": len(picks), "rules": rules, "contractMoves": moved}
open(os.path.join(ROOT, "data", "ledger_status.json"), "w").write(json.dumps(status, indent=1) + "\n")
print(json.dumps(status, indent=1), "\nchanged:", ch1, ch2, ch3, ch4, ch5, ch6, bool(moved), bool(signed))
