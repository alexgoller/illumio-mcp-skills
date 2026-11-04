# Rapid risk reduction plan -- section skeleton

One page. Every line carries the evidence row it came from and the rollback.

## 0. Header

`Rapid risk reduction -- <PCE> -- <window>`

Opening sentence: "Over `<start>`-`<end>`, `<N>` exposures qualify to block
today, `<M>` apps to fence this week, `<K>` to prepare isolation for; nothing
in this plan is provisioned." Then the assumptions (production envs, crown
jewels, window) one per line, and "Counts are lower bounds: `<which pull>`
hit the PCE cap" if any did.

## 1. Block today

Opens with: "`<N>` deny rules, all on traffic that is already potentially
blocked or comes from addresses that are not workloads."

Table: # · what · from -> to · port/proto · connections (window) · enforced
workloads touched · score (blast x ease) · would have blocked (30 d) · call
plan file. Override-deny lines are marked; say why (unknown source on an
admin port into enforced workloads).

## 2. Fence this week

Opens with: "`<M>` selective ringfences, ranked by the lateral-movement paths
they remove."

Table: app · env · bridge / articulation · inbound peer apps · of which
potentially blocked · workloads · enforcement mode today · call plan file.
Note that `dry_run: true` in the plan previews the allow-list the ringfence
would create; the deny rule is what makes it bite in selective mode.

## 3. Isolate on demand

One runbook per critical app: the override-deny calls in order, the blast
radius (what stops working), and the rollback. Marked "incident use only".

## 4. Questions, not rules

Identity findings and anything the data cannot settle: shared credentials,
wide interactive reach, unknown sources that look like a shared service.

## 5. Semantics the reader must hold

Four lines: override deny beats every allow and is for incidents; a selective
ringfence enforces through its deny rule, only in selective mode; deny rules
are enforced on the consumer (source) side, so `deny_consumer: any` affects
only the destination workloads; nothing here is provisioned until
`provision-policy` is called by a person.

## 6. Seven-day review

What to re-run (steps 2-5 against draft policy, the blocked-flow timeline)
and the numbers to compare against: today's connections per line, and the
timeline baseline.
