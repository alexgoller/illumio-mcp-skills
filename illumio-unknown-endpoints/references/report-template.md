# Unknown endpoints: <PCE or org name>

**Scope.** Window <start> to <end> (<N> days), direction <both|inbound|outbound>,
scope <labels or "whole estate">. <Q> PCE queries. Inventory <complete|truncated at
R of T workloads>; summary <complete|capped at 200,000 flows: coverage note>;
unknown-source scan <complete|capped at top_n>. Policy objects read from draft.

## Summary

| | Sources | Destinations |
| --- | --- | --- |
| Unknown endpoints | <n> | <n> |
| of which inside a managed subnet | <n> | <n> |
| of which public | <n> | <n> |
| of which covered by a named IP list | <n> | <n> |
| Connections involving unknown endpoints | <n> | <n> |
| Not unknown: unlabelled workloads seen | <n managed, n unmanaged> | <n managed, n unmanaged> |
| Noise endpoints (appendix) | <n> | <n> |

## Findings

Ordered high, medium, low; by connections within a severity.

- **U2 Scanner, high.** `10.20.30.40` (no FQDN, no IP list, shares 10.20.30.0/24
  with 14 managed workloads) touched 37 workloads in 6 apps on 212 ports,
  median 1 connection per pair, 96% blocked. Suggest: deny rule, then find the
  host.
- ...

## Unknown sources

Legend for both tables: **bold** port = admin port (22, 3389, 445, 1433 and
the rest of the rubric's list); the policy column is allowed / potentially
blocked / blocked connections, "partial" when the summary was capped and the
allowed count is unverified; Class is private, public or noise; IP list
names only lists narrower than the default; Findings are the rubric ids.

| Address | FQDN | Class | IP list | Neighbourhood | Peer apps | Ports | Allowed / pot. blocked / blocked | Connections | Shape | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Unknown destinations

| Address | FQDN | Class | IP list | Provider | Peer apps | Ports | Processes | Allowed / pot. blocked / blocked | Connections | Shape | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Collapsed ranges (not hosts, not in the counts above): "Any (0.0.0.0/0 and
::/0)" 443/tcp allowed, 50,000 connections; ...

## Deep dive: <address>   (only if approved)

Peer x port x policy table from the grouped query, then the timeline as one
line per bucket with a bar, the worst spike named as the rubric says, and the
`resolution_note` quoted when present.

## Suggested objects (not created)

1. Unmanaged workload `unknown-10-20-30-40` ... (U1)
2. IP list `infra-dns-resolvers` with 10.0.0.53, 10.0.1.53 ... (U5)
3. Deny rule ... (U2)

Call plans on request, as `create-workload` / `create-iplist` /
`create-deny-rule` arguments in a code block; nothing is executed.

## Appendix

- Noise endpoints (counts only, connections dropped from every total): <n>
  link-local, <n> multicast, <n> broadcast, <n> loopback.
- Unlabelled workloads seen in the unknown-source scan: <list or count>;
  labelling is covered by illumio-pce-assessment.
- Method: unknown means no workload on that side of the flow and not an
  interface address in the inventory; IP-list membership reported but not
  counted as known; `find-unmanaged-traffic` filtered against the inventory;
  policy mix joined from the summary's blocked section.
