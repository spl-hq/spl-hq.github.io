#!/usr/bin/env python3
"""📰 SPL Weekly Pulse robot (WS4). Run by .github/workflows/weekly-pulse.yml after the ESPN history pull (and Tuesday backstop).

1. Facts: the newest fully decided week of the newest season in gold data/SPL_Matchups.csv, plus the table, streaks, all-time series
   (data/SPL_Matchups.csv), next week's pairings (data/SPL_Schedule.csv) and 2027 keeper KP (data/Keeper_Contracts.csv). Pure gold, no ESPN.
2. Writer: Claude (CLAUDE_CODE_OAUTH_TOKEN set, `claude` CLI installed) writes the headline, game lines, one line per owner, Coach of
   the Week and a power ranking, as JSON. Every name and number Claude may use is in the facts; output is validated (owner ids from the
   registry, lengths clipped). No token → a plain template edition, so the reel never goes empty. Token set but Claude failed → template
   edition is still written, then the script exits 1 so the Action fails loudly.
3. Gold: data/Weekly_Pulse.json (robot-written, newest edition first, keeps 40). Safe to re-run: an edition Claude already wrote for that
   week is kept unless --force. build_data.py derives `pulse` into league-data.js.
Usage: python3 tools/pulse.py [--force] [--week N] [--facts-only]"""
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
if not all_rows: print("pulse: no games in data/SPL_Matchups.csv; nothing to do"); sys.exit(0)
season = max(int(r["season"]) for r in all_rows)
cur = [r for r in all_rows if int(r["season"]) == season]
decided_weeks = sorted({int(r["week"]) for r in cur} - {int(r["week"]) for r in cur if r["winner"] == "UNDECIDED"})
if WEEK_ARG: decided_weeks = [w for w in decided_weeks if w <= WEEK_ARG]
if not decided_weeks: print("pulse: no finished week yet in %d; nothing to do" % season); sys.exit(0)
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

def template():
    by = {t["owner"]: t for t in order}
    gl = []
    for r in results:
        w = r["winner"]; l = r["away"] if w == r["home"] else r["home"]
        if not w: line = f"{NAME[r['home']]} and {NAME[r['away']]} tie at {r['home_pts']}."
        else:
            wp, lp = (r["home_pts"], r["away_pts"]) if w == r["home"] else (r["away_pts"], r["home_pts"])
            how = "edges" if r["margin"] < 5 else "rolls past" if r["margin"] >= 40 else "beats"
            line = f"{NAME[w]} {how} {NAME[l]} {wp}–{lp}." + (f" {r['series_now']}." if r["met_before"] else " First meeting in the history we have.")
        gl.append({"home": r["home"], "away": r["away"], "line": line})
    lines = {}
    for o, t in by.items():
        lines[o] = f"{t['rec']}, #{t['rank']} in the table" + (f" (was #{prev_rank[o]})" if prev_rank.get(o) and prev_rank[o] != t["rank"] else "") + f", {t['streak']} streak, {t['avg']} a week."
    top = order[0]
    head = f"Week {week}: {NAME[hi[0]]} posts {round(hi[1], 1)}" + (", a season high" if facts["season_high"]["set_this_week"] else "")
    return {"headline": head, "dek": f"{NAME[top['owner']]} leads the table at {top['rec']}. Every game, every owner, and who's up next.",
            "games": gl, "owners": lines,
            "coach": {"owner": coach["owner"], "line": f"{coach_pts:.1f}, {coach_pts - coach['avg']:.1f} over his season average."} if coach else None,
            "power": [{"owner": t["owner"], "line": f"{t['rec']} · {t['pf']} PF · last 3 {t['last3']}"} for t in order],
            "next": [{"home": n["home"], "away": n["away"], "line": n["series"] + "."} for n in nxt]}

