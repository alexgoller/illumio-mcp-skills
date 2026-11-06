---
name: illumio-security-dashboard
description: "Generate an interactive React security assessment dashboard for an Illumio PCE environment. Use this skill whenever the user asks for an interactive, visual, or live security dashboard, security posture visualization, interactive network graph of their Illumio environment, or a React-based PCE assessment. Also trigger when the user says: interactive assessment, security dashboard, visual security report, network topology view, lateral movement visualization, or wants a browser-based view of their PCE security status. Produces a single-file React (.jsx) artifact with D3 force-directed network graph, tabbed navigation, compliance cards, enforcement charts, and filterable tables — all populated from live PCE data. Not for a Word assessment report (that is illumio-pce-assessment). Requires the illumio-mcp MCP server to be connected."
---

# Illumio Interactive Security Dashboard

Generate a single-file React component (.jsx) that provides an interactive security assessment of an Illumio PCE environment. The dashboard is rendered as a Claude artifact and uses D3 for network graph visualization.

## Prerequisites

- The **illumio-mcp** MCP server must be connected (verify with `check-pce-connection`)
- The **frontend-design skill** (`/mnt/skills/public/frontend-design/SKILL.md`) should be read for design quality guidance

## Data Collection

Collect all data from the PCE before generating the artifact. Every MCP call below is required — the dashboard needs all of these data dimensions.

### Required MCP Calls

Run these in order. When results are too large for context, parse with `bash_tool` + `python3`.

```
1. illumio-mcp:check-pce-connection
2. illumio-mcp:get-workload-enforcement-status
3. illumio-mcp:get-labels                        (max_results: 500)
4. illumio-mcp:get-rulesets                       (max_results: 100)
5. illumio-mcp:identify-infrastructure-services   (lookback_days: 90, top_n: 20)
6. illumio-mcp:detect-lateral-movement-paths      (lookback_days: 30, max_hops: 4)
7. illumio-mcp:find-unmanaged-traffic             (lookback_days: 30, min_connections: 10, top_n: 30)
8. illumio-mcp:compliance-check                   (framework: "general", lookback_days: 30)
```

### Custom Policy Validation

If the user provides rules of thumb (e.g., "RDP/SSH must go through jumphost"), query the relevant traffic:

```
illumio-mcp:get-traffic-flows-summary
  start_date: <90 days ago>
  end_date: <today>
  include_services: [{"port": 3389, "proto": "tcp"}, {"port": 22, "proto": "tcp"}]
```

Also query potentially blocked traffic to identify what would break during enforcement:

```
illumio-mcp:get-traffic-flows-summary
  start_date: <90 days ago>
  end_date: <today>
  policy_decisions: ["potentially_blocked", "blocked"]
```

### Additional port-specific queries

For high-risk port analysis, also query dangerous protocols:

```
illumio-mcp:get-traffic-flows-summary
  start_date: <90 days ago>
  end_date: <today>
  include_services: [{"port": 23, "proto": "tcp"}, {"port": 135, "proto": "tcp"}, {"port": 445, "proto": "tcp"}]
```

## Data Transformation

Transform the raw PCE data into JavaScript data structures that the React component consumes. All data is embedded as `const` declarations at the top of the .jsx file — the artifact is fully self-contained with no external API calls.

### Critical: Always Use the app (env) Tuple

Applications are only unique when identified by their `app` AND `env` labels together. The same app name can exist in multiple environments (e.g., `ordering` in both `prod` and `dev`, `pos` in both `staging` and `pci`). Every place in the dashboard that displays an application identity must show the tuple:

- **Network graph node labels**: `ordering (prod)`, not `ordering`
- **Tooltips**: Title as `app (env)`, do not show env as a separate line
- **Flow chips / connection tags**: `→ ordering (prod) :5432`
- **Lateral movement bars**: `laptop (users)` — no separate env column
- **Tables**: Merged "Application (Env)" column, e.g., `ordering` with `(prod)` in lighter gray
- **Violations / traffic tables**: Source and destination as `app (env)` tuples
- **Graph node IDs**: Use `app|env` format internally (e.g., `"ordering|prod"`)

### Data Structures to Build

From the collected data, construct these JavaScript objects:

1. **`enforcementData`** — `{ visibility_only: N, selective: N, full: N }` from enforcement status
2. **`complianceFindings`** — Array of `{ id, name, detail, status }` from compliance check
3. **`appGroups`** — Array of `{ app, env, count, mode, risk }` from enforcement status, sorted by workload count descending. Risk is derived: `visibility_only` in prod = "high", `mixed` = "critical", `full` = "low", `selective` = "medium"
4. **`lateralMovement`** — Array of `{ app, env, reachable, bridge }` from lateral movement paths, sorted by reachable descending
5. **`networkGraphData`** — `{ nodes: [...], links: [...] }`:
   - Nodes: `{ id: "app|env", app, env, score, tier, reachable?, bridge? }` from infrastructure services + lateral movement
   - Links: `{ source: "app|env", target: "app|env", port, risk }` from traffic flow summaries. Risk classification: high-risk ports (22, 3389) from non-jumphost sources = "high"; database ports (3306, 5432) = "medium"; infrastructure ports (514, 5666, 123, 53) = "low"; application ports (443, 80) = "medium" if cross-env, "low" if within expected pattern
   - Node tiers from infrastructure services: score >= 75 = "core", >= 50 = "shared", endpoint apps (laptop, vdi) = "endpoint", rest = "standard"
