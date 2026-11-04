import React, { useState, useMemo } from "react";

// Rapid risk reduction dashboard: the plan's numbers, nothing more.
// scripts/triage.py writes dashboard.jsx by replacing the block between
// // ==== DATA ==== and // ==== END DATA ==== below with plan.json's data;
// this file doubles as the template and as a worked example.

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
const scope = {"date": "2026-11-04", "windowStart": "2026-10-05", "windowEnd": "2026-11-04", "windowDays": 30, "productionEnvs": ["prod"], "crownJewels": ["pay (prod)"], "crownJewelsSource": "given by the user", "rulesetName": "RRR-2026-11-04", "lowerBounds": [], "missingInputs": [], "policyVersion": "draft"};
const kpis = {"exposures": 8, "blockToday": 2, "thisWeek": 6, "runbooks": 1, "watch": 3, "maxScore": 16, "allowedWouldStop": 240, "pbWouldStop": 680, "unknownAdminSources": 2, "envCrossings": 2, "bridges": 2};
const lines = [{"id": "L1", "cls": "X4", "kind": "ringfence", "bucket": "week", "score": 16, "blast": 4, "ease": 4, "title": "selective ringfence ad (prod), deny_consumer any", "radius": "reaches 6 apps, 2 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0}, "evidence": ["detect-lateral-movement-paths high_risk_bridge_nodes[ad|prod]", "get-workloads rows app=ad env=prod (2 workloads)", "estate summary app_to_app rows to ad (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "bridge reaching 6 apps; enforcement: full 2; allow list: 3 remote apps, 3 already allowed; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny); scoped rulesets: Core-AD", "recommendation": "Preview, then draft a selective ringfence RF-ad-prod with deny_consumer any (this week): allow rules for 3 observed inbound remote apps (3 already allowed), a deny for everything else, enforced at the app's own workloads.", "action": "selective ringfence RF-ad-prod, deny_consumer any, this week", "admittingRules": []}, {"id": "L2", "cls": "X1", "kind": "override_deny", "bucket": "today", "score": 15, "blast": 3, "ease": 5, "title": "unknown source 10.1.1.250 on 3389/tcp, 22/tcp", "radius": "7 workloads, 5 enforced", "wouldHaveBlocked": {"allowed": 30, "potentiallyBlocked": 370, "blocked": 240}, "evidence": ["find-unknown-endpoints endpoints[ip=10.1.1.250].profile_evidence.admin_reach", "as_source.ports admin rows (640 connections as source)"], "rollback": "delete the override deny rule from the draft ruleset", "detail": "override deny on purpose; source 10.1.1.250 is private, lists: none, profile: admin_reach, scanner; allowed into enforced workloads: 30; peer apps: shop (prod), pay (prod), ad (prod)", "recommendation": "Draft an override deny from an IP list holding 10.1.1.250 to all workloads on 3389/tcp, 22/tcp in RRR-2026-11-04 (today). Override deny on purpose: it must hold even where an allow admits the source.", "action": "override deny from an IP list of the source to all workloads on 3389/tcp, 22/tcp, today", "admittingRules": []}, {"id": "L3", "cls": "X2", "kind": "deny", "bucket": "today", "score": 10, "blast": 2, "ease": 5, "title": "admin ports env=dev -> env=prod (production)", "radius": "2 destination apps", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 310, "blocked": 40}, "evidence": ["admin-port flows rows env=dev -> env=prod (2 app pairs, 3 ports)"], "rollback": "delete the deny rule from the draft ruleset", "detail": "ports seen: 5432/tcp (200: potentially_blocked 200), 22/tcp (110: potentially_blocked 110), 3389/tcp (40: blocked 40); app pairs: ci (dev) -> pay (prod) potentially_blocked 310; ci (dev) -> shop (prod) blocked 40", "recommendation": "Draft a deny env=dev -> env=prod on 22/tcp, 3389/tcp, 5432/tcp in RRR-2026-11-04 (today); enforced on managed workloads carrying env=dev in selective or full enforcement.", "action": "deny env=dev -> env=prod on 22/tcp, 3389/tcp, 5432/tcp, today", "admittingRules": []}, {"id": "L4", "cls": "X4", "kind": "ringfence", "bucket": "week", "score": 9, "blast": 3, "ease": 3, "title": "selective ringfence jump (mgmt), deny_consumer any", "radius": "reaches 4 apps, 1 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0}, "evidence": ["detect-lateral-movement-paths high_risk_bridge_nodes[jump|mgmt]", "get-workloads rows app=jump env=mgmt (1 workloads)", "estate summary app_to_app rows to jump (mgmt)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "bridge reaching 4 apps; enforcement: full 1; allow list: 0 remote apps, 0 already allowed; no inbound app traffic observed, so the fence denies all inbound; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-jump-mgmt with deny_consumer any (this week): allow rules for 0 observed inbound remote apps (0 already allowed), a deny for everything else, enforced at the app's own workloads. No inbound app traffic was observed, so the fence denies all inbound.", "action": "selective ringfence RF-jump-mgmt, deny_consumer any, this week", "admittingRules": []}, {"id": "L5", "cls": "X2", "kind": "deny", "bucket": "week", "score": 6, "blast": 2, "ease": 3, "title": "admin ports env=mgmt -> env=prod (production)", "radius": "2 destination apps", "wouldHaveBlocked": {"allowed": 200, "potentiallyBlocked": 0, "blocked": 0}, "evidence": ["admin-port flows rows env=mgmt -> env=prod (2 app pairs, 2 ports)"], "rollback": "delete the deny rule from the draft ruleset", "detail": "ports seen: 22/tcp (120: allowed 120), 3389/tcp (80: allowed 80); app pairs: jump (mgmt) -> shop (prod) allowed 120; jump (mgmt) -> pay (prod) allowed 80; 200 allowed connections would stop: confirm they may, admitted by: RF-shop-prod: all workloads -> all workloads on All Services; Core-AD: all workloads -> all workloads on 389/tcp, 88/tcp", "recommendation": "Draft a deny env=mgmt -> env=prod on 22/tcp, 3389/tcp in RRR-2026-11-04 (this week); enforced on managed workloads carrying env=mgmt in selective or full enforcement. 200 allowed connections would stop, admitted by: RF-shop-prod: all workloads -> all workloads on All Services; Core-AD: all workloads -> all workloads on 389/tcp, 88/tcp; confirm first.", "action": "deny env=mgmt -> env=prod on 22/tcp, 3389/tcp, this week after review", "admittingRules": ["RF-shop-prod: all workloads -> all workloads on All Services", "Core-AD: all workloads -> all workloads on 389/tcp, 88/tcp"]}, {"id": "L6", "cls": "X5", "kind": "ringfence", "bucket": "week", "score": 6, "blast": 2, "ease": 3, "title": "selective ringfence pay (prod), deny_consumer any", "radius": "3 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 0, "blocked": 0}, "evidence": ["get-workloads rows app=pay env=prod (3 workloads)", "estate summary app_to_app rows to pay (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "2 workloads not enforcing with 365 denied inbound connections; enforcement: selective 1, visibility_only 2; allow list: 4 remote apps, 2 already allowed; no rule possible for 0 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-pay-prod with deny_consumer any (this week): allow rules for 4 observed inbound remote apps (2 already allowed), a deny for everything else, enforced at the app's own workloads. Then move the app's 2 non-enforcing workloads to selective enforcement (update-workload, not drafted here).", "action": "selective ringfence RF-pay-prod, deny_consumer any, this week; then selective enforcement", "admittingRules": []}, {"id": "L7", "cls": "X1", "kind": "override_deny", "bucket": "week", "score": 4, "blast": 2, "ease": 2, "title": "unknown source 203.0.113.9 (scan.example.net) on 22/tcp", "radius": "2 workloads, 2 enforced", "wouldHaveBlocked": {"allowed": 10, "potentiallyBlocked": 0, "blocked": 0}, "evidence": ["find-unknown-endpoints endpoints[ip=203.0.113.9].profile_evidence.admin_reach", "as_source.ports admin rows (90 connections as source)"], "rollback": "delete the override deny rule from the draft ruleset", "detail": "override deny on purpose; source 203.0.113.9 scan.example.net is public, lists: Partners, profile: admin_reach; allowed into enforced workloads: 90; peer apps: shop (prod); 10 allowed connections would stop: confirm admin access from this source may end", "recommendation": "Draft an override deny from an IP list holding 203.0.113.9 to all workloads on 22/tcp in RRR-2026-11-04 (this week). Override deny on purpose: it must hold even where an allow admits the source. 10 allowed connections would stop; confirm admin access from this source may end first.", "action": "override deny from an IP list of the source to all workloads on 22/tcp, this week", "admittingRules": []}, {"id": "L8", "cls": "X5", "kind": "ringfence", "bucket": "week", "score": 4, "blast": 1, "ease": 4, "title": "selective ringfence hr (prod), deny_consumer any", "radius": "1 workloads", "wouldHaveBlocked": {"allowed": 0, "potentiallyBlocked": 12, "blocked": 0}, "evidence": ["get-workloads rows app=hr env=prod (1 workloads)", "estate summary app_to_app rows to hr (prod)"], "rollback": "delete the RF- ruleset from the draft; workloads stay in their current enforcement mode", "detail": "1 workloads not enforcing with 12 denied inbound connections; enforcement: idle 1; allow list: 0 remote apps, 0 already allowed; no inbound app traffic observed, so the fence denies all inbound; no rule possible for 12 connections from unlabelled or IP-list sources (they hit the deny)", "recommendation": "Preview, then draft a selective ringfence RF-hr-prod with deny_consumer any (this week): allow rules for 0 observed inbound remote apps (0 already allowed), a deny for everything else, enforced at the app's own workloads. No inbound app traffic was observed, so the fence denies all inbound. 12 connections from unlabelled or IP-list sources get no allow and will hit the deny; label or list them first if they matter. Then move the app's 1 non-enforcing workloads to selective enforcement (update-workload, not drafted here).", "action": "selective ringfence RF-hr-prod, deny_consumer any, this week; then selective enforcement", "admittingRules": []}];
const runbooks = [{"name": "EMERGENCY-ISOLATE-pay-prod", "workloads": 3, "found": true, "steps": ["get-labels key app value pay; key env value prod", "create-ruleset EMERGENCY-ISOLATE-pay-prod, scoped to app=pay, env=prod", "create-deny-rule override deny: providers ams, consumers ams and Any, All Services, unscoped_consumers true", "optional: outbound override deny in an unscoped ruleset (consumers the app's labels, providers ams and Any)", "provision-policy"], "effect": "all traffic to the app stops, allow rules included.", "undo": "delete the override deny rules and provision again."}];
const watch = [{"cls": "X3", "title": "public source 203.0.113.9 scan.example.net", "detail": "reaches 2 workloads on 443/tcp; allowed into enforced 90; admitted by Partners", "recommendation": "No draft rule. Find the rule or list admitting 203.0.113.9: Partners; narrow it or add the address to a named list. Its admin ports are covered by the X1 override deny."}, {"cls": "X3", "title": "public source 198.51.100.20", "detail": "reaches 1 workloads on 443/tcp; allowed into enforced 0; admitted by no named list", "recommendation": "No draft rule. Find the rule or list admitting 198.51.100.20: the default Any list or a broad rule; narrow it or add the address to a named list."}, {"cls": "X6", "title": "identity jdoe", "detail": "interactive account active from 9 workloads; one person on several devices, or a shared credential; interactive account reaches 6 distinct apps -- wide for a single user; 9 workloads, 6 apps; admin ports 3389/tcp, 445/tcp", "recommendation": "No Illumio rule can name an identity. Confirm with the owner whether jdoe should be active from 9 workloads across 6 apps; the admin ports it uses (3389/tcp, 445/tcp) are what the X1 and X2 denies narrow."}];
const baseline = {"available": true, "bucket": "1d", "days": 30, "median": 22, "total": 706, "worst": {"bucketStart": "2026-10-14T00:00:00Z", "flows": 80, "multiple": 3.8}, "caveat": null, "truncated": false, "threshold": 63.0, "spikeBuckets": [{"bucketStart": "2026-10-14T00:00:00Z"}], "series": [{"bucketStart": "2026-10-05T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-06T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-07T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}, {"bucketStart": "2026-10-08T00:00:00Z", "flows": 25, "pb": 20, "blocked": 5}, {"bucketStart": "2026-10-09T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-10T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-11T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-12T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-10-13T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-14T00:00:00Z", "flows": 80, "pb": 64, "blocked": 16}, {"bucketStart": "2026-10-15T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-16T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-17T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}, {"bucketStart": "2026-10-18T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-19T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-20T00:00:00Z", "flows": 25, "pb": 20, "blocked": 5}, {"bucketStart": "2026-10-21T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-22T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-23T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-24T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-10-25T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-26T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-27T00:00:00Z", "flows": 24, "pb": 20, "blocked": 4}, {"bucketStart": "2026-10-28T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-10-29T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-10-30T00:00:00Z", "flows": 20, "pb": 16, "blocked": 4}, {"bucketStart": "2026-10-31T00:00:00Z", "flows": 23, "pb": 19, "blocked": 4}, {"bucketStart": "2026-11-01T00:00:00Z", "flows": 22, "pb": 18, "blocked": 4}, {"bucketStart": "2026-11-02T00:00:00Z", "flows": 21, "pb": 17, "blocked": 4}, {"bucketStart": "2026-11-03T00:00:00Z", "flows": 19, "pb": 16, "blocked": 3}]};
const callPlans = [{"for": "X1 (today)", "tool": "create-iplist", "runbook": null, "json": "{\n \"for\": \"X1 (today)\",\n \"tool\": \"create-iplist\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"name\": \"RRR-unknown-admin-sources-2026-11-04\",\n \"description\": \"Unknown (non-workload) sources seen on admin ports; rapid risk reduction\",\n \"ip_ranges\": [\n  {\n   \"from_ip\": \"10.1.1.250\",\n   \"description\": \"unknown source\"\n  }\n ]\n}"}, {"for": "X1 (week)", "tool": "create-iplist", "runbook": null, "json": "{\n \"for\": \"X1 (week)\",\n \"tool\": \"create-iplist\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"name\": \"RRR-unknown-admin-sources-2026-11-04-review\",\n \"description\": \"Unknown (non-workload) sources seen on admin ports; rapid risk reduction; these admit allowed traffic, review before the deny\",\n \"ip_ranges\": [\n  {\n   \"from_ip\": \"203.0.113.9\",\n   \"description\": \"scan.example.net\"\n  }\n ]\n}"}, {"for": "ruleset", "tool": "create-ruleset", "runbook": null, "json": "{\n \"for\": \"ruleset\",\n \"tool\": \"create-ruleset\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"name\": \"RRR-2026-11-04\",\n \"description\": \"Rapid risk reduction drafts 2026-11-04; unscoped (scopes: [] = all workloads)\",\n \"scopes\": []\n}"}, {"for": "X1 (today)", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X1 (today)\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"iplist:RRR-unknown-admin-sources-2026-11-04\"\n ],\n \"providers\": [\n  \"ams\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": true,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"why_override\": \"incident-grade block: must hold even where an allow rule admits the source\",\n  \"would_have_blocked\": {\n   \"allowed\": 30,\n   \"potentially_blocked\": 370,\n   \"blocked\": 240\n  }\n }\n}"}, {"for": "X1 (week)", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X1 (week)\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"iplist:RRR-unknown-admin-sources-2026-11-04-review\"\n ],\n \"providers\": [\n  \"ams\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": true,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"why_override\": \"incident-grade block: must hold even where an allow rule admits the source\",\n  \"would_have_blocked\": {\n   \"allowed\": 10,\n   \"potentially_blocked\": 0,\n   \"blocked\": 0\n  }\n }\n}"}, {"for": "X2 dev->prod", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X2 dev->prod\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"env=dev\"\n ],\n \"providers\": [\n  \"env=prod\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 5432,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": false,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"enforced_on\": \"managed workloads carrying env=dev in selective or full enforcement\",\n  \"would_have_blocked\": {\n   \"allowed\": 0,\n   \"potentially_blocked\": 310,\n   \"blocked\": 40,\n   \"denied_share\": 1.0\n  },\n  \"admitting_rules\": []\n }\n}"}, {"for": "X2 mgmt->prod", "tool": "create-deny-rule", "runbook": null, "json": "{\n \"for\": \"X2 mgmt->prod\",\n \"tool\": \"create-deny-rule\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"ruleset_name\": \"RRR-2026-11-04\",\n \"consumers\": [\n  \"env=mgmt\"\n ],\n \"providers\": [\n  \"env=prod\"\n ],\n \"ingress_services\": [\n  {\n   \"port\": 22,\n   \"proto\": \"tcp\"\n  },\n  {\n   \"port\": 3389,\n   \"proto\": \"tcp\"\n  }\n ],\n \"override_deny\": false,\n \"unscoped_consumers\": true,\n \"_notes\": {\n  \"enforced_on\": \"managed workloads carrying env=mgmt in selective or full enforcement\",\n  \"would_have_blocked\": {\n   \"allowed\": 200,\n   \"potentially_blocked\": 0,\n   \"blocked\": 0,\n   \"denied_share\": 0.0\n  },\n  \"admitting_rules\": [\n   \"RF-shop-prod: all workloads -> all workloads on All Services\",\n   \"Core-AD: all workloads -> all workloads on 389/tcp, 88/tcp\"\n  ]\n }\n}"}, {"for": "X4 ad (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 ad (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"ad\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X4 ad (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 ad (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"ad\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-ad-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "X4 jump (mgmt)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 jump (mgmt)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"jump\",\n \"env_name\": \"mgmt\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X4 jump (mgmt)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X4 jump (mgmt)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"jump\",\n \"env_name\": \"mgmt\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-jump-mgmt\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "X5 pay (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 pay (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"pay\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X5 pay (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 pay (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"pay\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-pay-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "X5 hr (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 hr (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"the user's preview call, never this skill's\",\n \"app_name\": \"hr\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": true\n}"}, {"for": "X5 hr (prod)", "tool": "create-ringfence", "runbook": null, "json": "{\n \"for\": \"X5 hr (prod)\",\n \"tool\": \"create-ringfence\",\n \"DO_NOT_CALL\": \"draft for review\",\n \"app_name\": \"hr\",\n \"env_name\": \"prod\",\n \"lookback_days\": 30,\n \"dry_run\": false,\n \"selective\": true,\n \"deny_consumer\": \"any\",\n \"ruleset_name\": \"RF-hr-prod\",\n \"_notes\": \"allow rules for every observed inbound remote app with app and env labels; unlabelled and IP-list sources get no allow and hit the deny\"\n}"}, {"for": "CJ pay (prod)", "tool": null, "runbook": "EMERGENCY-ISOLATE-pay-prod", "json": "{\n \"for\": \"CJ pay (prod)\",\n \"runbook\": \"EMERGENCY-ISOLATE-pay-prod\",\n \"DO_NOT_CALL\": \"run only on a confirmed incident\",\n \"steps\": [\n  {\n   \"tool\": \"get-labels\",\n   \"key\": \"app\",\n   \"value\": \"pay\"\n  },\n  {\n   \"tool\": \"get-labels\",\n   \"key\": \"env\",\n   \"value\": \"prod\"\n  },\n  {\n   \"tool\": \"create-ruleset\",\n   \"name\": \"EMERGENCY-ISOLATE-pay-prod\",\n   \"scopes\": [\n    [\n     {\n      \"key\": \"app\",\n      \"value\": \"pay\"\n     },\n     {\n      \"key\": \"env\",\n      \"value\": \"prod\"\n     }\n    ]\n   ]\n  },\n  {\n   \"tool\": \"create-deny-rule\",\n   \"ruleset_name\": \"EMERGENCY-ISOLATE-pay-prod\",\n   \"providers\": [\n    \"ams\"\n   ],\n   \"consumers\": [\n    \"ams\",\n    \"iplist:Any (0.0.0.0/0 and ::/0)\"\n   ],\n   \"ingress_services\": [\n    {\n     \"service\": \"All Services\"\n    }\n   ],\n   \"override_deny\": true,\n   \"unscoped_consumers\": true,\n   \"effect\": \"all inbound to the app stops, allow rules included\"\n  },\n  {\n   \"tool\": \"create-ruleset\",\n   \"name\": \"EMERGENCY-ISOLATE-pay-prod-outbound\",\n   \"scopes\": [],\n   \"optional\": true,\n   \"note\": \"outbound needs an unscoped ruleset: consumers are the app's labels, providers ams and Any\"\n  },\n  {\n   \"tool\": \"create-deny-rule\",\n   \"ruleset_name\": \"EMERGENCY-ISOLATE-pay-prod-outbound\",\n   \"optional\": true,\n   \"consumers\": [\n    \"app=pay\",\n    \"env=prod\"\n   ],\n   \"providers\": [\n    \"ams\",\n    \"iplist:Any (0.0.0.0/0 and ::/0)\"\n   ],\n   \"ingress_services\": [\n    {\n     \"service\": \"All Services\"\n    }\n   ],\n   \"override_deny\": true,\n   \"unscoped_consumers\": true\n  },\n  {\n   \"tool\": \"provision-policy\",\n   \"note\": \"the only step that changes enforcement\"\n  },\n  {\n   \"undo\": \"delete the override deny rules (delete-deny-rule) and the rulesets, then provision-policy again\"\n  }\n ]\n}"}];
// ==== END DATA ====

const font = "'DM Sans', system-ui, sans-serif";
const bucketStyle = {
  today: { bg: C.red, color: C.white, label: "BLOCK TODAY" },
  week: { bg: C.orange, color: C.white, label: "THIS WEEK" },
  demand: { bg: C.gray300, color: C.navy, label: "ON DEMAND" },
  watch: { bg: C.gray300, color: C.navy, label: "WATCH" },
};
const kindLabel = { override_deny: "override deny", deny: "deny", ringfence: "selective ringfence", watch: "watch" };
const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));

function Badge({ label, color, bg, mono }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: bg, color, letterSpacing: 0.2, fontFamily: mono ? "ui-monospace, Menlo, monospace" : font, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
const BucketBadge = ({ b }) => { const s = bucketStyle[b] || bucketStyle.watch; return <Badge label={s.label} bg={s.bg} color={s.color} />; };
const ClassBadge = ({ cls }) => <Badge label={cls} bg={C.gray100} color={C.gray700} mono />;

// The top border is red or orange only when the KPI is a risk and non-zero.
function KPICard({ label, value, subtitle, attention }) {
  const border = value > 0 && attention === "high" ? C.red : value > 0 && attention === "medium" ? C.orange : C.gray300;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: "14px 16px", borderTop: `4px solid ${border}`, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: C.navy, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.gray500, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function StatusBanner({ status, title, subtitle }) {
  const map = { high: C.red, medium: C.orange, ok: C.green };
  return (
    <div style={{ background: map[status] || C.green, color: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 22 }}>●</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
        <div style={{ fontSize: 13, opacity: 0.92 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Swatch({ color, kind }) {
  if (kind === "text") return <span style={{ color, fontWeight: 800, fontFamily: "ui-monospace, Menlo, monospace" }}>22/tcp</span>;
  if (kind === "outline") return <span style={{ display: "inline-block", width: 14, height: 10, border: `2px solid ${color}`, borderRadius: 2 }} />;
  if (kind === "dash") return <span style={{ display: "inline-block", width: 18, borderTop: `2px dashed ${color}` }} />;
  return <span style={{ display: "inline-block", width: 14, height: 10, background: color, borderRadius: 2 }} />;
}

function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.gray500, marginTop: 10,
      paddingTop: 8, borderTop: `1px dashed ${C.gray200}` }}>
      <span style={{ fontWeight: 700 }}>Legend</span>
      {items.map(([label, color, kind], i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Swatch color={color} kind={kind} />{label}</span>
      ))}
    </div>
  );
}

const LEGEND = {
  buckets: [["block today (deny or override deny, ease 4 or more)", C.red], ["this week (ringfence, or deny after review)", C.orange], ["watch and isolate on demand: nothing drafted", C.gray300]],
  decisions: [["allowed: an allow rule admits it; the rule would stop it", C.green], ["potentially blocked: no allow rule covers it", C.orange], ["blocked: already stopped, the rule makes it stick", C.red]],
  kpi: [["KPI top border red = allowed connections that would stop, when above zero", C.red], ["orange = exposures with no draft fix, when above zero", C.orange], ["grey = no meaning", C.gray300]],
  scores: [["bar length = score (blast radius x ease, 1 to 25); bar colour = bucket", C.red], ["this week", C.orange]],
  timeline: [["potentially blocked flows", C.orange], ["blocked flows", C.red], ["spike bucket (>= 3x median)", C.red, "outline"], ["3x median threshold", C.red, "dash"]],
  runbooks: [["override deny step: beats every allow rule", C.red, "text"], ["provision step: the only one that changes enforcement", C.navy, "text"]],
};

function ColourKey() {
  const items = [["block today", C.red, C.white], ["this week", C.orange, C.white], ["watch · on demand", C.gray300, C.navy], ["allowed", C.green, C.white]];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.gray500 }}>
      <span style={{ fontWeight: 700, marginRight: 2 }}>Colour key</span>
      {items.map(([l, bg, color]) => <Badge key={l} label={l} bg={bg} color={color} />)}
      <span>· grey strips and borders mean nothing · each section has its own legend</span>
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

function Section({ title, children, right }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 18, borderRadius: 2, background: C.gray300, display: "inline-block" }} />
          <span style={{ fontWeight: 800, color: C.navy, fontSize: 15 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function DecisionBar({ w }) {
  const a = w.allowed || 0, p = w.potentiallyBlocked || 0, b = w.blocked || 0;
  const total = a + p + b;
  const seg = (n, color) => (total ? <div title={fmt(n)} style={{ width: `${(100 * n) / total}%`, background: color }} /> : null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 170 }}>
      <div title={`allowed ${fmt(a)} · potentially blocked ${fmt(p)} · blocked ${fmt(b)}`}
        style={{ display: "flex", height: 10, width: 110, borderRadius: 5, overflow: "hidden", background: C.gray200 }}>
        {seg(a, C.green)}{seg(p, C.orange)}{seg(b, C.red)}
      </div>
      <span style={{ fontSize: 11, color: C.gray500, whiteSpace: "nowrap", fontFamily: "ui-monospace, Menlo, monospace" }}>{fmt(a)}/{fmt(p)}/{fmt(b)}</span>
    </div>
  );
}

function ScoreBars({ items }) {
  if (!items.length) return <div style={{ color: C.gray500, fontSize: 13 }}>No exposures with a draft fix.</div>;
  const max = Math.max(25, ...items.map((l) => l.score));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((l) => (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1.2fr) 3fr 60px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><ClassBadge cls={l.cls} /> {l.title}</span>
          <div style={{ background: C.gray100, borderRadius: 4, height: 14 }}>
            <div style={{ width: `${(100 * l.score) / max}%`, height: 14, borderRadius: 4, background: l.bucket === "today" ? C.red : C.orange }} />
          </div>
          <span style={{ fontWeight: 800, color: C.navy, textAlign: "right" }}>{l.score}</span>
        </div>
      ))}
    </div>
  );
}

