#!/usr/bin/env python3
"""Regenerate league-data.js (DERIVED) from the gold CSVs in data/. Run: python3 tools/build_data.py"""
import csv, json, datetime, os, re
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

# ---- 📚 History (derived): every season's regular-season table + how the playoffs finished. ESPN games first;
# data/Season_Results_Manual.csv fills seasons ESPN doesn't have (2004-05, 2020-21) once Joe/Glen supply them.
def opt_rows(name):
    return rows(name) if os.path.exists(os.path.join(ROOT, "data", name)) else []
names = {}  # (season, owner) -> team name used that season
if os.path.exists(mp):
    for r in rows("SPL_Matchups.csv"):
        for side in ("home", "away"):
            if r[side + "_owner"]: names[(int(r["season"]), r[side + "_owner"])] = r[side + "_team"]
history = []
for y in seasons:
    gs = [g for g in games if g[0] == y]
    t = {}
    def team(o): return t.setdefault(o, {"o": o, "team": names.get((y, o), ""), "w": 0, "l": 0, "t": 0, "pf": 0.0, "pa": 0.0, "pw": 0, "pl": 0, "po": False, "fin": "missed"})
    for g in gs:
        a, b = team(g[3]), team(g[5])
        if g[2] == "R":
            a["pf"] += g[4]; a["pa"] += g[6]; b["pf"] += g[6]; b["pa"] += g[4]
            if g[4] > g[6]: a["w"] += 1; b["l"] += 1
            elif g[4] < g[6]: a["l"] += 1; b["w"] += 1
            else: a["t"] += 1; b["t"] += 1
        elif g[2] == "P":
            a["po"] = b["po"] = True
            win, lose = (a, b) if g[4] > g[6] else (b, a)
            win["pw"] += 1; lose["pl"] += 1
    po = [g for g in gs if g[2] == "P"]
    weeks = sorted({g[1] for g in po})
    champ = runner = None
    reg_weeks = max([g[1] for g in gs if g[2] == "R"] or [0])
    if weeks and len([g for g in po if g[1] == weeks[-1]]) == 1 and len(weeks) >= 3:  # title game played
        f = [g for g in po if g[1] == weeks[-1]][0]
        champ, runner = (f[3], f[5]) if f[4] > f[6] else (f[5], f[3])
        for g in po:  # how far each playoff team got: lost in the semis (2nd-to-last week) or the round before
            loser = g[5] if g[4] > g[6] else g[3]
            if g[1] == weeks[-2]: t[loser]["fin"] = "semifinal"
            elif g[1] < weeks[-2]: t[loser]["fin"] = "wildcard"
        t[champ]["fin"], t[runner]["fin"] = "champion", "runner_up"
        for x in t.values():
            if x["po"] and x["fin"] == "missed": x["fin"] = "playoffs"  # bye team that lost in round 2 is covered above; safety net
    for x in t.values():
        x["pf"], x["pa"] = round(x["pf"], 1), round(x["pa"], 1)
    table = sorted(t.values(), key=lambda x: (-(x["w"] + 0.5 * x["t"]) / max(1, x["w"] + x["l"] + x["t"]), -x["pf"]))
    history.append({"y": y, "src": "espn", "done": bool(champ), "regWeeks": reg_weeks, "champ": champ, "runner": runner,
                    "teams": [[x["o"], x["team"], x["w"], x["l"], x["t"], x["pf"], x["pa"], x["pw"], x["pl"], x["fin"]] for x in table]})
manual = {}
for r in opt_rows("Season_Results_Manual.csv"):
    manual.setdefault(int(r["season"]), []).append(r)
