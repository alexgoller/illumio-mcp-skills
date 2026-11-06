# Inference rules: label advisor

Every suggestion in the advice is one **missing label** on one workload, backed by
the signals that point to a value and graded by how many independent kinds of
evidence agree. The script (`scripts/advise.py`) computes all of this from the saved
tool results; the rules are stated here so the reader of a suggestion knows what a
confidence means, and so a change on either side is noticed. The process and port
table is `process-roles.md`, parsed at run time.

## 1. What the script reads

| File | Tool | Used for |
| --- | --- | --- |
| `labels.txt` | `get-labels usage:true` | the dimensions (every label key) and the vocabulary per key |
| `workloads.json` | `get-workloads` compact, unfiltered | the inventory: hostname, IPs, os, managed, existing labels (a cell of `-`, empty or null is missing) |
| `workloads_full_<n>.json` | `get-workloads` full, one `ip_address` prefix per batch | `services.open_service_ports` (process, port, protocol), `os_id` |
| `summary.json` | `get-traffic-flows-summary`, unfiltered | the window and the estate-wide flow totals |
| `flows_src_<n>.json`, `flows_dst_<n>.json` | `get-traffic-flows` per batch of 25 hrefs, grouped by source, destination, port, proto, process | peers, ports served, fan-in |
| `infra.json` | `identify-infrastructure-services` | hubs the tool already knows (Core Infrastructure and Shared Service tiers) |
| `model-suggestions.json` | the model, after `unresolved.md` | the model pass (section 8) |
| `preferences.json` | the skill, apply mode | the plan filter (section 9) |

The four standard dimensions `role`, `app`, `env`, `loc` are always present; every
other key in `labels.txt` (or label column in the inventory) is a **custom
dimension**. A workload is *unlabelled* with no label in any dimension, *fully
labelled* when it carries all four standard dimensions, and *partly labelled* otherwise.
Custom dimensions count in the per-dimension coverage table but not toward "fully": a
sparsely used custom key would otherwise keep an estate from ever reading as fully
labelled.

## 2. Signals

A signal is one observation that points to one value of one dimension. Kinds (closed
list, the `kind` of every signal in `advice.json`):

| Kind | Dimension | Fires when | Evidence family |
| --- | --- | --- | --- |
| `listening_process` | role | a listener in `open_service_ports` matches a process row of the table (basename, port, proto, os) | listener |
| `listening_port` | role | no process row matches but a port-only row does: the listener's process is unknown, or the workload serves the port to at least 2 sources in the window | listener |
| `fan_in` | role | the workload is a hub (section 5) and a port-only row names the hub port; `hub only` rows count here | traffic |
| `ven_os` | role | the matched table row is os-specific and the VEN reports that os (Windows plus `lsass.exe` on 389 is a domain controller) | os |
| `hostname_token` | any | a mined hostname convention fires on the workload's hostname (section 6) | hostname |
| `peer_app` | app | 70 percent or more of the workload's connections to labelled peers go to one app, that app has at least 2 members, and the workload is not a hub | peers |
| `peer_env` | env | 90 percent or more of the connections to labelled peers share one env | peers |
| `subnet_majority` | loc, custom | the workload's /24 has a mined subnet rule (section 6) | subnet |
| `model_knowledge` | any | a `model-suggestions.json` entry (section 8) | model |

Flows contribute ports only, never process names: a grouped flow's `process_name` comes
from whichever VEN reported it, and `lsass.exe` is also the LDAP client on every member
server. Process evidence comes from `open_service_ports`, so a workload without a full
detail record gets `listening_port` at most.

Peers are the managed workloads on the other side of a flow, weighted by connections,
after the hubs are removed; a hub itself gets no peer signal (everyone talks to it).

Within the listener family, rows whose role is `-` (agents, `sshd`, RDP, WinRM) are
known and silent: they are neither a role nor an unresolved process. When listeners on
one host point to different roles the script does not choose, with one exception: DNS,
DHCP, NTP and File yield to Directory, because a domain controller serves all of them.
Any other disagreement (Jenkins and Redis on one host) leaves the dimension unresolved
with the competing values named, for the model pass.

Role values from the table are canonical (`Database`, `Directory`); the script maps
them to the customer's existing role vocabulary by case-insensitive match or alias
(`db`, `sql` for Database; `dc`, `ad`, `ldap` for Directory) and only proposes the
canonical value, flagged `new_value: true`, when nothing matches.

## 3. Confidence

