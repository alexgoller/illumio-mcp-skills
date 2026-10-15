import React, { useState, useMemo } from "react";

// Worked example of references/dashboard-spec.md with synthetic data.
// A real run replaces every constant below with the report's numbers.

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

// ==== DATA ====
const scope = {
  pce: "pce.example.com (org 1)", windowStart: "2026-10-07", windowEnd: "2026-10-14", days: 7,
  direction: "both", scopeLabels: "whole estate", queries: 5,
  inventoryTruncated: false, summaryTruncated: false, scanCapped: false,
  generatedAt: "2026-10-14 11:40 CEST",
};

const summaryKPIs = {
  unknownSources: 7, unknownDestinations: 5, insideManagedSubnet: 3, publicSources: 2,
  allowedIntoEnforced: 2, scanners: 1, coveredByNamedList: 3, noiseEndpoints: 14,
  unlabelledWorkloads: 4, connectionsUnknown: 68412, high: 4, medium: 4, low: 3,
};

const findings = [
  { id: "U2", title: "Scanner", severity: "high", endpoint: "10.20.30.40", direction: "source",
    numbers: "37 workloads in 6 apps, 212 ports, median 1 connection per pair, 96% blocked",
    detail: "No FQDN, no named IP list, shares 10.20.30.0/24 with 14 managed workloads.", suggestionId: "S3" },
  { id: "U1", title: "Unknown host inside a managed subnet", severity: "high", endpoint: "10.1.5.9", direction: "source",
    numbers: "4 allowed connections to shop (prod) on 3389/tcp; 10.1.5.0/24 has 12 managed workloads, 2 in full enforcement",
    detail: "Admin reach on an RDP port with allowed traffic.", suggestionId: "S1" },
  { id: "U3", title: "Unknown source on admin ports", severity: "high", endpoint: "10.1.5.9", direction: "source",
    numbers: "3389/tcp allowed, 4 connections", detail: "Same host as U1.", suggestionId: "S5" },
  { id: "U6", title: "Public source reaching workloads", severity: "high", endpoint: "198.51.100.23", direction: "source",
    numbers: "18 allowed connections to web (prod) on 443/tcp; no named IP list", detail: "Internet exposure admitted by a broad rule.", suggestionId: "S5" },
  { id: "U4", title: "Unknown source allowed into enforced workloads", severity: "medium", endpoint: "203.0.113.7", direction: "source",
    numbers: "30 allowed connections to web (prod), 3 of 6 workloads in full enforcement", detail: "Covered by IP list partner-cdn.", suggestionId: "S5" },
  { id: "U5", title: "Uninventoried infrastructure", severity: "medium", endpoint: "10.0.0.53", direction: "destination",
    numbers: "53/udp from 11 apps, 41,200 connections", detail: "A DNS resolver no workload or IP list names.", suggestionId: "S2" },
  { id: "U5", title: "Uninventoried infrastructure", severity: "medium", endpoint: "10.0.0.123", direction: "destination",
    numbers: "123/udp from 9 apps, 8,800 connections", detail: "NTP.", suggestionId: "S2" },
  { id: "U7", title: "Unknown public destination with notable egress", severity: "medium", endpoint: "api.anthropic.com", direction: "destination",
    numbers: "443/tcp from 2 apps, 6,120 connections, provider Anthropic", detail: "Point to illumio-agentic-ai-risk-assessment.", suggestionId: null },
  { id: "U8", title: "Unknown endpoint in no named IP list", severity: "low", endpoint: "10.20.30.40", direction: "source", numbers: "no covering list", detail: "", suggestionId: "S3" },
  { id: "U8", title: "Unknown endpoint in no named IP list", severity: "low", endpoint: "10.1.5.9", direction: "source", numbers: "no covering list", detail: "", suggestionId: "S1" },
  { id: "U9", title: "Volume outlier", severity: "low", endpoint: "10.9.9.9", direction: "source", numbers: "9,400 connections, 12x median", detail: "Single peer backup (prod) on 22/tcp.", suggestionId: "S4" },
];

