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
    FIN = {"champion": 0, "runner_up": 1, "semifinal": 2, "wildcard": 3, "playoffs": 3, "missed": 4}
    if any(x[2] is None for x in ts): ts.sort(key=lambda x: (FIN.get(x[9], 5), -(x[2] or 0), -(x[5] or 0)))  # records missing: order by how far they went
    else: ts.sort(key=lambda x: (-(x[2] or 0), -(x[5] or 0)))
    c = [x[0] for x in ts if x[9] == "champion"]; ru = [x[0] for x in ts if x[9] == "runner_up"]
    history.append({"y": y, "src": "manual", "done": bool(c), "champ": c[0] if c else None, "runner": ru[0] if ru else None, "teams": ts})
history.sort(key=lambda h: -h["y"])

# ---- 📝 Draft (gold Draft_Picks.csv): [season, round, pick_in_round, overall, owner, original_owner, player, flags, pos]
#   pos (for the ▦ grid's colors) = the player's position from ESPN's boards / final rosters / the Keeper Matrix, "" if unknown.
POS = {}
for f in ("ESPN_Draft_Boards.csv", "ESPN_Season_Rosters.csv", "Keeper_Matrix_History.csv"):
    for r in opt_rows(f):
        if r.get("player") and r.get("position"): POS.setdefault(r["player"], r["position"])
draft = []
for r in opt_rows("Draft_Picks.csv"):
    flags = ("F" if r["is_franchise"] == "Y" else "") + ("K" if r["is_keeper"] == "Y" else "") + ("?" if r["needs_review"] == "Y" else "")
    iv = lambda v: int(v) if str(v).strip().isdigit() else 0
    draft.append([int(r["season"]), int(r["round"]), iv(r["pick_in_round"]), iv(r["overall_pick"]), r["owner_id"], r["original_owner_id"], r["player"] or r["player_raw"], flags, POS.get(r["player"] or r["player_raw"], "")])
draft.sort(key=lambda d: (-d[0], d[1], d[3] or 999))

# ---- 🔒 Draft-board keepers (Mike 11/28: keepers sit apart from the rounds, locked under each team). From the Keeper Matrix
#   (2019-2026, gold): who each owner kept going into season S. Terminated (cut) rows are cap penalties, not keepers; a matrix keeper
#   who also shows as a normal pick on that season's board was re-drafted, so the board wins. Franchise tags stay (flag F).
#   [season, owner, player, pos, flags(F), contract_length]. ESPN-only seasons use ESPN's keeper flags instead (app side).
drafted = {(d[0], d[6]) for d in draft if "F" not in d[7]}
keep = []
for r in opt_rows("Keeper_Matrix_History.csv"):
    if r["cut"] == "Y": continue
    pl = r["player"] or r["player_raw"]
    if (int(r["season"]), pl) in drafted: continue
    keep.append([int(r["season"]), r["owner_id"], pl, r["position"], "F" if r["franchise"] == "Y" else "", r["contract_length"]])

# ---- 📇 Player files (DERIVED → player-history.js, loaded by the app only when a player file opens; ~300 KB kept out of the launch).
# d = SPL Draft picks [season, round, overall, owner, slot owner, player, src (p = Packet/gold board, e = ESPN), flags, pos (ESPN rows)]
#   The League → Draft boards screen also shows the ESPN-only seasons (2006-2018) from these rows.
#   gold Draft_Picks.csv wins for its seasons (SPL rounds); ESPN_Draft_Boards.csv fills the rest (2006-2018; empty 2020-21 skipped).
# k = Keeper Matrix history [season, owner, player, pos, term, kp_by_season, cut, franchise]
# r = final rosters ESPN kept [season, owner, player, how acquired]; t = trades + pickups ESPN kept (2018-19, 2022-26)
ph = {"d": [], "k": [], "r": []}
gold_seasons = {d[0] for d in draft}
for d in draft: ph["d"].append([d[0], d[1], d[3], d[4], d[5], d[6], "p", d[7]])
for r in opt_rows("ESPN_Draft_Boards.csv"):
    if int(r["season"]) in gold_seasons or not r["player"]: continue
    ph["d"].append([int(r["season"]), int(r["round"]), int(r["overall_pick"] or 0), r["owner_id"], r["owner_id"], r["player"], "e", "K" if r["keeper"] == "Y" else "", r["position"]])
