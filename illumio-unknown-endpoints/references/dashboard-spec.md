# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the illumio-security-dashboard and illumio-daily-assessment artifacts:
light mode, Illumio palette, DM Sans, pill tabs, inline styles, all data
embedded as constants. It shows the same numbers as the written report; it
never computes a finding the report does not have.

`dashboard-example.jsx` next to this file is a working rendering of this
spec with synthetic data, checked tab by tab in a browser. Start from it:
keep the components, replace the block between `// ==== DATA ====` and
`// ==== END DATA ====` with the report's data, set `deepDive` to `null`
when Step 7 did not run.

## Technology

- React with hooks (`useState`, `useMemo`); default export one component
- Inline `style={{}}` objects only: no Tailwind, no CSS modules, no
  separate stylesheet
- No external calls; every number comes from `const` data at the top of
  the file
- Google Fonts `DM Sans` (weights 400 to 800) loaded with a `<link>` in the
  component body
- No D3; the charts are small inline SVGs

## Palette and status colours

```javascript
const C = {
  green: "#00C48C", greenLight: "#E8FAF3", greenDark: "#00A876",
  teal: "#00B4D8", tealLight: "#E5F7FB",
  navy: "#1A1F36",
  orange: "#FF6B35", orangeLight: "#FFF3ED",
  red: "#E63946", redLight: "#FDE8EA",
  amber: "#FEF3C7", amberDark: "#92400E",
  gray50: "#F9FAFB", gray100: "#F3F4F6", gray200: "#E5E7EB", gray300: "#D1D5DB",
  gray400: "#9CA3AF", gray500: "#6B7280", gray700: "#374151", white: "#FFFFFF",
};
```

Severity and policy mapping, used everywhere (badges, row tints, bars):

| Meaning | Background | Text |
| --- | --- | --- |
| high finding, blocked | `red` | white |
| medium finding, potentially blocked | `orange` | white |
| low finding | `amber` | `amberDark` |
| allowed, known, ok | `green` | white |
| info, unknown class | `teal` | white |

Address class chips: private `tealLight`/`navy`, public `orangeLight`/
`orange`, noise `gray100`/`gray500`.

**Colour carries meaning only.** A viewer asked what an orange section
strip meant against a black one; the answer was "nothing", which is a
defect. Rules:

- Section heading strips are all `gray300`. No per-section colour.
- A KPI card's top border is `red` or `orange` only when the KPI is a risk
  (inside managed subnets, allowed into enforced, scanners, public
  sources) **and** its value is above zero; otherwise `gray300`.
- Subnet bars are coloured by the worst finding severity among that
  subnet's unknown hosts.
- Timeline bars are stacked by policy decision in the policy colours.
- A **colour key** sits next to the tab bar on every tab: high finding /
  blocked, medium / potentially blocked, low, allowed / ok, info, and the
  sentence "grey strips and borders mean nothing".
- **Every section that uses colour ends with a `Legend`** listing exactly
  the colours used in that section and what each means, with a swatch of
  the same kind (fill, coloured text, outline, dashed line). Required
  legends:
  - Overview: severity bar colours; KPI top-border rule
  - Findings: card border and badge = severity; address class chips
  - Unknown sources / destinations: row tints; port in red bold = admin
    port, black = other port; policy bar segments and the "partial" tag;
    class chips; finding badge colour = severity
  - Subnets: bar colour = worst finding in the subnet, bar length = unknown
    host count, click to list
  - Suggestions: kind badge colours
  - Deep dive: stacked policy colours, spike outline, 3x-median dashed line;
    policy badges on the peer table
  A viewer must never have to guess what a colour, a bold or a tint means.

## Data constants

Build these from the report, in this order, at the top of the file:

```javascript
const scope = { pce, windowStart, windowEnd, days, direction, scopeLabels,
                queries, inventoryTruncated, summaryTruncated, scanCapped,
                generatedAt };
const summaryKPIs = { unknownSources, unknownDestinations, insideManagedSubnet,
                      publicSources, allowedIntoEnforced, scanners,
                      coveredByNamedList, noiseEndpoints,
                      unlabelledWorkloads, connectionsUnknown,
                      high, medium, low };
const findings = [ { id: "U2", title, severity: "high"|"medium"|"low",
                     endpoint, direction: "source"|"destination",
                     numbers: "37 workloads, 212 ports, 96% blocked",
                     detail, suggestionId } ];
const unknownSources = [ { ip, fqdn, addressClass, ipLists: [], neighbourhood:
                           { prefix, managedCount } | null, peerApps: ["shop (prod)"],
                           peerWorkloads: null | n, ports: [{ port, proto, admin }],
                           policy: { allowed, potentiallyBlocked, blocked, partial },
                           connections, shapes: ["scanner"], findings: ["U1","U2"] } ];
const unknownDestinations = [ /* as sources plus */ { processes: [], provider,
                               providerConfidence } ];
const collapsedRanges = [ { label, port, proto, policy, connections } ];
const subnets = [ { prefix, managedCount, unmanagedCount, unknownCount,
                    unknownIps: [] } ];
const suggestions = [ { id, kind: "create-workload"|"create-iplist"|
                        "create-deny-rule"|"ven"|"narrow-rule", title,
                        findings: ["U1"], callPlan: "..." | null } ];
const deepDive = null | { ip, direction, bucket, effectiveBucket, resolutionNote,
                          series: [{ bucketStart, flows, connections,
                                     byPolicy: { allowed, potentially_blocked, blocked } }],
                          spikes: { median, threshold, worst: { bucketStart, multiple } | null,
                                    caveat },
                          peers: [{ peer, port, proto, policy, connections, process }] };
```

