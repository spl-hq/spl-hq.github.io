#!/usr/bin/env python3
"""✍️ SPL card lines robot (WS4, after MAFFL REEL `_ops/docs/CARD_LINES_RECIPE.md`). Run by .github/workflows/card-lines.yml after
each ESPN history pull (+ Tuesday backstop). The Weekly Pulse is retired (Mike 11/26): the reel's cards ARE the weekly update, and this
robot only writes the few words of personality on them.

1. Facts: the newest fully decided week of the newest season in gold data/SPL_Matchups.csv, the table, streaks, rank moves, all-time
   series, next week's pairings (data/SPL_Schedule.csv). Pure gold, no ESPN.
2. Claude (CLAUDE_CODE_OAUTH_TOKEN set) writes data/Card_Lines.json for that week: league headline/hot/cold, a result + next line per
   owner, and the Power 3 (a one-line take each). Validated (owner ids from the registry, ≤ 120 chars). The app shows plain facts without lines, so: no token →
   nothing is written (fine); Claude failed → nothing written, exit 1 (red Action).
3. Drops: a week's lines are published once and kept (never rewritten) unless --force. Keeps the last 30 weeks.
Usage: python3 tools/card_lines.py [--force] [--week N] [--facts-only]"""
import csv, json, os, re, subprocess, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rows(name):
    p = os.path.join(ROOT, "data", name)
    if not os.path.exists(p): return []
    with open(p, encoding="utf-8") as f: return list(csv.DictReader(l for l in f if not l.startswith("#")))
args = sys.argv[1:]
FORCE, FACTS_ONLY = "--force" in args, "--facts-only" in args
WEEK_ARG = int(args[args.index("--week") + 1]) if "--week" in args else None

reg = {r["owner_id"]: r for r in rows("SPL_Owner_Registry.csv")}
NAME = {k: r["short_name"] for k, r in reg.items()}
TEAM = {k: r["team_2026"] for k, r in reg.items()}
TIER = {"NONE": "R", "WINNERS_BRACKET": "P"}
all_rows = [r for r in rows("SPL_Matchups.csv") if r["home_owner"] and r["away_owner"]]
if not all_rows: print("card lines: no games in data/SPL_Matchups.csv; nothing to do"); sys.exit(0)
season = max(int(r["season"]) for r in all_rows)
cur = [r for r in all_rows if int(r["season"]) == season]
decided_weeks = sorted({int(r["week"]) for r in cur} - {int(r["week"]) for r in cur if r["winner"] == "UNDECIDED"})
if WEEK_ARG: decided_weeks = [w for w in decided_weeks if w <= WEEK_ARG]
if not decided_weeks: print("card lines: no finished week yet in %d; nothing to do" % season); sys.exit(0)
week = decided_weeks[-1]
games = [[int(r["season"]), int(r["week"]), TIER.get(r["playoff_tier"], "C"), r["home_owner"], float(r["home_pts"]), r["away_owner"], float(r["away_pts"])]
         for r in all_rows if r["winner"] != "UNDECIDED"]
upto = [g for g in games if (g[0], g[1]) <= (season, week)]

def series(a, b, before=None):  # all-time W-L-T for a vs b (regular + playoffs), optionally only games before (season, week)
    w = l = t = 0
    for g in upto:
        if g[2] == "C" or (before and (g[0], g[1]) >= before): continue
        if {g[3], g[5]} != {a, b}: continue
        ap, bp = (g[4], g[6]) if g[3] == a else (g[6], g[4])
        if ap > bp: w += 1
        elif ap < bp: l += 1
        else: t += 1
    return w, l, t
def rec(w, l, t=0): return f"{w}–{l}" + (f"–{t}" if t else "")

# The table: this season's regular-season games through `week`
table = {}
for g in [g for g in upto if g[0] == season and g[2] == "R"]:
    for me, mp, op in ((g[3], g[4], g[6]), (g[5], g[6], g[4])):
        t = table.setdefault(me, {"owner": me, "w": 0, "l": 0, "t": 0, "pf": 0.0, "pa": 0.0, "res": [], "scores": []})
        t["pf"] += mp; t["pa"] += op; t["scores"].append(mp)
        r = "W" if mp > op else "L" if mp < op else "T"; t["res"].append(r); t[{"W": "w", "L": "l", "T": "t"}[r]] += 1
order = sorted(table.values(), key=lambda t: (-(t["w"] + t["t"] / 2), -t["pf"]))
for i, t in enumerate(order):
    s = t["res"][-1]; n = 0
    for r in reversed(t["res"]):
        if r != s: break
        n += 1
    t.update(rank=i + 1, streak=f"{s}{n}", last3="".join(t["res"][-3:]), avg=round(t["pf"] / max(1, len(t["scores"])), 1),
             pf=round(t["pf"], 1), pa=round(t["pa"], 1), rec=rec(t["w"], t["l"], t["t"]))