num = lambda v, f=int: f(v) if str(v).strip() else None
for y, rs in manual.items():
    if y in seasons: continue
    ts = [[r["owner_id"], r["team_name"], num(r["wins"]), num(r["losses"]), num(r["ties"]) or 0, num(r["points_for"], float), num(r["points_against"], float), None, None, r["finish"] or "missed"] for r in rs]
    ts.sort(key=lambda x: (-(x[2] or 0), -(x[5] or 0)))
    c = [x[0] for x in ts if x[9] == "champion"]; ru = [x[0] for x in ts if x[9] == "runner_up"]
    history.append({"y": y, "src": "manual", "done": bool(c), "champ": c[0] if c else None, "runner": ru[0] if ru else None, "teams": ts})
history.sort(key=lambda h: -h["y"])

# ---- 📝 Draft (gold Draft_Picks.csv): [season, round, pick_in_round, overall, owner, original_owner, player, flags]
draft = []
for r in opt_rows("Draft_Picks.csv"):
    flags = ("F" if r["is_franchise"] == "Y" else "") + ("K" if r["is_keeper"] == "Y" else "") + ("?" if r["needs_review"] == "Y" else "")
    draft.append([int(r["season"]), int(r["round"]), int(r["pick_in_round"]), int(r["overall_pick"]), r["owner_id"], r["original_owner_id"], r["player"] or r["player_raw"], flags])
draft.sort(key=lambda d: (-d[0], d[3]))