for r in opt_rows("Keeper_Matrix_History.csv"):
    ph["k"].append([int(r["season"]), r["owner_id"], r["player"] or r["player_raw"], r["position"], r["contract_length"], r["kp_by_season"], r["cut"] == "Y", r["franchise"] == "Y"])
# t = moves ESPN kept [season, date, move (TRADE / ADD), from owner, to owner, player]: trades + pickups (drops left out: size)
ph["t"] = []; seen_t = set()
for r in opt_rows("ESPN_Transactions.csv"):
    mv = "TRADE" if "TRADE" in r["move"] else r["move"]
    if mv not in ("TRADE", "ADD") or not r["player"] or not r["to_owner"]: continue
    k = (r["season"], r["date"][:10], mv, r["player"], r["to_owner"])
    if k in seen_t: continue
    seen_t.add(k); ph["t"].append([int(r["season"]), r["date"][:10], mv, r["from_owner"], r["to_owner"], r["player"]])
# pre-app trades (league email / Packet, gold Trade_History.csv): same shape + [6] = what came back the other way
th = list(opt_rows("Trade_History.csv"))
for r in th:
    back = [x["asset"] for x in th if x["deal"] == r["deal"] and x["from_owner"] == r["to_owner"]]
    ph["t"].append([int(r["season"]), r["date"], "TRADE", r["from_owner"], r["to_owner"], r["asset"], " + ".join(back)])
for r in opt_rows("ESPN_Season_Rosters.csv"):
    if r["player"]: ph["r"].append([int(r["season"]), r["owner_id"], r["player"], r["acquired"]])
open(os.path.join(ROOT, "player-history.js"), "w", encoding="utf-8").write(
    "// DERIVED DATA -- DO NOT HAND-EDIT. Regenerate: python3 tools/build_data.py\n"
    "// Sources: data/Draft_Picks.csv, ESPN_Draft_Boards.csv, Keeper_Matrix_History.csv, ESPN_Season_Rosters.csv, ESPN_Transactions.csv, Trade_History.csv. Loaded on demand by player files.\n"
    f"var PLAYER_HISTORY = {json.dumps(ph, ensure_ascii=False, separators=(',', ':'))};\n")
print("player-history.js:", len(ph["d"]), "picks ·", len(ph["k"]), "keeper rows ·", len(ph["r"]), "roster rows ·", len(ph["t"]), "moves")

# ---- 📖 Rules: data/SPL_Rulebook.md (gold) -> sections of safe HTML; calendar CSV.
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
calendar = [{k: r[k] for k in ("season", "key", "event", "date", "kind", "note")} for r in opt_rows("Season_Calendar.csv")]
# 📚 History: eras + milestones ("how the league got here"), data/League_Timeline.csv (gold).
timeline = [{"y": int(r["season"]), "kind": r["kind"], "key": r["key"], "title": r["title"], "note": r["note"]} for r in opt_rows("League_Timeline.csv")]
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
# 🧠 SPL Trivia (Mike 11/28): lore cards from gold data/Trivia.csv + record cards computed here from the games, so a broken record
# updates its card on the next rebuild (build-data.yml). Card: {id, topic, y, q, opts:[a,b,c], ans: 0-2, fact, go}. An opt that is an
# owner id shows with the avatar. Record ids carry the answer (rec-high-moyer-2024) so a new record is a new card (votes are per id).
ON = {o["id"]: o["name"] for o in owners}
def fp(x): return ("%.1f" % x).rstrip("0").rstrip(".")
trivia = []
for r in opt_rows("Trivia.csv"):
    trivia.append({"id": r["id"], "topic": r["topic"], "y": int(r["season"]) if r["season"].isdigit() else None, "q": r["question"],
                   "opts": [r["a"], r["b"], r["c"]], "ans": "abc".index(r["answer"]), "fact": r["fact"], "go": r["go"]})
