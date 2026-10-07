#!/usr/bin/env bash
# Usage: docs/clients-polish/run-e2e.sh <outdir outside the repo> <suite>...  e.g. roster staff-go-live  Starts servers from the repo root (configs' own webServer runs from
# e2e/configs and times out/fails), warms routes, runs each suite, then re-runs only its failures once
# (first-hit Vite compiles can exceed test timeouts). A test is "failing" only if it fails on the retry too.
cd "$(git rev-parse --show-toplevel)"; OUT=$1; shift; mkdir -p "$OUT"
stop() { pkill -f "node_modules/.bin/vite|bin/vite.js" 2>/dev/null; true; }
stop; sleep 1
npx vite dev --port 8080 --host 127.0.0.1 > "$OUT/vite-app.log" 2>&1 &
npx vite --config e2e/harness/vite.config.ts > "$OUT/vite-harness.log" 2>&1 &
for p in 8080 4177; do for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:$p/ && break; sleep 5; done; done
for r in /dashboard/clients /dashboard/clients/00000000-0000-0000-0000-000000000000 /dashboard/team-members /dashboard /staff /staff/daily-logs /login; do
  curl -s -o /dev/null --max-time 240 "http://127.0.0.1:8080$r"; done
for c in "$@"; do
  npx playwright test --config=e2e/configs/playwright.$c.config.ts --reporter=list --output="$OUT/results-$c" > "$OUT/e2e-$c.txt" 2>&1
  first=$(grep -E '^\s+[0-9]+ (passed|failed|flaky)' "$OUT/e2e-$c.txt" | tr -s ' ' | tr '\n' ' ')
  if grep -qE '^\s+[0-9]+ failed' "$OUT/e2e-$c.txt"; then
    npx playwright test --config=e2e/configs/playwright.$c.config.ts --last-failed --reporter=list --output="$OUT/results-$c-retry" > "$OUT/e2e-$c-retry.txt" 2>&1
    echo "== $c: first run $first| retry of failures: $(grep -E '^\s+[0-9]+ (passed|failed)' "$OUT/e2e-$c-retry.txt" | tr -s ' ' | tr '\n' ' ')"
    echo "   still failing:"; grep -E '^\s+[0-9]+\) ' "$OUT/e2e-$c-retry.txt" | sed 's/^ *[0-9]*) /   - /' | sort -u
  else echo "== $c: $first"; fi
done
stop