const unknownSources = [
  { ip: "10.20.30.40", fqdn: null, addressClass: "private", ipLists: [], neighbourhood: { prefix: "10.20.30.0/24", managedCount: 14 },
    peerApps: ["shop (prod)", "web (prod)", "pay (prod)", "crm (dev)", "backup (prod)", "ad (prod)"], peerWorkloads: null,
    ports: [{ port: 22, proto: "tcp", admin: true }, { port: 3389, proto: "tcp", admin: true }, { port: 445, proto: "tcp", admin: true }, { port: 8080, proto: "tcp", admin: false }],
    portCount: 212, policy: { allowed: 9, potentiallyBlocked: 40, blocked: 201, partial: false }, connections: 250, shapes: ["scanner", "admin reach"], findings: ["U2", "U8"] },
  { ip: "10.1.5.9", fqdn: null, addressClass: "private", ipLists: [], neighbourhood: { prefix: "10.1.5.0/24", managedCount: 12 },
    peerApps: ["shop (prod)"], peerWorkloads: null, ports: [{ port: 3389, proto: "tcp", admin: true }], portCount: 1,
    policy: { allowed: 4, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 4, shapes: ["admin reach", "single peer"], findings: ["U1", "U3", "U8"] },
  { ip: "198.51.100.23", fqdn: null, addressClass: "public", ipLists: [], neighbourhood: null, peerApps: ["web (prod)"], peerWorkloads: null,
    ports: [{ port: 443, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 18, potentiallyBlocked: 0, blocked: 2, partial: false }, connections: 20, shapes: ["single peer"], findings: ["U6", "U8"] },
  { ip: "203.0.113.7", fqdn: "edge7.partner-cdn.example", addressClass: "public", ipLists: ["partner-cdn"], neighbourhood: null, peerApps: ["web (prod)"], peerWorkloads: null,
    ports: [{ port: 443, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 30, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 30, shapes: ["single peer"], findings: ["U4"] },
  { ip: "10.9.9.9", fqdn: "bkp-ctl.corp.example", addressClass: "private", ipLists: ["backup-controllers"], neighbourhood: null, peerApps: ["backup (prod)"], peerWorkloads: null,
    ports: [{ port: 22, proto: "tcp", admin: true }], portCount: 1, policy: { allowed: 9400, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 9400, shapes: ["high volume", "single peer", "admin reach"], findings: ["U9"] },
  { ip: "10.44.0.17", fqdn: null, addressClass: "private", ipLists: ["monitoring"], neighbourhood: { prefix: "10.44.0.0/24", managedCount: 3 }, peerApps: ["shop (prod)", "web (prod)", "pay (prod)"], peerWorkloads: null,
    ports: [{ port: 9100, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 0, potentiallyBlocked: 0, blocked: 0, partial: true }, connections: 1260, shapes: [], findings: ["U1", "U10"] },
  { ip: "172.16.8.4", fqdn: null, addressClass: "private", ipLists: [], neighbourhood: null, peerApps: ["crm (dev)"], peerWorkloads: null,
    ports: [{ port: 5432, proto: "tcp", admin: true }], portCount: 1, policy: { allowed: 0, potentiallyBlocked: 12, blocked: 0, partial: false }, connections: 12, shapes: ["admin reach", "single peer"], findings: ["U3", "U8"] },
];

const unknownDestinations = [
  { ip: "10.0.0.53", fqdn: null, addressClass: "private", ipLists: [], neighbourhood: null, peerApps: ["shop (prod)", "web (prod)", "pay (prod)", "crm (dev)", "backup (prod)", "ad (prod)", "hr (prod)", "erp (prod)", "ci (dev)", "log (prod)", "mon (prod)"], peerWorkloads: null,
    ports: [{ port: 53, proto: "udp", admin: false }], portCount: 1, policy: { allowed: 41200, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 41200, shapes: ["fan-in server", "high volume"], findings: ["U5", "U8"], processes: ["systemd-resolved", "svchost.exe"], provider: null, providerConfidence: null },
  { ip: "10.0.0.123", fqdn: null, addressClass: "private", ipLists: [], neighbourhood: null, peerApps: ["shop (prod)", "web (prod)", "pay (prod)", "crm (dev)", "backup (prod)", "ad (prod)", "hr (prod)", "erp (prod)", "ci (dev)"], peerWorkloads: null,
    ports: [{ port: 123, proto: "udp", admin: false }], portCount: 1, policy: { allowed: 8800, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 8800, shapes: ["fan-in server"], findings: ["U5", "U8"], processes: ["chronyd", "w32time"], provider: null, providerConfidence: null },
  { ip: "104.18.32.47", fqdn: "api.anthropic.com", addressClass: "public", ipLists: [], neighbourhood: null, peerApps: ["ci (dev)", "crm (dev)"], peerWorkloads: null,
    ports: [{ port: 443, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 6120, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 6120, shapes: ["high volume"], findings: ["U7", "U8"], processes: ["claude", "Claude.exe"], provider: "Anthropic", providerConfidence: "high" },
  { ip: "10.200.1.10", fqdn: "proxy.corp.example", addressClass: "private", ipLists: ["egress-proxies"], neighbourhood: null, peerApps: ["web (prod)", "shop (prod)"], peerWorkloads: null,
    ports: [{ port: 3128, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 2100, potentiallyBlocked: 0, blocked: 0, partial: false }, connections: 2100, shapes: [], findings: [], processes: ["curl", "java"], provider: null, providerConfidence: null },
  { ip: "192.0.2.77", fqdn: null, addressClass: "public", ipLists: [], neighbourhood: null, peerApps: ["ci (dev)"], peerWorkloads: null,
    ports: [{ port: 4444, proto: "tcp", admin: false }], portCount: 1, policy: { allowed: 0, potentiallyBlocked: 0, blocked: 16, partial: false }, connections: 16, shapes: ["single peer"], findings: ["U8"], processes: ["python3"], provider: null, providerConfidence: null },
];

const collapsedRanges = [
  { label: "Any (0.0.0.0/0 and ::/0)", port: 443, proto: "tcp", policy: "allowed", connections: 50000 },
];

const subnets = [
  { prefix: "10.20.30.0/24", managedCount: 14, unmanagedCount: 1, unknownCount: 1, unknownIps: ["10.20.30.40"] },
  { prefix: "10.1.5.0/24", managedCount: 12, unmanagedCount: 0, unknownCount: 1, unknownIps: ["10.1.5.9"] },
  { prefix: "10.44.0.0/24", managedCount: 3, unmanagedCount: 2, unknownCount: 1, unknownIps: ["10.44.0.17"] },
];

const suggestions = [
  { id: "S1", kind: "create-workload", title: "Unmanaged workload unknown-10-1-5-9", findings: ["U1", "U3"],
    callPlan: 'create-workload\n  name: "unknown-10-1-5-9"\n  hostname: "unknown-10-1-5-9"\n  interfaces: [{ name: "eth0", address: "10.1.5.9" }]\n  labels: app=shop, env=prod   (confirm with the owner first)' },
  { id: "S2", kind: "create-iplist", title: "IP list core-infra-dns-ntp", findings: ["U5"],
    callPlan: 'create-iplist\n  name: "core-infra-dns-ntp"\n  description: "DNS and NTP resolvers seen from 11 apps"\n  ip_ranges: [{ from_ip: "10.0.0.53" }, { from_ip: "10.0.0.123" }]' },
  { id: "S3", kind: "create-deny-rule", title: "Deny scanner 10.20.30.40 on admin ports", findings: ["U2"],
    callPlan: 'create-iplist   name: "scanner-10-20-30-40"  ip_ranges: [{ from_ip: "10.20.30.40" }]\ncreate-deny-rule\n  consumers: [ip_list scanner-10-20-30-40]\n  providers: [all workloads]\n  services: 22/tcp, 3389/tcp, 445/tcp, 135/tcp, 5985/tcp\n  (draft until provisioned)' },
  { id: "S4", kind: "ven", title: "VEN for bkp-ctl.corp.example", findings: ["U9"], callPlan: null },
  { id: "S5", kind: "narrow-rule", title: "Find and narrow the rule admitting 10.1.5.9, 198.51.100.23 and partner-cdn", findings: ["U3", "U4", "U6"],
    callPlan: 'get-rulesets   actor_labels: ["app=web", "env=prod"]   actor_side: "provider"   (next read, no change)' },
];

const deepDive = {
  ip: "10.20.30.40", direction: "source", bucket: "1h", effectiveBucket: "1h",
  resolutionNote: null,
  series: Array.from({ length: 24 }, (_, i) => {
    const base = [2, 1, 0, 0, 1, 3, 4, 6, 9, 11, 8, 7, 6, 5, 4, 5, 9, 61, 12, 7, 4, 3, 2, 1][i];
    return { bucketStart: `2026-10-13T${String(i).padStart(2, "0")}:00:00Z`, flows: base, connections: base * 2,
      byPolicy: { allowed: Math.round(base * 0.05), potentially_blocked: Math.round(base * 0.15), blocked: base - Math.round(base * 0.05) - Math.round(base * 0.15) } };
  }),
  spikes: { median: 5, threshold: 15, worst: { bucketStart: "2026-10-13T17:00:00Z", multiple: 12.2, label: "Mon 19:00-20:00 CEST" }, caveat: null },
  peers: [
    { peer: "shop (prod) · web-01", port: 22, proto: "tcp", policy: "blocked", connections: 3, process: null },
    { peer: "shop (prod) · web-01", port: 3389, proto: "tcp", policy: "blocked", connections: 1, process: null },
    { peer: "pay (prod) · pay-db-02", port: 1433, proto: "tcp", policy: "potentially_blocked", connections: 2, process: null },
    { peer: "ad (prod) · dc-01", port: 445, proto: "tcp", policy: "allowed", connections: 1, process: null },
  ],
};
// ==== END DATA ====

const font = "'DM Sans', system-ui, sans-serif";
const sev = {
  high: { bg: C.red, color: C.white },
  medium: { bg: C.orange, color: C.white },
  low: { bg: C.amber, color: C.amberDark },
  info: { bg: C.teal, color: C.white },
  ok: { bg: C.green, color: C.white },
};
const classChip = {
  private: { bg: C.tealLight, color: C.navy },
  public: { bg: C.orangeLight, color: C.orange },
  noise: { bg: C.gray100, color: C.gray500 },
};

function worstSeverity(list) {
  if (list.some((f) => f.severity === "high")) return "high";
  if (list.some((f) => f.severity === "medium")) return "medium";
  return "ok";
}

const fmt = (n) => (n == null ? "–" : n.toLocaleString("en-US"));

function Badge({ label, color, bg, mono }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: bg, color, letterSpacing: 0.2, fontFamily: mono ? "ui-monospace, Menlo, monospace" : font, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
const SeverityBadge = ({ s }) => <Badge label={s.toUpperCase()} {...(sev[s] || sev.info)} />;
const ClassChip = ({ c }) => <Badge label={c} {...(classChip[c] || classChip.noise)} />;

function KPICard({ label, value, subtitle, accent }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: "14px 16px", borderTop: `4px solid ${accent || C.green}`, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.navy, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function StatusBanner({ status, title, subtitle }) {
  const map = { high: { bg: C.red, icon: "●" }, medium: { bg: C.orange, icon: "●" }, ok: { bg: C.green, icon: "●" } };
  const m = map[status] || map.ok;
  return (
    <div style={{ background: m.bg, color: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 22 }}>{m.icon}</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.92 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", background: C.gray100, padding: 6, borderRadius: 999, width: "fit-content" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ border: "none", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontFamily: font,
          fontWeight: 700, fontSize: 13, background: active === t ? C.navy : "transparent", color: active === t ? C.white : C.gray700 }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Section({ title, accent, children, right }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: accent || C.green, display: "inline-block" }} />
          <span style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function PolicyBar({ policy }) {
  const a = policy.allowed || 0, p = policy.potentiallyBlocked || 0, b = policy.blocked || 0;
  const total = a + p + b;
  const seg = (n, color) => (total ? <div title={`${fmt(n)}`} style={{ width: `${(100 * n) / total}%`, background: color }} /> : null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 150 }}>
      <div title={`allowed ${fmt(a)} · potentially blocked ${fmt(p)} · blocked ${fmt(b)}`}
        style={{ display: "flex", height: 10, width: 110, borderRadius: 5, overflow: "hidden", background: C.gray200 }}>
        {seg(a, C.green)}{seg(p, C.orange)}{seg(b, C.red)}
      </div>
      {policy.partial && <Badge label="partial" bg={C.amber} color={C.amberDark} />}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ cursor: "pointer", border: `1px solid ${active ? C.navy : C.gray300}`, background: active ? C.navy : C.white,
      color: active ? C.white : C.gray700, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600, fontFamily: font }}>
      {label}
    </button>
  );
}

function DataTable({ columns, rows, rowTint, search, setSearch, limit = 50, empty }) {
  const [sort, setSort] = useState({ key: null, dir: -1 });
  const shown = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
    }
    if (sort.key) {
      r = [...r].sort((x, y) => {
        const a = x[sort.key], b = y[sort.key];
        if (typeof a === "number" && typeof b === "number") return (a - b) * sort.dir;
        return String(a ?? "").localeCompare(String(b ?? "")) * sort.dir;
      });
    }
    return r;
  }, [rows, search, sort]);
  if (!rows.length) return <div style={{ color: C.gray500, fontSize: 13 }}>{empty}</div>;
  return (
    <div>
      {setSearch && (
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
          style={{ fontFamily: font, fontSize: 13, padding: "7px 10px", border: `1px solid ${C.gray300}`, borderRadius: 8, width: 240, marginBottom: 10 }} />
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : -1 }))}
                  style={{ textAlign: "left", padding: "8px 10px", color: C.gray500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4,
                    borderBottom: `2px solid ${C.gray200}`, cursor: c.sortable === false ? "default" : "pointer", whiteSpace: "nowrap" }}>
                  {c.label}{sort.key === c.key ? (sort.dir < 0 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((row, i) => (
              <tr key={i} style={{ background: rowTint ? rowTint(row) : "transparent" }}>
                {columns.map((c) => (
                  <td key={c.key} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.gray100}`, verticalAlign: "top", color: C.navy }}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit && <div style={{ color: C.gray500, fontSize: 12, marginTop: 8 }}>and {shown.length - limit} more</div>}
    </div>
  );
}

function BarList({ items, onPick, picked }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((i) => (
        <div key={i.key} onClick={() => onPick && onPick(i.key)} style={{ cursor: onPick ? "pointer" : "default" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.navy, fontWeight: picked === i.key ? 800 : 600 }}>
            <span>{i.label}</span><span style={{ color: C.gray500 }}>{i.value}</span>
          </div>
          <div style={{ height: 10, background: C.gray100, borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${(100 * i.value) / max}%`, height: "100%", background: `linear-gradient(90deg, ${C.orange}, ${C.red})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineChart({ series, spikes, bucket }) {
  const w = 900, h = 220, pad = { l: 36, r: 10, t: 20, b: 40 };
  const max = Math.max(1, ...series.map((s) => s.flows));
  const bw = (w - pad.l - pad.r) / series.length;
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
  const thr = spikes ? y(spikes.threshold) : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", fontFamily: font }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={C.gray200} />
          <text x={pad.l - 6} y={y(max * f) + 4} fontSize={10} fill={C.gray500} textAnchor="end">{Math.round(max * f)}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const x = pad.l + i * bw + 2, width = Math.max(1, bw - 4);
        const spike = spikes && s.flows >= spikes.threshold;
        const bp = s.byPolicy;
        const parts = bp ? [[bp.allowed, C.green], [bp.potentially_blocked, C.orange], [bp.blocked, C.red]] : [[s.flows, C.teal]];
        let top = y(0);
        return (
          <g key={i}>
            {parts.map(([v, col], k) => {
              const hh = y(0) - y(v || 0);
              top -= hh;
              return <rect key={k} x={x} y={top} width={width} height={hh} fill={col} />;
            })}
            {spike && <rect x={x - 1} y={y(s.flows) - 1} width={width + 2} height={y(0) - y(s.flows) + 2} fill="none" stroke={C.red} strokeWidth={2} />}
            {i % Math.ceil(series.length / 12) === 0 && (
              <text x={x + width / 2} y={h - pad.b + 14} fontSize={10} fill={C.gray500} textAnchor="middle">{s.bucketStart.slice(11, 16)}</text>
            )}
          </g>
        );
      })}
      {thr != null && <line x1={pad.l} x2={w - pad.r} y1={thr} y2={thr} stroke={C.red} strokeDasharray="4 4" />}
      {thr != null && <text x={w - pad.r} y={thr - 4} fontSize={10} fill={C.red} textAnchor="end">3x median ({spikes.threshold})</text>}
      <text x={pad.l} y={h - 4} fontSize={10} fill={C.gray500}>bucket {bucket}, UTC labels</text>
    </svg>
  );
}

const endpointColumns = (isDst) => [
  { key: "ip", label: "Address", render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}>{r.ip}</span> },
  { key: "fqdn", label: "FQDN", render: (r) => r.fqdn || <span style={{ color: C.gray400 }}>–</span> },
  { key: "addressClass", label: "Class", render: (r) => <ClassChip c={r.addressClass} /> },
  { key: "ipLists", label: "IP list", sortable: false, render: (r) => (r.ipLists.length ? r.ipLists.join(", ") : <span style={{ color: C.gray400 }}>none</span>) },
  { key: "neighbourhood", label: "Neighbourhood", sortable: false, render: (r) => (r.neighbourhood ? `${r.neighbourhood.prefix} · ${r.neighbourhood.managedCount} managed` : <span style={{ color: C.gray400 }}>–</span>) },
  { key: "peerApps", label: "Peer apps", sortable: false, render: (r) => (
      <span>{r.peerApps.slice(0, 3).join(", ")}{r.peerApps.length > 3 ? ` +${r.peerApps.length - 3}` : ""}</span>) },
  { key: "ports", label: "Ports", sortable: false, render: (r) => (
      <span>
        {r.ports.map((p, i) => (
          <span key={i} style={{ fontWeight: p.admin ? 800 : 400, color: p.admin ? C.red : C.navy, marginRight: 6, fontFamily: "ui-monospace, Menlo, monospace" }}>{p.port}/{p.proto}</span>
        ))}
        {r.portCount > r.ports.length ? <span style={{ color: C.gray500 }}>+{r.portCount - r.ports.length}</span> : null}
      </span>) },
  ...(isDst ? [
    { key: "processes", label: "Processes", sortable: false, render: (r) => r.processes.join(", ") || "–" },
    { key: "provider", label: "Provider", render: (r) => (r.provider ? `${r.provider} (${r.providerConfidence})` : <span style={{ color: C.gray400 }}>–</span>) },
  ] : []),
  { key: "policy", label: "Policy", sortable: false, render: (r) => <PolicyBar policy={r.policy} /> },
  { key: "connections", label: "Connections", render: (r) => fmt(r.connections) },
  { key: "shapes", label: "Shape", sortable: false, render: (r) => r.shapes.map((s) => <Badge key={s} label={s} bg={C.gray100} color={C.gray700} />).reduce((acc, x, i) => (i ? [...acc, " ", x] : [x]), []) },
  { key: "findings", label: "Findings", sortable: false, render: (r) => r.findings.map((f) => {
      const sevOf = findings.find((x) => x.id === f && x.endpoint === r.ip)?.severity || "low";
      return <span key={f} style={{ marginRight: 4 }}><Badge label={f} {...sev[sevOf]} /></span>;
    }) },
];

function rowTint(r) {
  const sevs = findings.filter((f) => f.endpoint === r.ip || f.endpoint === r.fqdn).map((f) => f.severity);
  if (sevs.includes("high")) return C.redLight;
  if (sevs.includes("medium")) return C.orangeLight;
  return "transparent";
}

function EndpointTab({ rows, isDst }) {
  const [search, setSearch] = useState("");
  const [cls, setCls] = useState(null);
  const [shape, setShape] = useState(null);
  const [inList, setInList] = useState(false);
  const [inSubnet, setInSubnet] = useState(false);
  const shapes = [...new Set(rows.flatMap((r) => r.shapes))];
  const filtered = rows.filter((r) => (!cls || r.addressClass === cls) && (!shape || r.shapes.includes(shape)) && (!inList || r.ipLists.length) && (!inSubnet || r.neighbourhood));
  return (
    <Section title={isDst ? "Unknown destinations" : "Unknown sources"} accent={isDst ? C.teal : C.orange}
      right={<span style={{ color: C.gray500, fontSize: 12 }}>{filtered.length} of {rows.length}</span>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {["private", "public"].map((c) => <Chip key={c} label={c} active={cls === c} onClick={() => setCls(cls === c ? null : c)} />)}
        {shapes.map((s) => <Chip key={s} label={s} active={shape === s} onClick={() => setShape(shape === s ? null : s)} />)}
        <Chip label="in a named IP list" active={inList} onClick={() => setInList(!inList)} />
        {!isDst && <Chip label="inside managed subnet" active={inSubnet} onClick={() => setInSubnet(!inSubnet)} />}
      </div>
      <DataTable columns={endpointColumns(isDst)} rows={[...filtered].sort((a, b) => b.connections - a.connections)} rowTint={rowTint}
        search={search} setSearch={setSearch} empty={`No unknown ${isDst ? "destinations" : "sources"} in this window`} />
      {isDst && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>Collapsed ranges <span style={{ color: C.gray500, fontWeight: 400 }}>(ranges, not hosts, not in the counts)</span></div>
          {collapsedRanges.length ? collapsedRanges.map((c, i) => (
            <div key={i} style={{ fontSize: 13, color: C.gray700, marginTop: 4 }}>
              {c.label} · {c.port}/{c.proto} · {c.policy} · {fmt(c.connections)} connections
            </div>
          )) : <div style={{ color: C.gray500, fontSize: 13 }}>none</div>}
        </div>
      )}
    </Section>
  );
}

function Overview({ status }) {
  const top = findings.slice(0, 5);
  const total = (summaryKPIs.high + summaryKPIs.medium + summaryKPIs.low) || 1;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
        <KPICard label="Unknown sources" value={summaryKPIs.unknownSources} accent={C.orange} />
        <KPICard label="Unknown destinations" value={summaryKPIs.unknownDestinations} accent={C.teal} />
        <KPICard label="Inside managed subnets" value={summaryKPIs.insideManagedSubnet} subtitle="likely missing VENs" accent={C.red} />
        <KPICard label="Allowed into enforced" value={summaryKPIs.allowedIntoEnforced} subtitle="sources admitted by a rule" accent={C.red} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
        <KPICard label="Scanners" value={summaryKPIs.scanners} accent={C.red} />
        <KPICard label="Public sources" value={summaryKPIs.publicSources} accent={C.orange} />
        <KPICard label="Covered by named IP list" value={summaryKPIs.coveredByNamedList} subtitle="known range, not inventoried" accent={C.green} />
        <KPICard label="Noise endpoints" value={summaryKPIs.noiseEndpoints} subtitle="link-local, multicast, broadcast" accent={C.gray400} />
      </div>
      <Section title="Findings by severity" accent={C.navy}>
        <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: C.gray100 }}>
          <div style={{ width: `${(100 * summaryKPIs.high) / total}%`, background: C.red }} />
          <div style={{ width: `${(100 * summaryKPIs.medium) / total}%`, background: C.orange }} />
          <div style={{ width: `${(100 * summaryKPIs.low) / total}%`, background: C.amber }} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13, color: C.gray700 }}>
          <span><b style={{ color: C.red }}>{summaryKPIs.high}</b> high</span>
          <span><b style={{ color: C.orange }}>{summaryKPIs.medium}</b> medium</span>
          <span><b style={{ color: C.amberDark }}>{summaryKPIs.low}</b> low</span>
          <span style={{ color: C.gray500 }}>{fmt(summaryKPIs.connectionsUnknown)} connections involve unknown endpoints</span>
        </div>
      </Section>
      <Section title="Top issues" accent={C.red}>
        {top.length ? top.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: i < top.length - 1 ? `1px solid ${C.gray100}` : "none" }}>
            <SeverityBadge s={f.severity} />
            <div>
              <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{f.id} {f.title} · <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{f.endpoint}</span></div>
              <div style={{ color: C.gray700, fontSize: 13 }}>{f.numbers}</div>
            </div>
          </div>
        )) : <div style={{ color: C.gray500, fontSize: 13 }}>No findings in this window</div>}
      </Section>
      <div style={{ color: C.gray500, fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
        Appendix: {summaryKPIs.noiseEndpoints} noise endpoints counted, connections dropped from every total; {summaryKPIs.unlabelledWorkloads} unlabelled
        workloads seen in the unknown-source scan are inventoried and not unknown. Method: unknown means no workload on that side of the flow and not an
        interface address in the inventory; IP-list membership reported but not counted as known; policy mix joined from the summary's blocked section.
      </div>
    </div>
  );
}

function FindingsTab() {
  const [sevF, setSevF] = useState(null);
  const [idF, setIdF] = useState(null);
  const ids = [...new Set(findings.map((f) => f.id))].sort();
  const rows = findings.filter((f) => (!sevF || f.severity === sevF) && (!idF || f.id === idF));
  return (
    <Section title="Findings" accent={C.red} right={<span style={{ color: C.gray500, fontSize: 12 }}>{rows.length} of {findings.length}</span>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {["high", "medium", "low"].map((s) => <Chip key={s} label={s} active={sevF === s} onClick={() => setSevF(sevF === s ? null : s)} />)}
        <span style={{ width: 8 }} />
        {ids.map((i) => <Chip key={i} label={i} active={idF === i} onClick={() => setIdF(idF === i ? null : i)} />)}
      </div>
      {rows.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((f, i) => {
            const ep = [...unknownSources, ...unknownDestinations].find((e) => e.ip === f.endpoint || e.fqdn === f.endpoint);
            return (
              <div key={i} style={{ border: `1px solid ${C.gray200}`, borderLeft: `5px solid ${sev[f.severity].bg}`, borderRadius: 10, padding: "10px 14px", background: C.white }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <SeverityBadge s={f.severity} />
                  <span style={{ fontWeight: 800, color: C.navy }}>{f.id} {f.title}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: C.navy }}>{f.endpoint}</span>
                  {ep && <ClassChip c={ep.addressClass} />}
                  <span style={{ color: C.gray500, fontSize: 12 }}>{f.direction}</span>
                </div>
                <div style={{ color: C.gray700, fontSize: 13, marginTop: 6 }}>{f.numbers}</div>
                {f.detail && <div style={{ color: C.gray500, fontSize: 13, marginTop: 2 }}>{f.detail}</div>}
                {f.suggestionId && <div style={{ fontSize: 12, color: C.greenDark, marginTop: 6, fontWeight: 700 }}>→ suggestion {f.suggestionId}</div>}
              </div>
            );
          })}
        </div>
      ) : <div style={{ color: C.gray500, fontSize: 13 }}>No findings match</div>}
    </Section>
  );
}

function SubnetsTab() {
  const [picked, setPicked] = useState(null);
  const items = [...subnets].sort((a, b) => b.unknownCount - a.unknownCount).map((s) => ({
    key: s.prefix, value: s.unknownCount, label: `${s.prefix} · ${s.managedCount} managed · ${s.unmanagedCount} unmanaged · ${s.unknownCount} unknown` }));
  const sel = subnets.find((s) => s.prefix === picked);
  return (
    <Section title="Where the inventory gaps are" accent={C.orange} right={<span style={{ color: C.gray500, fontSize: 12 }}>managed prefixes with unknown hosts</span>}>
      {items.length ? <BarList items={items} onPick={setPicked} picked={picked} /> : <div style={{ color: C.gray500, fontSize: 13 }}>No unknown hosts inside managed subnets</div>}
      {sel && (
        <div style={{ marginTop: 14, background: C.gray50, borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>{sel.prefix}</div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: C.navy, marginTop: 4 }}>{sel.unknownIps.join("  ")}</div>
        </div>
      )}
    </Section>
  );
}

function SuggestionsTab() {
  const kindColor = { "create-workload": C.teal, "create-iplist": C.green, "create-deny-rule": C.red, ven: C.navy, "narrow-rule": C.orange };
  return (
    <Section title="Suggested objects (not created)" accent={C.green}
      right={<Badge label="NOTHING ON THIS TAB HAS BEEN EXECUTED" bg={C.amber} color={C.amberDark} />}>
      {suggestions.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {suggestions.map((s) => (
            <div key={s.id} style={{ border: `1px solid ${C.gray200}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Badge label={s.kind} bg={kindColor[s.kind] || C.gray400} color={C.white} />
                <span style={{ fontWeight: 800, color: C.navy }}>{s.id} {s.title}</span>
                <span style={{ color: C.gray500, fontSize: 12 }}>answers {s.findings.join(", ")}</span>
              </div>
              {s.callPlan && (
                <pre style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 10, fontSize: 12, marginTop: 8, overflowX: "auto", whiteSpace: "pre-wrap" }}>{s.callPlan}</pre>
              )}
            </div>
          ))}
        </div>
      ) : <div style={{ color: C.gray500, fontSize: 13 }}>No suggestions</div>}
    </Section>
  );
}

function DeepDiveTab() {
  const d = deepDive;
  const pol = { allowed: sev.ok, potentially_blocked: sev.medium, blocked: sev.high };
  return (
    <div>
      <Section title={`Deep dive: ${d.ip} as ${d.direction}`} accent={C.navy}
        right={<span style={{ fontSize: 12, color: C.gray500 }}>bucket {d.bucket} · effective {d.effectiveBucket}</span>}>
        {d.resolutionNote && <div style={{ background: C.amber, color: C.amberDark, borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10 }}>{d.resolutionNote}</div>}
        <TimelineChart series={d.series} spikes={d.spikes} bucket={d.bucket} />
        <div style={{ fontSize: 13, color: C.gray700, marginTop: 6 }}>
          {d.spikes.worst ? <span>Worst spike <b style={{ color: C.red }}>{d.spikes.worst.label}, {d.spikes.worst.multiple}x median</b> ({d.spikes.median} flows)</span> : "No spike"}
          {d.spikes.caveat && <div style={{ color: C.amberDark, marginTop: 4 }}>{d.spikes.caveat}</div>}
        </div>
      </Section>
      <Section title="Peer x port x policy" accent={C.teal}>
        <DataTable columns={[
          { key: "peer", label: "Peer" },
          { key: "port", label: "Port", render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{r.port}/{r.proto}</span> },
          { key: "policy", label: "Policy", render: (r) => <Badge label={r.policy.replace("_", " ")} {...(pol[r.policy] || sev.info)} /> },
          { key: "connections", label: "Connections", render: (r) => fmt(r.connections) },
          { key: "process", label: "Process", render: (r) => r.process || "–" },
        ]} rows={d.peers} empty="No peers" />
      </Section>
    </div>
  );
}

export default function UnknownEndpointsDashboard() {
  const tabs = ["Overview", "Findings", "Unknown sources", "Unknown destinations", "Subnets", "Suggestions", ...(deepDive ? ["Deep dive"] : [])];
  const [tab, setTab] = useState("Overview");
  const status = worstSeverity(findings);
  const title = { high: "Action required", medium: "Attention needed", ok: "No unknown endpoints of concern" }[status];
  const flags = [scope.inventoryTruncated && "inventory truncated", scope.summaryTruncated && "summary capped", scope.scanCapped && "scan capped at top_n"].filter(Boolean);
  const subtitle = `${scope.windowStart} to ${scope.windowEnd} (${scope.days} days), direction ${scope.direction}, ${scope.scopeLabels}, ${scope.queries} PCE queries` +
    (flags.length ? `, ${flags.join(", ")}` : ", complete data") + ". Policy objects read from draft.";
  return (
    <div style={{ fontFamily: font, background: C.gray50, minHeight: "100vh", padding: 20, color: C.navy }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 800, letterSpacing: 1 }}>ILLUMIO</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Unknown endpoints · {scope.pce}</div>
          </div>
          <div style={{ fontSize: 12, color: C.gray500 }}>generated {scope.generatedAt}</div>
        </div>
        <StatusBanner status={status} title={title} subtitle={subtitle} />
        <div style={{ marginTop: 14 }}><TabBar tabs={tabs} active={tab} onChange={setTab} /></div>
        {tab === "Overview" && <Overview status={status} />}
        {tab === "Findings" && <FindingsTab />}
        {tab === "Unknown sources" && <EndpointTab rows={unknownSources} isDst={false} />}
        {tab === "Unknown destinations" && <EndpointTab rows={unknownDestinations} isDst={true} />}
        {tab === "Subnets" && <SubnetsTab />}
        {tab === "Suggestions" && <SuggestionsTab />}
        {tab === "Deep dive" && deepDive && <DeepDiveTab />}
      </div>
    </div>
  );
}
