# Dashboard specification

The dashboard is a single-file React component (`.jsx`) in the same style
as the other skills' artifacts: light mode, Illumio Field (the palette
section below), Montserrat, text tabs with an orange underline, square
white cards on Zero Trust Tan, inline styles, all data embedded as
constants. It shows the same numbers as the written report; it
never computes a finding the report does not have.

`dashboard-example.jsx` next to this file is a working rendering of this
spec with synthetic data, checked tab by tab in a browser. Start from it:
keep the components, replace the block between `// ==== DATA ====` and
`// ==== END DATA ====` with the report's data, set `deepDive` to `null`
when Step 3 (the deep dive) did not run.

## Technology

- React with hooks (`useState`, `useMemo`); default export one component
- Inline `style={{}}` objects only: no Tailwind, no CSS modules, no
  separate stylesheet
- No external calls; every number comes from `const` data at the top of
  the file
- Google Fonts `Montserrat` (weights 300, 400, 500 and 600) loaded with a
  `<link>` in the component body; every `fontFamily` is the `FONT`
  constant, code and addresses stay in `ui-monospace, Menlo, monospace`
- No D3; the charts are small inline SVGs

## Palette and status colours

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

The component's constants, verbatim in every dashboard:

```javascript
const C = {
  accent: "#FF5500",          // Illumio Orange: active tab underline, title rule, today/new marker; never a status
  slate: "#313638",           // Server Slate: headings, primary text, table header rows
  text: "#464A4C",            // body text
  muted: "#64686A",           // captions, labels
  green: "#166644",           // Safeguard Green: pass, allowed, enforced, healthy
  greenLight: "rgba(22,102,68,0.10)",
  greenDark: "#11432F",
  teal: "#2D454C",            // System Cyan: info, selective, in progress
  tealLight: "rgba(45,69,76,0.10)",
  orange: "#F97607",          // Circuit Gold 110: warning, high (fills, swatches, bars; slate text on its tint)
  orangeLight: "rgba(249,118,7,0.10)",
  amber: "#FFA22F",           // Circuit Gold 100: medium
  amberLight: "rgba(255,162,47,0.12)",
  red: "#BE122F",             // Risk Red: critical, failed, blocked
  redLight: "rgba(190,18,47,0.10)",
  gray50: "#F7F4EE",          // page ground: Zero Trust Tan
  gray100: "#F5F5F5",         // subtle fills
  gray200: "#D6D7D7",         // borders
  gray300: "#C1C3C3",
  gray400: "#6F7274",         // muted text, minimum for small text on white
  gray500: "#64686A",         // secondary text
  gray700: "#464A4C",         // strong secondary text
  white: "#FFFFFF",
};
const FONT = '"FK Grotesk", Montserrat, Arial, sans-serif';
// <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
const BAND = "#EAEBEB";       // table banding
```

Severity and policy mapping, used everywhere (badges, row tints, bars):

| Meaning | Colour | Background | Text |
| --- | --- | --- | --- |
| high finding, blocked | Risk Red | `red` | white |
| medium finding, potentially blocked | Circuit Gold | `orange` | `slate` |
| low finding | Gold | `amber` | `slate` |
| allowed, known, ok | Safeguard Green | `green` | white |
| info, unknown class | System Cyan | `teal` | white |

Gold fills always carry slate text, and gold is never small text on its
own: a count next to a severity bar gets a swatch, not a coloured number;
notes and caveats sit on `amberLight` with a 4px `amber` left border.
Address class chips: private `tealLight`/`slate`, public `orangeLight`/
`slate` with a 1px `orange` border, noise `gray100`/`gray500`. Row tints
are `redLight` and `orangeLight`; rows without a tint alternate white and
`BAND`.

Illumio Orange (`accent`) appears exactly twice: the 2px underline under
the active tab and the short rule under the page title. It is never a
status colour and never text.

