# Unknown endpoints: <PCE or org name>

**Scope.** Window <window.start> to <window.end> (<N> days), direction
<both|inbound|outbound>, scope <labels or "whole estate">. <totals.pce_queries
plus deep-dive calls> PCE queries. <totals.pce_flows> flows <under the cap|capped:
counts are lower bounds>; inventory <complete, totals.inventory_workloads
workloads|truncated at totals.inventory_workloads workloads>; IP lists
<totals.ip_lists read in full|truncated>. Showing <totals.returned> of
<totals.unknown_endpoints> unknown endpoints. IP lists read from draft.

## Summary

| | Sources | Destinations |
| --- | --- | --- |
| Unknown endpoints | <n with as_source> | <n with as_destination> |
| of which inside a managed subnet (`neighbourhood`) | <n> | <n> |
| of which public (`address_class`) | <n> | <n> |
| of which covered by a named IP list (`ip_lists`) | <n> | <n> |
| Connections involving unknown endpoints | <sum of as_source.connections> | <sum of as_destination.connections> |
| Noise endpoints (appendix) | <totals.noise_endpoints> | |

## Findings

Ordered high, medium, low; by connections within a severity. Every number
is quoted from `profile_evidence` or the `as_source` / `as_destination`
block.

- **U2 Scanner, high.** `10.20.30.40` (no FQDN, no IP list, shares 10.20.30.0/24
  with 14 managed workloads) touched 37 workloads in 6 apps on 212 peer x port
  pairs, median 1 connection per pair, denied share 0.96. Suggest: deny rule,
  then find the host.
- ...

## Unknown sources

Legend for both tables: **bold** port = `admin: true` (22, 3389, 445, 1433
and the rest of the rubric's list); the policy column is `policy.allowed` /
`policy.potentially_blocked` / `policy.blocked` connections, "lower bound"
when `totals.flows_truncated` was true; Class is `address_class`; IP list
is `ip_lists` (named lists only; the default list is never shown);
Neighbourhood is `neighbourhood.prefix` with `managed_workloads`; Peer apps
are `as_source.peer_apps` as `app (env)`; Shape is `profile`; Findings are
the rubric ids. With a scope, Connections are estate-wide for the endpoint.

| Address (`ip`) | FQDN | Class | IP list | Neighbourhood | Peer apps | Ports | Allowed / pot. blocked / blocked | Connections | Shape | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Unknown destinations

Provider is `likely_provider` (`provider_confidence` in brackets); Processes
are filled only from a Step 3 process query, else blank.

| Address (`ip`) | FQDN | Class | IP list | Provider | Peer apps | Ports | Processes | Allowed / pot. blocked / blocked | Connections | Shape | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Deep dive: <address>   (only if approved)

Peer x port x policy table from the `ip` call's `peers` rows (`peer`,
`peer_app`, `peer_enforcement_mode`, `port`, `proto`, `policy`,
`connections`), the process column from the grouped query when run, then
the `timeline` as one line per bucket with a bar, `bucket` and
`effective_bucket` stated, the worst spike named as the rubric says, and
`resolution_note` and `spikes.caveat` quoted when present.

## Suggested objects (not created)

1. Unmanaged workload `unknown-10-20-30-40` ... (U1)
2. IP list `infra-dns-resolvers` with 10.0.0.53, 10.0.1.53 ... (U5)
3. Deny rule ... (U2)

Call plans on request, as `create-workload` / `create-iplist` /
`create-deny-rule` arguments in a code block; nothing is executed.

## Appendix

- Noise endpoints (counts only, connections in no other total):
  <totals.noise_endpoints> endpoints, <totals.noise_connections> connections;
  by class when `include_noise` was set.
- Unlabelled workloads seen as peers (`totals.unlabelled_workloads_seen`):
  <n>; they are workloads without an `app` label, not unknown; labelling is
  covered by illumio-pce-assessment.
- Known by inventory only (`totals.known_by_inventory_only`): <n> addresses
  Explorer did not name but the inventory did; treated as known.
- Rows between unknowns (`totals.rows_between_unknowns`): <n> flow rows with
  no workload on either side; not profiled.
- Default IP lists dropped from coverage (`totals.default_ip_lists`): <names>.
- Method: unknown means no workload attached by Explorer on that side of the
  flow and not an interface address in the inventory; IP-list membership
  reported but not counted as known; classes, coverage, neighbourhood and
  profile shapes computed by `find-unknown-endpoints`, findings by this
  skill. `coverage_note`: "<quoted>".
