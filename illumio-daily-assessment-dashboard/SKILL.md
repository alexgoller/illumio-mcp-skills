---
name: illumio-daily-assessment
description: "Generate an on-demand daily health and security assessment dashboard for an Illumio Core PCE environment. Produces a single-file React (.jsx) artifact covering blocked traffic, workload health and heartbeat status, security posture drift, data exfiltration indicators, and critical events from the last 24 hours. Use this skill whenever the user asks for a daily check, daily assessment, morning briefing, environment health check, what's going wrong, blocked traffic report, workload status, heartbeat check, security posture overview, exfiltration detection, PCE daily ops, or anything that implies a routine operational review of their Illumio environment. Also trigger when the user says: daily report, daily dashboard, what happened overnight, anything broken, environment status, show me problems, security findings today, blocked flows, offline workloads, agent issues, or health summary. Requires the illumio-mcp MCP server to be connected."
---

# Illumio Daily Assessment Dashboard

Generate a single-file React component (.jsx) that gives an operator a fast, actionable daily health and security view of their Illumio Core PCE. This is not a deep assessment — it's the "morning coffee" dashboard that surfaces what changed, what's broken, and what needs attention right now.

## Prerequisites

- The **illumio-mcp** MCP server must be connected (verify with `check-pce-connection`)
- All date ranges default to the **last 24 hours** unless the user specifies otherwise (some queries use longer lookbacks for context, noted below)

## Philosophy

A daily assessment is different from a full security assessment. The goal here is operational awareness, not strategic planning. Think of it as an SRE's morning check for microsegmentation:

- **Speed over depth**: Surface the top problems, don't enumerate everything
- **Change detection**: What's different from yesterday? New blocked traffic, workloads going offline, enforcement changes
- **Actionable items**: Every finding should suggest what to do about it
- **Red/gold/green at a glance**: The operator should know in 2 seconds if things are OK or on fire

## Data Collection

Collect all data from the PCE before generating the artifact. Run these in the order listed. When results are large, parse with `bash_tool` + `python3`.

### 1. PCE Connection Health

```
illumio-mcp:check-pce-connection
```

If this fails, stop and surface the connection error prominently — the PCE being unreachable is finding #1.

### 2. Blocked & Potentially Blocked Traffic (Last 24h)

This is the most operationally urgent data — traffic that's being dropped or would be dropped.

```
illumio-mcp:get-traffic-flows-summary
  start_date: <24 hours ago>
  end_date: <now>
  policy_decisions: ["blocked", "potentially_blocked"]
  max_results: 200
```

Parse the results to extract:
- Total blocked connection count
- Total potentially blocked connection count
- Top sources and destinations by connection volume
- Top blocked ports/services
- Whether any blocked traffic involves production workloads (cross-reference with labels)

Also run a **7-day lookback** for trend context:
```
illumio-mcp:get-traffic-flows-summary
  start_date: <7 days ago>
  end_date: <now>
  policy_decisions: ["blocked", "potentially_blocked"]
  max_results: 500
```

This lets the dashboard show whether today's blocked traffic volume is normal or spiking.

### 3. Workload Health & Heartbeats

```
illumio-mcp:get-workloads
  online: false
  max_results: 500
```

This returns workloads whose VEN agent hasn't sent a heartbeat recently (offline). Capture:
- Total offline workload count
- Which apps/envs they belong to
- Whether any are in production

Also get the full workload picture for context:
```
illumio-mcp:get-workload-enforcement-status
```

From this, derive:
- Total workloads and enforcement distribution
- Any mixed-enforcement applications (governance risk)
- Apps that changed enforcement mode recently (compare with events)

### 4. PCE Events (Last 24h)

Pull recent events focusing on errors and warnings — these surface agent issues, policy failures, and system problems.

```
illumio-mcp:get-events
  severity: "err"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

```
illumio-mcp:get-events
  severity: "warning"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

```
illumio-mcp:get-events
  status: "failure"
  timestamp_gte: <24 hours ago ISO 8601>
  max_results: 50
```

Combine and deduplicate. Categorize events into:
- **Agent issues**: VEN communication failures, heartbeat timeouts
- **Policy issues**: Rule provisioning failures, policy compute errors
- **System issues**: PCE component errors, capacity warnings
- **Security events**: Tampering alerts, unauthorized access attempts

### 5. Data Exfiltration Indicators

Query for unusually large outbound traffic patterns. The idea is to find workloads sending abnormal volumes to external IPs or unexpected destinations.

```
illumio-mcp:get-traffic-flows-summary
  start_date: <24 hours ago>
  end_date: <now>
  max_results: 500
```

