# MAFFL ↔ SPL parity (WS6)

_Two-way: what MAFFL HQ's REEL has that SPL HQ should get, and what SPL built that should go back to MAFFL._
**Last checked:** 2026-11-26 against `maffl-commish/maffl` main (MAFFL REEL is in desk-only mode until the off-season) and SPL v0.14.
Update the status column as items ship. ✅ shipped · ⏭️ next · ⬜ backlog · 🚫 not porting (MAFFL-only)

## Already ported (WS4 v0.14, same day)
✅ REEL_SERIES science → `docs/SPL_REEL_SERIES.md` (drops, budget, card anatomy, per-series reaction trays) · ✅ card lines robot
(`tools/card_lines.py`, MAFFL `CARD_LINES_RECIPE.md`) · ✅ 🗳️ Game of the Week + 🧠 Quiz on a **Votes** engine (backend `vote`/`social`,
one locked vote, results after you vote) · ✅ 📅 This week in SPL history · ✅ Weekly Pulse retired (the cards are the update, as MAFFL).

## Shipped in WS6

| Item | From MAFFL | SPL |
|---|---|---|
| ✅ Backend split into parts | `logic.js` `parts_()` evaluates `mod_*.js` in the core's scope; per-part 5-min cache under VERSION, 6 h last-good, broken part emails | Backend v0.11.1: `logic.js` was 83 KB of a ~95 KB cache ceiling (the veto vote or SPL Draft room would have pushed it over). Now core 26 KB + `mod_espn` 25 · `mod_trades` 15 · `mod_drafts` 11 · `mod_social` 10. **Loader (`Code.gs`) unchanged**, no re-paste. |
| ✅ CI on every push | `backend-check.yml` (syntax, size, regression, contract) | `checks.yml`: backend syntax + size, smoke test (now loads the parts), new `tests/app_check.js` (all inline scripts, `sw.js`, `league-data.js` compile). |

## MAFFL → SPL (priority order)

