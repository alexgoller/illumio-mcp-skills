# Findings rubric: unknown endpoints

Sections 1 and 2 are computed by `find-unknown-endpoints` and read from
its output; the thresholds are stated here so a reader of the report knows
what a shape means, and so a change on either side is noticed. Sections 3
and 4 are the skill's own analysis on that output. No rule below needs an
extra PCE query.

## 1. Classification of a flow endpoint

| Class | Test | Treated as |
| --- | --- | --- |
| managed workload | Explorer attached a workload, or the address is an interface of an inventoried workload with a VEN | known; not reported |
| unmanaged workload | as above, workload without a VEN | known; not reported |
| unlabelled workload | known, no `app` label | known; counted in `totals.unlabelled_workloads_seen`, shown as peer app `unlabelled` |
| noise | `address_class` of `link_local` (`169.254.0.0/16`, `fe80::/10`), `multicast` (`224.0.0.0/4`, `ff00::/8`), `broadcast` (`255.255.255.255` or the `.255` of a /24 holding a managed workload), `loopback` (`127.0.0.0/8`, `::1`) | `totals.noise_endpoints`; listed only with `include_noise` |
| unknown | no workload on that side of the flow **and** not an interface address in the inventory | `endpoints`; profiled |

`address_class` of an unknown endpoint: **private** (`10/8`, `172.16/12`,
`192.168/16`, `100.64/10` carrier NAT, `fc00::/7`) or **public**.

IP-list coverage, `ip_lists`: the named lists whose ranges contain the
address (CIDR, single address or `from_ip`..`to_ip` span), exclusion
ranges honoured, plus any list name Explorer itself attached to the flow.
A default list (an inclusion range equal to `0.0.0.0/0` or `::/0`) is
never coverage; its name is in `totals.default_ip_lists`. The same answer
for one address outside this workflow is `get-iplists contains_ip:
"<ip>"`, dropping lists with `is_default: true`.

Neighbourhood, `neighbourhood`: the managed prefix (/24 for IPv4, /64 for
IPv6) that contains the address, as `{prefix, managed_workloads}`; null
when no managed workload shares it.

Admin ports (tcp unless noted), the `admin` flag on a port row: 21, 22,
23, 88, 135, 139, 161 udp, 389, 445, 636, 1433, 1521, 2049, 3306, 3389,
5432, 5900, 5985, 5986, 6379, 9200, 27017.

Infrastructure ports for the U5 test (skill-side, from the `ports` list):
53 (tcp and udp), 123 udp, 25, 587, 514 (tcp and udp), 3128, 8080, 88,
389, 636, 445, 1514, 8443.

## 2. Profile shapes

`profile` lists the shapes that apply; `profile_evidence` carries the
numbers each test used, under the shape's name. Quote those; do not
recompute a shape from the top-10 `ports` list, which is a subset.

| Shape | Test | Evidence keys | Reads as |
| --- | --- | --- | --- |
| `scanner` | >= 10 distinct peer x port pairs as a source, median connections per pair <= 3, and where policy is known >= 70% of connections blocked or potentially blocked | `peer_port_pairs`, `median_connections_per_pair`, `denied_share` | probing, not using |
| `fan_in_server` | destination reached by >= 5 distinct labelled peer apps on <= 3 distinct ports | `peer_apps`, `ports` | shared infrastructure the inventory does not name |
| `admin_reach` | source touching any admin port on a workload | `admin_ports` (as `port/proto`), `allowed_connections` | an operator host, a jump box, or an attacker |
| `high_volume` | connections >= 10x the median connections over all unknown endpoints in the same direction (needs >= 5 endpoints there) | per direction: `connections`, `median`, `multiple` | an outlier worth a name |
| `single_peer` | exactly one peer workload across the directions scanned | `peer` | a point-to-point dependency; easy to inventory |