From the full flow data, use Python to:
1. **Aggregate connections per source workload** — flag any source with an unusually high connection count (top 5 by volume)
2. **Identify outbound flows to external/unmanaged IPs** — especially on non-standard ports (not 80, 443, 53)
3. **Flag large fan-out patterns** — a single source connecting to many distinct destinations (>20 unique destinations in 24h is suspicious)
4. **Flag high-risk port usage** — outbound connections on ports commonly used for data exfil: 20/21 (FTP), 22 (SCP/SFTP), 3389 (RDP), 445 (SMB), or any port >10000 to external IPs

This is heuristic-based — clearly label findings as "indicators" not "confirmed exfiltration."

### 6. Unmanaged Traffic (Blind Spots)

```
illumio-mcp:find-unmanaged-traffic
  lookback_days: 1
  min_connections: 5
  top_n: 20
```

These are flows from/to IPs that don't have a VEN. New unmanaged traffic appearing in the last 24h could mean:
- A new system was deployed without an agent
- An attacker is using an unmonitored host
- Infrastructure (load balancers, scanners) is generating noise

### 7. Compliance Snapshot

```
illumio-mcp:compliance-check
  framework: "general"
  lookback_days: 1
```

Quick compliance score for the last 24h. The dashboard shows this as a single number with pass/fail/warning breakdown.

### 8. Security Posture Drift (Optional Context)

If time allows, also run:
```
illumio-mcp:detect-lateral-movement-paths
  lookback_days: 1
  max_hops: 3
```

This identifies any new lateral movement paths that appeared in the last day — new bridge nodes or expanded reachability.

## Data Transformation

Transform raw PCE data into JavaScript data structures embedded as `const` declarations at the top of the .jsx file. The artifact is fully self-contained.

### Data Structures to Build

1. **`summaryKPIs`** — Object with top-level numbers:
   ```js
   {
     totalWorkloads: N,
     onlineWorkloads: N,
     offlineWorkloads: N,
     blockedFlows24h: N,
     potentiallyBlockedFlows24h: N,
     blockedTrend7d: [N, N, N, N, N, N, N], // daily counts
     errorEvents24h: N,
     warningEvents24h: N,
     complianceScore: N, // percentage
     unmanagedSources: N,
     exfilIndicators: N // count of flagged patterns
   }
   ```

2. **`blockedTraffic`** — Array of `{ source, destination, port, proto, connections, policyDecision, severity }` sorted by connections descending

3. **`offlineWorkloads`** — Array of `{ name, hostname, app, env, ip, lastHeartbeat, enforcement }` for all offline workloads

4. **`enforcementStatus`** — `{ visibility_only: N, selective: N, full: N, idle: N, mixedApps: [{app, env, modes}] }`

5. **`criticalEvents`** — Array of `{ timestamp, severity, eventType, status, summary }` sorted by timestamp descending

6. **`exfilIndicators`** — Array of `{ source, destinationCount, connectionCount, topPorts, riskLevel, reason }` for flagged sources

7. **`unmanagedTraffic`** — Array of `{ ip, direction, destination, port, connections, riskNote }` sorted by connections descending

8. **`complianceFindings`** — Array of `{ id, name, detail, status }` from the compliance check

9. **`lateralMovement`** — Array of `{ app, env, reachable, bridge }` if lateral movement data was collected

## React Component Architecture

### Technology Stack
- **React** with hooks (`useState`, `useEffect`, `useRef`)
- **Tailwind-free**: All styling is inline `style={{}}` objects
- **Single file**: Everything in one .jsx file, no separate CSS
- **No external API calls**: All data embedded as constants

### Design System

The dashboard follows Illumio Field (the same system as the security dashboard skill).

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
- **Surfaces**: page background `C.gray50` (Zero Trust Tan); cards, KPI tiles, tables and panels white with a 1px `C.gray200` border and `borderRadius: 0`; buttons and filter chips square; tags and badges square with `borderRadius` of at most 2px.
- **Tables**: header row `C.slate` with white text; row banding `#EAEBEB`; hairline `C.gray200` borders.
- **Headings**: page title in `C.slate` at weight 300 with a 2px `C.accent` rule under it; section titles `C.slate` SemiBold (600); eyebrows `C.slate` SemiBold in caps; body `C.text`; captions and labels `C.muted`.
- **Status colours**: Risk Red (`C.red`) critical / blocked / fail; Circuit Gold (`C.orange`) warning / high, used as a fill, swatch, bar or border with `C.slate` text on its tint, never as small text; Gold (`C.amber`) medium; Safeguard Green (`C.green`) pass / enforced / online / low; System Cyan (`C.teal`) info / selective / in progress; tints are the `*Light` values with `C.slate` text; grey means nothing.
- **Illumio Orange (`C.accent`)** is an accent, never a status: it marks the active tab, the title rule and a "new in the last 24h" marker, and appears nowhere else.