prev_rank = {}
prev = [g for g in upto if g[0] == season and g[2] == "R" and g[1] < week]
if prev:
    pt = {}
    for g in prev:
        for me, mp, op in ((g[3], g[4], g[6]), (g[5], g[6], g[4])):
            x = pt.setdefault(me, [0, 0.0]); x[0] += 1 if mp > op else 0.5 if mp == op else 0; x[1] += mp
    for i, (o, _) in enumerate(sorted(pt.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))): prev_rank[o] = i + 1

wk = [g for g in upto if g[0] == season and g[1] == week]
results = []
for g in wk:
    h, hp, a, ap = g[3], g[4], g[5], g[6]
    win, lose = (h, a) if hp >= ap else (a, h)
    sw = series(win, lose); before = series(win, lose, (season, week))
    results.append({"home": h, "away": a, "home_pts": round(hp, 1), "away_pts": round(ap, 1), "winner": win if hp != ap else "",
                    "margin": round(abs(hp - ap), 1), "tier": g[2],
                    "series_now": f"{NAME[win]} {rec(*sw)} vs {NAME[lose]} all-time" if win in NAME and lose in NAME else "",
                    "series_before": rec(*before), "met_before": sum(before)})
scores = [(g[3], g[4]) for g in wk] + [(g[5], g[6]) for g in wk]
season_scores = [(g[3], g[4], g[1]) for g in upto if g[0] == season] + [(g[5], g[6], g[1]) for g in upto if g[0] == season]
hi, lo = max(scores, key=lambda x: x[1]), min(scores, key=lambda x: x[1])
season_hi = max(season_scores, key=lambda x: x[1])
coach = max((t for t in order if any(o == t["owner"] for o, _ in scores)),
            key=lambda t: next(p for o, p in scores if o == t["owner"]) - t["avg"], default=None)
coach_pts = next((p for o, p in scores if coach and o == coach["owner"]), None)
sched = rows("SPL_Schedule.csv")
nxt = []
for r in sched:
    if int(r["season"] or 0) == season and int(r["week"] or 0) == week + 1 and r["home_owner"] and r["away_owner"]:
        h, a = r["home_owner"], r["away_owner"]; s = series(h, a)
        nxt.append({"home": h, "away": a, "tier": TIER.get(r["playoff_tier"], "C"), "series": f"{NAME.get(h, h)} {rec(*s)} vs {NAME.get(a, a)} all-time",
                    "home_rec": table.get(h, {}).get("rec", ""), "away_rec": table.get(a, {}).get("rec", "")})
kp27 = {}
for r in rows("Keeper_Contracts.csv"):
    m = re.search(r"2027:(\d+)", r.get("kp_by_season", ""))
    if m and r["status"] == "active": kp27[r["owner_id"]] = kp27.get(r["owner_id"], 0) + int(m.group(1))
reg_weeks = None
for l in open(os.path.join(ROOT, "data", "SPL_Schedule.csv"), encoding="utf-8") if os.path.exists(os.path.join(ROOT, "data", "SPL_Schedule.csv")) else []:
    m = re.search(r"reg_weeks=(\d+)", l)
    if m: reg_weeks = int(m.group(1))
facts = {"league": "SPL (State Penn League), 12 owners, keeper league, half-PPR, Super Flex. Top 6 make the playoffs (Weeks 15–17); Week 14 is the SPL Shoot Out.",
         "season": season, "week": week, "regular_season_weeks": reg_weeks or 14,
         "owners": {k: {"name": NAME[k], "team": TEAM[k]} for k in NAME},
         "results": results,
         "table": [{k: t[k] for k in ("rank", "owner", "rec", "pf", "pa", "avg", "streak", "last3")} | {"rank_last_week": prev_rank.get(t["owner"])} for t in order],
         "high_score": {"owner": hi[0], "pts": round(hi[1], 1)}, "low_score": {"owner": lo[0], "pts": round(lo[1], 1)},
         "season_high": {"owner": season_hi[0], "pts": round(season_hi[1], 1), "week": season_hi[2], "set_this_week": season_hi[2] == week},
         "coach_of_the_week": {"owner": coach["owner"], "pts": round(coach_pts, 1), "season_avg": coach["avg"], "over_avg": round(coach_pts - coach["avg"], 1)} if coach else None,
         "next_week": nxt, "keeper_kp_2027": kp27}

