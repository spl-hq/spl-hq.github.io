#!/usr/bin/env python3
"""ESPN archive pull (Mike 11/27: "as much as possible from ESPN"). Re-runnable; rebuilds each file from ESPN every run.
Writes robot GOLD (never hand-edit; fix the registry or Packet transcriptions instead):
  data/ESPN_Draft_Boards.csv   every SPL Draft pick ESPN kept: season, round, pick, overall, owner, player, keeper flag
  data/ESPN_Season_Teams.csv   every season's teams: owner, team name, abbrev, division, record, PF/PA, final rank
  data/ESPN_Season_Rosters.csv each finished season's final rosters: owner, player, how acquired, keeper value
  data/ESPN_Transactions.csv   executed trades + adds/drops/waivers ESPN still has, one row per player moved
  docs/ESPN_ARCHIVE_REPORT.md  what each season returned (and what ESPN refused), unresolved owners
Owners resolve through data/SPL_Owner_Registry.csv aliases (member name, then team name). Never guesses: blank owner = unresolved.
Runs in .github/workflows/espn-archive.yml with secrets ESPN_S2 + SWID (the sandbox can't reach ESPN)."""
import csv, json, os, re, time, urllib.request, urllib.error, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LID = 19583
S2, SWID = os.environ.get("ESPN_S2", "").strip(), os.environ.get("SWID", "").strip()
if SWID and not SWID.startswith("{"): SWID = "{" + SWID + "}"
BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"
POS = {1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST"}
PRO = {0: "FA", 1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR",
       15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WSH",
       29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU"}
LOG = []
DBG = []

def get(url, filt=None):
    h = {"Cookie": f"espn_s2={S2}; SWID={SWID}", "User-Agent": "Mozilla/5.0 SPL-HQ archive pull", "Accept": "application/json"}
    if filt is not None: h["x-fantasy-filter"] = json.dumps(filt)
    for i in range(3):  # reads only: safe to retry a network blip
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=90) as r: return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (401, 403, 404): return e.code, None
            err = e.code
        except Exception as e: err = str(e)[:80]
        time.sleep(2 * (i + 1))
    return err, None

def season(y, views, extra=""):
    """A season's league object: modern endpoint first, leagueHistory for old seasons."""
    q = "&".join("view=" + v for v in views) + extra
    st, d = get(f"{BASE}/seasons/{y}/segments/0/leagues/{LID}?{q}")
    if isinstance(d, dict) and d.get("teams"): return d, "season"
    st2, d2 = get(f"{BASE}/leagueHistory/{LID}?seasonId={y}&{q}")
    if isinstance(d2, list) and d2: return d2[0], "leagueHistory"
    if isinstance(d2, dict) and d2.get("teams"): return d2, "leagueHistory"
    return None, f"HTTP {st}/{st2}"

def norm(s): return re.sub(r"[^a-z0-9]", "", str(s or "").lower())
reg = list(csv.DictReader(l for l in open(os.path.join(ROOT, "data", "SPL_Owner_Registry.csv"), encoding="utf-8") if not l.startswith("#")))
alias = {}
for r in reg:
    for a in [r["canonical_name"], r["team_2026"], r["team_2025"], r["team_2019"]] + r["aliases"].split("|"):
        if a and len(norm(a)) > 2: alias.setdefault(norm(a), r["owner_id"])
unresolved = {}

def team_map(d, y):
    members = {m.get("id"): (m.get("firstName", "") + " " + m.get("lastName", "")).strip() or m.get("displayName", "") for m in d.get("members", [])}
    divs = {x.get("id"): x.get("name", "") for x in (((d.get("settings") or {}).get("scheduleSettings") or {}).get("divisions") or [])}
    out = {}
    for t in d.get("teams", []):
        name = t.get("name") or (str(t.get("location", "")) + " " + str(t.get("nickname", ""))).strip()
        owners = [members.get(o, "") for o in (t.get("owners") or [])]
        prim = members.get(t.get("primaryOwner"), "") or (owners[0] if owners else "")
        oid = alias.get(norm(prim)) or next((alias.get(norm(o)) for o in owners if alias.get(norm(o))), None) or alias.get(norm(name)) or ""
        if not oid: unresolved.setdefault(f"{name} ({prim or '?'})", []).append(y)
        rec = ((t.get("record") or {}).get("overall") or {})
        out[t["id"]] = {"owner": oid, "name": name, "who": prim, "abbrev": t.get("abbrev", ""), "div": divs.get(t.get("divisionId"), str(t.get("divisionId", ""))),
                        "w": rec.get("wins", ""), "l": rec.get("losses", ""), "t": rec.get("ties", ""), "pf": round(rec.get("pointsFor", 0) or 0, 2), "pa": round(rec.get("pointsAgainst", 0) or 0, 2),
                        "seed": t.get("playoffSeed", ""), "final": t.get("rankCalculatedFinal", "") or t.get("finalStandingsPosition", "")}
    return out

def player_names(y, d):
    """id → (name, pos, nfl team). Season player pool first; rosters fill the rest."""
    names = {}
    st, pl = get(f"{BASE}/seasons/{y}/players?scoringPeriodId=0&view=players_wl", {"filterActive": None})
    if isinstance(pl, list):
        for p in pl: names[p.get("id")] = (p.get("fullName", ""), POS.get(p.get("defaultPositionId"), ""), PRO.get(p.get("proTeamId"), ""))
    for t in (d or {}).get("teams", []):
        for e in ((t.get("roster") or {}).get("entries") or []):
            p = ((e.get("playerPoolEntry") or {}).get("player") or {})
            if p.get("id") and p.get("fullName"): names.setdefault(p["id"], (p["fullName"], POS.get(p.get("defaultPositionId"), ""), PRO.get(p.get("proTeamId"), "")))
    return names, (len(pl) if isinstance(pl, list) else f"pool HTTP {st}")

def pname(names, pid): return names.get(pid, ("", "", ""))

this_year = datetime.date.today().year
drafts, teams_rows, rosters, moves, report = [], [], [], [], []
for y in range(this_year, 2003, -1):
    d, src = season(y, ["mTeam", "mSettings", "mDraftDetail", "mRoster", "mStatus"])
    if not d:
        report.append(f"| {y} | — | ESPN has no league ({src}) | | | |"); continue
    tm = team_map(d, y)
    names, pool = player_names(y, d)
    finished = y < this_year
    # teams
    for tid, t in sorted(tm.items(), key=lambda x: (x[1]["final"] or 99)):
        teams_rows.append({"season": y, "team_id": tid, "owner_id": t["owner"], "team_name": t["name"], "abbrev": t["abbrev"], "division": t["div"],
                           "wins": t["w"], "losses": t["l"], "ties": t["t"], "points_for": t["pf"], "points_against": t["pa"], "playoff_seed": t["seed"], "final_rank": t["final"], "espn_member": t["who"]})
    # draft
    picks = ((d.get("draftDetail") or {}).get("picks") or [])
    for p in picks:
        n, pos, pro = pname(names, p.get("playerId"))
        drafts.append({"season": y, "round": p.get("roundId"), "pick_in_round": p.get("roundPickNumber"), "overall_pick": p.get("overallPickNumber"),
                       "owner_id": tm.get(p.get("teamId"), {}).get("owner", ""), "team_name": tm.get(p.get("teamId"), {}).get("name", ""),
                       "player_id": p.get("playerId"), "player": n, "position": pos, "nfl_team": pro, "keeper": "Y" if p.get("keeper") or p.get("reservedForKeeper") else "N"})
    # final rosters (finished seasons only; the live one is in the app)
    nr = 0
    if finished:
        for t in d.get("teams", []):
            for e in ((t.get("roster") or {}).get("entries") or []):
                n, pos, pro = pname(names, e.get("playerId"))
                ad = e.get("acquisitionDate")
                rosters.append({"season": y, "owner_id": tm.get(t["id"], {}).get("owner", ""), "player_id": e.get("playerId"), "player": n, "position": pos, "nfl_team": pro,
                                "acquired": (e.get("acquisitionType") or "").lower(), "acquired_on": datetime.datetime.utcfromtimestamp(ad / 1000).date().isoformat() if ad else "",
                                "keeper_value": e.get("keeperValue", "") or "", "lineup_slot": e.get("lineupSlotId", "")})
                nr += 1
    # transactions: ESPN hands them out per scoring period
    seen, nt, ntr = set(), 0, 0
    for sp in range(0, 19):
        _, tx = get(f"{BASE}/seasons/{y}/segments/0/leagues/{LID}?view=mTransactions2&scoringPeriodId={sp}")
        if sp == 1: DBG.append(f"{y}: mTransactions2 sp1 → {len((tx or {}).get('transactions') or [])} rows, keys {sorted((tx or {}).keys())[:8]}")
        for x in ((tx or {}).get("transactions") or []):
            if x.get("status") != "EXECUTED" or x.get("id") in seen: continue
            seen.add(x.get("id"))
            ty = x.get("type", "")
            if ty in ("TRADE_PROPOSAL", "TRADE_DECLINE", "TRADE_VETO", "ROSTER", "DRAFT", "FUTURE_ROSTER"): continue
            when = x.get("processDate") or x.get("proposedDate")
            for it in x.get("items") or []:
                n, pos, pro = pname(names, it.get("playerId"))
                moves.append({"season": y, "date": datetime.datetime.utcfromtimestamp(when / 1000).isoformat(timespec="minutes") if when else "", "scoring_period": x.get("scoringPeriodId", sp),
                              "transaction_id": x.get("id"), "type": ty, "move": it.get("type", ""), "player_id": it.get("playerId"), "player": n, "position": pos,
                              "from_owner": tm.get(it.get("fromTeamId"), {}).get("owner", "") if it.get("fromTeamId", -1) > 0 else "",
                              "to_owner": tm.get(it.get("toTeamId"), {}).get("owner", "") if it.get("toTeamId", -1) > 0 else ""})
                nt += 1
            if ty.startswith("TRADE"): ntr += 1
        time.sleep(0.2)
    # mTransactions2 is usually empty for past seasons: fall back to the league's activity feed (what ESPN's "Recent Activity" shows)
    if not nt:
        ACT = {178: "ADD", 180: "WAIVER_ADD", 179: "DROP", 181: "DROP", 239: "DROP", 244: "TRADE"}
        for off in range(0, 6000, 50):
            filt = {"topics": {"filterType": {"value": ["ACTIVITY_TRANSACTIONS"]}, "limit": 50, "limitPerMessageSet": {"value": 25}, "offset": off,
                               "sortMessageDate": {"order": "DESC"}, "sortFor": {"order": "DESC"}, "filterIncludeMessageTypeIds": {"value": [178, 179, 180, 181, 239, 244]}}}
            st, cm = get(f"{BASE}/seasons/{y}/segments/0/leagues/{LID}/communication/?view=kona_league_communication", filt)
            if st == 400 and off == 0:  # older seasons reject the message-type filter: ask without it
                f2 = json.loads(json.dumps(filt)); f2["topics"].pop("filterIncludeMessageTypeIds", None)
                st, cm = get(f"{BASE}/seasons/{y}/segments/0/leagues/{LID}/communication/?view=kona_league_communication", f2)
            topics = (cm or {}).get("topics") or []
            if off == 0: DBG.append(f"{y}: activity HTTP {st}, {len(topics)} topics, keys {sorted((cm or {}).keys())[:6] if isinstance(cm, dict) else type(cm).__name__}")
            for tp in topics:
                when = tp.get("date")
                kinds = {ACT.get(m.get("messageTypeId")) for m in tp.get("messages") or []}
                if "TRADE" in kinds: ntr += 1
                for m in tp.get("messages") or []:
                    k = ACT.get(m.get("messageTypeId"))
                    if not k: continue
                    n, pos, pro = pname(names, m.get("targetId"))
                    own = lambda t: tm.get(t, {}).get("owner", "") if isinstance(t, int) and t > 0 else ""
                    moves.append({"season": y, "date": datetime.datetime.utcfromtimestamp(when / 1000).isoformat(timespec="minutes") if when else "", "scoring_period": "",
                                  "transaction_id": tp.get("id"), "type": "ACTIVITY_" + k, "move": k, "player_id": m.get("targetId"), "player": n, "position": pos,
                                  "from_owner": own(m.get("from")) if k in ("TRADE", "DROP") else "", "to_owner": own(m.get("to")) if k == "TRADE" else own(m.get("for") or m.get("to"))})
                    nt += 1
            if len(topics) < 50: break
            time.sleep(0.3)
    report.append(f"| {y} | {src} | {len(tm)} teams | {len(picks)} picks (pool {pool}) | {nr} roster rows | {ntr} trades / {nt} moves |")
    time.sleep(0.5)

def write(name, rows, head, fields):
    with open(os.path.join(ROOT, "data", name), "w", newline="", encoding="utf-8") as f:
        f.write(f"# {name}  --  GOLD (robot-written by tools/pull_espn_archive.py from ESPN league {LID}; never hand-edit, re-run to refresh).\n")
        f.write(f"# Pulled {datetime.datetime.utcnow().isoformat(timespec='minutes')}Z. {head}\n")
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)
drafts.sort(key=lambda r: (-r["season"], r["overall_pick"] or 0))
write("ESPN_Draft_Boards.csv", drafts, "One row per pick; keeper=Y = a keeper slot on the board. owner_id blank = unresolved (report).",
      ["season", "round", "pick_in_round", "overall_pick", "owner_id", "team_name", "player_id", "player", "position", "nfl_team", "keeper"])