### Colour legends (required)

Colour carries meaning only, and every place it is used explains itself:
- A **colour key** next to the tab bar on every tab: Risk Red critical / blocked, Circuit Gold high / warning / potentially blocked, Gold medium, Safeguard Green low / pass / online, System Cyan info / selective, plus "grey borders and strips mean nothing".
- A **`Legend` component** (swatch plus text) at the bottom of every section that uses colour, listing exactly what is used there: the health banner colours and their thresholds; KPI card accents; blocked-traffic row tints (Risk Red blocked, Circuit Gold potentially blocked); enforcement donut segments; OFFLINE tag; event timeline dots (Risk Red error, Circuit Gold warning); exfiltration risk levels; blind-spot new-source tag.
- Section heading accents are one neutral grey; KPI card accents are coloured only when the value calls for attention, grey otherwise.
- Keep the legend wording in one `LEGEND` constant so every tab says the same thing.

### Overall Health Indicator

At the very top of the dashboard, show a single large status indicator that summarizes everything:

- **GREEN, Safeguard Green `C.green` with white text ("All Clear")**: No offline production workloads, <5 blocked flows, no error events, no exfil indicators
- **GOLD, Circuit Gold `C.orange` with `C.slate` text ("Attention Needed")**: Some offline workloads OR 5-50 blocked flows OR warning events OR minor exfil indicators
- **RED, Risk Red `C.red` with white text ("Action Required")**: Production workloads offline OR >50 blocked flows OR error events OR critical exfil indicators OR compliance failures

The thresholds above are defaults; the logic should be clearly written so it's easy to adjust.

### Tab Structure

Use a text tab bar with 6 tabs. Tabs are plain `C.muted` labels; the active tab is `C.slate` SemiBold with a 2px Illumio Orange (`C.accent`) underline. No fills, no outlines, square everywhere.

1. **Overview** — Health indicator, KPI cards (8 metrics), blocked traffic trend sparkline (7-day), top 5 issues list
2. **Blocked Traffic** — Full blocked/potentially_blocked flow table with search, severity badges, source/dest grouping
3. **Workload Health** — Offline workloads table, enforcement distribution donut, mixed-enforcement alerts
4. **Events & Alerts** — Timeline of error/warning events, categorized by type, severity badges
5. **Exfiltration Watch** — Flagged sources with risk indicators, fan-out visualization, unusual port activity
6. **Blind Spots** — Unmanaged traffic table, new unmanaged sources, compliance score card

### Tab 1: Overview

This is the "glance" view. It should answer "is everything OK?" in under 3 seconds.

- **Health banner**: Full-width square bar, Safeguard Green / Circuit Gold / Risk Red as above, with icon and one-line summary
- **KPI row**: 4 cards across — Total Workloads (with online/offline split), Blocked Flows (24h with 7d trend arrow), Error Events, Compliance Score
- **Second KPI row**: 4 more cards — Offline Workloads, Exfil Indicators, Unmanaged Sources, Mixed-Enforcement Apps
- **Trend sparkline**: Small inline SVG showing 7-day blocked traffic trend (just dots and lines, no axis)
- **Top Issues**: Prioritized list of the 5 most urgent findings across all categories, each with a severity badge and one-line description. These are the "fix these first" items.

### Tab 2: Blocked Traffic

- **Summary bar**: Total blocked + potentially blocked counts with percentage of total traffic
- **Filter chips**: By policy decision (blocked vs potentially_blocked), by severity
- **Table**: Source (app/env or IP), Destination (app/env or IP), Port, Proto, Connections, Policy Decision, Severity
- Sort by connections descending by default
- Risk Red tinted rows (`C.redLight`) for blocked, Circuit Gold tint (`C.orangeLight`) for potentially_blocked, `C.slate` text on both
- If >50 flows, show top 50 with "and N more..." footer

### Tab 3: Workload Health

- **Enforcement donut chart**: SVG with visibility_only / selective / full / idle segments; full = Safeguard Green (`C.green`), selective = System Cyan (`C.teal`), visibility_only = Circuit Gold (`C.orange`), idle = `C.gray300`
- **Offline workloads table**: Name, App (Env), IP, Enforcement Mode, status tag "OFFLINE" in Risk Red
- **Mixed enforcement alerts**: Cards for each app group where workloads have inconsistent enforcement modes
- **Heartbeat summary**: Count of workloads by last-seen bucket (last 1h, 1-6h, 6-24h, >24h)