**Shapes and type.** Cards, tiles, tables, buttons, chips and inputs have
square corners (no `borderRadius`); `Badge` has `borderRadius: 2`; nothing
is a pill. Cards are white with a 1px `gray200` border on the `gray50`
(Zero Trust Tan) page; table header rows are `slate` with white uppercase
text; cell borders are 1px `gray200`. The page title is weight 300;
section titles, KPI labels (eyebrows, slate, caps) and emphasis are 600,
nothing heavier.

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
  blocked (Risk Red), medium / potentially blocked (Circuit Gold), low
  (Gold), allowed / ok (Safeguard Green), info (System Cyan), and the
  sentence "grey strips, borders and banding mean nothing; the orange tab
  underline is the brand accent, not a status".
- **Every section that uses colour ends with a `Legend`** listing exactly
  the colours used in that section and what each means, by its Illumio
  Field name, with a swatch of the same kind (fill, coloured text,
  outline, dashed line). Required legends:
  - Overview: severity bar colours; KPI top-border rule
  - Findings: card border and badge = severity; address class chips
  - Unknown sources / destinations: row tints and banding; port in Risk
    Red bold = admin port, slate = other port; policy bar segments and the
    "partial" tag; class chips; finding badge colour = severity
  - Subnets: bar colour = worst finding in the subnet, bar length = unknown
    host count, click to list
  - Suggestions: kind badge colours
  - Deep dive: stacked policy colours, spike outline, 3x-median dashed line,
    the gold note panel; policy badges on the peer table
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

Field mapping from `find-unknown-endpoints`, via the report: `ip` stays
`ip`; `address_class` is `addressClass`; `ip_lists` is `ipLists`;
`neighbourhood.managed_workloads` is `neighbourhood.managedCount`;
`as_source` / `as_destination` `peer_apps` and `peer_workloads` are
`peerApps` and `peerWorkloads`; `ports[].admin` keeps its name; `policy`
keeps `allowed` and `blocked`, `potentially_blocked` becomes
`potentiallyBlocked`, and `partial` is true when `totals.flows_truncated`
was; `profile` is `shapes`; `likely_provider` and `provider_confidence` are
`provider` and `providerConfidence`. `collapsedRanges` is `[]`: the tool
keeps every destination as its own `ip`, so there are no IP-list-named
rows to collapse.

## Health banner

One full-width banner at the top of every tab:

- **Risk Red "Action required"**, white text, when any finding is high
- **Circuit Gold "Attention needed"**, slate text, when the worst finding
  is medium
- **Safeguard Green "No unknown endpoints of concern"**, white text, when
  every finding is low or there are none

Subtitle: the scope line in one sentence (window, direction, query count,
truncation flags). Thresholds live in one function so they are easy to
change.

## Tabs

Text tab bar with six tabs, the active tab underlined 2px in Illumio
Orange; a seventh, **Deep dive**, appears only when `deepDive` is not
null.

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
   Ports (admin ports bold, Risk Red), Policy (a three-segment inline bar
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

Build these inside the file: `Badge` (`label, color, bg, border`, the
only rounded element, 2px), `SeverityBadge`, `ClassChip`, `KPICard`
(label, value, subtitle, attention), `StatusBanner`, `TabBar` (text tabs,
orange underline on the active one), `PolicyBar` (three-segment inline
bar), `DataTable` (column definitions, search, sort, row tint callback,
slate header row, banding, "and N more" footer), `BarList` (horizontal
bars with labels, colour per item),
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
- [ ] Admin ports are bold and Risk Red in the Ports column
- [ ] Policy bars show "partial" wherever the report said the mix was unverified
- [ ] Collapsed ranges are outside the destinations table and outside every KPI
- [ ] The Suggestions tab says nothing was created
- [ ] The Deep dive tab exists only when `deepDive` is not null, and shows the spike caveat verbatim
- [ ] All tabs render with empty data
- [ ] No colour without meaning: section strips grey, KPI borders coloured only for non-zero risk values, colour key visible on every tab
- [ ] Every section that uses colour, bold or a tint ends with a legend that names each one by its Illumio Field name
- [ ] Illumio Field: tan page, white square cards, slate table header rows, Montserrat, orange only on the active tab underline and the title rule, gold never as small text
