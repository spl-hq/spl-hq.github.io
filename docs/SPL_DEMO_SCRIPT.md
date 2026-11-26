# SPL HQ — the Joe demo (WS5)

_15 minutes, Mike + Joe, both on their phones. Everything runs on the ESPN **test league 1722387564**; the real SPL league (19583) is never written to._

## The setup (Mike, once, the day before)

The test league has 4 teams. SPL HQ maps them to 4 SPL owners: **Mike's own ESPN team = Mike**, the other three (by ESPN team id) = **Joe, Al, Glen**. Each one gets a copy of that owner's real SPL roster.

1. **ESPN:** invite Joe to the test league and give him the team SPL HQ maps to him (Ops desk shows which: Joe = ESPN "…"). Then LM Tools → make Joe a league manager. That way he sees the trade land in his own ESPN app.
2. **Pick a quiet day** (Tue/Wed): players whose game has started are locked, and ESPN may refuse to move them.
3. SPL HQ → Desk → 🛠️ Ops desk → **🏈 ESPN test league** → **Off · turn on** (writes).
4. **🪞 Mirror SPL rosters.** It drops players no SPL team has, moves SPL players sitting on the wrong test team over (commish trade, so nobody hits waivers), then adds the rest, one player per add. When it's done every team should say ✅ N of N match SPL. Misses (roster limits, locked players) are listed with ESPN's reason; run it again later to finish.
5. Make sure Joe has his passphrase and is signed in (Ops desk → Owners).

## The demo

1. **Mike proposes** (Team → Propose a trade → Joe): one of his players + a 2027 pick for one of Joe's players. Note: a 🔒 keeper contract travels with its player.
2. **Joe gets it** in his DM card + email → opens it → **Accept**.
3. **Approve.** A Joe ↔ Mike trade has no neutral commish, so either may approve (the league card says so). Let Joe tap **Approve** on his 📥 Commish desk.
4. **Watch ESPN.** The app moves both players on the test league right then (one write) and reads ESPN back. The trade card says **🏈 Done on ESPN · test league**, and league chat posts it. Joe opens his ESPN app: the players have switched teams.
5. **The parts ESPN can't do:** the pick moved in the pick ledger (Draft screen, 🎟️ pick wire), the keeper contract followed its player (💸 cap impact card), and the ledger robot copies both into the repo within 2 h.
6. **If ESPN says no** (roster too big, player locked): the trade still counts in the app, and it lands on the Commish desk under **🏈 Do on ESPN** with ESPN's reason. Nothing is retried by itself, so nothing ever happens twice.

## After the demo

- Ops desk → **🪞 Mirror SPL rosters** puts the test league back to the real rosters; **Wipe test trades** clears the practice trades and picks.
- The question for Joe (📋 "ESPN co-commish"): make Mike a league manager in SPL on ESPN. With that and his sign-off, Claude flips `WRITE_LEAGUE` to 19583 and `TRADE_MODE` to live: from then on approved SPL trades move on ESPN by themselves.