def rec(key, topic, y, q, ranked, fact, go="history"):
    """ranked: owner ids best-first (answer first); takes the answer + the next two different owners as the other choices."""
    seen = []
    for o in ranked:
        if o and o not in seen: seen.append(o)
    if len(seen) >= 3: trivia.append({"id": "rec-" + key, "topic": topic, "y": y, "q": q, "opts": seen[:3], "ans": 0, "fact": fact, "go": go})
def numq(key, topic, y, q, right, wrong, fact, go="history"):
    trivia.append({"id": "rec-" + key, "topic": topic, "y": y, "q": q, "opts": [str(right)] + [str(w) for w in wrong], "ans": 0, "fact": fact, "go": go})
sides = sorted([(g[4], g[3], g[5], g[6], g) for g in games] + [(g[6], g[5], g[3], g[4], g) for g in games], key=lambda x: x[0])
if sides:
    lo, hi = sides[0], sides[-1]
    rec("low-%s-%d" % (lo[1], lo[4][0]), "Records", lo[4][0], "Lowest score in an SPL game (since 2006)?", [lo[1]] + [x[1] for x in sides[1:12]],
        "%s: %s in Week %d, %d, against %s (%s)." % (ON[lo[1]], fp(lo[0]), lo[4][1], lo[4][0], ON[lo[2]], fp(lo[3])))
    rec("high-%s-%d" % (hi[1], hi[4][0]), "Records", hi[4][0], "Highest score in an SPL game?", [hi[1]] + [x[1] for x in reversed(sides[:-1])],
        "%s: %s in Week %d, %d%s, against %s (%s)." % (ON[hi[1]], fp(hi[0]), hi[4][1], hi[4][0], " (playoffs)" if hi[4][2] == "P" else "", ON[hi[2]], fp(hi[3])))
    losers = sorted([(min(g[4], g[6]), g) for g in games if g[4] != g[6]], key=lambda x: -x[0])
    if losers:
        v, g = losers[0]; lo_o, w_o = (g[3], g[5]) if g[4] < g[6] else (g[5], g[3])
        rec("hiloss-%s-%d" % (lo_o, g[0]), "Records", g[0], "Most points ever in a LOSS?", [lo_o] + [(x[1][3] if x[1][4] < x[1][6] else x[1][5]) for x in losers[1:12]],
            "%s scored %s and lost: %s put up %s (Week %d, %d)." % (ON[lo_o], fp(v), ON[w_o], fp(max(g[4], g[6])), g[1], g[0]))
champs = {}; runners = {}
for h in history:
    if h["champ"]: champs[h["champ"]] = champs.get(h["champ"], []) + [h["y"]]
    if h["runner"]: runners[h["runner"]] = runners.get(h["runner"], []) + [h["y"]]
def most(dct, key, q, word):
    if not dct: return
    order = sorted(dct, key=lambda o: (-len(dct[o]), o)); top = len(dct[order[0]]); tied = [o for o in order if len(dct[o]) == top]
    others = [o for o in order if len(dct[o]) < top] + [o["id"] for o in owners if o["id"] not in dct]
    names = " and ".join("%s (%s)" % (ON[o], ", ".join(str(y) for y in sorted(dct[o]))) for o in tied)
    rec("%s-%s-%d" % (key, "-".join(tied), top), "Records", None, q % top, [tied[0]] + others,
        ("%s: %d %s each." if len(tied) > 1 else "%s: %d %s.") % (names, top, word))
most(champs, "titles", "Who has won %d SPL titles?", "titles")
most(runners, "runnerup", "Who has finished runner-up %d times?", "title-game losses")
pw = {}; reg = {}
for g in games:
    for o, a, b in ((g[3], g[4], g[6]), (g[5], g[6], g[4])):
        if g[2] == "P": w = pw.setdefault(o, [0, 0]); w[0 if a > b else 1] += 1
        if g[2] == "R": w = reg.setdefault(o, [0, 0]); w[0 if a > b else 1] += 1 if a != b else 0