function LineTable({ rows, empty }) {
  const [open, setOpen] = useState(null);
  if (!rows.length) return <div style={{ color: C.gray500, fontSize: 13 }}>{empty}</div>;
  const th = (t) => <th style={{ textAlign: "left", padding: "8px 10px", color: C.gray500, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `2px solid ${C.gray200}`, whiteSpace: "nowrap" }}>{t}</th>;
  const td = { padding: "8px 10px", borderBottom: `1px solid ${C.gray100}`, verticalAlign: "top", fontSize: 13, color: C.navy };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{th("Score")}{th("Class")}{th("Exposure")}{th("Fix")}{th("Blast radius")}{th("Ease")}{th("Would have blocked")}{th("")}</tr></thead>
        <tbody>
          {rows.map((l) => (
            <React.Fragment key={l.id}>
              <tr>
                <td style={{ ...td, fontWeight: 800 }}>{l.score}</td>
                <td style={td}><ClassBadge cls={l.cls} /></td>
                <td style={td}>{l.title}</td>
                <td style={td}>{kindLabel[l.kind] || l.kind}</td>
                <td style={td}>{l.blast} <span style={{ color: C.gray500, fontSize: 12 }}>({l.radius})</span></td>
                <td style={td}>{l.ease}</td>
                <td style={td}><DecisionBar w={l.wouldHaveBlocked} /></td>
                <td style={td}><button onClick={() => setOpen(open === l.id ? null : l.id)} style={{ cursor: "pointer", border: `1px solid ${C.gray300}`, background: C.white, borderRadius: 6, fontFamily: font, fontSize: 12, padding: "3px 8px", color: C.gray700 }}>{open === l.id ? "hide" : "detail"}</button></td>
              </tr>
              {open === l.id && (
                <tr><td colSpan={8} style={{ ...td, background: C.gray50, fontSize: 12, color: C.gray700 }}>
                  <div><b>Recommendation:</b> {l.recommendation}</div>
                  <div style={{ marginTop: 4 }}><b>What we saw:</b> {l.detail}</div>
                  <div style={{ marginTop: 4 }}><b>Evidence:</b> {l.evidence.join("; ")}</div>
                  {l.admittingRules.length > 0 && <div style={{ marginTop: 4 }}><b>Admitted today by:</b> {l.admittingRules.join("; ")}</div>}
                  <div style={{ marginTop: 4 }}><b>Rollback:</b> {l.rollback}</div>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineChart({ b }) {
  if (!b.available || !b.series.length) return <div style={{ color: C.gray500, fontSize: 13 }}>No timeline saved; run get-traffic-timeline for the baseline.</div>;
  const W = 900, H = 180, pad = 28;
  const max = Math.max(1, ...b.series.map((s) => s.flows));
  const bw = (W - pad * 2) / b.series.length;
  const y = (v) => H - pad - ((H - pad * 2) * v) / max;
  const spikes = new Set((b.spikeBuckets || []).map((s) => s.bucketStart));
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block" }}>
        {b.series.map((s, i) => {
          const x = pad + i * bw;
          const hb = y(0) - y(s.blocked), hp = y(0) - y(s.pb);
          return (
            <g key={s.bucketStart}>
              <rect x={x + 1} y={y(0) - hb} width={Math.max(1, bw - 2)} height={hb} fill={C.red} />
              <rect x={x + 1} y={y(0) - hb - hp} width={Math.max(1, bw - 2)} height={hp} fill={C.orange} />
              {spikes.has(s.bucketStart) && <rect x={x} y={y(s.flows) - 2} width={Math.max(1, bw)} height={y(0) - y(s.flows) + 2} fill="none" stroke={C.red} strokeWidth={2} />}
            </g>
          );
        })}
        {b.threshold != null && <line x1={pad} x2={W - pad} y1={y(b.threshold)} y2={y(b.threshold)} stroke={C.red} strokeDasharray="5 4" strokeWidth={1.5} />}
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke={C.gray300} />
        <text x={pad} y={H - 8} fontSize={10} fill={C.gray500} fontFamily={font}>{b.series[0].bucketStart.slice(0, 10)}</text>
        <text x={W - pad} y={H - 8} fontSize={10} fill={C.gray500} fontFamily={font} textAnchor="end">{b.series[b.series.length - 1].bucketStart.slice(0, 10)}</text>
        <text x={pad} y={14} fontSize={10} fill={C.gray500} fontFamily={font}>max {fmt(max)} flows per {b.bucket}</text>
      </svg>
    </div>
  );
}

function CallPlanBlock({ c }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{c.for}: {c.tool || c.runbook} <Badge label="DO_NOT_CALL" bg={C.gray100} color={C.gray700} mono /></div>
      <pre style={{ background: C.gray50, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 10, fontSize: 11, overflowX: "auto", margin: "6px 0 0" }}>{c.json}</pre>
    </div>
  );
}

export default function App() {
  const tabs = ["Overview", "Block today", "This week", "Isolate on demand", "Watch", "Baseline", "Call plans"];
  const [tab, setTab] = useState("Overview");
  const today = useMemo(() => lines.filter((l) => l.bucket === "today"), []);
  const week = useMemo(() => lines.filter((l) => l.bucket === "week"), []);
  const status = today.length ? "high" : week.length ? "medium" : "ok";
  const bannerTitle = today.length ? `${today.length} exposure${today.length > 1 ? "s" : ""} to block today` : week.length ? `${week.length} to fence or review this week` : "Nothing to draft";
  const subtitle = `${scope.windowStart} to ${scope.windowEnd} (${scope.windowDays} days) · production: ${scope.productionEnvs.join(", ") || "none"} · crown jewels: ${scope.crownJewels.join(", ") || "none"} · draft ruleset ${scope.rulesetName}` +
    (scope.lowerBounds.length ? ` · lower bounds on ${scope.lowerBounds.join(", ")}` : "") + (scope.missingInputs.length ? ` · missing inputs ${scope.missingInputs.join(", ")}` : "") + " · nothing is provisioned";
  const top = [...lines].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div style={{ fontFamily: font, background: C.gray50, minHeight: "100vh", padding: 20, color: C.navy }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Rapid risk reduction</div>
          <div style={{ fontSize: 13, color: C.gray500 }}>Plan of {scope.date} · what to block or fence now, with the least chance of breaking something</div>
        </div>
        <Badge label="DRAFT ONLY · NOTHING PROVISIONED" bg={C.gray100} color={C.gray700} />
      </div>
      <div style={{ marginTop: 14 }}><StatusBanner status={status} title={bannerTitle} subtitle={subtitle} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <ColourKey />
      </div>

      {tab === "Overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
            <KPICard label="Exposures with a fix" value={kpis.exposures} subtitle="draft rules and ringfences" />
            <KPICard label="Block today" value={kpis.blockToday} subtitle="deny, ease 4 or more" />
            <KPICard label="This week" value={kpis.thisWeek} subtitle="ringfences, denies after review" />
            <KPICard label="Isolation runbooks" value={kpis.runbooks} subtitle="held in reserve" />
            <KPICard label="Allowed connections that would stop" value={kpis.allowedWouldStop} subtitle="across all deny lines" attention="high" />
            <KPICard label="Watch" value={kpis.watch} subtitle="no draft fix" attention="medium" />
          </div>
          <Section title="KPI borders"><Legend items={LEGEND.kpi} /></Section>
          <Section title="Exposures by score">
            <ScoreBars items={[...lines].sort((a, b) => b.score - a.score)} />
            <Legend items={LEGEND.scores} />
          </Section>
          <Section title="Top recommendations">
            {top.length ? top.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.gray100}`, fontSize: 13 }}>
                <BucketBadge b={l.bucket} />
                <div><b>{l.score}</b> · <ClassBadge cls={l.cls} /> {l.title}<div style={{ color: C.gray700, marginTop: 2 }}>{l.recommendation}</div></div>
              </div>
            )) : <div style={{ color: C.gray500, fontSize: 13 }}>No exposures with a draft fix.</div>}
            <Legend items={LEGEND.buckets} />
          </Section>
        </>
      )}

      {tab === "Block today" && (
        <Section title="Block today: deny or override deny with ease 4 or more">
          <LineTable rows={today} empty="Nothing qualifies: no deny with ease 4 or more." />
          <Legend items={LEGEND.decisions} />
        </Section>
      )}

      {tab === "This week" && (
        <Section title="This week: fence, or deny after review">
          <LineTable rows={week} empty="Nothing this week." />
          <Legend items={LEGEND.decisions} />
        </Section>
      )}

      {tab === "Isolate on demand" && (
        <Section title="Isolation runbooks (run only on a confirmed incident)">
          {runbooks.length ? runbooks.map((r) => (
            <div key={r.name} style={{ border: `1px solid ${C.gray200}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>{r.name} <span style={{ fontWeight: 400, color: C.gray500, fontSize: 12 }}>· {r.workloads} workloads in inventory{r.found ? "" : " · not found, check the label values"}</span></div>
              <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 13 }}>
                {r.steps.map((s, i) => <li key={i} style={{ marginBottom: 3, color: /override deny/.test(s) ? C.red : /provision-policy/.test(s) ? C.navy : C.gray700, fontWeight: /override deny|provision-policy/.test(s) ? 700 : 400 }}>{s}</li>)}
              </ol>
              <div style={{ fontSize: 12, color: C.gray700, marginTop: 6 }}><b>Effect:</b> {r.effect} <b>Undo:</b> {r.undo}</div>
            </div>
          )) : <div style={{ color: C.gray500, fontSize: 13 }}>None: no crown jewels given and no production bridge app found; name one as app (env) and re-run.</div>}
          <Legend items={LEGEND.runbooks} />
        </Section>
      )}

      {tab === "Watch" && (
        <Section title="Watch: evidence without a draft rule">
          {watch.length ? watch.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.gray100}`, fontSize: 13 }}>
              <ClassBadge cls={w.cls} />
              <div><b>{w.title}</b><div style={{ color: C.gray700, marginTop: 2 }}>{w.detail}</div><div style={{ color: C.gray500, marginTop: 2 }}>Recommendation: {w.recommendation}</div></div>
            </div>
          )) : <div style={{ color: C.gray500, fontSize: 13 }}>Nothing to watch.</div>}
          <Legend items={[["class badge: grey, no meaning", C.gray100]]} />
        </Section>
      )}

      {tab === "Baseline" && (
        <Section title={`Blocked and potentially blocked flows per ${baseline.bucket} (baseline for the 7-day review)`}>
          <div style={{ fontSize: 13, color: C.gray700, marginBottom: 8 }}>
            {baseline.available ? `${baseline.days} buckets · median ${fmt(baseline.median)} · total ${fmt(baseline.total)}${baseline.truncated ? " (capped; lower bound)" : ""} · ` : ""}
            {baseline.caveat ? `No spike quoted: ${baseline.caveat}` : baseline.worst ? `Worst spike ${baseline.worst.bucketStart} with ${fmt(baseline.worst.flows)} flows, ${baseline.worst.multiple}x the median` : baseline.available ? "No bucket above 3x the median" : ""}
          </div>
          <TimelineChart b={baseline} />
          <div style={{ fontSize: 12, color: C.gray500, marginTop: 8 }}>After provisioning, blocked should rise and potentially blocked fall; the deny lines account for {fmt(kpis.allowedWouldStop + kpis.pbWouldStop)} connections per window (the timeline counts flows: compare direction, not magnitude).</div>
          <Legend items={LEGEND.timeline} />
        </Section>
      )}

      {tab === "Call plans" && (
        <Section title="Call plans, in apply order (every block is DO_NOT_CALL)">
          <div style={{ fontSize: 12, color: C.gray700 }}>In every block, for, tool, DO_NOT_CALL and _notes are not parameters. Override deny beats every allow and is used only for unknown admin-port sources and the runbooks. Nothing here has been executed.</div>
          {callPlans.length ? callPlans.map((c, i) => <CallPlanBlock key={i} c={c} />) : <div style={{ color: C.gray500, fontSize: 13, marginTop: 8 }}>No call plans.</div>}
          <Legend items={[["DO_NOT_CALL badge: grey, no meaning", C.gray100]]} />
        </Section>
      )}

      <div style={{ fontSize: 11, color: C.gray500, marginTop: 20 }}>
        Method: eight read-only illumio-mcp pulls scored by blast radius x ease (references/scoring.md). Override deny is for incidents; a selective ringfence needs its deny rule; deny rules with a label consumer are enforced on the source, with an IP-list consumer at the destination; a deny bites only in selective or full enforcement.
      </div>
    </div>
  );
}
