# App profile — section skeleton

Keep it short. Every table: top 10 by connections, and the full count in the
caption. Every finding names the evidence row it came from.

## 0. Header

`<app labels> — profile for <window>, <policy_version> policy`

Opening sentence: "This profile covers `app=X, env=Y` over `<start>`–`<end>`,
read against `<draft|active>` policy; direction `<in|out|both>`."
Then the assumptions in one line each, and, if any traffic result was
truncated, the sentence "Traffic counts are lower bounds: the PCE cap was hit
on `<which>`."

## 1. Workloads

Opens with: "`<N>` workloads carry the app's labels: `<full>` in full
enforcement, `<selective>` selective, `<visibility>` visibility-only,
`<idle>` idle."

Table: hostname · role · enforcement_mode · ven_status · last heartbeat ·
health. Then "Stale VENs: `<n>`" with the list, or "no stale VENs".

## 2. Inbound traffic

Opens with: "`<N>` peer apps reach the app; `<M>` of those have blocked or
potentially blocked flows."

Table from `app_to_app` (from · decision · connections). Then the blocked
detail table (peer host → app host · port/proto · decision · connections).

## 3. Outbound traffic

Same shape as 2, from the app's point of view.

## 4. Intra-app traffic

One table, listed once. Say if there is none.

## 5. Policy

Opens with: "`<policy_version>` policy has `<n>` rulesets scoped to the app
and `<m>` rules elsewhere that name it."

List scoped rulesets (name · enabled · rule count). Then referencing rules
(ruleset · rule_type · consumers · providers · services), rendered from the
data the tool returns, never from hrefs alone. Note pending changes if
`compare-draft-active` was run.

## 6. Blocked flows over time

Opens with the bucket actually used: "Blocked flows per `<bucket>` over the
window (`effective_bucket` `<x>`)."

Then either the worst spike -- "Tue 14:00–15:00, 7.2× the median" -- or the
caveat verbatim. Never both. Give the series as a compact list or a sparkline
of counts.

## 7. Findings

In this order, each as one line plus its evidence:

1. workloads in visibility mode
2. stale VENs
3. blocked services with no rule
4. blocked-flow spikes (only without a caveat)
5. candidate allow rules -- "suggested, not created" in the heading. One per
   blocked peer app × service, consumer named by labels where the peer is
   labelled, else by address with the note that it needs an IP list. Include
   the `create-ruleset` call plan as a fenced block the user can copy.

Close with one sentence on readiness for enforcement, derived from 1 and 3:
nothing in visibility mode and no uncovered blocked services means ready;
otherwise say what is in the way.