### Tab 4: Events & Alerts

- **Event timeline**: Vertical timeline with colored dots (Risk Red `C.red` for errors, Circuit Gold `C.orange` for warnings); the line itself is `C.gray200`
- **Category filter**: Agent / Policy / System / Security
- **Event cards**: Each shows timestamp, severity badge, event type, and summary text
- **Counts bar**: Total errors, warnings, and failures in the last 24h

### Tab 5: Exfiltration Watch

This tab surfaces suspicious patterns. Frame everything as "indicators" — make it clear these are heuristic flags, not confirmed incidents.

- **Risk summary cards**: Count of high/medium/low risk indicators (high = Circuit Gold `C.orange`, medium = Gold `C.amber`, low = Safeguard Green `C.green`; a critical indicator, if any, is Risk Red `C.red`)
- **Flagged sources table**: Source workload, # of unique destinations, # of connections, top ports used, risk level, reason for flag
- **Fan-out visualization**: Simple horizontal bar chart showing top 10 sources by unique destination count
- **Unusual port activity**: Table of outbound connections on non-standard ports (not 80/443/53) to external IPs

### Tab 6: Blind Spots

- **Unmanaged traffic table**: IP, Direction, Connected App (Env), Port, Connections, Risk Note
- **New sources tag**: Highlight IPs that appear only in the last 24h (this is the one place the Illumio Orange `C.accent` "new" marker may be used; it is a marker, not a status, and is named as such in the legend)
- **Compliance card**: Score with pass/fail/warning breakdown from the compliance check
- **Lateral movement summary** (if data available): Count of bridge nodes, max reachability, compared to baseline

### Component Inventory

Build these reusable sub-components inside the file:

- **`Badge`**: Square tag (`borderRadius` at most 2px) `{ label, color, bg }`
- **`SeverityBadge`**: Pre-mapped for critical/high/medium/low/info (Risk Red, Circuit Gold, Gold, Safeguard Green, System Cyan; gold tags carry `C.slate` text)
- **`KPICard`**: Square white card with 1px `C.gray200` border; eyebrow label in `C.slate` SemiBold caps, value, subtitle, trend arrow (up/down/flat), accent color
- **`StatusBanner`**: Full-width square banner with icon, title, and subtitle, colored by health status (Safeguard Green or Risk Red with white text, Circuit Gold with `C.slate` text)
- **`Sparkline`**: Inline SVG sparkline from an array of numbers, stroke `C.slate`
- **`DataTable`**: Generic sortable table with column definitions, search box, row coloring callback; `C.slate` header row with white text, `#EAEBEB` banding
- **`DonutChart`**: SVG donut with legend
- **`TimelineEvent`**: Single event in the timeline with dot, timestamp, and content
- **`TabBar`**: Text tab switcher with the 2px `C.accent` underline on the active tab

### Critical: App/Env Tuple Convention

Same as the other Illumio skills — always display applications as `app (env)` tuples. Never show app name alone without the environment context.

### Timestamps

Display all timestamps in the user's local timezone. Show relative time ("2h ago", "14m ago") alongside the absolute timestamp.

## Output

Save the artifact as:
```
/mnt/user-data/outputs/illumio_daily_assessment_<YYYY-MM-DD>.jsx
```

Present to the user with `present_files`. The artifact renders directly in Claude's UI.

## Quality Checklist

Before finalizing, verify:

- [ ] Health banner correctly reflects the worst status across all categories
- [ ] All KPI cards show real numbers from the collected data
- [ ] Blocked traffic table is sorted by connections descending
- [ ] Offline workloads show app (env) tuples, not just hostnames
- [ ] Events are deduplicated and categorized correctly
- [ ] Exfiltration indicators are clearly labeled as heuristic, not confirmed
- [ ] Unmanaged traffic shows direction (inbound/outbound)
- [ ] Sparkline trend is visible and correctly scaled
- [ ] All tabs render without errors
- [ ] No empty state crashes — gracefully handle zero results for any section
- [ ] Compliance score displays even if only "general" framework was used
- [ ] Top Issues list on Overview pulls the most urgent items from all categories
- [ ] Illumio Field surfaces: page on `C.gray50`, white cards with 1px `C.gray200` borders, `C.slate` table headers with white text, Montserrat via `FONT`; no rounded corners anywhere (cards, tiles, tables and buttons at radius 0, tags at most 2px)
- [ ] Illumio Orange (`C.accent`) appears only as the active tab underline, the title rule and the "new" marker, never as a status; gold is never small text
- [ ] Colour key visible on every tab; every section that uses colour ends with a legend naming each colour, tint, dot and badge
