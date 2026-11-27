# SPL HQ ↔ ESPN: what we can and can't do

_For the Joe conversation. Started 2026-11-26 (Mike: "be crystal clear on how this interacts with ESPN")._

## The one rule that decides it
SPL HQ writes to ESPN the same way ESPN's own website does: as the League Manager, with the LM's cookie. So **anything Joe can click
in ESPN's LM Tools, the app can do too**, once we've captured the exact call ESPN's site sends (do the action once on the test
league with the browser's network log open, copy it). What ESPN itself can't do, no app can make it do.

Today: reads come from the real league (19583); writes go only to the test league (1722387564) until Joe signs off.

## Proven (works on the test league today)
| What | How | Used for |
|---|---|---|
| Read everything | league, rosters, scores, schedule, settings, history | standings, Match, reel cards, history robot |
| Trades | one LM trade call, several players both ways, executes at once | approved app trades → ESPN |
| Add / drop any player on any team | LM free-agent call | the roster mirror |
| Draft board → rosters | the same LM add, one player per call, ESPN read first (built 11/27; to prove after ESPN's 2027 rollover) | SPL Draft room: each pick + keeper onto the owner's ESPN team |

## ESPN's LM Tools can do it, call not captured yet (to prove on the test league)
| What | Why we'd want it | Notes |
|---|---|---|
| **Edit head-to-head matchups** (Edit H2H Schedule → switch teams) | Seed 3 picks its Week 15 opponent, Seed 1 picks Week 16 (constitution G; ESPN's fixed bracket can't), Shoot Out pairings | ESPN says matchups can change "at any time". **Unknown: whether playoff-round games can be hand-edited.** Biggest one to prove. |
| **Schedule settings** (playoff bracket, seeding tiebreaker, season length) | set up each season from the app | |
| **Adjust scoring** (add/subtract points for a team in a week) | penalties, rulings, stat fixes | standings update by themselves; the game shows an asterisk |
| **Edit rosters after lock** | commish fixes | |
| Draft order / settings, keeper draft rounds | Slot Draft result → ESPN draft order; keepers as picks in their round | keeper rounds need a manually set order; changing the order afterwards wipes them |
| Divisions | Divisional Draft result → ESPN | |
| Trade veto threshold / review window | match the constitution (C1: 6 vetoes, ESPN has 8) | a settings call |
| League message | post rulings or results to ESPN's league page | |

## Tried and refused
| What | What happened | Likely reason |
|---|---|---|
| Rename a team | ESPN refused our `PUT …/teams/<id>` (11/26) | ESPN lets each team's own manager name their team; it's not in LM Tools. Could also be our guess at the call: capture it from ESPN's own "edit team" page before calling it impossible. |

## ESPN can't, so SPL HQ owns it
Keeper contracts and the cap · traded future picks (the pick ledger) · the league veto vote as the constitution runs it · choose-your-opponent
(the app runs the pick, then writes the matchup) · the off-season drafts (Divisional, Slot, Shoot Out) · history before ESPN's records.

## What we ask Joe
1. LM access for the app on the real league (already in his 📋 Questions as "ESPN co-commish").
2. Which writes he wants automatic vs. "app tells Joe, Joe clicks": trades, playoff matchups, score adjustments, draft order.
