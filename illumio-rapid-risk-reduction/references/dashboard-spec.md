# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the other Illumio dashboard skills: light mode, Illumio palette, DM
Sans, pill tabs, inline styles, every number embedded as a constant. It
shows the plan's numbers and nothing the plan does not have.

`scripts/triage.py` writes `dashboard.jsx` itself: it takes
`dashboard-example.jsx` next to this file as the template and replaces
the block between `// ==== DATA ====` and `// ==== END DATA ====` with
the plan's data. The example therefore doubles as a worked rendering
(its data is the script's synthetic fixture) and as the template. Do not
hand-build the dashboard from prose; if the template is missing, say so
and ship the plan and report without it.

## Conventions shared with the other dashboards

- React with hooks, one default export, inline `style={{}}` only, no
  external calls, DM Sans via a `<link>` in the component body, small
  inline SVGs instead of a chart library.
- Palette `C` (green `#00C48C`, teal `#00B4D8`, navy `#1A1F36`, orange
  `#FF6B35`, red `#E63946`, amber `#FEF3C7`/`#92400E`, greys).
- **Colour carries meaning only.** Section strips are grey. KPI top
  borders are coloured only when the KPI is a risk and above zero. A
  colour key sits by the tab bar on every tab, and every section that
  uses colour ends with a `Legend` naming the colours used there. The
  legend texts live in one `LEGEND` constant.

## Colour mapping

| Meaning | Colour |
| --- | --- |
| Block today (deny or override deny, ease 4 or more) | red |
| This week (ringfence, or deny after review) | orange |
| Watch, isolate on demand: nothing drafted | grey |
| allowed connections (an allow rule admits them; the rule would stop them) | green |
| potentially blocked (no allow rule covers them) | orange |
| blocked (already stopped; the rule makes it stick) | red |
| spike bucket in the baseline | red outline; 3x-median threshold a red dashed line |
| runbook steps: the override deny step | red bold text; the provision step navy bold |

The decision bar uses green, orange and red for allowed, potentially
blocked and blocked: the same mapping as illumio-unknown-endpoints.

## Data constants

```javascript
const scope = { date, windowStart, windowEnd, windowDays, productionEnvs: [], crownJewels: ["pay (prod)"],
                crownJewelsSource, rulesetName, lowerBounds: [], missingInputs: [], policyVersion };
const kpis = { exposures, blockToday, thisWeek, runbooks, watch, maxScore, allowedWouldStop, pbWouldStop,
               unknownAdminSources, envCrossings, bridges };
const lines = [ { id, cls: "X1"|"X2"|"X4"|"X5"|"X4+X5", kind: "override_deny"|"deny"|"ringfence",
                  bucket: "today"|"week", score, blast, ease, title, radius,
                  wouldHaveBlocked: { allowed, potentiallyBlocked, blocked }, evidence: [], rollback,
                  detail, recommendation, action, admittingRules: [] } ];
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
`series` with `by_policy_decision` split into `pb` and `blocked`.

## Banner

- **RED** "N exposures to block today" when the today bucket is not empty
- **AMBER** "N to fence or review this week" when only the week bucket has lines
- **GREEN** "Nothing to draft" otherwise

Subtitle: window, production environments, crown jewels, the draft
ruleset name, lower-bound and missing-input notes, "nothing is
provisioned".

## Tabs

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
banner is green then. No tab may throw on empty arrays or a null
`worst`.

## Output

Save as `/mnt/user-data/outputs/illumio_rapid_risk_reduction_<YYYY-MM-DD>.jsx`
when that directory exists, else next to the plan, and present the file.
It renders directly in Claude's UI.

## Checklist

- [ ] Banner colour follows the buckets (red when today is non-empty)
- [ ] Every KPI equals the matching number in plan.md and report.md
- [ ] Every table row is a plan line with the same score, ease and would-have-blocked
- [ ] Ringfence rows say "selective ringfence" and their call plan carries `deny_consumer: "any"`
- [ ] Runbooks end in provision-policy and show the undo
- [ ] The Call plans tab says nothing was executed
- [ ] The spike caveat appears verbatim when present and no spike is drawn then
- [ ] All tabs render with empty data
- [ ] Colour key on every tab, grey strips, a legend in every coloured section