if pw:
    order = sorted(pw, key=lambda o: (-pw[o][0], pw[o][1]))
    rec("pwins-%s-%d" % (order[0], pw[order[0]][0]), "Playoffs", None, "Most playoff wins since 2006?", order,
        "%s: %d–%d in the playoffs. Next: %s, %d–%d." % (ON[order[0]], pw[order[0]][0], pw[order[0]][1], ON[order[1]], pw[order[1]][0], pw[order[1]][1]))
if reg:
    order = sorted(reg, key=lambda o: (-reg[o][0] / max(1, sum(reg[o])), o)); top = reg[order[0]]
    tied = [o for o in order if reg[o] == top]; rest = [o for o in order if reg[o] != top]
    if len(tied) == 1:
        rec("alltime-%s-%d" % (order[0], top[0]), "Records", None, "Best all-time regular-season record since 2006?", order,
            "%s, %d–%d. Next: %s, %d–%d." % (ON[order[0]], top[0], top[1], ON[rest[0]], reg[rest[0]][0], reg[rest[0]][1]))
    else:  # a tie at the top: ask for the partner (only one right answer on the card)
        rec("alltime-%s-%d" % ("-".join(tied), top[0]), "Records", None, "%s has the best all-time regular-season record (%d–%d)… and shares it with whom?" % (ON[tied[0]], top[0], top[1]),
            [tied[1]] + rest, "%s: both %d–%d since 2006, dead even at the top." % (" and ".join(ON[o] for o in tied), top[0], top[1]))
streaks = []
for o in ON:
    c, start = 0, None
    for g in sorted(x for x in games if x[2] == "R" and o in (x[3], x[5])):
        won = (g[4] > g[6]) == (g[3] == o)
        if won:
            if not c: start = (g[0], g[1])
            c += 1; streaks.append((c, o, start, (g[0], g[1])))
        else: c = 0
if streaks:
    best = max(s[0] for s in streaks); who = {}
    for s in streaks:
        if s[0] == best: who[s[1]] = s
    txt = " · ".join("%s (%s)" % (ON[o], str(s[2][0]) if s[2][0] == s[3][0] else "%d–%s" % (s[2][0], str(s[3][0])[2:])) for o, s in sorted(who.items(), key=lambda kv: kv[1][2]))
    numq("streak-%d-%d" % (best, len(who)), "Records", None, "Longest regular-season win streak in the SPL?", "%d straight" % best, ["%d straight" % (best - 3), "%d straight" % (best + 3)],
         ("%d wins in a row, and %d owners have done it: %s." if len(who) > 1 else "%d wins in a row: %s.") % ((best, len(who), txt) if len(who) > 1 else (best, txt)))
finals = []
for h in history:
    if h["src"] != "espn" or not h["champ"]: continue
    po = [g for g in games if g[0] == h["y"] and g[2] == "P"]; wk = max(g[1] for g in po)
    finals += [g for g in po if g[1] == wk]
if finals:
    cf = min(finals, key=lambda g: abs(g[4] - g[6])); w, l = (cf[3], cf[5]) if cf[4] > cf[6] else (cf[5], cf[3])
    rec("closefinal-%s-%d" % (w, cf[0]), "Champions", cf[0], "Closest title game on file: who won it?", [w, l] + [h["champ"] for h in history if h["champ"] not in (w, l)],
        "%d: %s %s, %s %s. Won by %s." % (cf[0], ON[w], fp(max(cf[4], cf[6])), ON[l], fp(min(cf[4], cf[6])), fp(abs(cf[4] - cf[6]))))
    lf = min(finals, key=lambda g: min(g[4], g[6])); l = lf[3] if lf[4] < lf[6] else lf[5]; w = lf[5] if l == lf[3] else lf[3]
    rec("lowfinal-%s-%d" % (l, lf[0]), "Champions", lf[0], "Lowest score ever in a title game?", [l] + [x[1] for x in sides[:40]],
        "%s: %s in the %d final. %s won it with %s." % (ON[l], fp(min(lf[4], lf[6])), lf[0], ON[w], fp(max(lf[4], lf[6]))))
