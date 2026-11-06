#!/bin/sh
# Run scripts/advise.py on the three fixtures (and the model pass on half) into tests/out/<name>/
# and print the readiness and suggestion counts. Fixtures come from tests/make_fixtures.py.
set -e
cd "$(dirname "$0")"
PY="${PYTHON:-python3}"
"$PY" -I make_fixtures.py
for name in unlabelled half full; do
  echo "== $name"
  "$PY" -I ../scripts/advise.py --scratch "fixtures/$name/scratch" --out "out/$name" --plan-batches
  "$PY" -I ../scripts/advise.py --scratch "fixtures/$name/scratch" --out "out/$name" --date 2026-11-06
done
echo "== half --model"
"$PY" -I ../scripts/advise.py --scratch fixtures/half/scratch --out out/half-model --model --date 2026-11-06
