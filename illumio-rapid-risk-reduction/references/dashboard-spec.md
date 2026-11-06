# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the other Illumio dashboard skills: light mode, the Illumio Field
palette, Montserrat, square cards, text tabs with an Illumio Orange
underline, inline styles, every number embedded as a constant. It shows
the plan's numbers and nothing the plan does not have.

`scripts/triage.py` writes `dashboard.jsx` itself: it takes
`dashboard-example.jsx` next to this file as the template and replaces
the block between `// ==== DATA ====` and `// ==== END DATA ====` with
the plan's data. The example therefore doubles as a worked rendering
(its data is the script's synthetic fixture) and as the template. Do not
hand-build the dashboard from prose; if the template is missing, say so
and ship the plan and report without it.

## Conventions shared with the other dashboards

- React with hooks, one default export, inline `style={{}}` only, no
  external calls, Montserrat (300, 400, 500, 600) via a `<link>` in the
  component body, small inline SVGs instead of a chart library.
- Palette `C` and `FONT` as in the Illumio Field section below: page
  ground Zero Trust Tan, white square cards with 1px `C.gray200` borders,
  table header rows Server Slate with white text, banding `#EAEBEB`,
  page title in weight 300, section titles and eyebrows Server Slate
  SemiBold caps, badges rounded at most 2px, no pills; the active tab
  carries a 2px Illumio Orange underline and Illumio Orange appears
  nowhere else.
- **Colour carries meaning only.** Section strips are grey. KPI top
  borders are coloured only when the KPI is a risk and above zero. A
  colour key sits by the tab bar on every tab, and every section that
  uses colour ends with a `Legend` naming the colours used there. The
  legend texts live in one `LEGEND` constant.

### Illumio Field

Every rendered output of every skill in this repo follows the Illumio Field
design system, which implements the visual identity of the Illumio Brand
Guidelines (November 2024). Visual identity only; no brand messaging.

- **Grounds.** Page on Zero Trust Tan `#F7F4EE`; cards, panels and tables
  white; square corners (0, at most 2px on small tags); 1px borders
  `#D6D7D7`; table banding `#EAEBEB`.
- **Text.** Server Slate `#313638` for headings and primary text, `#464A4C`
  for body, `#64686A` for captions and labels, `#6F7274` the lightest
  colour for small text on white. Page title in weight 300 (Light);
  eyebrows and section labels in Server Slate SemiBold caps; emphasis
  SemiBold.
- **Font.** `"FK Grotesk", Montserrat, Arial, sans-serif`; load Montserrat
  300, 400, 500 and 600 from Google Fonts.
- **Accent.** Illumio Orange `#FF5500` is the one brand accent: the active
  tab underline, the rule under the page title, a "today" or "new" marker.
  As text only at 24px and up or bold on white; never on tan (contrast
  1.1); never as a status colour.
- **Status colours**, for meaning only, each with a legend where it
  appears: Risk Red `#BE122F` critical, failed, blocked; Safeguard Green
  `#166644` pass, allowed, enforced, healthy; Circuit Gold `#F97607`
  warning, high; Gold `#FFA22F` medium; System Cyan `#2D454C` info,
  selective, in progress. Red, green and cyan may be text on white; gold
  is a fill, swatch, border or bar with slate text, never small text.
  Row and badge tints are the status colour at 10% over white
  (`rgba(190,18,47,0.10)` and so on), never a separate hue.
- **Tables.** Server Slate header row with white text, light banding,
  hairline borders.
- **Decoration.** None in colour: section strips, dividers and inactive
  elements are slate greys.

## Colour mapping

| Meaning | Colour |
| --- | --- |
| Block today (deny or override deny, ease 4 or more) | Risk Red |
| This week (ringfence, deny after review, internal source to identify) | Circuit Gold (a fill with slate text, never gold text) |
| Watch, isolate on demand: nothing drafted | grey |
| allowed by a rule (the rule would stop it) | Safeguard Green |
| allowed, no provisioned rule, on selective enforcement (a deny would catch it) | System Cyan |
| drafted, waiting for provisioning (policy tile, `DRAFTED` badge) | System Cyan |
| provisioned deny names it, reported allowed (policy tile, `PROVISIONED, REPORTED ALLOWED` badge) | Risk Red |
| nothing drafted (policy tile) | Circuit Gold |
| potentially blocked (no allow rule covers them) | Circuit Gold |
| blocked (already stopped; the rule makes it stick) | Risk Red |
| spike bucket in the baseline | Risk Red outline; 3x-median threshold a Risk Red dashed line |
| runbook steps: the override deny step | Risk Red bold text; the provision step System Cyan bold |
| labelling readiness badge | Risk Red NOT READY (label first), Circuit Gold PARTIAL, grey READY |
| Risk map KPI top border | Risk Red = override denies not showing, Circuit Gold = unmanaged admin-port sources, each only above zero |
| Risk map grid and environment matrix cells | one Server Slate tint in four steps: band 1 to 4 (percentile among the apps; square-root scale of allowed connections in the matrix); no tint = zero |

The decision bar uses Safeguard Green, System Cyan, Circuit Gold and
Risk Red for allowed by a rule, allowed with no rule, potentially
blocked and blocked; the first, third and fourth are the mapping of
illumio-unknown-endpoints. Drift and fix-first text carry no colour.
Illumio Orange is never a status colour; where the old amber pair was
used for a medium or watch tint, use `C.amberLight` with `C.text`.

## Data constants

```javascript
const scope = { date, windowStart, windowEnd, windowDays, lateralDays, adminSpan: { start, end, days },
                productionEnvs: [], crownJewels: ["pay (prod)"], crownJewelsSource, rulesetName,
                lowerBounds: [], missingInputs: [], policyVersion, headerNotes: [] };
const kpis = { exposures, blockToday, thisWeek, runbooks, watch, maxScore, allowedWouldStop, pbWouldStop,
               unknownAdminSources, envCrossings, bridges };
const riskMap = { takeaway,
                  readiness: { verdict: "ready"|"partial"|"not ready", workloads, labelled, unlabelled, withApp, withEnv,
                               labelColumns, notes: [], examples: [] },
                  headline: { workloads, fullEnforcement, selective, notEnforcing, unmanagedAdminSources,
                              unmanagedAdminInternal, unmanagedAdminPublic, appsInGraph, wideReachApps | null,
                              wideReachLowerBound, lateralDays, overrideDeniesNotShowing, overrideDeniesUnchecked },
                  apps: [ { app: "pos (PCI)", workloads, crownJewel, publicAdminSources,
                            values: { unmanagedInbound, unmanagedAdminSources, crossEnvConnections, crossEnvApps,
                                      wideReachAccounts, workloadsNotEnforcing },
                            bands: { /* same keys, 0 to 4 */ } } ],   // top 12, ranked
                  appsTotal, appsExcluded,
                  envMatrix: [ { from, to, allowed, potentiallyBlocked, blocked } ],
                  ruleDrift: [ { ruleset, shouldStop, allowed, basis, enforcedOn, updatedAt, changedInWindow } ],
                  draftActive: { available, pending },
                  policy: { view: "provisioned"|"draft", text, pending: { available, pending },
                            exposures: { total, provisioned, drafted, none },
                            delta: null | { rulesetsNew: [], rulesetsChanged: [], rulesetsRemoved: [], rulesetsUnchanged,
                                            rulesNew, rulesChanged, rulesRemoved, newByKind: { allow, deny, overrideDeny } } },
                  fixFirst: [], inputs: { summary, lateral, rulesets, identities, unknown } };
const lines = [ { id, cls: "X1"|"X2"|"X4"|"X5"|"X4+X5", kind: "override_deny"|"deny"|"ringfence",
                  bucket: "today"|"week", score, blast, ease, title, radius,
                  wouldHaveBlocked: { allowed, potentiallyBlocked, blocked, allowedNoRule }, evidence: [], rollback,
                  detail, recommendation, action, admittingRules: [],
                  state: "drafted"|"provisioned"|"none", cover: { provisioned: [], drafted: [] } } ];
const runbooks = [ { name, workloads, found, steps: [], effect, undo } ];
const watch = [ { cls: "X3"|"X6", title, detail, recommendation } ];
const baseline = { available, bucket, days, median, total, worst: { bucketStart, flows, multiple } | null,
                   caveat, truncated, threshold, spikeBuckets: [{ bucketStart }],
                   series: [{ bucketStart, flows, pb, blocked }] };
const callPlans = [ { for, tool, runbook, json } ];
```

Every value comes from `plan.json`: `lines` are the plan's lines in score
order, `wouldHaveBlocked` is `would_have_blocked`, `recommendation` and
`action` are the report's sentences, `baseline.series` is the timeline's
`series` with `by_policy_decision` split into `pb` and `blocked`. `riskMap`
is `plan.json["risk_map"]` with the keys camel-cased and the app list cut
to the top 12; its bands are shown as shading, never as a number, and
`risk_rank_score` is not on the page (it is not the plan score).

## Banner

- **RISK RED** "N exposures to block today" when the today bucket is not empty
- **CIRCUIT GOLD** (slate text) "N to fence or review this week" when only the week bucket has lines
- **SAFEGUARD GREEN** "Nothing to draft" otherwise

Subtitle: window, production environments, crown jewels, the policy
read ("provisioned only" or "provisioned and draft"), the draft ruleset
name, lower-bound and missing-input notes, "nothing is provisioned".

## Tabs

The tab bar opens on **Risk map**; the seven detail tabs stay behind
it. No second file.

0. **Risk map**, top to bottom: the one-sentence takeaway (generated);
   the **Readiness** strip (badge and the labelling counts, what sits
   outside every scoped fix); the **Policy** section: the policy line
   and, in the provisioned view, two tiles (exposures a provisioned deny
   names yet reports allowed, Risk Red when above zero; pending changes
   not read, grey), or in the draft view four tiles (drafted, System
   Cyan; provisioned but reported allowed, Risk Red; nothing drafted,
   Circuit Gold; pending changes, grey) and the delta table (rulesets and rules new,
   changed, removed); four KPIs (workloads in full enforcement
   of N, unmanaged admin-port sources with the internal and public split
   only when public exist, apps reaching most of the estate of N over
   the lateral window with a dash when there is no lateral result,
   override denies not showing with the unchecked count); the KPI-border
   legend; **Where the risk sits**: the top 12 apps as a shaded grid,
   one column per measure, crown jewels marked `CJ`, the footnote naming
   excluded unlabelled workloads and, only when they exist, the public
   admin sources and the apps they land on; **Traffic between
   environments**: the from/to matrix of allowed connections with a dot
   for none and the largest crossing in a sentence; **Rules not showing
   in traffic**: only when non-empty (or one grey sentence when no
   rulesets were saved), with the pending-changes count, the unchecked
   count and the neutral explanation; **Fix first**: the generated list
   and the sentence that nothing was changed on the PCE. Every section
   ends with a legend; the tab reads at about 400px (tables scroll
   inside their section).
1. **Overview**: six KPIs (exposures with a fix, block today, this week,
   isolation runbooks, allowed connections that would stop, watch); the
   KPI-border legend; exposures by score as horizontal bars coloured by
   bucket; the top five recommendations with bucket badges.
2. **Block today**: the line table (score, class, exposure, fix, blast
   radius with its reading, ease, would-have-blocked bar with counts);
   each row expands to recommendation, what we saw, evidence, admitting
   rules, rollback.
3. **This week**: the same table for the week bucket.
4. **Isolate on demand**: one card per runbook with its numbered steps,
   effect and undo; "not found, check the label values" when the app has
   no workloads in the inventory.
5. **Watch**: X3 and X6 cards with what was seen and the recommendation.
6. **Baseline**: the blocked and potentially blocked timeline, stacked,
   spike buckets outlined, the threshold dashed, the worst spike or the
   caveat verbatim, and the 7-day review sentence.
7. **Call plans**: every block in apply order, in monospace, with a
   `DO_NOT_CALL` badge; the parameter note.

## Empty states

Every tab renders with empty data: one grey sentence per section. The
banner is Safeguard Green then. No tab may throw on empty arrays or a null
`worst`. On the Risk map: no public source means the word "public"
appears nowhere on the tab; no drift hides the section; no crossings is
one grey sentence; a missing summary makes the grid and the matrix say
so; a missing lateral result shows a dash in the reach KPI; no
`high_risk_bridge_nodes` is normal on a flat network; fewer than 12 apps
show what exists; no identities make the accounts column zeros; no
labels at all turn the readiness badge Risk Red and the takeaway into the
readiness sentence.

## Output

Save as `/mnt/user-data/outputs/illumio_rapid_risk_reduction_<YYYY-MM-DD>.jsx`
when that directory exists, else next to the plan, and present the file.
It renders directly in Claude's UI.

## Checklist

- [ ] Banner colour follows the buckets (Risk Red when today is non-empty)
- [ ] Every KPI equals the matching number in plan.md and report.md
- [ ] Every table row is a plan line with the same score, ease and would-have-blocked
- [ ] Ringfence rows say "selective ringfence" and their call plan carries `deny_consumer: "any"`
- [ ] Runbooks end in provision-policy and show the undo
- [ ] The Call plans tab says nothing was executed
- [ ] The spike caveat appears verbatim when present and no spike is drawn then
- [ ] All tabs render with empty data
- [ ] Colour key on every tab, grey strips, a legend in every coloured section
- [ ] The Risk map tab is first and open by default; its headline, top apps, largest crossing and drift rows equal plan.md and report.md
- [ ] The readiness badge matches `risk_map.readiness.verdict` and the unlabelled count is named when above zero
- [ ] Bands are shading only; no rank score number on the page
- [ ] "public" appears nowhere on the Risk map tab when `unmanagedAdminPublic` is zero
- [ ] Drift rows say "reported allowed"; the explanation names the enforcing side's mode, the scope and the update time, never pending changes
- [ ] The Policy section names the view; its tiles equal the policy line in plan.md and report.md; in the draft view the delta table is present and a `DRAFTED` line's action says "provision"
- [ ] `DRAFTED` and `PROVISIONED, REPORTED ALLOWED` badges appear only on lines whose `state` says so, and the line-state legend sits under every table that shows them
- [ ] The fix-first list names only apps and hosts present in the evidence