tenth = [g for g in games if abs(g[4] - g[6]) < 0.15 and g[4] != g[6]]
if len(tenth) >= 2:
    numq("tenth-%d" % len(tenth), "Records", None, "How many SPL games have been decided by a tenth of a point?", len(tenth), [max(0, len(tenth) - 3) or len(tenth) + 5, len(tenth) + 3],
         "%d, most recently %s over %s, %s–%s (Week %d, %d)." % ((len(tenth),) + (lambda g: (ON[g[3] if g[4] > g[6] else g[5]], ON[g[5] if g[4] > g[6] else g[3]], fp(max(g[4], g[6])), fp(min(g[4], g[6])), g[1], g[0]))(max(tenth))))
pfs = sorted([(t[5], t[0], h["y"], t[2], t[3], t[9]) for h in history if h["src"] == "espn" and h["done"] for t in h["teams"] if t[5]], reverse=True)
if pfs:
    p = pfs[0]; FINW = {"champion": "won the title", "runner_up": "lost the title game", "semifinal": "lost in the semis", "wildcard": "lost in the first round", "missed": "missed the playoffs"}
    rec("pf-%s-%d" % (p[1], p[2]), "Seasons", p[2], "Most regular-season points in one SPL season?", [x[1] for x in pfs[:30]],
        "%s: %s points in %d, %d–%d, and %s." % (ON[p[1]], fp(p[0]), p[2], p[3], p[4], FINW.get(p[5], "made the playoffs")))
h2 = {}
for g in games:
    w, l = (g[3], g[5]) if g[4] > g[6] else (g[5], g[3])
    if g[4] != g[6]: h2[(w, l)] = h2.get((w, l), 0) + 1
pairs = sorted(((h2.get((a, b), 0), h2.get((b, a), 0), a, b) for (a, b) in h2 if h2.get((a, b), 0) > h2.get((b, a), 0)), key=lambda x: (-(x[0] - x[1]), -x[0]))
if pairs:
    W_, L_, a, b = pairs[0]
    rec("h2h-%s-%s-%d" % (a, b, W_), "Rivalries", None, "Most lopsided head-to-head in the SPL: who owns %s (%d–%d)?" % (ON[b], W_, L_), [a] + [o for o in ON if o not in (a, b)][::-1],
        "%s leads %s %d–%d all-time, every game since 2006 counted." % (ON[a], ON[b], W_, L_), "rivalry:%s,%s" % (a, b))
# 🔥 Hall of Shame (Mike 11/28: "harsh ribbing is welcomed in this league"). Same rules: computed, so a new low replaces the card.
SHAME = "Hall of Shame"
def tiedq(key, q, val, best, fact, go="history"):
    """val: owner → number; best: the owners tied for the (worst) mark. Answer = one of them; the other choices are never tied with it."""
    rest = sorted([o for o in val if o not in best], key=lambda o: val[o]) + [o for o in ON if o not in val]
    rec("%s-%s" % (key, "-".join(sorted(best))), SHAME, None, q, [best[0]] + rest[:6][::-1], fact, go)
done = [h for h in history if h["done"]]
champ_y = {}
for h in done: champ_y.setdefault(h["champ"], []).append(h["y"])
first = {r["owner_id"]: (2003 if r["first_season"] == "inception" else int(r["first_season"])) for r in opt_rows("SPL_Owner_Registry.csv")}
cl = sorted(champ_y, key=lambda c: (-len(champ_y[c]), c))
for k, o in enumerate([o for o in ON if o not in champ_y]):  # 0 titles: one card per owner still waiting (different champs as the decoys)
    ns = len([h for h in done if h["y"] >= first.get(o, 2003)]); ru = runners.get(o, [])
    rec("never-%s-%d" % (o, ns), SHAME, None, "Which of these owners has NEVER won an SPL title?", [o] + cl[2 * k:] + cl,
        "%s: 0 for %d seasons. %s" % (ON[o], ns, ("Lost the title game in %s." % " and ".join(str(y) for y in sorted(ru))) if ru else "Never even made the title game."))
