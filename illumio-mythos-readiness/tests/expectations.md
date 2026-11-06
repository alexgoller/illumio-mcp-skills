# What each fixture run must show

`make_fixtures.py` writes three rapid-risk-reduction scratch sets, `run_all.sh` runs RRR's
`triage.py` on each and then `scripts/readiness.py` into `tests/out/<name>/` (plus `mixed`
without `lateral.json` as `mixed-nolateral`), and `check.py` asserts the statements below.
Every run must also satisfy the invariants in the last section.

## mixed (98 workloads, 11 apps over prod, staging, dev and mgmt, 15 unlabelled)

Planted levels, with the gate that stops each app:

| App | Level | Why it stops there |
| --- | --- | --- |
| pay (prod) | 4 Doors shut | crown jewel (the only production bridge, so RRR's default) and bridge: passes everything except `not_a_bridge`; step `ringfence`, bucket week, call plan |
| erp (prod) | 4 Doors shut | the review-flagged account jdoe is seen in it: `no_wide_reach_account`; step `review_account`, bucket plan, no call plan |
| dns (mgmt) | 4 Doors shut | DNS from everywhere is allowed in: `no_unmanaged_inbound`; step `narrow_inbound` naming the X3 source 198.51.100.7, bucket plan |
| shop (prod) | 3 Enforcing | selective and fenced, but the internal source 10.9.9.9 is allowed in on admin ports: `no_unknown_admin`; one `block_unknown` step saying identify first, bucket week, call plan |
| billing (prod) | 3 Enforcing | the dev-to-prod admin crossing ci (dev) to billing (prod) on 22/tcp is reported allowed: `no_cross_env_admin`; step `deny_crossing`, bucket today, call plan |
| crm (prod) | 2 Planned | scoped ruleset, 4 of 12 workloads in visibility only: `enforcing`; step `move_enforcement` backed by its X5 line |
| hr (staging) | 2 Planned | 3 selective workloads with no deny behind them: fails `fenced_if_selective` (and, by construction, `full_enforcement`) and nothing else; step `provision_deny`, bucket plan |
| wiki (staging) | 1 Seen | visibility only, no ruleset: `policy_written`; step `write_policy` backed by its X5 line, bucket week |
| ci (dev) | 1 Seen | the same; it is also the X2 source |
| legacy (dev) | 0 Unseen | one workload has no VEN: `managed`; step `pair_ven`, bucket plan |
| logs (mgmt) | 5 Contained | nothing left; no next step |
| unlabelled | 0 Unseen | 15 workloads: 5 with app only, 5 with env only, 5 with neither; one `label` step naming the illumio-label-advisor skill; measures and score null |

- Crown jewels: `pay (prod)`, defaulted by RRR; it sorts first.
- The public source 203.0.113.50 reaches pay (prod) on 3389/tcp with 0 allowed connections: pay passes `no_unknown_admin`.
- The staging-to-prod crossing into crm (prod) is potentially blocked: crm passes `no_cross_env_admin`.
- Estate: level 2 (66 of 82 managed labelled workloads, 80.5 percent, sit at level 2 or higher; only 48 at level 3 or higher). In force 49 percent, contained 8 percent. `to_next` starts with the unlabelled row (15 workloads), then crm (prod) (12).
- Environments: prod 2 (36 of 48 at level 3 or higher is 75 percent), staging 1, dev 0 (ci and legacy: 6 of 11 managed at level 1 or higher), mgmt 4 (8 of 12 at level 5).
- Notes carry the X1 per-source caveat and the unlabelled count.

## mixed-nolateral (the same set without lateral.json)

- `inputs.lateral` is null; a note says the lateral result is missing.
- `not_a_bridge` is `unknown` with reason "reach unknown: lateral.json missing" on every app row.
- No app reaches level 5: logs (mgmt) drops to 4 with a single `check_reach` step; every other app keeps its level.
- Estate and environment levels are unchanged (2; prod 2, staging 1, dev 0, mgmt 4).

## contained (40 workloads, 5 apps, everything in full enforcement behind scoped, fenced rulesets)

- Every app at level 5, every gate passes, no next steps; estate level 5, `next_level` null, `to_next` empty, contained share 100 percent; prod and mgmt both at 5.
- Section 5 of `readiness.md` says nothing is left.
- Crown jewels default to web (prod), the top production app on the risk map (no bridge on a flat graph).

## unlabelled (40 workloads, no app or env column)

- One row, `unlabelled`, at level 0 with `labelled` failing and every other gate `unknown`, "not graded: unlabelled"; one `label` step.
- Estate level 0, distribution `0: 1 app, 40 workloads`, 0 labelled, 40 managed, no environments; a note says the inventory has no app or env column.

## Invariants for every run

- `date` and `generated` follow `--date`; the ladder has six levels, Contained last, human-dependent for 0 to 2 only; `gate_text` has the eleven gate ids.
- Every row carries every gate id with state pass, fail or unknown and a reason when not passing; the level equals the highest level whose gates and all lower gates pass; `level_name` and `next_level` match; enforcement counts add up to the workloads.
- Next steps are exactly the failing or unknown gates of level + 1: one step per gate, except `no_unknown_admin`, one per X1 line. Kinds come from the mapping table; buckets are today, week or plan; a call plan is `call-plans.md: <RRR line title>` and exists only with bucket today or week; watch-backed steps (X3, X6) have bucket plan, the watch titles in `rrr_lines` and no call plan. No step carries a score, a blast radius or an ease.
- Apps sort crown jewels first, then level ascending, then workloads descending.
- The 80 percent rule recomputed from the rows gives the estate level and every environment level; the distribution adds up to the rows and workloads; in-force and contained shares are recomputed; `to_next` holds every row below the next level, largest first, each with a first step.
- `evidence` equals the seven named keys of `plan.risk_map`; `rrr.crown_jewels` are "app (env)" strings equal to the plan's.
- `readiness.md` has the header and the nine sections in order, the no-write line, the human-dependence sentence, no score word before appendix A and the call-plans pointer in appendix C.
- `dashboard.jsx` is written from `references/dashboard-example.jsx`, has each DATA marker exactly once on its own line and one `const DATA` whose JSON equals `readiness.json`.
- Every kind of the mapping table appears in at least one run.
- No em dash in any file of the skill or in any written report; no `__pycache__` left behind.
