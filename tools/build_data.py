#!/usr/bin/env python3
"""Regenerate league-data.js (DERIVED) from the gold CSVs in data/. Run: python3 tools/build_data.py"""
import csv, json, datetime, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rows(name):
    with open(os.path.join(ROOT, "data", name), encoding="utf-8") as f:
        return list(csv.DictReader(l for l in f if not l.startswith("#")))
def seasons(sv):
    out = {}
    for part in filter(None, (sv or "").split("|")):
        k, v = part.split(":"); out[k] = v if v == "F" else (float(v) if "." in v else int(v))
    return out
contracts = [{"id": r["contract_id"], "owner": r["owner_id"], "player": r["player"], "pos": r["position"],
              "signed": int(r["signed_season"]), "term": int(r["term_years"]), "tag": r["is_franchise_tag"] == "Y",
              "kp": seasons(r["kp_by_season"]), "pen": seasons(r["cap_penalty_by_season"]), "status": r["status"]}
             for r in rows("Keeper_Contracts.csv")]
owners = [{"id": r["owner_id"], "name": r["short_name"], "full": r["canonical_name"], "team": r["team_2026"], "div": r["division_2026"]}
          for r in rows("SPL_Owner_Registry.csv")]
out = ("// DERIVED DATA -- DO NOT HAND-EDIT. Regenerate: python3 tools/build_data.py\n"
       f"// Sources: data/Keeper_Contracts.csv, data/SPL_Owner_Registry.csv. Generated {datetime.date.today()}.\n"
       f"var LEAGUE_DATA = {json.dumps({'owners': owners, 'contracts': contracts}, ensure_ascii=False)};\n")
open(os.path.join(ROOT, "league-data.js"), "w", encoding="utf-8").write(out)
print(len(contracts), "contracts,", len(owners), "owners")
