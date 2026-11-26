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
# Head-to-head history: compact game list [season, week, tier, home_owner, home_pts, away_owner, away_pts]
# tier: R = regular season, P = playoffs (winners bracket), C = consolation. Unresolved owners skipped.
TIER = {"NONE": "R", "WINNERS_BRACKET": "P"}
games = []
mp = os.path.join(ROOT, "data", "SPL_Matchups.csv")
if os.path.exists(mp):
    for r in rows("SPL_Matchups.csv"):
        if not r["home_owner"] or not r["away_owner"] or r.get("winner") == "UNDECIDED": continue  # unresolved or still being played
        games.append([int(r["season"]), int(r["week"]), TIER.get(r["playoff_tier"], "C"), r["home_owner"], round(float(r["home_pts"]), 2), r["away_owner"], round(float(r["away_pts"]), 2)])
seasons = sorted({g[0] for g in games})
ls = os.path.join(ROOT, "data", "ledger_status.json")
ledger = json.load(open(ls)) if os.path.exists(ls) else None
out = ("// DERIVED DATA -- DO NOT HAND-EDIT. Regenerate: python3 tools/build_data.py\n"
       f"// Sources: data/Keeper_Contracts.csv, data/SPL_Owner_Registry.csv, data/SPL_Matchups.csv. Generated {datetime.date.today()}.\n"
       f"var LEAGUE_DATA = {json.dumps({'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'owners': owners, 'contracts': contracts, 'seasons': seasons, 'ledger': ledger, 'games': games}, ensure_ascii=False, separators=(',', ':'))};\n")
open(os.path.join(ROOT, "league-data.js"), "w", encoding="utf-8").write(out)
print(len(contracts), "contracts,", len(owners), "owners,", len(games), "games", seasons[:1], "-", seasons[-1:])