po_pct = {o: pw[o][0] / sum(pw[o]) for o in pw if sum(pw[o]) >= 6}
if po_pct:
    lo_ = min(po_pct.values()); best = [o for o in po_pct if po_pct[o] == lo_]
    tiedq("poworst", "Worst playoff record in the SPL (6+ playoff games)?", po_pct, best,
          " · ".join("%s: %d–%d" % (ON[o], pw[o][0], pw[o][1]) for o in best) + " in the playoffs. Gets in, gets sent home.")
if reg:
    rp = {o: reg[o][0] / max(1, sum(reg[o])) for o in reg}; lo_ = min(rp.values()); best = [o for o in rp if rp[o] == lo_]
    tiedq("regworst", "Worst all-time regular-season record since 2006?", rp, best, " · ".join("%s: %d–%d" % (ON[o], reg[o][0], reg[o][1]) for o in best) + ". Somebody has to hold up the table.")
lstreaks = {}
for o in ON:
    c, st = 0, None
    for g in sorted(x for x in games if x[2] == "R" and o in (x[3], x[5])):
        lost = (g[4] < g[6]) == (g[3] == o) and g[4] != g[6]
        if lost:
            if not c: st = (g[0], g[1])
            c += 1
            if c > lstreaks.get(o, (0,))[0]: lstreaks[o] = (c, st, (g[0], g[1]))
        else: c = 0
if lstreaks:
    mx = max(v[0] for v in lstreaks.values()); best = [o for o in lstreaks if lstreaks[o][0] == mx]
    tiedq("lstreak", "Longest losing streak in the SPL?", {o: -lstreaks[o][0] for o in lstreaks}, best,
          " · ".join("%s: %d straight L's (%s)" % (ON[o], mx, "Week %d %d → Week %d %d" % (lstreaks[o][1][1], lstreaks[o][1][0], lstreaks[o][2][1], lstreaks[o][2][0])) for o in best) + ".")
last = {}
for h in done:
    ts = [t for t in h["teams"] if t[2] is not None]
    if len(ts) >= 12: w = min(ts, key=lambda t: (t[2] - t[3], t[5] or 0)); last.setdefault(w[0], []).append(h["y"])
if last:
    mx = max(len(v) for v in last.values()); best = [o for o in last if len(last[o]) == mx]
    tiedq("lastplace-%d" % mx, "Who has finished DEAD LAST %d times?" % mx, {o: -len(last.get(o, [])) for o in ON}, best,
          " · ".join("%s (%s)" % (ON[o], ", ".join(str(y) for y in last[o])) for o in best) + ": the regular-season basement, %d times each." % mx if len(best) > 1 else
          "%s (%s): the regular-season basement, %d times." % (ON[best[0]], ", ".join(str(y) for y in last[best[0]]), mx))
pos = sorted([(g[4], g[3], g[6], g[5], g) for g in games if g[2] == "P"] + [(g[6], g[5], g[4], g[3], g) for g in games if g[2] == "P"], key=lambda x: x[0])
if pos:
    x = pos[0]
    rec("lowpo-%s-%d" % (x[1], x[4][0]), SHAME, x[4][0], "Lowest score ever in an SPL playoff game?", [x[1]] + [y[1] for y in pos[1:20]],
        "%s: %s in the %d playoffs. %s scored %s and moved on." % (ON[x[1]], fp(x[0]), x[4][0], ON[x[3]], fp(x[2])))
beat = sorted([g for g in games if g[2] == "R" and g[4] != g[6]], key=lambda g: -abs(g[4] - g[6]))
if beat:
    g = beat[0]; w, l = (g[3], g[5]) if g[4] > g[6] else (g[5], g[3])
    rec("beatdown-%s-%d" % (l, g[0]), SHAME, g[0], "Worst regular-season beating in SPL history: who was on the wrong end of it?",
        [l] + [(b[5] if b[4] > b[6] else b[3]) for b in beat[1:15]],
        "%s, Week %d, %d: %s %s, %s %s. A %s-point beatdown." % (ON[l], g[1], g[0], ON[w], fp(max(g[4], g[6])), ON[l], fp(min(g[4], g[6])), fp(abs(g[4] - g[6]))))