write("ESPN_Season_Teams.csv", sorted(teams_rows, key=lambda r: (-r["season"], r["final_rank"] or 99)), "One row per team per season (final_rank = ESPN's final standing).",
      ["season", "team_id", "owner_id", "team_name", "abbrev", "division", "wins", "losses", "ties", "points_for", "points_against", "playoff_seed", "final_rank", "espn_member"])
write("ESPN_Season_Rosters.csv", sorted(rosters, key=lambda r: (-r["season"], r["owner_id"], r["player"])), "Final roster of each finished season, one row per player.",
      ["season", "owner_id", "player_id", "player", "position", "nfl_team", "acquired", "acquired_on", "keeper_value", "lineup_slot"])
write("ESPN_Transactions.csv", sorted(moves, key=lambda r: (r["season"], r["date"], str(r["transaction_id"]))), "Executed moves ESPN still has, one row per player moved (TRADE_* = trades).",
      ["season", "date", "scoring_period", "transaction_id", "type", "move", "player_id", "player", "position", "from_owner", "to_owner"])
with open(os.path.join(ROOT, "docs", "ESPN_ARCHIVE_REPORT.md"), "w", encoding="utf-8") as f:
    f.write(f"# ESPN archive pull report\n\n_Robot: tools/pull_espn_archive.py · {datetime.datetime.utcnow().isoformat(timespec='minutes')}Z · league {LID}._\n\n")
    f.write("| Season | Source | Teams | Draft | Final rosters | Transactions |\n|---|---|---|---|---|---|\n" + "\n".join(report) + "\n\n")
    f.write(f"Totals: {len(drafts)} picks · {len(teams_rows)} team-seasons · {len(rosters)} roster rows · {len(moves)} moves.\n\n")
    f.write("## Transaction probe\n\n" + "\n".join("- " + d for d in DBG[:12]) + "\n\n")
    f.write("## Unresolved owners (add an alias to data/SPL_Owner_Registry.csv, then re-run)\n\n" + ("\n".join(f"- {k}: {sorted(set(v))}" for k, v in sorted(unresolved.items())) or "None.") + "\n")
print("\n".join(report)); print(len(drafts), "picks", len(teams_rows), "team-seasons", len(rosters), "roster rows", len(moves), "moves")
