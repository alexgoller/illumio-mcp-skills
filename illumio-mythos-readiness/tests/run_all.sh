#!/bin/sh
# Generate the three fixture sets, run rapid-risk-reduction's triage.py on each, grade each
# with scripts/readiness.py into tests/out/<name>/, add a mixed run without lateral.json,
# then assert tests/expectations.md with check.py. Paths resolve from this script's directory.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"
TRIAGE="$HERE/../../illumio-rapid-risk-reduction/scripts/triage.py"
READY="$HERE/../scripts/readiness.py"
DATE=2026-11-06

run() {
  name="$1"
  echo "== $name"
  "$PY" -I "$TRIAGE" --scratch "$HERE/fixtures/$name" --out "$HERE/out/$name/rrr" --date "$DATE" --window-days 30
  "$PY" -I "$READY" --rrr "$HERE/out/$name/rrr" --scratch "$HERE/fixtures/$name" --out "$HERE/out/$name" --date "$DATE"
}

cd "$HERE"
"$PY" -I make_fixtures.py
for name in unlabelled mixed contained; do
  run "$name"
done

# the mixed set without the lateral-movement result: not_a_bridge is unknown, no app reaches level 5
mkdir -p "$HERE/fixtures/mixed-nolateral"
rm -f "$HERE/fixtures/mixed-nolateral"/*.json
command cp -f "$HERE/fixtures/mixed"/*.json "$HERE/fixtures/mixed-nolateral/"
rm -f "$HERE/fixtures/mixed-nolateral/lateral.json"
run mixed-nolateral

"$PY" -I check.py