Signals that agree on a value are grouped; the value with the most evidence families
wins (ties go to section 2's disagreement rule). Then:

| Confidence | Rule |
| --- | --- |
| `high` | two independent evidence families agree (listener and hostname, hostname and peers, listener and traffic, listener and os), or one mined convention (hostname or subnet) with support 5 or more and no counter-example |
| `medium` | one signal, or one convention with fewer than 5 supporters or with counter-examples |
| `low` | model knowledge only, when the model said low |

`listening_process` and `listening_port` are one family (the same port), so they never
make a high on their own; `fan_in` is the traffic family, so a listener plus many
sources on its port is high. `ven_os` belongs to the listener family too: the OS makes
the listener match more specific (`sqlservr.exe` on Windows), it is not a second
observation of the role, so a listener on its own OS is still medium until traffic, a
hostname convention or a subnet rule agrees. A model entry that
agrees with the script is appended to the suggestion's signals and leaves the
confidence as it was; a model entry on its own is never above medium.

## 4. Fill gaps only, conflicts

A suggestion never exists for a dimension the workload already carries. When the
evidence for a carried dimension points to a different value, the workload goes to
`conflicts` with the existing value, the suggested one, the confidence the suggestion
would have had, and the signals; nothing in the plan touches it. Comparison is
case-insensitive after vocabulary mapping, so `db` and `Database` are not a conflict.

Unresolved (`unresolved.md`) lists, per workload, the missing dimensions nothing spoke
to and why (`no convention match`, `no labelled peers`, `no traffic in window`, `no
full-detail record`, `hub: peers say nothing about it`, `signals disagree: ...`), and
per listener kind the processes the table does not know (process, port, proto, os,
workload count, up to ten hostnames).

## 5. Hubs

A workload is a **hub** when one destination port has at least N distinct sources in
the window, N = the lower of 20 and 25 percent of the managed workloads, never below 3
(`from: fan-in`); or when `identify-infrastructure-services` lists its app and env as
Core Infrastructure or Shared Service (`from: infra-tool`, only when fan-in did not
already find it). A hub carries its busiest port, the process behind it when the full
record has one, the source count, the other qualifying ports and a kind taken from the
port-only table row (`directory`, `dns`, `backup`, `file`, ...; `service` when the
table has no row; the tool's tier and pattern for infra-tool hubs).

Hubs get role suggestions like everyone else (`fan_in` plus their listeners), and are
excluded as evidence for the `peer_app` and `peer_env` of others: a hundred workloads
talking to the domain controller say nothing about any of them.

## 6. Conventions mined from the labelled workloads

**Hostname.** The hostname is lower-cased and split on `-`, `_` and `.` into parts;
part N yields itself and, when it mixes letters and digits, each letter run and digit
run (`web01` gives `web01`, `web`, `01`; `dc1` gives `dc1`, `dc`, `1`). For every
dimension, every (part position, token) pair seen on labelled workloads is counted per
value: `support` is the top value's count, `counter` the others. A rule is kept with
support 3 or more and no counter-example, or support 10 or more and at most one
counter-example in ten (the counter-examples then surface as conflicts, which is how a
mislabelled host is caught by its own naming convention). A whole-part rule is dropped
when one of its runs already maps to the same value at the same position. Digit-run
rules (`01 -> Production` on four infrastructure hosts) are real but weak; the
conventions table shows them so the reader can discount them.

**Subnet.** For `loc` and every custom dimension, the /24 of the workload's first IPv4
address is counted per value among labelled workloads; a rule is kept when the top value
has 3 or more supporters and 80 percent or more of the subnet.

Every rule appears in `advice.conventions` with its dimension, token (or subnet),
value, support and counter. A convention fires on a workload through `hostname_token` or
`subnet_majority`; when two hostname rules of one dimension fire with different values,
the stronger (more support) wins and an equal tie fires nothing.

## 7. Custom dimensions

A custom dimension gets `hostname_token` and `subnet_majority` signals only, and only
values already in use: `new_value` is always false, a model entry with a value the
dimension does not have is ignored with a note, and a custom key with no labels yet
produces nothing (the vocabulary is empty, so nothing can be mined).

## 8. The model pass

`unresolved.md` tells the model what the script could not resolve and the JSON shape to
write back: `[{href, dimension, value, confidence, evidence}]`. On `--model` each entry
becomes a suggestion with `source: "model"` and one `model_knowledge` signal carrying
the evidence sentence; confidence is `low` or `medium` (high is capped to medium). An
entry is ignored, with a note in `readiness.notes`, when the href is unknown, the
dimension is not a label key, the workload already carries the dimension, or a custom
dimension's value does not exist. An entry that agrees with an existing script
suggestion is appended to its signals; one that disagrees is noted and the script's
suggestion stands.

## 9. The plan

`plan.json` (= `advice.plan`) filters the suggestions by the preferences: the
dimensions wanted, the minimum confidence (default high) and the scope (`all`, an
`env` value the workload already carries, a `subnet` in CIDR notation, a `hostname`
glob or substring, or a list of `hrefs`). Per workload it carries the labels before,
the additions, the merged set after, the confidence per added key and the new label
values. Counts: workloads, labels added, label values to create. `plan.md` lists the
table and, per workload, the apply call with the full after set and the rollback call
with the before set, because `update-workload labels` replaces the whole set. The plan
is a dry run; the skill applies it only after the user's explicit yes, one workload at
a time, re-reading the labels first.

## 10. Limits

- Process names exist only where the VEN reports them: `open_service_ports` needs a
  VEN with process visibility, and unmanaged workloads have none. The readiness section
  counts workloads with and without listeners.
- `get-workloads detail_level:full` is capped by response size (800 KB) with no
  paging, so full detail is pulled in batches by `ip_address` prefix per /24, unlabelled
  workloads first, up to `--max-full` workloads (default 300); workloads beyond the cap
  get port evidence only. A workload without an IPv4 address cannot be fetched this way.
- `get-traffic-flows` returns at most 500 grouped rows per call; a capped call is
  recorded in `inputs.truncated` and the readiness notes, and its counts are lower
  bounds. Flow batches hold 25 hrefs so a batch rarely hits the cap.
- Peer evidence needs labelled peers; on an unlabelled estate only the listener,
  traffic and os families fire, so app, env and loc stay unresolved until someone
  labels a seed set or the model pass adds knowledge.
- A hostname token shared by every labelled host (a domain suffix) maps to whatever
  single value that dimension has; the rule is true for the data and still worth a look
  before applying.
- Suggestions are evidence-backed proposals, not facts. The signals say what was seen;
  the user decides, and the plan writes nothing until told to.
