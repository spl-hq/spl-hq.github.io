#!/usr/bin/env python3
"""One-time (re-runnable) pull of every SPL season ESPN has → data/SPL_Matchups.csv (GOLD, robot-written).
Run by .github/workflows/espn-history.yml with secrets ESPN_S2 + SWID. Owners are resolved through
data/SPL_Owner_Registry.csv (ESPN member name first, team name second); anything unresolved is listed in the report
and written with owner_id blank. Never guesses."""
import csv, json, os, re, sys, time, urllib.request, urllib.error, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LID = 19583
S2, SWID = os.environ.get("ESPN_S2", "").strip(), os.environ.get("SWID", "").strip()
if SWID and not SWID.startswith("{"): SWID = "{" + SWID + "}"
HDR = {"Cookie": f"espn_s2={S2}; SWID={SWID}", "User-Agent": "Mozilla/5.0 SPL-HQ history pull"}
def get(url):
    req = urllib.request.Request(url, headers=HDR)
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return e.code, None
    except Exception as e: return 0, None
def norm(s): return re.sub(r"[^a-z0-9]", "", str(s or "").lower())
reg = list(csv.DictReader(l for l in open(os.path.join(ROOT, "data", "SPL_Owner_Registry.csv"), encoding="utf-8") if not l.startswith("#")))
alias = {}
for r in reg:
    for a in [r["canonical_name"], r["team_2026"], r["team_2025"], r["team_2019"]] + r["aliases"].split("|"):
        if a and len(norm(a)) > 2: alias.setdefault(norm(a), r["owner_id"])
VIEWS = "view=mMatchupScore&view=mMatchup&view=mTeam&view=mSettings"
rows, report, unresolved = [], [], {}
this_year = datetime.date.today().year
for y in range(this_year, 1999, -1):
    st, d = get(f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{y}/segments/0/leagues/{LID}?{VIEWS}")
    src = "season"
    if not d or not d.get("schedule"):
        st2, d2 = get(f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{LID}?seasonId={y}&{VIEWS}")
        if isinstance(d2, list) and d2: d, st, src = d2[0], st2, "leagueHistory"
        elif isinstance(d2, dict): d, st, src = d2, st2, "leagueHistory"
    if not d or not d.get("schedule"):
        report.append(f"{y}: no data (HTTP {st})"); continue
    members = {m.get("id"): (m.get("firstName", "") + " " + m.get("lastName", "")).strip() or m.get("displayName", "") for m in d.get("members", [])}
    teams = {}
    for t in d.get("teams", []):
        name = t.get("name") or (str(t.get("location", "")) + " " + str(t.get("nickname", ""))).strip()
        owners = [members.get(o, "") for o in (t.get("owners") or [])]
        prim = members.get(t.get("primaryOwner"), "") or (owners[0] if owners else "")
        oid = alias.get(norm(prim)) or next((alias.get(norm(o)) for o in owners if alias.get(norm(o))), None) or alias.get(norm(name))
        if not oid: unresolved.setdefault(f"{name} ({prim or '?'})", []).append(y)
        teams[t["id"]] = {"name": name, "owner": oid or "", "who": prim}
    reg_weeks = ((d.get("settings") or {}).get("scheduleSettings") or {}).get("matchupPeriodCount")
    n = 0
    for g in d["schedule"]:
        h, a = g.get("home") or {}, g.get("away") or {}
        if not h or not a: continue  # byes
        def pts(sd):  # ESPN keeps the final in different fields by season
            for k in ("totalPoints", "totalPointsLive"):
                if sd.get(k): return sd[k]
            pb = sd.get("pointsByScoringPeriod") or {}
            if pb: return sum(v for v in pb.values() if isinstance(v, (int, float)))
            return 0
        hp, ap = pts(h), pts(a)
        if not hp and not ap: continue  # not played yet
        tier = g.get("playoffTierType") or "NONE"
        th, ta = teams.get(h.get("teamId"), {}), teams.get(a.get("teamId"), {})
        rows.append({"season": y, "week": g.get("matchupPeriodId"), "playoff_tier": tier,
                     "home_owner": th.get("owner", ""), "home_team": th.get("name", ""), "home_pts": round(hp, 2),
                     "away_owner": ta.get("owner", ""), "away_team": ta.get("name", ""), "away_pts": round(ap, 2),
                     "winner": g.get("winner", "UNDECIDED"), "source": "espn-" + src})
        n += 1
    if not n and d["schedule"]: report.append(f"{y}: DEBUG first game keys home={sorted((d['schedule'][0].get('home') or {}).keys())} sample={json.dumps(d['schedule'][0])[:400]}")
    report.append(f"{y}: {n} games, {len(teams)} teams, regular-season weeks {reg_weeks}, via {src}")
    time.sleep(0.5)
rows.sort(key=lambda r: (r["season"], r["week"] or 0, r["home_owner"]))
out = os.path.join(ROOT, "data", "SPL_Matchups.csv")
with open(out, "w", newline="", encoding="utf-8") as f:
    f.write("# SPL_Matchups.csv  --  GOLD (robot-written by tools/pull_history.py from ESPN league 19583; re-run to refresh).\n")
    f.write(f"# Pulled {datetime.datetime.utcnow().isoformat(timespec='minutes')}Z. One row per game; byes and unplayed games skipped.\n")
    f.write("# playoff_tier: NONE = regular season, WINNERS_BRACKET = playoffs, others = consolation. owner_id blank = unresolved (see report).\n")
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["season"]); w.writeheader(); w.writerows(rows)
rep = os.path.join(ROOT, "docs", "HISTORY_PULL_REPORT.md")
with open(rep, "w", encoding="utf-8") as f:
    f.write(f"# ESPN history pull · {datetime.datetime.utcnow().isoformat(timespec='minutes')}Z\n\n{len(rows)} games total.\n\n## Seasons\n")
    f.write("\n".join("- " + x for x in report) + "\n\n## Unresolved teams (owner_id left blank)\n")
    f.write("\n".join(f"- {k}: {sorted(set(v))}" for k, v in unresolved.items()) or "- none")
    f.write("\n")
print(open(rep).read())
if not S2: sys.exit("ESPN_S2 secret missing")
