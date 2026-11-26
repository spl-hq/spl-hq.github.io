#!/usr/bin/env bash
# Push a robot's commit safely. Robots share league-data.js (DERIVED), so two robots fired by the same push used to collide on it.
# Rebase onto whatever landed meanwhile (each gold file has one robot owner, so the robot's own version wins a conflict),
# then rebuild league-data.js from the merged gold and push. Retries 3 times. Call after `git commit`.
set -u
for i in 1 2 3; do
  if git pull -q --rebase -X theirs; then
    python3 tools/build_data.py >/dev/null || { echo "robot_push: build_data failed"; exit 1; }
    git add league-data.js
    git diff --cached --quiet || git commit -q -m "Rebuild league-data.js after rebase"
    # Robot pushes never start CI (GitHub doesn't run workflows for GITHUB_TOKEN pushes), so check the app here: a bad league-data.js = blank app.
    node tests/app_check.js >/dev/null || { echo "robot_push: app check failed (league-data.js?), not pushing"; node tests/app_check.js | grep FAIL; exit 1; }
    git push -q && exit 0
  else
    git rebase --abort 2>/dev/null || true
  fi
  sleep $((i * 5))
done
echo "robot_push: gave up after 3 tries"; exit 1
