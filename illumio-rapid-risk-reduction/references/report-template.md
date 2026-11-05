# Rapid risk reduction plan: one page

Keep it to one page. Every line names its evidence rows, its blast radius,
what it would have blocked in the window, and its rollback. Nothing in it
has been created or provisioned; the call plans are in the appendix,
every block marked `DO_NOT_CALL`.

## 0. Header

`Rapid risk reduction plan, <date>: <window start> to <window end>`

Opening lines, one each: production environments assumed; crown-jewel
apps (given, defaulted to the top production bridges, or on a flat
network to the top production apps on the risk map); the PCE queries
used and whether any hit its cap ("counts on X1 are lower bounds: the
Explorer cap was hit"), the span the admin-port map really covers when
it was capped, the unknown-endpoint coverage (`returned` of
`unknown_endpoints`), the lateral-movement window when it was shorter
than the plan's; the **labelling readiness** verdict with the unlabelled
count and what sits outside every scoped fix; the draft ruleset name,
`RRR-<date>`, and the sentence "Nothing below is provisioned. Every rule
is a draft to review; rollback is deleting it from the draft."

Then one line of totals: "`<n>` exposures: `<a>` to block today, `<b>` to
fence this week, `<k>` isolation runbooks, `<w>` to watch."

Then the map line: "Where the risk sits: `<top three apps>`; largest
crossing `<from>` to `<to>`, `<n>` allowed connections; `<d>` override
denies not showing in traffic." It is the same `risk_map` block the
report and the dashboard read, so the three cannot disagree.

## 1. Block today

One line per rule, ordered by score:

`<score> | <X#> <what> | blast radius <B> (<n> workloads/apps) | would have blocked <allowed>/<pb>/<blocked> connections (allowed/potentially blocked/blocked); <m> of the allowed are admitted by no draft rule | evidence: <rows> | rollback: delete the draft rule`

For X1 name the sources (IP, FQDN when known, the admin ports), say
whether any reached an enforced workload (`allowed_into_enforced`), and
that the rule is an **override deny** on purpose; only public sources
land here, an internal one is always "this week: identify first". For
X2 name the environment pair, the admin ports seen, the app pairs
behind it and, when the ports include Kerberos, LDAP or SMB, the
directory servers and the carve-out.

## 2. This week: fence, or deny after review

Same line shape. For a ringfence say: the app, why (bridge with
`reachable_apps` N, or visibility-mode with blocked inbound), the inbound
remote apps the allow list will carry and how many of them are already
allowed, and that unlabelled or IP-list sources get no allow rule and
will hit the deny. For a deny that landed here because an allow rule
admits most of the traffic, say how many allowed connections would stop
and which rules or IP list admit them today; the user confirms before
provisioning.

## 3. Isolate on demand

One paragraph per crown-jewel app: the runbook name, the trigger ("run
only on a confirmed incident"), the steps as tool calls in order, the
effect ("all traffic to and from the app stops, including the allows"),
and the undo. No score; these are not drafted.

## 4. Watch

X3 and X6 lines, one each, with the evidence and the control that
covers them ("the X1 override deny covers 3389; 443 from this address
stays open through list `Partners`").

## 5. Baseline

"Blocked and potentially blocked flows per day over the window: median
`<m>`, total `<t>`." Then the worst spike with its multiple, or the
caveat verbatim. Then the review sentence: "Re-run the timeline 7 days
after provisioning; blocked should rise by about `<sum>` connections per
window and nothing else should move."

## Appendix: call plans (DO_NOT_CALL)

In apply order, each as a fenced JSON block with `"DO_NOT_CALL": "draft
for review"` as its first key:

1. `create-iplist` for the X1 sources, one list per group: public
   sources nothing admits (`RRR-unknown-admin-sources-<date>`), public
   sources an allow rule admits (`-review`), internal sources to
   identify first (`-internal-review`), public sources already on a
   named list (`-listed-review`, with the rules naming that list)
2. `create-ruleset` `RRR-<date>` (unscoped, `scopes: []`)
3. `create-deny-rule` per X1 group and X2 line, `ruleset_name:
   "RRR-<date>"`; an X2 block carrying directory ports has a
   `carve_out` note with the allow to place above it
4. `create-ringfence` per X4 and X5 line: the `dry_run: true` block is
   the user's preview call (never this skill's), then the same call with
   `dry_run: false`, `selective: true`, `deny_consumer: "any"`
5. the isolation runbooks, each a numbered list of calls ending in
   `provision-policy`, with the undo

Close the appendix with: "After the user provisions anything, re-run
this skill with the same window; lines whose rule is now active should
show their traffic as `blocked`."

## Colour

The plan is text. If it is rendered as a document with status colours
(a .docx through the docx skill), the only mapping is: red = Block today,
amber = This week, grey = Watch and Isolate on demand; nothing else is
coloured. Every table that uses colour ends with a legend naming each
colour where it is used, and decorative colour is one neutral grey.
