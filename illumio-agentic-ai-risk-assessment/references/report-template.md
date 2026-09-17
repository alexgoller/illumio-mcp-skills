# Report template

Ten sections, this order. Each section opens with its point in one sentence.
Never open with "this section describes". Every workload shown carries its
defining labels (see SKILL.md, Label handling). Counts come from the merged
flow table and are re-checked in the verification task before publishing.

Placeholders in `{braces}` are filled from the data. Delete rows and
sub-bullets that have no evidence rather than writing "none".

---

## 1. Executive summary

`{Overall rating}` risk: `{N}` of `{M}` managed endpoints run agentic AI
clients that reach `{K}` internal applications, including `{regulated apps}`.

- **Finding 1** `{the single worst path, with hosts and port}`
- **Finding 2** `{the control that was assumed to work and does not}`
- **Finding 3** `{the exposure a CISO would not expect, e.g. unmanaged host or contractor VDIs}`

One paragraph on the shape of the fix: which allow rules first, which denies
next, which enforcement move last, and what it closes.

## 2. Scope and method

Assessed `{population label}` workloads (`{count}`: `{VDI count}` VDI,
`{laptop count}` laptop) over `{start}` to `{end}`, the full window the PCE
held.

- **Agent definition**: unambiguous families from the catalog (`{list}`).
  Ambiguous hosts (`{list}`) are tabulated in section 3 but not scored.
- **Unattributed flows**: `{n}` rows (`{pct}` percent) had no process; counted
  as a coverage gap.
- **Defining labels used**: `{app, env, role, loc, bu, compliance, ...}`.
  Dropped: `{quarantine, DFIRBubble, ...}` because they steer policy, not
  identity.
- **Query method**: Explorer via `get-traffic-flows`, grouped by process,
  sliced by `{source label}` x `{destination label}` to stay under the 500-flow
  cap; `{n}` slices, largest `{rows}` rows.
- **Assumptions**: `{report format, window, scope override}`.
- **Diagram**: `{link to Sankey artifact}`.

## 3. Inventory

`{N}` endpoints run at least one agent; `{n}` run two or more.

| Endpoint | Kind | Labels | User | Agents | Apps reached | Regulated |
| --- | --- | --- | --- | --- | --- | --- |
| `{hostname}` | VDI / laptop | `{role=..., loc=..., os=...}` | `{user}` | `{Cursor, Claude}` | `{n}` | yes / no |

Possible agent hosts (not scored):

| Process | Endpoints | Flows | Connections |
| --- | --- | --- | --- |

## 4. Reach into internal systems

Agents on endpoints reach `{K}` applications on `{H}` hosts; `{app}` receives
the most connections.

`{Stacked bar: connections by app (x) and agent (colour), fixed agent order}`

Then one bullet per application family, naming the ports and whether they are
the app's expected service:

- **`{app}`** (`{bu}`, `{compliance}`): `{agents}` from `{n}` endpoints on
  `{ports}`. `{Why the ports matter.}`

Call out explicitly:

- **Regulated reach**: `{endpoints}` reach `{compliance-labelled hosts}`.
- **Administrative reach**: `{endpoints}` reach `{dc / jumpbox}` on `{ports}`.
- **Odd ports**: `{host}:{port}` from `{agent}`, not a service `{app}` offers.
- **Personal data**: `{endpoints}` reach `{hr / crm / payroll}`.

## 5. External egress

Agent processes sent `{total}` connections to `{n}` external destinations,
`{m}` of them attributable to model vendors.

| Process | Destination | Port | Connections | Likely provider | Policy today |
| --- | --- | --- | --- | --- | --- |

Unmanaged internal hosts reached by agents (RFC1918, not in the workload map):

| Address | Reached by | Ports | Also seen as source of blocked traffic |
| --- | --- | --- | --- |

## 6. Policy posture

All `{n}` workloads are in `{mode}` enforcement, so "allowed" in Explorer
means no deny rule matched, not that an allow rule exists.

| Ruleset | Scope | Consumers | Providers | Services | What it actually does |
| --- | --- | --- | --- | --- | --- |

Draft versus active: `{n}` ruleset changes pending; observed state is
`{live / partly unprovisioned}`.

Three structural gaps:

1. `{e.g. no process-qualified services on any endpoint-facing rule}`
2. `{e.g. any/any allow inside app scopes}`
3. `{e.g. no deny from endpoints to compliance zones}`

## 7. Risk register

| ID | Risk | Assets | Evidence | L | I | Score | Closed by |
| --- | --- | --- | --- | --- | --- | --- | --- |

Overall: `{High / Medium / Low}` because `{top line and score}`.

## 8. Regulatory exposure

Practitioner's read, not legal advice.

| Regime | Requirement | Evidence from this assessment |
| --- | --- | --- |

## 9. Recommendations

Allow rules before denies, denies before any enforcement move.

**Week 1**

- **REC-1** `{Illumio construct}`: `{what}`. Closes `{R-ids}`.

**Weeks 2 to 4**

- **REC-n** ...

**Quarter**

- **REC-n** ...

Each item names the construct: deny rule, process-qualified service, IP list,
label change, enforcement move, and the labels it uses (all of which exist in
the org).

## 10. Appendix

**A. Flow table** (one row per endpoint, agent, destination, port)

| Endpoint | Labels | Agent | Destination | Dest labels | Port | Proto | Connections | Policy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

**B. Query notes**: slices run, rows per slice, any slice at the 500 cap,
tool versions, time of run.