Peer apps are always the `app (env)` tuple; never an app without its env.

## Health banner

One full-width banner at the top of every tab:

- **RED "Action required"** when any finding is high
- **AMBER "Attention needed"** when the worst finding is medium
- **GREEN "No unknown endpoints of concern"** when every finding is low or
  there are none

Subtitle: the scope line in one sentence (window, direction, query count,
truncation flags). Thresholds live in one function so they are easy to
change.

## Tabs

Pill-style tab bar with six tabs; a seventh, **Deep dive**, appears only
when `deepDive` is not null.

1. **Overview**: banner; KPI row of four (Unknown sources, Unknown
   destinations, Inside managed subnets, Allowed into enforced); second row
   of four (Scanners, Public sources, Covered by named IP list, Noise
   endpoints); a severity split bar (high / medium / low counts); **Top
   issues**, the five highest-ranked findings with severity badge, endpoint
   and the numbers sentence.
2. **Findings**: filter chips by severity and by finding id; one card per
   finding: severity badge, id and title, endpoint with class chip, numbers,
   detail, link to its suggestion. Ordered as the report: high first, then
   by connections.
3. **Unknown sources**: search box; chips for address class, shape, "in a
   named IP list", "inside managed subnet"; table with Address, FQDN,
   Class, IP list, Neighbourhood (`10.1.5.0/24 · 12 managed`), Peer apps,
   Ports (admin ports bold, red), Policy (a three-segment inline bar
   allowed / potentially blocked / blocked, with counts on hover and a
   "partial" tag when the mix is unverified), Connections, Shape chips,
   Findings. Sorted by connections descending; rows with a high finding
   tinted `redLight`, medium `orangeLight`. Over 50 rows shows 50 and "and N
   more".
4. **Unknown destinations**: same table plus Processes and Provider
   columns; below it a **Collapsed ranges** list for IP-list-named summary
   rows, labelled "ranges, not hosts, not in the counts".
5. **Subnets**: horizontal bars, one per managed prefix that has unknown
   hosts, bar length = unknown count, label `prefix · N managed · M
   unmanaged · K unknown`, sorted by unknown count; clicking a bar lists its
   unknown addresses. This is the "where are the inventory gaps" view.
6. **Suggestions**: heading "Suggested objects (not created)"; one card per
   suggestion with kind badge, title, the findings it answers, and the call
   plan in a monospace block when present. A fixed note: nothing on this
   tab has been executed.
7. **Deep dive** (conditional): header with the endpoint and direction;
   bucket and `effectiveBucket` side by side, `resolutionNote` quoted when
   present; a bar chart of the series (stacked by policy decision when
   available), spike buckets outlined in red, the worst spike labelled
   "7.2x median" and the caveat shown verbatim when present; the peer x
   port x policy table below.

Appendix line in the Overview footer: noise counts by class, unlabelled
workload counts, and the method sentence from the report.

## Components

Build these inside the file: `Badge` (`label, color, bg`),
`SeverityBadge`, `ClassChip`, `KPICard` (label, value, subtitle, accent),
`StatusBanner`, `TabBar`, `PolicyBar` (three-segment inline bar),
`DataTable` (column definitions, search, sort, row tint callback, "and N
more" footer), `BarList` (horizontal bars with labels, colour per item),
`TimelineChart` (SVG bars with spike outlines), `Section` (heading with
the neutral strip), `ColourKey`, `Legend` and `Swatch`, with the legend
texts in one `LEGEND` constant so the same wording appears everywhere.

## Empty states

Every tab renders with zero rows: a one-line "No unknown <sources|
destinations> in this window" in `gray500`. The banner is green then. No
tab may throw on an empty array or a null `deepDive`.

## Output

Save as `/mnt/user-data/outputs/illumio_unknown_endpoints_<YYYY-MM-DD>.jsx`
when that directory exists, else in the working directory, and present the
file. The artifact renders directly in Claude's UI.

## Quality checklist

- [ ] Banner colour equals the worst finding severity in `findings`
- [ ] Every KPI equals the matching number in the written report
- [ ] Every row in the tables is also in the report's tables, and the counts match
- [ ] Peer apps are `app (env)` tuples everywhere, no separate env column
- [ ] Admin ports are bold and red in the Ports column
- [ ] Policy bars show "partial" wherever the report said the mix was unverified
- [ ] Collapsed ranges are outside the destinations table and outside every KPI
- [ ] The Suggestions tab says nothing was created
- [ ] The Deep dive tab exists only when `deepDive` is not null, and shows the spike caveat verbatim
- [ ] All tabs render with empty data
- [ ] No colour without meaning: section strips grey, KPI borders coloured only for non-zero risk values, colour key visible on every tab
- [ ] Every section that uses colour, bold or a tint ends with a legend that names each one
