# Profile template

Short. One screen for the summary, tables for the rest. Each section opens
with its point in one sentence. Delete rows and sections with no data rather
than writing "none". Placeholders in `{braces}`.

---

## {app} ({env}{, loc}) profile

`{n}` workloads, `{inbound peers}` inbound peers, `{outbound peers}` outbound
peers, `{blocked flows}` blocked flows in `{window}`. Policy read from
`{draft | active}`.

**Findings**

- **F1** `{...}`
- **F3** `{...}`
- **F5** `{...}`

(ordered by what to fix first: enforcement blockers, then blocked services,
then hygiene)

## Scope and method

Window `{start}` to `{end}`, direction `{in | out | both}`. Labels
`{app=shop, env=prod}` resolved to `{n}` hrefs. `{k}` PCE queries in total
(`{list by step}`). Traffic results `{complete | truncated: which}`.
Timeline `{run with N buckets of X | not run}`.

## Workloads

| Workload | Role | Enforcement | Online | VEN | Last heartbeat |
| --- | --- | --- | --- | --- | --- |

Enforcement: full `{n}`, selective `{n}`, visibility_only `{n}`, idle `{n}`.

## Inbound traffic

Peers that talk to `{app}`, grouped by peer, then service.

| Peer | Peer labels | Port/proto | Allowed | Potentially blocked | Blocked |
| --- | --- | --- | --- | --- | --- |

## Outbound traffic

What `{app}` talks to.

| Destination | Dest labels | Port/proto | Allowed | Potentially blocked | Blocked |
| --- | --- | --- | --- | --- | --- |

## Intra-app traffic

Flows where both ends are `{app}`; listed once, and not repeated in the
inbound and outbound tables.

| Source | Destination | Port/proto | Policy | Connections |
| --- | --- | --- | --- | --- |

## Policy

Rulesets whose scope covers `{app}`:

| Ruleset | Enabled | Scope | Rules | Touches blocked services |
| --- | --- | --- | --- | --- |

Rules elsewhere that name `{app}` as consumer or provider:

| Ruleset | Rule | Consumer | Provider | Services |
| --- | --- | --- | --- | --- |

Draft versus active: `{in sync | n pending changes touching: ...}` (only
changes to the rulesets above are listed).

## Blocked flows over time

`{N}` buckets of `{X}`; median of non-zero buckets `{m}`; `{k}` spikes.
Worst: `{Tue 14:00-15:00 CEST, 7.2x median, 312 flows}`.

```
{compact text sparkline or bar list, one line per bucket with a bar}
```

## Candidate allow rules

Suggestions. Nothing here has been created or provisioned.

| # | Consumer | Provider | Service | Window | Blocked connections |
| --- | --- | --- | --- | --- | --- |

## Follow-ups

- `enforcement-readiness` and `get-policy-coverage-report` for `{app}` give
  a readiness score; they re-run their own traffic queries, so they were
  not run here.
