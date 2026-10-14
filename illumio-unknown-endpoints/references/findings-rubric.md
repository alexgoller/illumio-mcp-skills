# Findings rubric: unknown endpoints

Every rule below is computed from data the workflow already holds. No rule
needs an extra PCE query.

## 1. Classification of a flow endpoint

| Class | Test | Treated as |
| --- | --- | --- |
| managed workload | address in the known IP set with `managed` true | known; not reported |
| unmanaged workload | address in the known IP set with `managed` false | known; not reported |
| unlabelled workload | in the known IP set, no `app` label | known; counted in the "not unknown" line |
| noise | link-local `169.254.0.0/16`, `fe80::/10`; multicast `224.0.0.0/4`, `ff00::/8`; broadcast `255.255.255.255` or the `.255` of a managed /24; loopback `127.0.0.0/8`, `::1` | appendix count only |
| unknown | no workload on that side of the flow **and** not in the known IP set | profiled |

Address class of an unknown endpoint: **private** (`10/8`, `172.16/12`,
`192.168/16`, `fc00::/7`, also `100.64/10` carrier NAT) or **public**.

IP-list coverage: an address is covered by list L when it falls in one of
L's ranges (CIDR when `to_ip` is None or empty, a single address when
`from_ip` has no prefix and no `to_ip`, else the span from `from_ip` to
`to_ip`) and in none of L's ranges marked `exclusion`. A default list (any
range equal to `0.0.0.0/0` or `::/0`) is never coverage.

Neighbourhood: the managed prefix (/24 for IPv4, /64 for IPv6) that
contains the address, with the number of managed workloads in it.

Admin ports (tcp unless noted): 21, 22, 23, 88, 135, 139, 161 udp, 389,
445, 636, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 5985, 5986, 6379,
9200, 27017.

Infrastructure ports for the fan-in test: 53 (tcp and udp), 123 udp, 25,
587, 514 (tcp and udp), 3128, 8080, 88, 389, 636, 445, 1514, 8443.

## 2. Profile shapes

Computed per unknown endpoint from its aggregated rows (peer app or
workload x port/proto x connections, plus the policy mix where known).

| Shape | Test | Reads as |
| --- | --- | --- |
| scanner | >= 10 distinct peer x port pairs, median connections per pair <= 3, and where policy is known >= 70% of connections blocked or potentially blocked | probing, not using |
| fan-in server | destination reached by >= 5 distinct peer apps on <= 3 distinct ports | shared infrastructure the inventory does not name |
| admin reach | source touching any admin port on a workload | an operator host, a jump box, or an attacker |
| high volume | connections >= 10x the median connections over all unknown endpoints in the same direction (needs >= 5 endpoints) | an outlier worth a name |
| single peer | exactly one peer app/env pair before the deep dive, exactly one peer workload after it | a point-to-point dependency; easy to inventory |

A spike in the deep-dive timeline is a bucket with flows at least 3 times
the median of the non-zero buckets; the worst spike is the largest multiple,
named by weekday and local time range with the zone stated once
("Tue 14:00-15:00 CEST, 7.2x median"). Fewer than 3 non-zero buckets is too
sparse. Quote `spikes.worst` only when the response carries no `caveat`.

## 3. Findings

Severity: **high** needs action this week, **medium** this quarter,
**low** is hygiene. Each finding names the endpoint, the numbers the test
used, and the suggestion it leads to.

| # | Finding | Test | Severity |
| --- | --- | --- | --- |
| U1 | Unknown host inside a managed subnet | private address, not noise, neighbourhood has >= 1 managed workload | high when it also has admin reach or is allowed into full-enforcement workloads, else medium |
| U2 | Scanner | scanner shape | high |
| U3 | Unknown source on admin ports | admin reach shape | high when any admin-port connection is allowed, else medium |
| U4 | Unknown source allowed into enforced workloads | allowed connections to a peer app/env in which >= 1 workload is in `full` enforcement (report n of m workloads; the exact workload is known only after the deep dive) | high when no named IP list covers the address (the rule admitting it is broad), else medium; name the covering list |
| U5 | Uninventoried infrastructure | fan-in server shape, or any port in the infrastructure set serving >= 3 apps | medium |
| U6 | Public source reaching workloads | public address as a source, not noise | high when any connection is allowed and no named IP list covers the address, else medium; name the covering list |
| U7 | Unknown public destination with notable egress | public destination with high volume shape, or a `likely_provider` from the egress tool | medium; when the provider is an AI vendor point to illumio-agentic-ai-risk-assessment |
| U8 | Unknown endpoint in no named IP list | private or public, no covering list | low (policy has no object for it) |
| U9 | Volume outlier | high volume shape, not already U2, U5 or U7 | low |
| U10 | Policy mix unknown | endpoint from Step 4 with no `blocked` row while the summary was capped (`totals.truncated` true or `blocked` in `truncated_sections`) | low; say the allowed count is unverified |

An endpoint can carry several findings; list it once in the table with all
its finding numbers, and once per finding in the findings section, high
first, then by connections. A direction with no unknown endpoints is one
line, not a section.

## 4. Suggestions

Suggestions are text. When the user asks for a call plan, write the
arguments in a code block and do not call the tool.

| Lead finding | Suggestion | Call plan |
| --- | --- | --- |
| U1, single peer, fan-in with a private address | unmanaged workload entry: hostname from the FQDN when known, else `unknown-<ip with dots replaced by dashes>`; the address as its interface; `app`/`env` from the dominant peer when the user agrees | `create-workload` with `name`, `hostname`, `interfaces: [{name: "eth0", address: "<ip>"}]`, labels; unmanaged workloads are created without a VEN |
| U1 on an OS the user manages | VEN deployment through a pairing profile | none; name `get-pairing-profiles` as the next read |
| U5, U7, a group of addresses with one role | IP list naming the group, with the role in `description` | `create-iplist` with `name`, `ip_ranges: [{from_ip: "<ip>"}]`, `fqdns` when resolved |
| U2, U3 with blocked traffic | deny rule from an IP list of the scanner addresses to all workloads on the admin ports; or confirm the block holds in enforcement | `create-deny-rule` arguments; say it is draft until provisioned |
| U4, U6 with allowed traffic | find the rule that admits it: the covering IP list named in the finding, or the default list; recommend narrowing | `get-rulesets` filtered by that list is the next read |

Never present a suggestion as applied. The heading of the section is
"Suggested objects (not created)".
