# Findings rubric

Every finding is computed from data already collected. A finding is included
only when its trigger is met; the profile never lists a finding with no
evidence. Keep the definitions identical to the ones in illumio-tui's app
focus mode, so the TUI and the skill give the same answer for the same app.

## Finding definitions

| ID | Finding | Trigger | Evidence line |
| --- | --- | --- | --- |
| F1 | Workloads still in visibility mode | any workload of the app has `enforcement_mode` of `visibility_only` or `idle` | `{n} of {total} workloads: {names}` |
| F2 | Mixed enforcement | the app's workloads carry more than one enforcement mode | `{mode: count, ...}` |
| F3 | Blocked services with no rule | an inbound or outbound (peer, port/proto) pair with `blocked` or `potentially_blocked` flows, and no enabled allow rule in the matched draft policy whose actors (scope included) cover both ends and whose services span that port/proto (no services means all); unmanaged peers are never covered by `ams` | `{peer} -> {app} {port}/{proto}: {connections} blocked connections, no rule` (peer is the hostname, or the IP/FQDN when unmanaged) |
| F4 | Stale VENs | workload `online` is false, or `agent.status.last_heartbeat_on` is older than 24 hours, or `agent.status.status` is not `active` (needs `detail_level: full`, see illumio-mcp-server#44) | `{name}: offline since {time}` or `heartbeat {age}` |
| F5 | Blocked-flow spike | a timeline bucket with at least 3 times the median of the non-zero buckets | `{weekday} {HH:MM}-{HH:MM}, {m}x median, {flows} flows` |
| F6 | Unmanaged peers | inbound or outbound peers that are IPs or FQDNs, not managed workloads | `{n} peers, {connections} connections, top: {list}` |
| F7 | Policy not provisioned | `compare-draft-active` lists one of the app's scoped or referencing rulesets (matched by href) under created, updated or deleted | `{ruleset}: {change}` |
| F8 | No policy at all | no ruleset scope covers the app and no rule names its labels | one line |
| F9 | Candidate allow rules | one per F3 pair, grouped by provider service | see below |

## Spike rule

Identical in illumio-tui and here. Do not change one without the other.

1. Split the window into equal buckets. Defaults: 24 buckets of 1 hour for a
   one-day window, 28 buckets of 6 hours for a one-week window. Any other
   window: pick the bucket so the count stays between 12 and 48.
2. Count **blocked flows** per bucket: `totals.pce_flows` of a
   `get-traffic-flows-summary` run with `policy_decisions: ["blocked"]`
   over that bucket (`potentially_blocked` only when the user asked for it,
   then report both series separately). Sum both directions.
3. Median is taken over the **non-zero** buckets only. With fewer than 3
   non-zero buckets there is no spike finding; say the series is too sparse.
4. A spike is any bucket with `flows >= 3 x median`.
5. The worst spike is the bucket with the largest multiple. Name it by weekday
   and local time range, with the multiple to one decimal:
   `Tue 14:00-15:00, 7.2x median`.

## Candidate allow rules (F9)

Suggestions only, written for the user to review. The skill never calls
`create-ruleset`, `create-deny-rule`, `provision-policy` or any other write
tool.

Build one candidate per blocked (peer group, service) pair:

- **Provider**: the app's labels (`app=shop, env=prod`) for inbound; the
  peer's labels for outbound.
- **Consumer**: the peer's labels when the peer is a managed workload with
  labels (`app=web, env=prod`); otherwise an IP list suggestion with the
  observed addresses, named `{app}-{env}-allowed-{direction}`.
- **Service**: `port/proto`. Name the PCE service when the port is a
  well-known one (443 HTTPS, 3306 MySQL, 5432 PostgreSQL, 1433 MSSQL, 6379
  Redis, 5672 AMQP, 9092 Kafka, 22 SSH, 3389 RDP, 389/636 LDAP, 53 DNS).
- **Ranking**: by blocked connections descending. Put intra-app flows
  first; they are almost always legitimate and a ringfence rule covers them
  in one line.
- **Table columns**: `#`, Consumer, Provider, Service, Window (the traffic
  window the evidence came from), Blocked connections. Flow counts are not
  available from grouped results; do not invent them.

Emit as text in the profile and, when the user asks for it, as a
`create-ruleset` call plan:

```
create-ruleset
  name: "shop-prod allow (draft, candidate)"
  scopes: [["app=shop", "env=prod"]]
  rules:
    - consumers: ["app=web", "env=prod"]
      providers: ["app=shop", "env=prod"]
      ingress_services: [{"port": 8080, "proto": "tcp"}]
      description: "candidate from 1,204 blocked flows 2026-10-06..13"
```

Mark every candidate with the blocked connection count it came from and the
window.