# ---- 📖 Rules: data/SPL_Rulebook.md (gold) -> sections of safe HTML; conflicts + calendar CSVs.
import html as _h
def inline(s):
    s = _h.escape(s, quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
def md_blocks(lines):
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip(): i += 1; continue
        if ln.lstrip().startswith("|"):
            tb = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells): tb.append(cells)
                i += 1
            out.append("<table class=\"rb\"><tr>" + "".join("<th>" + inline(c) + "</th>" for c in tb[0]) + "</tr>" +
                       "".join("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in r) + "</tr>" for r in tb[1:]) + "</table>")
            continue
        m = re.match(r"^(\s*)(\d+\.|-)\s+(.*)", ln)
        if m:
            ordered = m.group(2) != "-"; items = []
            while i < len(lines):
                m2 = re.match(r"^(\s*)(\d+\.|-)\s+(.*)", lines[i])
                if not m2 or len(m2.group(1)) > 0 and not items: break
                if len(m2.group(1)) == 0:
                    if (m2.group(2) != "-") != ordered: break
                    items.append([m2.group(3), []])
                else:
                    items[-1][1].append(m2.group(3))
                i += 1
            tag = "ol" if ordered else "ul"
            start = int(m.group(2)[:-1]) if ordered else 1
            out.append("<" + tag + (' start="%d"' % start if start > 1 else "") + ">" + "".join("<li>" + inline(a) + ("<ul>" + "".join("<li>" + inline(x) + "</li>" for x in sub) + "</ul>" if sub else "") + "</li>" for a, sub in items) + "</" + tag + ">")
            continue
        para = []
        while i < len(lines) and lines[i].strip() and not lines[i].lstrip().startswith("|") and not re.match(r"^\s*(\d+\.|-)\s+", lines[i]):
            para.append(lines[i].strip()); i += 1
        out.append("<p>" + "<br>".join(inline(p) for p in para) + "</p>")
    return "".join(out)
rules = []
rp = os.path.join(ROOT, "data", "SPL_Rulebook.md")
if os.path.exists(rp):
    txt = re.sub(r"<!--.*?-->", "", open(rp, encoding="utf-8").read(), flags=re.S)
    for chunk in re.split(r"^## ", txt, flags=re.M)[1:]:
        lines = chunk.split("\n"); title = lines[0].strip(); body = lines[1:]
        status, note = "current", ""
        if body and body[0].startswith("> status:"):
            st = body.pop(0)[len("> status:"):].strip(); status, _, note = (p.strip() for p in st.partition("--"))
        m = re.match(r"^([A-K])\.\s+(.*)", title)
        sid = m.group(1) if m else title.split("·")[0].strip()
        text = re.sub(r"[*|#>-]", " ", "\n".join(body))
        rules.append({"id": sid, "title": title, "status": status, "note": note, "html": md_blocks(body), "text": re.sub(r"\s+", " ", text).strip()})
conflicts = [{k: r[k] for k in ("id", "item", "section", "constitution", "espn", "proposed", "status", "note")} for r in opt_rows("Rules_Conflicts.csv")]
calendar = [{k: r[k] for k in ("season", "key", "event", "date", "kind", "note")} for r in opt_rows("Season_Calendar.csv")]
# 🗓️ Finished live off-season drafts (robot-written gold): divisions + SPL Draft slots by season. Rehearsals (data/test/) stay out.
offseason = {}
for r in opt_rows("Offseason_Drafts.csv"):
    o = offseason.setdefault(r["season"], {"divs": {}, "slots": {}})
    if r["draft"] == "div": o["divs"].setdefault(r["division_of"], [r["division_of"]]).append(r["value"])
    elif r["draft"] == "slot": o["slots"][r["value"]] = r["owner_id"]

# 🗓️ Up next (WS4): the newest season's undecided games (robot-written gold, daily) + its header facts.
schedule = None
sp = os.path.join(ROOT, "data", "SPL_Schedule.csv")
if os.path.exists(sp):
    meta = {}
    for l in open(sp, encoding="utf-8"):
        if l.startswith("# season="): meta = dict(kv.split("=", 1) for kv in l[2:].split())
    num = lambda k: int(meta[k]) if meta.get(k, "").isdigit() else None
    schedule = {"season": num("season"), "regWeeks": num("reg_weeks"), "playoffTeams": num("playoff_teams"), "current": num("current_week"), "pulled": meta.get("pulled") or None,
                "games": [[int(r["week"]), "R" if r["playoff_tier"] == "NONE" else "P" if r["playoff_tier"] == "WINNERS_BRACKET" else "C", r["home_owner"], r["away_owner"]]
                          for r in rows("SPL_Schedule.csv") if r["week"]]}
# ✍️ Card lines (WS4): the robot's few words on the reel cards per finished week (tools/card_lines.py), newest first; the app keeps 3.
cp = os.path.join(ROOT, "data", "Card_Lines.json")
lines = (json.load(open(cp, encoding="utf-8")).get("weeks") or [])[:3] if os.path.exists(cp) else []
ls = os.path.join(ROOT, "data", "ledger_status.json")
ledger = json.load(open(ls)) if os.path.exists(ls) else None
payload = {'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'owners': owners, 'contracts': contracts,
           'seasons': seasons, 'ledger': ledger, 'games': games, 'history': history, 'draft': draft, 'rules': rules,
           'conflicts': conflicts, 'calendar': calendar, 'offseason': offseason, 'schedule': schedule, 'lines': lines}
out = ("// DERIVED DATA -- DO NOT HAND-EDIT. Regenerate: python3 tools/build_data.py\n"
       "// Sources: data/Keeper_Contracts.csv, SPL_Owner_Registry.csv, SPL_Matchups.csv, Season_Results_Manual.csv, Draft_Picks.csv,\n"
       f"//   SPL_Rulebook.md, Rules_Conflicts.csv, Season_Calendar.csv, Offseason_Drafts.csv,\n"
       f"//   SPL_Schedule.csv, Card_Lines.json. Generated {datetime.date.today()}.\n"
       f"var LEAGUE_DATA = {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))};\n")
open(os.path.join(ROOT, "league-data.js"), "w", encoding="utf-8").write(out)
print(len(contracts), "contracts,", len(owners), "owners,", len(games), "games", seasons[:1], "-", seasons[-1:], "·", len(history), "seasons of history ·",
      len(draft), "draft picks ·", len(rules), "rule sections ·", len(conflicts), "conflicts ·", len(calendar), "dates ·", len((schedule or {}).get("games") or []), "scheduled ·", len(lines), "weeks of card lines")