6. **`jumphostViolations`** — Array of `{ source, dest, port, conns, severity }` from traffic analysis of the user's custom rules
7. **`highRiskPorts`** — Array of `{ port, proto, conns, apps, severity }` aggregated from traffic flows
8. **`unmanagedTraffic`** — Array of `{ ip, dest, port, conns, type }` from unmanaged traffic analysis

## React Component Architecture

The dashboard is a single default-exported React component with these sections:

### Technology Stack
- **React** with hooks (`useState`, `useEffect`, `useRef`)
- **D3.js** for the force-directed network graph (imported as `import * as d3 from "d3"`)
- **Tailwind-free**: All styling is inline `style={{}}` objects — no Tailwind classes, no CSS modules
- **Single file**: Everything in one .jsx file, no separate CSS

### Design System

Light mode, clean, not too dark. The dashboard follows Illumio Field.

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

Palette constants, declared once at the top of the file:

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
```

Load Montserrat (weights 300, 400, 500 and 600) via the `<link>` above, rendered in the component body, and set `fontFamily: FONT` on the root element so every child inherits it.

Applied to this dashboard:
- **Surfaces**: page background `C.gray50` (Zero Trust Tan); cards, KPI tiles, tables and panels white with a 1px `C.gray200` border and `borderRadius: 0`; buttons square; tags and badges square with `borderRadius` of at most 2px.
- **Tables**: header row `C.slate` with white text; row banding `#EAEBEB`; hairline `C.gray200` borders.
- **Headings**: page title in `C.slate` at weight 300 with a 2px `C.accent` rule under it; section titles `C.slate` SemiBold (600); eyebrows `C.slate` SemiBold in caps; body `C.text`; captions and labels `C.muted`.
- **Illumio Orange (`C.accent`)** is an accent, never a status: it marks the active tab and the title rule and appears nowhere else.

### Status color mapping

Apply consistently everywhere (badges, cells, backgrounds):
- **critical / fail / high risk**: Risk Red (`C.red`) bg, white text
- **high / warning**: Circuit Gold (`C.orange`) fill, `C.slate` text (gold is a fill or swatch, never small gold text)
- **medium**: Gold (`C.amber`) fill, `C.slate` text
- **low / pass / enforced**: Safeguard Green (`C.green`) bg, white text
- **info / in progress / selective**: System Cyan (`C.teal`) bg, white text
- **row and cell tints**: the matching `*Light` value (the status colour at 10% over white) with `C.slate` text
- **grey** (`C.gray200`, `C.gray300`, `C.gray400`) means nothing

### Colour legends (required)

Colour carries meaning only, and every place it is used explains itself:
- A **colour key** next to the tab bar on every tab: Risk Red critical / fail / high risk, Circuit Gold high / warning, Gold medium, Safeguard Green low / pass / enforced, System Cyan info / in progress / selective, plus the sentence "grey borders and strips mean nothing".
- A **`Legend` component** (swatch plus text) at the bottom of every section that uses colour, listing exactly the colours used there: the enforcement donut segments; graph node fill by tier and the Risk Red override for bridge nodes; link colour by risk level and width for high risk; lateral movement bar fills (bridge, high reachability, low) and the BRIDGE tag; port card severities; violation row tints; unmanaged traffic anomaly colours.
- Section heading accents are one neutral grey; no per-section colour.
- Keep the legend wording in one `LEGEND` constant so every tab says the same thing.

### Tab Structure

Use a text tab bar with 5 tabs. Tabs are plain `C.muted` labels; the active tab is `C.slate` SemiBold with a 2px Illumio Orange (`C.accent`) underline. No fills, no outlines, square everywhere.

1. **Overview** — KPI cards, enforcement donut, compliance cards, app status table
2. **Network Graph** — D3 force-directed graph with risk filter, legend, detail panel, lateral movement bars
3. **Policy Violations** — Alert banner, violations table, remediation card (only if user provided custom rules)
4. **High-Risk Ports** — Visual port cards with severity, connections, affected apps
5. **Unmanaged Traffic** — KPI cards, traffic table, anomaly alerts

### Component Inventory

Build these reusable components:

