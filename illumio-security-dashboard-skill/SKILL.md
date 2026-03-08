---
name: illumio-security-dashboard
description: "Generate an interactive React security assessment dashboard for an Illumio PCE environment. Use this skill whenever the user asks for an interactive, visual, or live security dashboard, security posture visualization, interactive network graph of their Illumio environment, or a React-based PCE assessment. Also trigger when the user says: interactive assessment, security dashboard, visual security report, network topology view, lateral movement visualization, or wants a browser-based view of their PCE security status. Produces a single-file React (.jsx) artifact with D3 force-directed network graph, tabbed navigation, compliance cards, enforcement charts, and filterable tables — all populated from live PCE data. Requires the illumio-mcp MCP server to be connected."
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

Light mode, clean, not too dark. Use the Illumio brand palette:

```javascript
const C = {
  green: "#00C48C",       // Illumio primary
  greenLight: "#E8FAF3",  // Success backgrounds
  greenDark: "#00A876",   // Success text
  teal: "#00B4D8",        // Selective / info accent
  tealLight: "#E5F7FB",   // Info backgrounds
  navy: "#1A1F36",        // Primary text, headers
  orange: "#FF6B35",      // Warnings
  orangeLight: "#FFF3ED", // Warning backgrounds
  red: "#E63946",         // Critical / failures
  redLight: "#FDE8EA",    // Critical backgrounds
  gray50: "#F9FAFB",      // Page background
  gray100: "#F3F4F6",     // Subtle backgrounds
  gray200: "#E5E7EB",     // Borders
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",     // Muted text
  gray500: "#6B7280",     // Secondary text
  gray700: "#374151",     // Strong secondary text
  white: "#FFFFFF",
};
```

Use Google Fonts `DM Sans` (weights 400–800) loaded via `<link>` in the component body.

### Status color mapping

Apply consistently everywhere (badges, cells, backgrounds):
- **critical / fail / high risk**: Red (`E63946`) bg, white text
- **high**: Orange (`FF6B35`) bg, white text
- **medium / warning**: Amber (`#FEF3C7`) bg, dark amber text
- **low / pass / enforced**: Green (`00C48C`) bg, white text
- **info / in progress**: Teal (`00B4D8`) bg, white text

### Tab Structure

Use a pill-style tab bar with 5 tabs:

1. **Overview** — KPI cards, enforcement donut, compliance cards, app status table
2. **Network Graph** — D3 force-directed graph with risk filter, legend, detail panel, lateral movement bars
3. **Policy Violations** — Alert banner, violations table, remediation card (only if user provided custom rules)
4. **High-Risk Ports** — Visual port cards with severity, connections, affected apps
5. **Unmanaged Traffic** — KPI cards, traffic table, anomaly alerts

### Component Inventory

Build these reusable components:

- **`Badge`**: Pill-shaped label with `color` + `bg` props
- **`RiskBadge`**: Pre-mapped risk level badge
- **`ModeBadge`**: Pre-mapped enforcement mode badge (visibility_only displays as "vis only")
- **`KPI`**: Card with label, large value, subtitle, accent color
- **`Section`**: Heading with icon, optional accent bar, children
- **`TabBar`**: Pill-style tab switcher
- **`EnforcementDonut`**: SVG donut chart with arc paths and legend
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
- Circle fill by tier: core=red, shared=orange, endpoint=teal, standard=gray400
- Bridge nodes override to red fill regardless of tier
- Text label below node: **`${d.app} (${d.env})`** — always the tuple
- Font: DM Sans, 9px, gray700

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
- Grid: Infra Score, Tier, Bridge (YES in red / No in green), Reachable count
- Connected flows: List of flow chips showing `→ app (env) :port` with risk-colored backgrounds

**Lateral movement bar chart** (below graph detail):
- Horizontal bars showing reachable/22 ratio
- Gradient fills: bridge nodes = red→orange, high reachability = orange→amber, low = teal→green
- Bridge nodes get a red "BRIDGE" badge
- Label: `app (env)` — always the tuple, no separate env column

### Violations Tab (Conditional)

Only show this tab if the user provided custom security rules of thumb. Structure:
- Red alert banner summarizing the total violation count
- Table sorted by connections descending, with red-tinted rows for critical severity
- Green remediation card with numbered steps

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
- [ ] Tab switching works without losing state
- [ ] No separate env columns anywhere — env is always part of the app tuple