PROMPT = """You write the short lines on the SPL HQ Home screen cards (never call them a "reel"; SPL = State Penn League: 12 old friends, keeper league, half-PPR,
Super Flex; top 6 make the playoffs, Week 14 is the SPL Shoot Out). The app shows plain facts if you don't write, so a missing line is fine
and a wrong line is not.

Return ONLY a JSON object (no markdown fence):
{"league": {"headline": "...", "hot": "...", "cold": "..."},
 "owners": {"<owner id>": {"result": "...", "next": "..."}},
 "power3": [{"owner": "<owner id>", "take": "..."}]}

- headline: the league's story after this week. NEVER the week's top score or high scorer (the Week awards card owns that fact: one fact,
  one card). Lead with the race, a streak, an upset, a rank swing. Shared card: never say "you".
- hot / cold: the hottest and coldest team right now (streak, last3, points).
- owners.<id>.result: one line on that owner's game this week, from their side ("you"). next: one line on their next game (facts.next_week).
  Every owner id in facts.owners gets a result line; next only if they have a game in facts.next_week.
- The card already shows both scores and both records. Don't restate them. Give the one angle the numbers alone don't: the streak it
  started or snapped, the rank move, the all-time series, the season high, the opponent's form.
  Good: "Snapped a three-game skid, and Pete still owns you 16-6 all-time." Bad: "You lost 98.1-113.2; now 5-6."
- power3: the three best teams right now, best first, judged on record, points and last3. "take" is ONE punchy sentence on why
  they're here (<= 80 chars). The card already shows record, streak, points rank and next game as tiles: give the angle those don't.
- Only facts in the JSON. No players, injuries, news or quotes. No guessing beyond "a win would..." arithmetic.
- Short: every line <= 110 characters, one sentence, no hashtags, at most one emoji at the start. Owners by first name.
- Voice: a commissioner who knows everyone: dry, a little teasing, never mean about a person. Spread the spotlight.
- Never explain league rules. Valid JSON; when in doubt leave a key out.

FACTS:
"""
def clip(s, n): return re.sub(r"\s+", " ", str(s or "")).strip()[:n]
def valid(x):
    ids = set(NAME)
    if not isinstance(x, dict): raise ValueError("not an object")
    lg = {k: clip(v, 130) for k, v in (x.get("league") or {}).items() if k in ("headline", "hot", "cold") and v}
    if not lg.get("headline"): raise ValueError("no headline")
    ow = {}
    for k, v in (x.get("owners") or {}).items():
        if k in ids and isinstance(v, dict):
            o = {kk: clip(v.get(kk), 130) for kk in ("result", "next") if v.get(kk)}
            if o: ow[k] = o
    played = {r["home"] for r in results} | {r["away"] for r in results}
    miss = sorted(i for i in played if not ow.get(i, {}).get("result"))
    if miss: raise ValueError("missing result lines: " + ", ".join(miss))
    p3 = [{"owner": i.get("owner"), "take": clip(i.get("take"), 100)} for i in x.get("power3") or [] if isinstance(i, dict) and i.get("owner") in ids and i.get("take")][:3]
    return {"league": lg, "owners": ow, "power3": p3}
def claude():
    p = subprocess.run(["claude", "-p", "--output-format", "text", "--tools", ""], input=PROMPT + json.dumps(facts, ensure_ascii=False),
                       capture_output=True, text=True, timeout=600)
    if p.returncode: raise RuntimeError("claude exited %d: %s" % (p.returncode, (p.stderr or p.stdout)[-300:]))
    m = re.search(r"\{.*\}", p.stdout, re.S)
    if not m: raise ValueError("no JSON in Claude's reply")
    return valid(json.loads(m.group(0)))

if FACTS_ONLY: print(json.dumps(facts, indent=1, ensure_ascii=False)); sys.exit(0)
gp = os.path.join(ROOT, "data", "Card_Lines.json")
gold = json.load(open(gp, encoding="utf-8")) if os.path.exists(gp) else {"weeks": []}
if any(e["season"] == season and e["week"] == week for e in gold["weeks"]) and not FORCE:
    print(f"card lines: {season} week {week} already published (drops are kept)"); sys.exit(0)
if not (os.environ.get("CLAUDE_CODE_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY")):
    print("card lines: no CLAUDE_CODE_OAUTH_TOKEN; the cards show plain facts"); sys.exit(0)
try: body = claude()
except Exception as e: sys.exit("card lines: Claude failed, nothing published: " + str(e)[:300])
ed = {"season": season, "week": week, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="minutes"), "writer": "claude"} | body
gold["weeks"] = sorted([ed] + [e for e in gold["weeks"] if not (e["season"] == season and e["week"] == week)], key=lambda e: (-e["season"], -e["week"]))[:30]
gold["_"] = "GOLD, robot-written by tools/card_lines.py (card-lines.yml). Newest first. A week is published once and kept; --force rewrites."
with open(gp, "w", encoding="utf-8") as f: json.dump(gold, f, ensure_ascii=False, indent=1); f.write("\n")
print(f"card lines: {season} week {week} published: {body['league']['headline']}")