defense = {}
for h in done:
    nx = [x for x in done if x["y"] == h["y"] + 1]
    if not nx or not h["champ"]: continue
    t = [t for t in nx[0]["teams"] if t[0] == h["champ"] and t[2] is not None]
    if t and t[0][9] == "missed": defense.setdefault(h["champ"], []).append((t[0][2] / max(1, t[0][2] + t[0][3]), t[0][2], t[0][3], h["y"]))
if defense:
    worst = {o: min(v) for o, v in defense.items()}; lo_ = min(v[0] for v in worst.values()); best = [o for o in worst if worst[o][0] == lo_]
    tiedq("defense", "Worst title defense ever: which champ followed it up with %d–%d and no playoffs?" % (worst[best[0]][1], worst[best[0]][2]),
          {o: worst[o][0] for o in worst}, best,
          " · ".join("%s won it in %d, then went %d–%d" % (ON[o], worst[o][3], worst[o][1], worst[o][2]) for o in best) + ". Hangover.")
miss = sorted([(t[5], t[0], h["y"], t[2], t[3]) for h in done if h["src"] == "espn" for t in h["teams"] if t[9] == "missed" and t[5]], reverse=True)
if miss:
    m = miss[0]
    rec("misspf-%s-%d" % (m[1], m[2]), SHAME, m[2], "Most points by a team that MISSED the playoffs?", [x[1] for x in miss[:30]],
        "%s, %d: %s points, %d–%d, home for the playoffs." % (ON[m[1]], m[2], fp(m[0]), m[3], m[4]))
pa = sorted([(t[6], t[0], h["y"], t[2], t[3]) for h in done if h["src"] == "espn" for t in h["teams"] if t[6]], reverse=True)
if pa:
    m = pa[0]
    rec("pa-%s-%d" % (m[1], m[2]), SHAME, m[2], "Most points scored AGAINST one team in a season?", [x[1] for x in pa[:30]],
        "%s, %d: %s points against. Everybody brought their A game.%s" % (ON[m[1]], m[2], fp(m[0]), " (%d–%d)" % (m[3], m[4])))
print(len(trivia), "trivia cards (", len([t for t in trivia if t["id"].startswith("rec-")]), "records )")

payload = {'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'owners': owners, 'contracts': contracts,
           'seasons': seasons, 'ledger': ledger, 'games': games, 'history': history, 'draft': draft, 'keep': keep, 'rules': rules,
           'calendar': calendar, 'timeline': timeline, 'offseason': offseason, 'schedule': schedule, 'lines': lines, 'trivia': trivia}
out = ("// DERIVED DATA -- DO NOT HAND-EDIT. Regenerate: python3 tools/build_data.py\n"
       "// Sources: data/Keeper_Contracts.csv, SPL_Owner_Registry.csv, SPL_Matchups.csv, Season_Results_Manual.csv, Draft_Picks.csv, Keeper_Matrix_History.csv,\n"
       f"//   SPL_Rulebook.md, Season_Calendar.csv, Offseason_Drafts.csv,\n"
       f"//   SPL_Schedule.csv, Card_Lines.json, Trivia.csv. Generated {datetime.date.today()}.\n"
       f"var LEAGUE_DATA = {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))};\n")
open(os.path.join(ROOT, "league-data.js"), "w", encoding="utf-8").write(out)
print(len(contracts), "contracts,", len(owners), "owners,", len(games), "games", seasons[:1], "-", seasons[-1:], "·", len(history), "seasons of history ·",
      len(draft), "draft picks ·", len(rules), "rule sections ·", len(calendar), "dates ·", len((schedule or {}).get("games") or []), "scheduled ·", len(lines), "weeks of card lines")