- **`Badge`**: Square tag (`borderRadius` at most 2px) with `color` + `bg` props
- **`RiskBadge`**: Pre-mapped risk level badge
- **`ModeBadge`**: Pre-mapped enforcement mode badge (visibility_only displays as "vis only")
- **`KPI`**: Square white card with 1px `C.gray200` border; eyebrow label in `C.slate` SemiBold caps, large value, subtitle, accent color (a status colour only when the value calls for attention, `C.gray300` otherwise)
- **`Section`**: Heading in `C.slate` SemiBold with icon, optional accent bar in neutral grey, children
- **`TabBar`**: Text tab switcher with the 2px `C.accent` underline on the active tab
- **`EnforcementDonut`**: SVG donut chart with arc paths and legend; full = Safeguard Green (`C.green`), selective = System Cyan (`C.teal`), visibility_only = Circuit Gold (`C.orange`)
- **`NetworkGraph`**: D3 force-directed graph (see below)

### Network Graph Specification

The graph is the centerpiece. Build it as a separate `NetworkGraph` component:

**Props**: `onNodeClick`, `highlightRisk`

**D3 Setup**:
- Force simulation: `forceLink` (distance 100, strength 0.3), `forceManyBody` (strength -300), `forceCenter`, `forceCollide` (radius + 8)
- SVG markers for directional arrows, colored by risk level
- Zoom via `d3.zoom` (scale 0.3–3)
- Drag behavior on nodes

**Node rendering**:
- Circle radius by tier: core=18, shared=15, endpoint=12, standard=10
- Circle fill by tier: core = Risk Red (`C.red`), shared = Circuit Gold (`C.orange`), endpoint = System Cyan (`C.teal`), standard = `C.gray400`
- Bridge nodes override to Risk Red fill regardless of tier
- Text label below node: **`${d.app} (${d.env})`**, always the tuple
- Font: `FONT`, 9px, `C.gray700`

**Link rendering**:
- Stroke color by risk level
- Stroke width: high=2.5, others=1.5
- Opacity: 0.35 default
- Arrow markers at endpoints

**Interactions**:
- **Hover**: Highlight connected links (opacity 0.85) and dim unconnected nodes (opacity 0.15). Show tooltip with app (env) tuple, infra score, tier, bridge status, reachable count
- **Click**: Set selectedNode state, renders detail panel below graph
- **Risk filter buttons**: When active, highlight only links of that risk level, dim everything else (applied via setTimeout after 1.5s to let simulation settle)
- **Drag**: Standard D3 drag with alpha target restart

**Detail panel** (shown below graph when a node is clicked):
- Header: `app (env)` with close button
- Grid: Infra Score, Tier, Bridge (YES in Risk Red / No in Safeguard Green), Reachable count
- Connected flows: List of square flow chips showing `→ app (env) :port` with risk-tinted backgrounds (the `*Light` values) and `C.slate` text

**Lateral movement bar chart** (below graph detail):
- Horizontal bars showing reachable/22 ratio, square ends
- Flat fills: bridge nodes = Risk Red (`C.red`), high reachability = Circuit Gold (`C.orange`), low = Safeguard Green (`C.green`); track `C.gray100`
- Bridge nodes get a Risk Red "BRIDGE" tag
- Label: `app (env)` — always the tuple, no separate env column

### Violations Tab (Conditional)

Only show this tab if the user provided custom security rules of thumb. Structure:
- Risk Red alert banner (`C.redLight` tint, 1px `C.red` left border, `C.slate` text) summarizing the total violation count
- Table sorted by connections descending, with Risk Red tinted rows (`C.redLight`) for critical severity
- Safeguard Green remediation card (`C.greenLight` tint, 1px `C.green` left border) with numbered steps

### Adaptation

If the user does not provide custom rules of thumb, replace the "Policy Violations" tab with a different relevant view (e.g., "Enforcement Roadmap" or "Policy Gaps"). Adjust the tab array accordingly.

## Output

Save the artifact as:
```
/mnt/user-data/outputs/security_assessment.jsx
```

Present to the user with `present_files`. The artifact renders directly in Claude's UI.

## Quality Checklist

Before finalizing, verify:

- [ ] Every graph node label shows `app (env)`, not just `app`
- [ ] Every tooltip title shows `app (env)`
- [ ] Every flow chip / connection tag shows `app (env) :port`
- [ ] Every lateral movement label shows `app (env)` with NO separate env column
- [ ] Every table uses a merged "Application (Env)" column or shows tuples inline
- [ ] Network graph has working zoom, drag, hover highlight, click detail
- [ ] Risk filter buttons work and dim non-matching content
- [ ] Donut chart segments add up to total workloads
- [ ] All status badges use correct color mapping
- [ ] Illumio Field surfaces: page on `C.gray50`, white cards with 1px `C.gray200` borders, `C.slate` table headers with white text, Montserrat via `FONT`; no rounded corners anywhere (cards, tiles, tables and buttons at radius 0, tags at most 2px)
- [ ] Illumio Orange (`C.accent`) appears only as the active tab underline and the title rule, never as a status
- [ ] Colour key visible on every tab; every section that uses colour ends with a legend naming each colour, tint and badge
- [ ] Tab switching works without losing state
- [ ] No separate env columns anywhere — env is always part of the app tuple