A spike in the deep-dive `timeline` is a bucket with flows at least 3
times the median of the non-zero buckets (`spikes.rule`,
`spikes.median_nonzero`, `spikes.threshold`); the worst spike is
`spikes.worst`, named by weekday and local time range with the zone stated
once ("Tue 14:00-15:00 CEST, 7.2x median" from `bucket_start` and
`multiple`). Fewer than 3 non-zero buckets is too sparse. Quote
`spikes.worst` only when `spikes` carries no `caveat`.

## 3. Findings

Severity: **high** needs action this week, **medium** this quarter,
**low** is hygiene. Each finding names the endpoint, the numbers the test
used (from `profile_evidence`, `as_source`, `as_destination`,
`neighbourhood`, `ip_lists`), and the suggestion it leads to.

| # | Finding | Test | Severity |
| --- | --- | --- | --- |
| U1 | Unknown host inside a managed subnet | `address_class` private, `neighbourhood` not null | high when it also has `admin_reach` or `as_source.allowed_into_enforced` > 0, else medium |
| U2 | Scanner | `scanner` in `profile` | high |
| U3 | Unknown source on admin ports | `admin_reach` in `profile` | high when `profile_evidence.admin_reach.allowed_connections` > 0, else medium |
| U4 | Unknown source allowed into enforced workloads | `as_source.allowed_into_enforced` > 0 (report it with `peers_enforced` of `peer_workloads`) | high when `ip_lists` is empty (the rule admitting it is broad), else medium; name the covering list |
| U5 | Uninventoried infrastructure | `fan_in_server` in `profile`, or any `as_destination` port in the infrastructure set with `peers` >= 3 | medium |
| U6 | Public source reaching workloads | `address_class` public with an `as_source` block | high when `as_source.policy.allowed` > 0 and `ip_lists` is empty, else medium; name the covering list |
| U7 | Unknown public destination with notable egress | `address_class` public with an `as_destination` block, and `high_volume` in `profile` or `likely_provider` not null | medium; when the provider is an AI vendor point to illumio-agentic-ai-risk-assessment |
| U8 | Unknown endpoint in no named IP list | `ip_lists` empty | low (policy has no object for it) |
| U9 | Volume outlier | `high_volume` in `profile`, not already U2, U5 or U7 | low |
| U10 | Counts unverified | `totals.flows_truncated` true (one finding for the run: every count is a lower bound), or a policy mix with connections under a key other than `allowed`, `potentially_blocked`, `blocked` | low; say which counts are unverified |

An endpoint can carry several findings; list it once in the table with all
its finding numbers, and once per finding in the findings section, high
first, then by connections. A direction with no unknown endpoints is one
line, not a section.

## 4. Suggestions

Suggestions are text. When the user asks for a call plan, write the
arguments in a code block and do not call the tool.

| Lead finding | Suggestion | Call plan |
| --- | --- | --- |
| U1, `single_peer`, `fan_in_server` with a private address | unmanaged workload entry: hostname from `fqdn` when known, else `unknown-<ip with dots replaced by dashes>`; the address as its interface; `app`/`env` from the dominant peer app when the user agrees | `create-workload` with `name`, `hostname`, `interfaces: [{name: "eth0", address: "<ip>"}]`, labels; unmanaged workloads are created without a VEN |
| U1 on an OS the user manages | VEN deployment through a pairing profile | none; name `get-pairing-profiles` as the next read |
| U5, U7, a group of addresses with one role | IP list naming the group, with the role in `description` | `create-iplist` with `name`, `ip_ranges: [{from_ip: "<ip>"}]`, `fqdns` when resolved |
| U2, U3 with blocked traffic | deny rule from an IP list of the scanner addresses to all workloads on the admin ports; or confirm the block holds in enforcement | `create-deny-rule` arguments; say it is draft until provisioned |
| U4, U6 with allowed traffic | find the rule that admits it: the list named in `ip_lists`, or the default list | `get-rulesets` filtered by that list is the next read |

Never present a suggestion as applied. The heading of the section is
"Suggested objects (not created)".