PROMPT = """You write the SPL Weekly Pulse: a short, punchy weekly fantasy football newsletter for a 12-owner league of old friends
(the State Penn League). Voice: a sharp league insider who knows the history; funny, specific, never mean-spirited, no clichés.
Use ONLY the facts in the JSON below: never invent players, injuries, trades, quotes or numbers. Refer to owners by first name.
Spread the spotlight: no single owner in more than two game lines' worth of jokes, and every owner gets their own line.
Lean on history (all-time series, streaks, rank moves) to make it feel like this league's story.

Return ONLY a JSON object, no markdown fence, with exactly these keys:
{"headline": "<= 90 chars", "dek": "<= 200 chars, one sentence",
 "games": [{"home": "<owner id>", "away": "<owner id>", "line": "<= 220 chars, one per result, same order"}],
 "owners": {"<owner id>": "<= 140 chars, a line for EVERY owner id in facts.owners, about their week/season"},
 "coach": {"owner": "<facts.coach_of_the_week.owner>", "line": "<= 160 chars"},
 "power": [{"owner": "<owner id>", "line": "<= 120 chars"}  (all 12, best to worst, your judgment from the table)],
 "next": [{"home": "<owner id>", "away": "<owner id>", "line": "<= 160 chars preview"} (one per facts.next_week game; [] if none)]}

FACTS:
"""
def clip(s, n): return re.sub(r"\s+", " ", str(s or "")).strip()[:n]
def valid(x):
    ids = set(NAME)
    if not isinstance(x, dict) or not x.get("headline"): raise ValueError("no headline")
    g = [{"home": i.get("home"), "away": i.get("away"), "line": clip(i.get("line"), 260)} for i in x.get("games") or [] if isinstance(i, dict)]
    if len(g) != len(results) or any(i["home"] not in ids or i["away"] not in ids or not i["line"] for i in g): raise ValueError("games don't match the results")
    ow = {k: clip(v, 170) for k, v in (x.get("owners") or {}).items() if k in ids and v}
    if set(ow) != ids: raise ValueError("missing owner lines: " + ", ".join(sorted(ids - set(ow))))
    pw = [{"owner": i.get("owner"), "line": clip(i.get("line"), 150)} for i in x.get("power") or [] if isinstance(i, dict) and i.get("owner") in ids]
    if len({i["owner"] for i in pw}) != len(ids): pw = template()["power"]
    c = x.get("coach") if isinstance(x.get("coach"), dict) and x["coach"].get("owner") in ids else template()["coach"]
    nx = [{"home": i.get("home"), "away": i.get("away"), "line": clip(i.get("line"), 190)} for i in x.get("next") or [] if isinstance(i, dict) and i.get("home") in ids and i.get("away") in ids]
    return {"headline": clip(x["headline"], 100), "dek": clip(x.get("dek"), 220), "games": g, "owners": ow,
            "coach": {"owner": c["owner"], "line": clip(c.get("line"), 190)} if c else None, "power": pw, "next": nx}
def claude():
    p = subprocess.run(["claude", "-p", "--output-format", "text", "--tools", ""], input=PROMPT + json.dumps(facts, ensure_ascii=False),
                       capture_output=True, text=True, timeout=600)
    if p.returncode: raise RuntimeError("claude exited %d: %s" % (p.returncode, (p.stderr or p.stdout)[-300:]))
    m = re.search(r"\{.*\}", p.stdout, re.S)
    if not m: raise ValueError("no JSON in Claude's reply")
    return valid(json.loads(m.group(0)))

if FACTS_ONLY: print(json.dumps(facts, indent=1, ensure_ascii=False)); sys.exit(0)
gp = os.path.join(ROOT, "data", "Weekly_Pulse.json")
gold = json.load(open(gp, encoding="utf-8")) if os.path.exists(gp) else {"editions": []}
have = next((e for e in gold["editions"] if e["season"] == season and e["week"] == week), None)
token = bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN") or os.environ.get("ANTHROPIC_API_KEY"))
if have and not FORCE and (have.get("writer") == "claude" or not token):
    print(f"pulse: {season} week {week} already written ({have.get('writer')}); nothing to do"); sys.exit(0)
failed = None
if token:
    try: body, writer = claude(), "claude"
    except Exception as e: failed = str(e)[:300]; body, writer = template(), "template"
else: body, writer = template(), "template"
ed = {"season": season, "week": week, "at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="minutes"), "writer": writer,
      "high": facts["high_score"], "table": facts["table"], "results": [{k: r[k] for k in ("home", "away", "home_pts", "away_pts", "winner", "tier")} for r in results]} | body
if failed: ed["note"] = "Claude failed, template used: " + failed
gold["editions"] = [ed] + [e for e in gold["editions"] if not (e["season"] == season and e["week"] == week)]
gold["editions"] = sorted(gold["editions"], key=lambda e: (-e["season"], -e["week"]))[:40]
gold["_"] = "GOLD, robot-written by tools/pulse.py (weekly-pulse.yml). Newest first. Fix a line by re-running with --force, not by hand."
with open(gp, "w", encoding="utf-8") as f: json.dump(gold, f, ensure_ascii=False, indent=1); f.write("\n")
print(f"pulse: {season} week {week} written by {writer}: {ed['headline']}")
if failed: sys.exit("pulse: Claude writer failed (template edition saved): " + failed)