| # | Item | MAFFL source | Why for SPL | Status |
|---|---|---|---|---|
| 1 | **Commish-posted polls** on the Votes engine (closes at a set time, league or subset) | desk `dkpollnew`, 📊 Poll card, Polls tab | The **league veto vote** is a poll on a trade (Joe's `veto_vote`: 24 h / 6 vetoes in season, 72 h off-season). Votes engine exists; add commish-created polls with a close time, then wire trades to it when Joe answers. | ⏭️ |
| 2 | **📣 Commish alert / announcements** (reel card + pinned in chat + Board) | `alert` series, `board_`, `chatmod` | SPL has the `announce` email toggle but no way for Joe to post one. | ⬜ |
| 3 | **Passphrase request** from the sign-in screen (Requests tab, commish emailed) | `request_`, menu "Mark request done" | A new phone or lost passphrase today means texting Mike; make it a desk item. | ⬜ |
| 4 | **Red CI / robot failure → desk** | `desk-notify.yml` | Mike sees a failed robot on the 🛠️ Ops desk, not only in a GitHub email. | ✅ v0.16 (WS7), done SPL's way: the backend reads runs from the GitHub API (no commit per failure) |
| 5 | **Regression mock + screenshots** (frozen fixture, `shoot.py` at 390 px against a mock) | `_ops/tests/mock.js`, `regress.js`, `shoot.py` | Makes CLAUDE.md's "screenshot at 390 px" repeatable and catches behavior drift the smoke test doesn't. | ⬜ |
| 6 | **More Vault cards**: 🗄️ Throwback, 👋 Meet the owner, 🏷️ Name that team | REEL_SERIES "Vault", `gen_vault.py` → `vault-data.js` (weekly robot) | 20 seasons of games + team names already in gold; off-season reel filler (off-season vault budget is 6). | ⬜ |
| 7 | **📈 Records watch** (league records within reach this week) | `records` series, `daily.js` | Same gold; tension card for the season. | ⬜ |
| 8 | **Coach of the Week from the bench** (fewest points left on the bench; "could have won") | `maffl_espn_pull.py` v0.5.1 | Needs ESPN box scores in `espn-history.yml`. | ⬜ |
| 9 | First-run tour · tap log (which cards get used) · beta crew | `tour`, `taplog`, beta in desk | Tour ✅ v0.19 (11/27: first visit + You replay + Ops desk replay for me/one/everyone). Tap log + beta crew still open. | 🟡 |
| 10 | Claude in chat (`@claude`) · chat moderation | `botpost`, `claude-mention.yml`, `chatmod` | Later. | ⬜ |
| 11 | Rehearsal workflow (full robot chain dry run) · pause / desk-only kill switch | `rehearsal.yml`, `REEL_MODE` | SPL's `APP_MODE` kill switch (plan §3) can copy `REEL_MODE`. | ⬜ |

🚫 Not porting (MAFFL-only): credits + perks, dues ledger, Survivor, tiers / promotion race / the other tier / Elite 5 / tier headline,
👻 Ghost, waiver auction, 💸 What would you pay (auction drafts), 📰 headline pick, `contract.js` (SPL has no classic pages to scrape).

## SPL → MAFFL (hand back when REEL wakes for the off-season)

Batch these for a MAFFL chat; this session can read MAFFL but not push to it. Pointers are SPL files/versions.

| # | Item | SPL source | MAFFL gap found 11/26 |
|---|---|---|---|
| 1 | **iOS Home Screen frame**: fit script sizes the frame to `screen.height` when installed, `html.sa` 16 pt header offset, nothing parked under the status bar, no fixed bars | `index.html` top of `<body>`, v0.5.2 · v0.8–0.8.3 | MAFFL `lab/` still uses `status-bar-style default` and 16 `position:fixed` rules: the same washed-out band / floating tab bar bugs SPL fixed. |
| 2 | **`robot_push.sh`**: rebase, keep the robot's own gold, rebuild derived, push, 3 tries | `tools/robot_push.sh` | MAFFL has several committing robots (credit-sync, build-write, vault-data, pulse) and the same collision risk. |
| 3 | **ESPN write switch + `EspnLog` + refusal → Do-on-ESPN with ESPN's reason** | `mod_espn.js` (`writesOn_`, EspnLog tab), Ops card 🏈 | MAFFL's 👻 Send to ESPN writes to the real league with no switch or write log tab. |
| 4 | **Robot freshness on the desk** ("updated N ago", red when stale) + **accordion desk with status badges** | Ops desk v0.7.1, v0.13.6 | MAFFL desk lists items, no per-robot freshness. |
| 5 | **Rules from commish answers** (`rules_()`: latest commish answer wins, defaults until answered) + Questions with retired qids | `logic.js` `joeAnswer_`/`rules_`, v0.13.4 | MAFFL rules are constants in code. |
| 6 | **Rivalry grade + ⏭️ Up next with the series line** | v0.12 (`upNextRows`, rivalry pages) | MAFFL's `next` card has no grade; `rivalry.html` is classic. |
| 7 | **Offline behavior**: chat outbox, everything else refuses up front; header pill only when offline | v0.12.1 | MAFFL shows a vague error offline. |
| 8 | **Card lines from gold only, plain-fact fallback** when the Claude token is missing or Claude fails | `tools/card_lines.py`, `card-lines.yml` | Check MAFFL's card-lines + Pulse robots degrade the same way. |
| 9 | Desks behind a header button, no role labels | v0.9, v0.12.1 | Taste call for MAFFL; offer it. |
| 10 | **Robot watchdog** (hourly backend tick runs robots GitHub's cron skipped, alerts on change, robots card) + **daily Sheet backup to the ops inbox** + SW old-cache cleanup + app check in `robot_push.sh` | `backend/mod_ops.js`, v0.16 | Check MAFFL's scheduled runs actually fire; MAFFL's SW likely keeps old caches too. |

## Next
Port #1: commish-posted polls in `backend/mod_social.js` (on the Votes tab) + a 📊 Poll card, then the veto vote on top once Joe answers `veto_vote`.
