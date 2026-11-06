# What each fixture run must show

`make_fixtures.py` writes three seeded estates, `run_all.sh` runs `scripts/advise.py` on
each (plus `--model` on `half`) into `tests/out/<name>/`, and `check.py` asserts the
statements below. Every run must also satisfy the invariants in the last section.

## unlabelled (60 workloads, no labels, opaque hostnames)

- Readiness: 60 unlabelled, 0 partly, 0 fully labelled; 58 managed, 2 unmanaged; no
  custom dimension; `infra.json` recorded as message-only (no labelled app flows).
- Suggestions exist for `role` only (nothing can speak to app, env or loc), 40 or more,
  every value `new_value: true` because the vocabulary is empty.
- Hubs by fan-in: two `directory` (lsass.exe on 88 and 389), two `dns` (named on 53),
  one `backup` (bprd on 13720); every hub `from: fan-in`.
- The two domain controllers get `Directory` at `high` (listening_process, ven_os,
  fan_in agree; dns.exe on the same host yields to Directory).
- Signal kinds fired include `listening_process`, `ven_os`, `fan_in`.
- Unresolved processes are exactly `svc_foo.exe` 9443 (windows) and `vendord` 7777
  (linux); all 60 workloads appear under unresolved workloads for app, env and loc.
- No conflicts, no conventions. The plan carries the high role suggestions and lists
  the role values to create.

## half (120 workloads, convention `<env>-<app>-<role><nn>`, custom `bu` by subnet)

- Readiness: 120 workloads, 60 fully labelled, 20 partly, 40 unlabelled; custom
  dimension `["bu"]`; `flows_dst_1.json` recorded as truncated and
  `traffic.truncated_calls` is 1.
- Conventions mined include `prd -> Production` (with the 2 planted counter-examples),
  `stg -> Staging`, `shop -> shop`, `web -> Web`, and subnet rules such as
  `10.10.3.0/24 -> bu Sales` and `10.20.1.0/24 -> loc DC2`.
- Conflicts are exactly two, both `env`, existing `Staging`, suggested `Production`,
  confidence `high`, on `prd-shop-web03` and `prd-pay-app03`; neither host is in the
  plan.
- Suggestions cover all five dimensions; 40 or more for `bu` by subnet majority; no new
  values (the vocabulary is complete). Kinds fired include `listening_process`,
  `hostname_token`, `peer_app`, `peer_env`, `subnet_majority`, `ven_os`.
- Hubs include dc01, dc02, dns01, dns02 (fan-in, confirmed by infra.json) and bk01;
  mon01 comes from `infra-tool` only. A labelled hub gets no suggestion.
- `preferences.json` is applied: dimensions role, app, env, loc, bu; minimum confidence
  high; every plan entry is high.
- Before the model pass `prd-shop-util01` (svc_foo.exe) is unresolved for role and
  `unm02` for all five dimensions.

## half --model

- Exactly one suggestion is added: `prd-shop-util01` role `Backup`, source `model`,
  confidence `medium` (the model said medium; high would have been capped).
- Notes record: the entry for a workload that already carries role (ignored), the
  unknown href (ignored), the custom value `bu=Marketing` not in use (ignored), and the
  two entries that agree with the script (confidence unchanged).
- Conflicts are unchanged; util01 leaves the unresolved list.

## full (80 workloads fully labelled including `bu`)

- Readiness: 80 fully labelled, 0 partly, 0 unlabelled; coverage has no gaps.
- Zero suggestions, zero conflicts, nothing unresolved, an empty plan.
- Hubs and conventions are still reported (they describe the estate, not gaps).

## Invariants for every run

- Every suggestion names a dimension the workload does not carry (fill gaps only);
  every conflict's `existing` equals the fixture label; signal kinds come from the
  closed list; confidence is high, medium or low; model suggestions are never high.
- Custom dimensions propose existing values only, `new_value` false.
- Plan: `before` equals the fixture labels, `add` never overlaps `before`, `after` is
  their union, confidence keys equal add keys, every entry meets `min_confidence` and
  stays inside the preferred dimensions, counts add up, `plan.json` equals
  `advice.plan`.
- `plan.md` carries one apply call (the after set) and one rollback call (the before
  set) per plan entry, as `update-workload href:<href> labels:[...]`.
- `batches.json`: full-detail batches are `/24` prefixes of at most 150 workloads; flow
  batches hold at most 25 hrefs, cover every workload once, unlabelled first.
- `dashboard.jsx` has each DATA marker exactly once on its own line and one
  `const DATA` whose JSON equals `advice.json`.
- No em dash in any file of the skill; no `__pycache__` left behind.
