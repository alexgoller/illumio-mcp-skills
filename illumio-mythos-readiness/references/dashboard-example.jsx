import React, { useState, useMemo } from "react";

// Mythos readiness dashboard: how contained a breach stays against an autonomous attacker,
// graded per app (env) on a six-level ladder from a rapid-risk-reduction run. scripts/readiness.py
// writes dashboard.jsx by replacing everything between the two marker lines below (matched as
// whole lines) with `const DATA = <readiness.json>;`. DATA is the readiness.json object exactly
// (references/dashboard-spec.md). This file doubles as the template and as a worked example;
// its DATA is a hand-written sample in the same shape. Nothing here reads the PCE.

// Illumio Field palette (references/dashboard-spec.md, "Illumio Field").
const C = {
  accent: "#FF5500",          // Illumio Orange: active tab underline, title rule; never a status
  slate: "#313638",           // Server Slate: headings, primary text, table header rows, filled level badges
  text: "#464A4C",            // body text
  muted: "#64686A",           // captions, labels
  green: "#166644",           // Safeguard Green: gate pass
  greenLight: "rgba(22,102,68,0.10)",
  greenDark: "#11432F",
  teal: "#2D454C",            // System Cyan: info (truncated or missing input)
  tealLight: "rgba(45,69,76,0.10)",
  orange: "#F97607",          // Circuit Gold 110: this week; unmanaged admin sources above zero
  orangeLight: "rgba(249,118,7,0.10)",
  amber: "#FFA22F",           // Gold (unused here)
  amberLight: "rgba(255,162,47,0.12)",
  red: "#BE122F",             // Risk Red: gate fail; today; override denies not showing
  redLight: "rgba(190,18,47,0.10)",
  gray50: "#F7F4EE",          // page ground: Zero Trust Tan
  gray100: "#F5F5F5",         // subtle fills
  gray200: "#D6D7D7",         // borders
  gray300: "#C1C3C3",         // unknown, plan, bars below level 3
  gray400: "#6F7274",         // muted text, minimum for small text on white
  gray500: "#64686A",         // secondary text
  gray700: "#464A4C",         // strong secondary text
  white: "#FFFFFF",
};
const FONT = '"FK Grotesk", Montserrat, Arial, sans-serif';
const MONO = "ui-monospace, Menlo, monospace";
const BAND = "#EAEBEB"; // table banding

// ===== DATA START =====
const DATA = {
  "generated": "2026-11-06T00:00:00Z",
  "date": "2026-11-06",
  "rrr": {
    "date": "2026-11-06",
    "window": {
      "start": "2026-10-07T00:00:00Z",
      "end": "2026-11-06T00:00:00Z"
    },
    "window_days": 30,
    "lateral_days": 30,
    "policy_view": "provisioned",
    "crown_jewels": [
      "pay (prod)"
    ],
    "crown_jewels_source": "defaulted to the three production bridge apps with the largest reach",
    "inputs": {
      "workloads": true,
      "summary": true,
      "admin_ports": true,
      "lateral": true,
      "unknown": true,
      "identities": true,
      "rulesets": true,
      "timeline": true,
      "draft_active": true
    },
    "truncated": {
      "workloads": false,
      "summary": false,
      "admin_ports": false,
      "unknown": false,
      "timeline": false
    },
    "missing_inputs": []
  },
  "inputs": {
    "plan": "/Volumes/MacMini-4TB/alex-extern/git/illumio-mcp-skills/illumio-mythos-readiness/tests/out/mixed/rrr/plan.json",
    "workloads": "/Volumes/MacMini-4TB/alex-extern/git/illumio-mcp-skills/illumio-mythos-readiness/tests/fixtures/mixed/workloads.json",
    "lateral": "/Volumes/MacMini-4TB/alex-extern/git/illumio-mcp-skills/illumio-mythos-readiness/tests/fixtures/mixed/lateral.json"
  },
  "ladder": [
    {
      "level": 0,
      "name": "Unseen",
      "gates": [],
      "attacker": "we would not know",
      "human_dependent": true
    },
    {
      "level": 1,
      "name": "Seen",
      "gates": [
        "labelled",
        "managed"
      ],
      "attacker": "we would know afterwards",
      "human_dependent": true
    },
    {
      "level": 2,
      "name": "Planned",
      "gates": [
        "policy_written"
      ],
      "attacker": "we have rules; nothing stops it yet",
      "human_dependent": true
    },
    {
      "level": 3,
      "name": "Enforcing",
      "gates": [
        "enforcing",
        "fenced_if_selective"
      ],
      "attacker": "the attacker meets rules",
      "human_dependent": false
    },
    {
      "level": 4,
      "name": "Doors shut",
      "gates": [
        "no_unknown_admin",
        "no_cross_env_admin"
      ],
      "attacker": "the easy ways in are closed",
      "human_dependent": false
    },
    {
      "level": 5,
      "name": "Contained",
      "gates": [
        "full_enforcement",
        "no_unmanaged_inbound",
        "not_a_bridge",
        "no_wide_reach_account"
      ],
      "attacker": "a breach stays where it landed",
      "human_dependent": false
    }
  ],
  "gate_text": {
    "labelled": "app and env labels on every workload",
    "managed": "a VEN on every workload (managed)",
    "policy_written": "a provisioned ruleset scoped to the app, or every workload in full enforcement",
    "enforcing": "every workload in selective or full enforcement",
    "fenced_if_selective": "when any workload is in selective enforcement, a provisioned ruleset scoped to the app with a deny to all its workloads (selective enforces deny rules only)",
    "no_unknown_admin": "no unknown source reaches the app on admin ports with connections reported allowed (counted per source, not per app)",
    "no_cross_env_admin": "no admin-port traffic from another environment into the app is reported allowed",
    "full_enforcement": "every workload in full enforcement (default deny with allow rules)",
    "no_unmanaged_inbound": "no allowed connection into the app from an unlabelled workload or an external address",
    "not_a_bridge": "not a bridge in the lateral-movement graph and not reaching three quarters of its apps (the top-20 list is capped, so a lower bound)",
    "no_wide_reach_account": "no review-flagged account seen reaching into the app (a lower bound: top 10 destinations per account)"
  },
  "estate": {
    "workloads": 98,
    "managed": 97,
    "labelled": 83,
    "threshold": 0.8,
    "level": 2,
    "next_level": 3,
    "distribution": {
      "0": {
        "apps": 2,
        "workloads": 21
      },
      "1": {
        "apps": 2,
        "workloads": 11
      },
      "2": {
        "apps": 2,
        "workloads": 18
      },
      "3": {
        "apps": 2,
        "workloads": 18
      },
      "4": {
        "apps": 3,
        "workloads": 22
      },
      "5": {
        "apps": 1,
        "workloads": 8
      }
    },
    "in_force_share": 0.49,
    "contained_share": 0.08,
    "to_next": [
      {
        "app": "unlabelled",
        "env": null,
        "workloads": 15,
        "level": 0,
        "first_step": "label the 15 workloads without app and env; the illumio-label-advisor skill suggests values"
      },
      {
        "app": "crm",
        "env": "prod",
        "workloads": 12,
        "level": 2,
        "first_step": "move 4 of 12 workloads of crm (prod) from visibility only to selective or full enforcement, once the ringfence is provisioned so the deny has something to hold"
      },
      {
        "app": "ci",
        "env": "dev",
        "workloads": 6,
        "level": 1,
        "first_step": "write a ruleset scoped to ci (dev): the rapid-risk-reduction ringfence drafts it from the inbound apps seen and adds a deny to all its workloads"
      },
      {
        "app": "hr",
        "env": "staging",
        "workloads": 6,
        "level": 2,
        "first_step": "draft and provision a ruleset scoped to hr (staging) with a deny to all its workloads: 3 workloads of hr (staging) are in selective enforcement, which enforces deny rules only"
      },
      {
        "app": "legacy",
        "env": "dev",
        "workloads": 6,
        "level": 0,
        "first_step": "pair a VEN on the 1 unmanaged workload of legacy (dev) so the PCE can see and enforce it"
      },
      {
        "app": "wiki",
        "env": "staging",
        "workloads": 5,
        "level": 1,
        "first_step": "write a ruleset scoped to wiki (staging): the rapid-risk-reduction ringfence drafts it from the inbound apps seen and adds a deny to all its workloads"
      }
    ]
  },
  "envs": [
    {
      "env": "prod",
      "workloads": 48,
      "level": 2,
      "next_level": 3,
      "distribution": {
        "0": {
          "apps": 0,
          "workloads": 0
        },
        "1": {
          "apps": 0,
          "workloads": 0
        },
        "2": {
          "apps": 1,
          "workloads": 12
        },
        "3": {
          "apps": 2,
          "workloads": 18
        },
        "4": {
          "apps": 2,
          "workloads": 18
        },
        "5": {
          "apps": 0,
          "workloads": 0
        }
      },
      "in_force_share": 0.75,
      "contained_share": 0.0,
      "to_next": [
        {
          "app": "crm",
          "env": "prod",
          "workloads": 12,
          "level": 2,
          "first_step": "move 4 of 12 workloads of crm (prod) from visibility only to selective or full enforcement, once the ringfence is provisioned so the deny has something to hold"
        }
      ]
    },
    {
      "env": "dev",
      "workloads": 12,
      "level": 0,
      "next_level": 1,
      "distribution": {
        "0": {
          "apps": 1,
          "workloads": 6
        },
        "1": {
          "apps": 1,
          "workloads": 6
        },
        "2": {
          "apps": 0,
          "workloads": 0
        },
        "3": {
          "apps": 0,
          "workloads": 0
        },
        "4": {
          "apps": 0,
          "workloads": 0
        },
        "5": {
          "apps": 0,
          "workloads": 0
        }
      },
      "in_force_share": 0.0,
      "contained_share": 0.0,
      "to_next": [
        {
          "app": "legacy",
          "env": "dev",
          "workloads": 6,
          "level": 0,
          "first_step": "pair a VEN on the 1 unmanaged workload of legacy (dev) so the PCE can see and enforce it"
        }
      ]
    },
    {
      "env": "mgmt",
      "workloads": 12,
      "level": 4,
      "next_level": 5,
      "distribution": {
        "0": {
          "apps": 0,
          "workloads": 0
        },
        "1": {
          "apps": 0,
          "workloads": 0
        },
        "2": {
          "apps": 0,
          "workloads": 0
        },
        "3": {
          "apps": 0,
          "workloads": 0
        },
        "4": {
          "apps": 1,
          "workloads": 4
        },
        "5": {
          "apps": 1,
          "workloads": 8
        }
      },
      "in_force_share": 1.0,
      "contained_share": 0.67,
      "to_next": [
        {
          "app": "dns",
          "env": "mgmt",
          "workloads": 4,
          "level": 4,
          "first_step": "narrow the rule or list admitting the public source 198.51.100.7 (resolver.example.org) into dns (mgmt); 500 allowed connections came in from unlabelled or external sources"
        }
      ]
    },
    {
      "env": "staging",
      "workloads": 11,
      "level": 1,
      "next_level": 2,
      "distribution": {
        "0": {
          "apps": 0,
          "workloads": 0
        },
        "1": {
          "apps": 1,
          "workloads": 5
        },
        "2": {
          "apps": 1,
          "workloads": 6
        },
        "3": {
          "apps": 0,
          "workloads": 0
        },
        "4": {
          "apps": 0,
          "workloads": 0
        },
        "5": {
          "apps": 0,
          "workloads": 0
        }
      },
      "in_force_share": 0.0,
      "contained_share": 0.0,
      "to_next": [
        {
          "app": "wiki",
          "env": "staging",
          "workloads": 5,
          "level": 1,
          "first_step": "write a ruleset scoped to wiki (staging): the rapid-risk-reduction ringfence drafts it from the inbound apps seen and adds a deny to all its workloads"
        }
      ]
    }
  ],
  "apps": [
    {
      "app": "pay",
      "env": "prod",
      "key": "pay (prod)",
      "workloads": 10,
      "crown_jewel": true,
      "enforcement": {
        "full": 10,
        "selective": 0,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 10,
      "level": 4,
      "level_name": "Doors shut",
      "next_level": 5,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "pass",
          "reason": ""
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "fail",
          "reason": "bridge in the lateral-movement graph, reaching 7 apps"
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "not_a_bridge",
          "reason": "bridge in the lateral-movement graph, reaching 7 apps",
          "kind": "ringfence",
          "sentence": "fence pay (prod): it is a bridge, so a breach there reaches the apps behind it; the rapid-risk-reduction ringfence drafts the ruleset",
          "bucket": "week",
          "rrr_lines": [
            "selective ringfence pay (prod), deny_consumer any"
          ],
          "call_plan": "call-plans.md: X4 pay (prod)"
        }
      ],
      "risk_rank_score": 3,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "unlabelled",
      "env": null,
      "key": "unlabelled",
      "workloads": 15,
      "crown_jewel": false,
      "enforcement": {
        "full": 0,
        "selective": 5,
        "visibility_only": 10,
        "idle": 0
      },
      "managed": 15,
      "level": 0,
      "level_name": "Unseen",
      "next_level": 1,
      "gates": {
        "labelled": {
          "state": "fail",
          "reason": "15 workloads lack an app label, an env label or both"
        },
        "managed": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "policy_written": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "enforcing": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "fenced_if_selective": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "no_unknown_admin": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "no_cross_env_admin": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "full_enforcement": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "no_unmanaged_inbound": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "not_a_bridge": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        },
        "no_wide_reach_account": {
          "state": "unknown",
          "reason": "not graded: unlabelled"
        }
      },
      "next_steps": [
        {
          "gate": "labelled",
          "reason": "15 workloads lack an app label, an env label or both",
          "kind": "label",
          "sentence": "label the 15 workloads without app and env; the illumio-label-advisor skill suggests values",
          "bucket": "plan",
          "rrr_lines": [],
          "call_plan": null
        }
      ],
      "risk_rank_score": null,
      "measures": null
    },
    {
      "app": "legacy",
      "env": "dev",
      "key": "legacy (dev)",
      "workloads": 6,
      "crown_jewel": false,
      "enforcement": {
        "full": 5,
        "selective": 0,
        "visibility_only": 0,
        "idle": 1
      },
      "managed": 5,
      "level": 0,
      "level_name": "Unseen",
      "next_level": 1,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "fail",
          "reason": "1 of 6 workloads are not managed (no VEN paired)"
        },
        "policy_written": {
          "state": "fail",
          "reason": "no provisioned ruleset is scoped to legacy (dev) and 1 of 6 workloads are not in full enforcement"
        },
        "enforcing": {
          "state": "fail",
          "reason": "1 of 6 workloads idle"
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "1 of 6 workloads not enforcing"
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "managed",
          "reason": "1 of 6 workloads are not managed (no VEN paired)",
          "kind": "pair_ven",
          "sentence": "pair a VEN on the 1 unmanaged workload of legacy (dev) so the PCE can see and enforce it",
          "bucket": "plan",
          "rrr_lines": [],
          "call_plan": null
        }
      ],
      "risk_rank_score": 1,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 1
      }
    },
    {
      "app": "ci",
      "env": "dev",
      "key": "ci (dev)",
      "workloads": 6,
      "crown_jewel": false,
      "enforcement": {
        "full": 0,
        "selective": 0,
        "visibility_only": 6,
        "idle": 0
      },
      "managed": 6,
      "level": 1,
      "level_name": "Seen",
      "next_level": 2,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "fail",
          "reason": "no provisioned ruleset is scoped to ci (dev) and 6 of 6 workloads are not in full enforcement"
        },
        "enforcing": {
          "state": "fail",
          "reason": "6 of 6 workloads in visibility_only"
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "6 of 6 workloads not enforcing"
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "policy_written",
          "reason": "no provisioned ruleset is scoped to ci (dev) and 6 of 6 workloads are not in full enforcement",
          "kind": "write_policy",
          "sentence": "write a ruleset scoped to ci (dev): the rapid-risk-reduction ringfence drafts it from the inbound apps seen and adds a deny to all its workloads",
          "bucket": "week",
          "rrr_lines": [
            "selective ringfence ci (dev), deny_consumer any"
          ],
          "call_plan": "call-plans.md: X5 ci (dev)"
        }
      ],
      "risk_rank_score": 4,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 6
      }
    },
    {
      "app": "wiki",
      "env": "staging",
      "key": "wiki (staging)",
      "workloads": 5,
      "crown_jewel": false,
      "enforcement": {
        "full": 0,
        "selective": 0,
        "visibility_only": 5,
        "idle": 0
      },
      "managed": 5,
      "level": 1,
      "level_name": "Seen",
      "next_level": 2,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "fail",
          "reason": "no provisioned ruleset is scoped to wiki (staging) and 5 of 5 workloads are not in full enforcement"
        },
        "enforcing": {
          "state": "fail",
          "reason": "5 of 5 workloads in visibility_only"
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "5 of 5 workloads not enforcing"
        },
        "no_unmanaged_inbound": {
          "state": "fail",
          "reason": "30 allowed connections into the app from unlabelled or external sources in the window"
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "policy_written",
          "reason": "no provisioned ruleset is scoped to wiki (staging) and 5 of 5 workloads are not in full enforcement",
          "kind": "write_policy",
          "sentence": "write a ruleset scoped to wiki (staging): the rapid-risk-reduction ringfence drafts it from the inbound apps seen and adds a deny to all its workloads",
          "bucket": "week",
          "rrr_lines": [
            "selective ringfence wiki (staging), deny_consumer any"
          ],
          "call_plan": "call-plans.md: X5 wiki (staging)"
        }
      ],
      "risk_rank_score": 8,
      "measures": {
        "unmanaged_inbound": 30,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 10,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 5
      }
    },
    {
      "app": "crm",
      "env": "prod",
      "key": "crm (prod)",
      "workloads": 12,
      "crown_jewel": false,
      "enforcement": {
        "full": 8,
        "selective": 0,
        "visibility_only": 4,
        "idle": 0
      },
      "managed": 12,
      "level": 2,
      "level_name": "Planned",
      "next_level": 3,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "fail",
          "reason": "4 of 12 workloads in visibility_only"
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "fail",
          "reason": "source 10.9.9.9 reaches the app on 22/tcp, 3389/tcp; 25 of its admin-port connections are reported allowed across its 2 peer apps"
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "4 of 12 workloads not enforcing"
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "fail",
          "reason": "1 review-flagged account seen reaching into the app (a lower bound)"
        }
      },
      "next_steps": [
        {
          "gate": "enforcing",
          "reason": "4 of 12 workloads in visibility_only",
          "kind": "move_enforcement",
          "sentence": "move 4 of 12 workloads of crm (prod) from visibility only to selective or full enforcement, once the ringfence is provisioned so the deny has something to hold",
          "bucket": "week",
          "rrr_lines": [
            "selective ringfence crm (prod), deny_consumer any"
          ],
          "call_plan": "call-plans.md: X5 crm (prod)"
        }
      ],
      "risk_rank_score": 8,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 4
      }
    },
    {
      "app": "hr",
      "env": "staging",
      "key": "hr (staging)",
      "workloads": 6,
      "crown_jewel": false,
      "enforcement": {
        "full": 3,
        "selective": 3,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 6,
      "level": 2,
      "level_name": "Planned",
      "next_level": 3,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "fail",
          "reason": "3 of 6 workloads in selective enforcement, which enforces deny rules only, and no provisioned ruleset scoped to hr (staging) carries a deny to all its workloads"
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "3 of 6 workloads in selective enforcement (deny rules only)"
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "fenced_if_selective",
          "reason": "3 of 6 workloads in selective enforcement, which enforces deny rules only, and no provisioned ruleset scoped to hr (staging) carries a deny to all its workloads",
          "kind": "provision_deny",
          "sentence": "draft and provision a ruleset scoped to hr (staging) with a deny to all its workloads: 3 workloads of hr (staging) are in selective enforcement, which enforces deny rules only",
          "bucket": "plan",
          "rrr_lines": [],
          "call_plan": null
        }
      ],
      "risk_rank_score": 0,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "shop",
      "env": "prod",
      "key": "shop (prod)",
      "workloads": 12,
      "crown_jewel": false,
      "enforcement": {
        "full": 0,
        "selective": 12,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 12,
      "level": 3,
      "level_name": "Enforcing",
      "next_level": 4,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "fail",
          "reason": "source 10.9.9.9 reaches the app on 22/tcp, 3389/tcp; 25 of its admin-port connections are reported allowed across its 2 peer apps"
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "fail",
          "reason": "12 of 12 workloads in selective enforcement (deny rules only)"
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "fail",
          "reason": "1 review-flagged account seen reaching into the app (a lower bound)"
        }
      },
      "next_steps": [
        {
          "gate": "no_unknown_admin",
          "reason": "source 10.9.9.9 reaches the app on 22/tcp, 3389/tcp; 25 of its admin-port connections are reported allowed across its 2 peer apps",
          "kind": "block_unknown",
          "sentence": "identify the internal source 10.9.9.9 first (it reaches shop (prod) on 22/tcp, 3389/tcp, and 25 of its admin-port connections are reported allowed across 2 peer apps), then label it as a workload or block it with the override deny",
          "bucket": "week",
          "rrr_lines": [
            "unknown internal source 10.9.9.9 on 22/tcp, 3389/tcp"
          ],
          "call_plan": "call-plans.md: X1 (internal)"
        }
      ],
      "risk_rank_score": 6,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "billing",
      "env": "prod",
      "key": "billing (prod)",
      "workloads": 6,
      "crown_jewel": false,
      "enforcement": {
        "full": 6,
        "selective": 0,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 6,
      "level": 3,
      "level_name": "Enforcing",
      "next_level": 4,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "fail",
          "reason": "admin ports from env=dev into the app are reported allowed: ci (dev) 90 connections"
        },
        "full_enforcement": {
          "state": "pass",
          "reason": ""
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "no_cross_env_admin",
          "reason": "admin ports from env=dev into the app are reported allowed: ci (dev) 90 connections",
          "kind": "deny_crossing",
          "sentence": "deny admin ports from env=dev into env=prod: ci (dev) reaches billing (prod) on 22/tcp, 5432/tcp with 90 connections reported allowed",
          "bucket": "today",
          "rrr_lines": [
            "admin ports env=dev -> env=prod (production)"
          ],
          "call_plan": "call-plans.md: X2 dev->prod"
        }
      ],
      "risk_rank_score": 5,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 90,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "erp",
      "env": "prod",
      "key": "erp (prod)",
      "workloads": 8,
      "crown_jewel": false,
      "enforcement": {
        "full": 8,
        "selective": 0,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 8,
      "level": 4,
      "level_name": "Doors shut",
      "next_level": 5,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "pass",
          "reason": ""
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "fail",
          "reason": "1 review-flagged account seen reaching into the app (a lower bound)"
        }
      },
      "next_steps": [
        {
          "gate": "no_wide_reach_account",
          "reason": "1 review-flagged account seen reaching into the app (a lower bound)",
          "kind": "review_account",
          "sentence": "review the 1 wide-reach account seen into erp (prod) (the review-flagged accounts are jdoe); no rule can name an account, so confirm their reach with the owners",
          "bucket": "plan",
          "rrr_lines": [
            "X6 jdoe"
          ],
          "call_plan": null
        }
      ],
      "risk_rank_score": 3,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "dns",
      "env": "mgmt",
      "key": "dns (mgmt)",
      "workloads": 4,
      "crown_jewel": false,
      "enforcement": {
        "full": 4,
        "selective": 0,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 4,
      "level": 4,
      "level_name": "Doors shut",
      "next_level": 5,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "pass",
          "reason": ""
        },
        "no_unmanaged_inbound": {
          "state": "fail",
          "reason": "500 allowed connections into the app from unlabelled or external sources in the window"
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [
        {
          "gate": "no_unmanaged_inbound",
          "reason": "500 allowed connections into the app from unlabelled or external sources in the window",
          "kind": "narrow_inbound",
          "sentence": "narrow the rule or list admitting the public source 198.51.100.7 (resolver.example.org) into dns (mgmt); 500 allowed connections came in from unlabelled or external sources",
          "bucket": "plan",
          "rrr_lines": [
            "X3 public source 198.51.100.7"
          ],
          "call_plan": null
        }
      ],
      "risk_rank_score": 9,
      "measures": {
        "unmanaged_inbound": 500,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 120,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0
      }
    },
    {
      "app": "logs",
      "env": "mgmt",
      "key": "logs (mgmt)",
      "workloads": 8,
      "crown_jewel": false,
      "enforcement": {
        "full": 8,
        "selective": 0,
        "visibility_only": 0,
        "idle": 0
      },
      "managed": 8,
      "level": 5,
      "level_name": "Contained",
      "next_level": null,
      "gates": {
        "labelled": {
          "state": "pass",
          "reason": ""
        },
        "managed": {
          "state": "pass",
          "reason": ""
        },
        "policy_written": {
          "state": "pass",
          "reason": ""
        },
        "enforcing": {
          "state": "pass",
          "reason": ""
        },
        "fenced_if_selective": {
          "state": "pass",
          "reason": ""
        },
        "no_unknown_admin": {
          "state": "pass",
          "reason": ""
        },
        "no_cross_env_admin": {
          "state": "pass",
          "reason": ""
        },
        "full_enforcement": {
          "state": "pass",
          "reason": ""
        },
        "no_unmanaged_inbound": {
          "state": "pass",
          "reason": ""
        },
        "not_a_bridge": {
          "state": "pass",
          "reason": ""
        },
        "no_wide_reach_account": {
          "state": "pass",
          "reason": ""
        }
      },
      "next_steps": [],
      "risk_rank_score": 8,
      "measures": {
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 1400,
        "cross_env_apps": 2,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0
      }
    }
  ],
  "evidence": {
    "readiness": {
      "verdict": "partial",
      "workloads": 98,
      "labelled": 83,
      "unlabelled": 15,
      "with_app": 88,
      "with_env": 88,
      "label_columns": true,
      "unlabelled_modes": {
        "visibility_only": 10,
        "selective": 5
      },
      "unlabelled_examples": [
        "batch--01",
        "batch--02",
        "batch--03",
        "batch--04",
        "batch--05",
        "srv-prod-01",
        "srv-prod-02",
        "srv-prod-03"
      ],
      "traffic_connections_unlabelled": 60,
      "admin_rows_unlabelled": 0,
      "unlabelled_seen_by_unknown_sources": 3,
      "share_labelled": 0.85,
      "notes": [
        "15 of 98 workloads lack app or env (10 without app, 10 without env; selective 5, visibility_only 10): they sit outside every grid row, ringfence and environment deny",
        "apps with workloads missing env: batch (5)",
        "60 connections in the estate summary involve an unlabelled workload",
        "3 unlabelled workloads were seen as peers of unknown sources"
      ]
    },
    "headline": {
      "workloads": 98,
      "full_enforcement": 52,
      "selective": 20,
      "not_enforcing": 26,
      "unmanaged_admin_sources": 2,
      "unmanaged_admin_internal": 1,
      "unmanaged_admin_public": 1,
      "apps_in_graph": 11,
      "wide_reach_apps": 0,
      "wide_reach_lower_bound": false,
      "lateral_days": 30,
      "override_denies_not_showing": 0,
      "override_denies_unchecked": 0
    },
    "apps": [
      {
        "app": "pay (prod)",
        "workloads": 10,
        "crown_jewel": true,
        "public_admin_sources": 1,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 3,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 3
      },
      {
        "app": "dns (mgmt)",
        "workloads": 4,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 500,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 120,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 3,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 3,
          "cross_env_apps": 3,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 9
      },
      {
        "app": "logs (mgmt)",
        "workloads": 8,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 1400,
        "cross_env_apps": 2,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 4,
          "cross_env_apps": 4,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 8
      },
      {
        "app": "wiki (staging)",
        "workloads": 5,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 30,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 10,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 5,
        "bands": {
          "unmanaged_inbound": 1,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 1,
          "cross_env_apps": 3,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 3
        },
        "risk_rank_score": 8
      },
      {
        "app": "crm (prod)",
        "workloads": 12,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 1,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 4,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 3,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 3,
          "workloads_not_enforcing": 2
        },
        "risk_rank_score": 8
      },
      {
        "app": "shop (prod)",
        "workloads": 12,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 1,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 1,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 3,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 3,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 6
      },
      {
        "app": "billing (prod)",
        "workloads": 6,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 90,
        "cross_env_apps": 1,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 2,
          "cross_env_apps": 3,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 5
      },
      {
        "app": "ci (dev)",
        "workloads": 6,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 6,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 4
        },
        "risk_rank_score": 4
      },
      {
        "app": "erp (prod)",
        "workloads": 8,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 1,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 3,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 3
      },
      {
        "app": "legacy (dev)",
        "workloads": 6,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 1,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 1
        },
        "risk_rank_score": 1
      },
      {
        "app": "hr (staging)",
        "workloads": 6,
        "crown_jewel": false,
        "public_admin_sources": 0,
        "internal_admin_sources": 0,
        "unmanaged_inbound": 0,
        "unmanaged_admin_sources": 0,
        "cross_env_connections": 0,
        "cross_env_apps": 0,
        "wide_reach_accounts": 0,
        "workloads_not_enforcing": 0,
        "bands": {
          "unmanaged_inbound": 0,
          "unmanaged_admin_sources": 0,
          "cross_env_connections": 0,
          "cross_env_apps": 0,
          "wide_reach_accounts": 0,
          "workloads_not_enforcing": 0
        },
        "risk_rank_score": 0
      }
    ],
    "env_matrix": [
      {
        "from": "prod",
        "to": "mgmt",
        "allowed": 1520,
        "potentially_blocked": 0,
        "blocked": 0
      },
      {
        "from": "dev",
        "to": "prod",
        "allowed": 90,
        "potentially_blocked": 200,
        "blocked": 30
      },
      {
        "from": "dev",
        "to": "staging",
        "allowed": 10,
        "potentially_blocked": 0,
        "blocked": 0
      },
      {
        "from": "staging",
        "to": "prod",
        "allowed": 0,
        "potentially_blocked": 15,
        "blocked": 0
      }
    ],
    "rule_drift": [],
    "fix_first": [
      "Identify the 1 internal host on admin ports, starting with 10.9.9.9, which reaches 9 workloads; then label each one or block it.",
      "Narrow the admin-port crossing env=dev to env=prod into pay (prod) (22/tcp, 5432/tcp), keeping Kerberos, LDAP and SMB to the directory servers open.",
      "Block the 1 public source on admin ports with the override deny from the X1 list.",
      "Label the 15 workloads without app or env (batch--01, batch--02, batch--03, batch--04, ...): they are outside every ringfence, environment deny and grid row."
    ],
    "takeaway": "Most exposure sits in pay (prod), dns (mgmt), logs (mgmt); the largest environment crossing is prod to mgmt with 1,520 allowed connections; 2 unmanaged sources reach workloads on admin ports; 15 of 98 workloads are unlabelled."
  },
  "notes": [
    "X1 counts are per source, not per app, so a no_unknown_admin failure can rest on a source whose allowed connections went to another peer app",
    "the wide-reach rule reads the top-20 reachable list, so the count of wide-reach apps is a lower bound",
    "gates are tested against the provisioned policy; a drafted rule changes nothing until it is provisioned",
    "15 of 98 workloads lack app or env and sit in the unlabelled row at level 0"
  ]
};
// ===== DATA END =====

// Defensive accessors: every tab renders on a partial or empty readiness.json.
const D = DATA || {};
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "n/a" : Number(n).toLocaleString("en-US"));
const pct = (x) => (x == null || Number.isNaN(Number(x)) ? "n/a" : `${Math.round(100 * Number(x))}%`);
const compact = (n) => (n == null ? "n/a" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));
const LADDER = arr(D.ladder);
const GATES = LADDER.flatMap((l) => arr(l.gates));
const GATE_TEXT = obj(D.gate_text);
const APPS = arr(D.apps);
const EST = obj(D.estate);
const ENVS = arr(D.envs);
const EV = obj(D.evidence);
const RRR = obj(D.rrr);
const appKey = (a) => a.key || (a.env ? `${a.app} (${a.env})` : a.app);
const levelName = (n) => (LADDER.find((l) => l.level === n) || {}).name || "";
const IN_FORCE = 3; // levels 3 and above hold without a human

// Short column words for the gate ids; the full sentence is DATA.gate_text, shown on hover and in the legend.
const GATE_SHORT = { labelled: "Labels", managed: "VEN", policy_written: "Policy", enforcing: "Enforcing", fenced_if_selective: "Fenced", no_unknown_admin: "Unknown admin",
  no_cross_env_admin: "Env crossing", full_enforcement: "Full", no_unmanaged_inbound: "Inbound", not_a_bridge: "Bridge", no_wide_reach_account: "Accounts" };
const KIND_ORDER = ["label", "pair_ven", "write_policy", "move_enforcement", "provision_deny", "block_unknown", "deny_crossing", "narrow_inbound", "ringfence", "review_account", "check_reach"];
const KIND_LABEL = { label: "Label", pair_ven: "Pair a VEN", write_policy: "Write policy", move_enforcement: "Move enforcement", provision_deny: "Provision the deny",
  block_unknown: "Block or identify unknown source", deny_crossing: "Deny the crossing", narrow_inbound: "Narrow inbound", ringfence: "Ringfence", review_account: "Review account", check_reach: "Check reach" };

// Eyebrows and table headers: Server Slate SemiBold caps.
const eyebrow = { fontSize: 11, color: C.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };
const TH = { textAlign: "left", padding: "8px 10px", background: C.slate, color: C.white, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };
const TD = { padding: "7px 10px", borderBottom: `1px solid ${C.gray200}`, verticalAlign: "top", fontSize: 12, color: C.text };
const TDK = { ...TD, fontWeight: 600, color: C.slate, whiteSpace: "nowrap" };
const TDN = { ...TD, textAlign: "right", fontFamily: MONO, whiteSpace: "nowrap" };
const empty = { color: C.muted, fontSize: 13 };

function Badge({ label, color, bg, mono, wrap, outline, title }) {
  return (
    <span title={title} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600, lineHeight: "15px",
      background: outline ? "transparent" : bg, color, border: outline ? `1.5px solid ${color}` : "1.5px solid transparent",
      letterSpacing: 0.2, fontFamily: mono ? MONO : FONT, whiteSpace: wrap ? "normal" : "nowrap" }}>
      {label}
    </span>
  );
}

// Level badge: filled Server Slate at level 3 and above (holds without a human), outlined below.
const LevelBadge = ({ level, name }) => {
  const n = name || levelName(level);
  const filled = Number(level) >= IN_FORCE;
  return <Badge label={`${level == null ? "?" : level} ${n}`.trim()} bg={C.slate} color={filled ? C.white : C.slate} outline={!filled} />;
};
// Gate cell: Safeguard Green pass, Risk Red fail, grey unknown. The reason rides on the title attribute.
const gateStyle = { pass: { bg: C.green, color: C.white, label: "pass" }, fail: { bg: C.red, color: C.white, label: "fail" }, unknown: { bg: C.gray300, color: C.slate, label: "unknown" } };
const GateBadge = ({ g, id }) => { const s = gateStyle[obj(g).state] || gateStyle.unknown; return <Badge label={s.label} bg={s.bg} color={s.color} title={`${GATE_TEXT[id] || id}${obj(g).reason ? `: ${g.reason}` : ""}`} />; };
// Bucket badge: today Risk Red, week Circuit Gold with slate text, plan grey (as rapid-risk-reduction does).
const bucketStyle = { today: { bg: C.red, color: C.white, label: "TODAY" }, week: { bg: C.orange, color: C.slate, label: "WEEK" }, plan: { bg: C.gray300, color: C.slate, label: "PLAN" } };
const BucketBadge = ({ b }) => { const s = bucketStyle[b] || bucketStyle.plan; return <Badge label={s.label} bg={s.bg} color={s.color} />; };
const CrownBadge = () => <Badge label="crown jewel" bg={C.gray100} color={C.gray700} />;
// Risk map bands 0 to 4: one Server Slate tint, darker = higher percentile among the apps (as rapid-risk-reduction does).
const bandBg = (b) => ["transparent", "rgba(49,54,56,0.10)", "rgba(49,54,56,0.26)", "rgba(49,54,56,0.48)", "rgba(49,54,56,0.78)"][b] || "transparent";
const bandFg = (b) => (b >= 3 ? C.white : C.slate);
const verdictStyle = { ready: { bg: C.gray300, color: C.slate, label: "READY" }, partial: { bg: C.orange, color: C.slate, label: "PARTIAL" }, "not ready": { bg: C.red, color: C.white, label: "NOT READY" } };

function Swatch({ color, kind }) {
  if (kind === "text") return <span style={{ color, fontWeight: 600, fontFamily: MONO }}>abc</span>;
  if (kind === "outline") return <span style={{ display: "inline-block", width: 14, height: 10, border: `2px solid ${color}`, borderRadius: 0 }} />;
  return <span style={{ display: "inline-block", width: 14, height: 10, background: color, borderRadius: 0 }} />;
}

function Legend({ items }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.muted, marginTop: 10,
      paddingTop: 8, borderTop: `1px dashed ${C.gray200}` }}>
      <span style={{ fontWeight: 600, color: C.slate }}>Legend</span>
      {items.map(([label, color, kind], i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Swatch color={color} kind={kind} />{label}</span>
      ))}
    </div>
  );
}

const LEGEND = {
  level: [["Server Slate filled: level 3 and above, holds without a human", C.slate], ["Server Slate outline: level 0 to 2, depends on a human noticing", C.slate, "outline"]],
  gates: [["Safeguard Green: gate passes", C.green], ["Risk Red: gate fails", C.red], ["grey: unknown, never passes", C.gray300]],
  bars: [["Server Slate: workloads at level 3 and above, in force", C.slate], ["grey: workloads at level 0 to 2", C.gray300]],
  buckets: [["Risk Red: today, an RRR line with ease 4 or more backs it", C.red], ["Circuit Gold: this week, an RRR line backs it", C.orange], ["grey: plan, human work with no RRR line", C.gray300]],
  crown: [["crown jewel badge: grey, no meaning; named by the RRR run", C.gray100]],
  plain: [["table text: no colour, no meaning", C.gray300]],
  info: [["System Cyan: an input was truncated or missing, counts from it are lower bounds", C.teal]],
  verdict: [["Risk Red: labelling not ready, label first", C.red], ["Circuit Gold: partial, some workloads outside every scoped fix", C.orange], ["grey: ready", C.gray300]],
  mapKpi: [["KPI top border Risk Red = override denies not showing in traffic, when above zero", C.red], ["Circuit Gold = unmanaged admin-port sources, when above zero", C.orange], ["grey = no meaning", C.gray300]],
  grid: [["no traffic or zero", "transparent", "outline"], ["lowest quarter of the apps with a value", bandBg(1)], ["second quarter", bandBg(2)], ["third quarter", bandBg(3)], ["top quarter (one Server Slate tint, no status colour)", bandBg(4)], ["CJ badge = crown jewel, grey, no meaning", C.gray100]],
  matrix: [["allowed connections, darker Server Slate tint = more (square-root scale)", bandBg(4)], ["dot = none", C.gray300, "text"]],
};

function ColourKey() {
  const items = [["Safeguard Green: gate passes", C.green, C.white], ["Risk Red: gate fails · today", C.red, C.white], ["Circuit Gold: step this week · labelling partial (evidence)", C.orange, C.slate], ["grey: unknown · plan", C.gray300, C.slate], ["Server Slate filled: in force, level 3 and above", C.slate, C.white]];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.muted }}>
      <span style={{ fontWeight: 600, color: C.slate, marginRight: 2 }}>Colour key</span>
      {items.map(([l, bg, color]) => <Badge key={l} label={l} bg={bg} color={color} wrap />)}
      <span>· grey strips and borders mean nothing · Illumio Orange marks the active tab only · each section has its own legend</span>
    </div>
  );
}

// Text tabs; the active one carries the Illumio Orange underline, the one brand accent.
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.gray200}`, width: "fit-content", maxWidth: "100%" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: "8px 12px 6px", borderRadius: 0, fontFamily: FONT,
          fontWeight: active === t ? 600 : 500, fontSize: 13, color: active === t ? C.slate : C.muted, borderBottom: `2px solid ${active === t ? C.accent : "transparent"}`, marginBottom: -1 }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: 16, marginTop: 16, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 4, height: 16, borderRadius: 0, background: C.gray300, display: "inline-block" }} />
          <span style={{ ...eyebrow, fontSize: 12 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Grey top border always: these counts are facts, not risks. A string value is shown as given.
function Tile({ label, value, subtitle }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: "12px 14px", borderTop: `4px solid ${C.gray300}`, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: C.slate, lineHeight: 1.2, marginTop: 4 }}>{typeof value === "string" ? value : fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// The top border is Risk Red or Circuit Gold only when the KPI is a risk and above zero (as rapid-risk-reduction does).
function KPICard({ label, value, subtitle, attention }) {
  const border = value > 0 && attention === "high" ? C.red : value > 0 && attention === "medium" ? C.orange : C.gray300;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: "12px 14px", borderTop: `4px solid ${border}`, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: C.slate, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// System Cyan info line: the one place cyan carries a tint on this page.
function InfoLine({ children }) {
  return <div style={{ background: C.tealLight, borderLeft: `3px solid ${C.teal}`, color: C.teal, fontSize: 12, padding: "8px 10px", marginTop: 8, lineHeight: 1.45 }}>{children}</div>;
}

const Scroll = ({ children }) => <div style={{ overflowX: "auto", maxWidth: "100%" }}>{children}</div>;
const Table = ({ head, children, min }) => (
  <Scroll>
    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: min || 0 }}>
      <thead><tr>{head.map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </Scroll>
);

function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontFamily: FONT, fontSize: 12, color: C.slate, background: C.white, border: `1px solid ${C.gray300}`, borderRadius: 0, padding: "3px 6px" }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const gateWords = (ids) => arr(ids).map((g) => GATE_TEXT[g] || g).join("; ");
const ruleText = (t) => `An estate or environment is at level L when at least ${pct(t)} of its managed labelled workloads sit in apps at level L or above; level 0 always qualifies.`;

// The share of managed labelled workloads at or above a level, from the app rows (the unlabelled row has no env).
function shareAt(level, rows) {
  const labelled = rows.filter((a) => a.env != null && a.app !== "unlabelled");
  const total = labelled.reduce((s, a) => s + (Number(a.managed) || 0), 0);
  const above = labelled.filter((a) => Number(a.level) >= level).reduce((s, a) => s + (Number(a.managed) || 0), 0);
  return { total, above };
}

function DistributionTable({ dist }) {
  const d = obj(dist);
  const rows = LADDER.length ? LADDER.map((l) => l.level) : Object.keys(d).map(Number).sort();
  const max = Math.max(1, ...rows.map((k) => Number(obj(d[String(k)]).workloads) || 0));
  if (!rows.length) return <div style={empty}>No distribution in the data.</div>;
  return (
    <Table head={["Level", "Apps", "Workloads", "Share of workloads"]} min={420}>
      {rows.map((k, i) => {
        const e = obj(d[String(k)]);
        const w = Number(e.workloads) || 0;
        return (
          <tr key={k} style={{ background: i % 2 ? BAND : C.white }}>
            <td style={TDK}><LevelBadge level={k} /></td>
            <td style={TDN}>{fmt(e.apps)}</td>
            <td style={TDN}>{fmt(e.workloads)}</td>
            <td style={{ ...TD, minWidth: 160 }}>
              <div style={{ display: "flex", height: 12, background: C.gray100, borderRadius: 0, overflow: "hidden" }}>
                <div style={{ width: `${(100 * w) / max}%`, background: Number(k) >= IN_FORCE ? C.slate : C.gray300 }} />
              </div>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function ToNextTable({ rows }) {
  const r = arr(rows);
  if (!r.length) return <div style={empty}>Nothing below the next level.</div>;
  return (
    <Table head={["App", "Env", "Workloads", "Level", "First step"]} min={620}>
      {r.map((x, i) => (
        <tr key={`${x.app}|${x.env}|${i}`} style={{ background: i % 2 ? BAND : C.white }}>
          <td style={TDK}>{x.app}</td><td style={{ ...TD, fontFamily: MONO }}>{x.env == null ? "none" : x.env}</td><td style={TDN}>{fmt(x.workloads)}</td>
          <td style={TD}><LevelBadge level={x.level} /></td><td style={{ ...TD, minWidth: 320 }}>{x.first_step || "no step recorded"}</td>
        </tr>
      ))}
    </Table>
  );
}

function ReadinessTab() {
  const next = EST.next_level;
  const share = next != null ? shareAt(Number(next), APPS) : null;
  const needed = share ? Math.ceil(Number(EST.threshold || 0) * share.total) : null;
  return (
    <>
      <div style={{ fontSize: 15, color: C.slate, marginTop: 16, lineHeight: 1.45, maxWidth: 860 }}>
        Mythos readiness is how contained a breach stays when the attacker is an autonomous AI agent that finds a foothold, exploits and moves laterally at machine speed, with no human in the loop. Against such an attacker the thing that changes is time: controls that need a human to notice count for little, controls already in force count.
      </div>
      <Section title="The ladder">
        {LADDER.length ? (
          <Table head={["Level", "Name", "Gates", "Attacker's view", "Holds"]} min={760}>
            {LADDER.map((l, i) => (
              <tr key={l.level} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TDK}><LevelBadge level={l.level} name={l.name} />{Number(EST.level) === Number(l.level) && <span style={{ marginLeft: 6 }}><Badge label="estate is here" bg={C.gray100} color={C.gray700} /></span>}</td>
                <td style={{ ...TD, fontWeight: 600, color: C.slate, whiteSpace: "nowrap" }}>{l.name}</td>
                <td style={{ ...TD, minWidth: 300 }}>{arr(l.gates).length ? gateWords(l.gates) : "none: level 1 not reached"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{l.attacker}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{l.human_dependent ? "depends on a human noticing" : "holds without one"}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No ladder in the data.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>An app sits at the highest level whose gates, and every lower level's gates, all pass; unknown never passes. The "estate is here" badge is grey, no meaning.</div>
        <Legend items={LEGEND.level} />
      </Section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
        <Tile label="Estate level" value={EST.level == null ? "n/a" : `${EST.level} ${levelName(EST.level)}`} subtitle={next == null ? "top of the ladder" : `next: ${next} ${levelName(next)}`} />
        <Tile label="In force" value={pct(EST.in_force_share)} subtitle="workloads in apps at level 3 or above" />
        <Tile label="Contained" value={pct(EST.contained_share)} subtitle="workloads in apps at level 5" />
        <Tile label="Workloads" value={EST.workloads} subtitle={`${fmt(EST.managed)} managed · ${fmt(EST.labelled)} labelled`} />
      </div>
      <Section title="Apps and workloads per level">
        <DistributionTable dist={EST.distribution} />
        <Legend items={[...LEGEND.bars, ...LEGEND.level]} />
      </Section>
      <Section title="Environments">
        {ENVS.length ? (
          <Table head={["Env", "Workloads", "Level", "In force", "Contained", "Next level", "Rows to lift"]} min={640}>
            {ENVS.map((e, i) => (
              <tr key={e.env} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={{ ...TDK, fontFamily: MONO }}>{e.env}</td><td style={TDN}>{fmt(e.workloads)}</td>
                <td style={TD}><LevelBadge level={e.level} /></td><td style={TDN}>{pct(e.in_force_share)}</td><td style={TDN}>{pct(e.contained_share)}</td>
                <td style={TD}>{e.next_level == null ? "top of the ladder" : `${e.next_level} ${levelName(e.next_level)}`}</td>
                <td style={{ ...TD, minWidth: 220 }}>{arr(e.to_next).length ? arr(e.to_next).map((x) => `${x.app} (${fmt(x.workloads)})`).join(", ") : "none"}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No environment in the data: no workload carries an env label.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Workloads without both app and env labels form the unlabelled row at level 0 and belong to no environment.</div>
        <Legend items={LEGEND.level} />
      </Section>
      <Section title={`To the next level${next == null ? "" : `: ${next} ${levelName(next)}`}`}>
        <div style={{ fontSize: 12, color: C.text, marginBottom: 8, lineHeight: 1.5 }}>
          {ruleText(EST.threshold)} {next != null && share && share.total > 0 && <span>Today {fmt(share.above)} of {fmt(share.total)} managed labelled workloads ({pct(share.above / share.total)}) sit at level {next} or above; the bar is {fmt(needed)}.</span>}
          {next == null && <span>The estate is at level 5; nothing is below the next level.</span>}
        </div>
        <ToNextTable rows={EST.to_next} />
        <Legend items={[...LEGEND.level, ...LEGEND.plain]} />
      </Section>
    </>
  );
}

function AppsTab() {
  const [env, setEnv] = useState("all");
  const [level, setLevel] = useState("all");
  const envs = [...new Set(APPS.map((a) => (a.env == null ? "none" : a.env)))];
  const rows = useMemo(() => APPS.filter((a) => (env === "all" || (a.env == null ? "none" : a.env) === env) && (level === "all" || String(a.level) === level)), [env, level]);
  const filters = (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Select label="Env" value={env} onChange={setEnv} options={[["all", "all"], ...envs.map((e) => [e, e])]} />
      <Select label="Level" value={level} onChange={setLevel} options={[["all", "all"], ...(LADDER.length ? LADDER : [0, 1, 2, 3, 4, 5].map((n) => ({ level: n, name: "" }))).map((l) => [String(l.level), `${l.level} ${l.name}`.trim()])]} />
    </div>
  );
  const th2 = { ...TH, textAlign: "center", padding: "6px 6px", fontSize: 10, letterSpacing: 0.3 };
  const groups = LADDER.filter((l) => arr(l.gates).length);
  return (
    <Section title="Apps on the ladder" right={filters}>
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>
        Showing {fmt(rows.length)} of {fmt(APPS.length)} rows · crown jewels first, then level ascending · one cell per gate in ladder order; hover a cell for the reason, a header for the gate in words.
      </div>
      {rows.length ? (
        <Scroll>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={TH} rowSpan={2}>App</th><th style={TH} rowSpan={2}>Env</th><th style={{ ...TH, textAlign: "right" }} rowSpan={2}>Workloads</th><th style={TH} rowSpan={2}>Level</th>
                {groups.map((l) => <th key={l.level} colSpan={arr(l.gates).length} style={{ ...th2, borderLeft: `1px solid ${C.gray400}` }}>{l.level} {l.name}</th>)}
                <th style={TH} rowSpan={2}>First next step</th>
              </tr>
              <tr>
                {GATES.map((g) => <th key={g} title={GATE_TEXT[g] || g} style={{ ...th2, background: C.gray700 }}>{GATE_SHORT[g] || g}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={appKey(a)} style={{ background: i % 2 ? BAND : C.white }}>
                  <td style={TDK}>{a.app}{a.crown_jewel && <span style={{ marginLeft: 6 }}><CrownBadge /></span>}</td>
                  <td style={{ ...TD, fontFamily: MONO, whiteSpace: "nowrap" }}>{a.env == null ? "none" : a.env}</td>
                  <td style={TDN}>{fmt(a.workloads)}</td>
                  <td style={TD}><LevelBadge level={a.level} name={a.level_name} /></td>
                  {GATES.map((g) => <td key={g} style={{ ...TD, textAlign: "center", padding: "7px 4px" }}><GateBadge g={obj(a.gates)[g]} id={g} /></td>)}
                  <td style={{ ...TD, minWidth: 420 }}>{arr(a.next_steps).length ? arr(a.next_steps)[0].sentence : a.next_level == null ? "contained; nothing to do" : "no step recorded"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : <div style={empty}>{APPS.length ? "No app matches these filters." : "No app rows: the workload inventory is empty."}</div>}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Gates: {GATES.map((g) => `${GATE_SHORT[g] || g} = ${GATE_TEXT[g] || g}`).join("; ")}.</div>
      <Legend items={[...LEGEND.gates, ...LEGEND.level, ...LEGEND.crown]} />
    </Section>
  );
}

function NextStepsTab() {
  const steps = APPS.flatMap((a) => arr(a.next_steps).map((s) => ({ ...s, app: a.app, env: a.env, key: appKey(a), crown: a.crown_jewel })));
  const kinds = [...KIND_ORDER, ...[...new Set(steps.map((s) => s.kind))].filter((k) => !KIND_ORDER.includes(k))].filter((k) => steps.some((s) => s.kind === k));
  const order = { today: 0, week: 1, plan: 2 };
  const count = (b) => steps.filter((s) => s.bucket === b).length;
  return (
    <>
      <div style={{ fontSize: 12, color: C.text, marginTop: 16, lineHeight: 1.5 }}>
        {fmt(steps.length)} steps across {fmt(new Set(steps.map((s) => s.key)).size)} rows · {fmt(count("today"))} today, {fmt(count("week"))} this week, {fmt(count("plan"))} to plan. Each step moves its app one gate towards the next level; the bucket is rapid-risk-reduction's when one of its lines backs the step. Call plans live in that run's call-plans.md; nothing here writes to the PCE.
      </div>
      {kinds.length ? kinds.map((k) => (
        <Section key={k} title={KIND_LABEL[k] || k}>
          {steps.filter((s) => s.kind === k).sort((a, b) => (order[a.bucket] ?? 3) - (order[b.bucket] ?? 3)).map((s, i) => (
            <div key={`${s.key}|${s.gate}|${i}`} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.gray200}`, fontSize: 13 }}>
              <BucketBadge b={s.bucket} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: C.slate }}>{s.app}{s.env == null ? "" : ` (${s.env})`}</span>{s.crown && <span style={{ marginLeft: 6 }}><CrownBadge /></span>}
                <span style={{ color: C.muted }}> · gate {GATE_SHORT[s.gate] || s.gate}</span>
                <div style={{ color: C.text, marginTop: 2 }}>{s.sentence}</div>
                {s.call_plan && <div style={{ fontFamily: MONO, fontSize: 11, color: C.gray700, marginTop: 3, overflowWrap: "anywhere" }}>{s.call_plan}</div>}
              </div>
            </div>
          ))}
          <Legend items={[...LEGEND.buckets, ...LEGEND.crown]} />
        </Section>
      )) : <Section title="Next steps"><div style={empty}>No step: every app is at level 5, or no app row exists.</div><Legend items={LEGEND.buckets} /></Section>}
    </>
  );
}

const GRID_COLS = [["unmanaged_inbound", "Unmanaged inbound", "allowed connections from external or unlabelled sources"],
  ["unmanaged_admin_sources", "Unmanaged admin sources", "unknown sources on admin ports"],
  ["cross_env_connections", "Cross-env connections", "allowed connections from other environments"],
  ["cross_env_apps", "Cross-env apps", "distinct apps in other environments"],
  ["wide_reach_accounts", "Wide-reach accounts", "review-flagged identities touching the app"],
  ["workloads_not_enforcing", "Not enforcing", "workloads not in selective or full"]];

function HeatGrid({ apps, headline }) {
  const th = { ...TH, textAlign: "center", padding: "6px 4px", fontSize: 10, letterSpacing: 0.3, whiteSpace: "normal", verticalAlign: "bottom" };
  if (!apps.length) return <div style={empty}>No app could be ranked: no labelled app in the inventory or the traffic summary.</div>;
  return (
    <Scroll>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, width: "100%", fontSize: 12, minWidth: 620 }}>
        <thead><tr><th style={{ ...th, textAlign: "left" }}>App</th><th style={th}>Workloads</th>{GRID_COLS.map(([k, label, hint]) => <th key={k} style={th} title={hint}>{label}</th>)}</tr></thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.app}>
              <td style={{ padding: "6px 6px", color: C.slate, fontWeight: 600, whiteSpace: "nowrap" }}>{a.app}{a.crown_jewel && <span> <Badge label="CJ" bg={C.gray100} color={C.gray700} mono /></span>}</td>
              <td style={{ padding: "6px 4px", textAlign: "center", color: C.text }}>{fmt(a.workloads)}</td>
              {GRID_COLS.map(([k]) => { const b = Number(obj(a.bands)[k]) || 0; return (
                <td key={k} title={`${fmt(a[k])}`} style={{ padding: "7px 4px", textAlign: "center", background: bandBg(b), color: bandFg(b), fontWeight: 600, borderRadius: 0, minWidth: 54 }}>{compact(a[k])}</td>
              ); })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
        {fmt(apps.length)} apps, ranked by the sum of the shaded bands (crown jewels first). Measures over the whole window.
        {Number(headline.unmanaged_admin_public) > 0 && ` ${fmt(headline.unmanaged_admin_public)} of the unmanaged admin sources are public addresses; they land on ${apps.filter((a) => a.public_admin_sources > 0).slice(0, 4).map((a) => a.app).join(", ") || "apps outside these rows"}.`}
      </div>
    </Scroll>
  );
}

function EnvMatrix({ m }) {
  if (!m.length) return <div style={empty}>No allowed traffic between environments in this window.</div>;
  const totals = {};
  m.forEach((r) => { totals[r.from] = (totals[r.from] || 0) + (r.allowed || 0); totals[r.to] = (totals[r.to] || 0) + (r.allowed || 0); });
  const envs = Object.keys(totals).sort((x, y) => totals[y] - totals[x]);
  const max = Math.max(1, ...m.map((r) => r.allowed || 0));
  const look = {};
  m.forEach((r) => { look[`${r.from}|${r.to}`] = r; });
  const band = (v) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor(4 * Math.sqrt(v / max) * 0.999)));
  const cell = { padding: "7px 4px", textAlign: "center", fontSize: 12, borderRadius: 0, minWidth: 54 };
  const th = { ...TH, padding: "6px 4px", fontSize: 10, letterSpacing: 0.3, textAlign: "center" };
  const top = [...m].sort((a, b) => (b.allowed || 0) - (a.allowed || 0))[0];
  return (
    <Scroll>
      <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 12 }}>
        <thead><tr><th style={{ ...th, textAlign: "left", padding: "6px" }}>From / to</th>{envs.map((e) => <th key={e} style={th}>{e}</th>)}</tr></thead>
        <tbody>
          {envs.map((from) => (
            <tr key={from}>
              <td style={{ padding: "6px", fontWeight: 600, color: C.slate, whiteSpace: "nowrap" }}>{from}</td>
              {envs.map((to) => {
                const r = look[`${from}|${to}`];
                if (from === to || !r || !r.allowed) return <td key={to} style={{ ...cell, color: C.gray300 }}>{from === to ? "" : "·"}</td>;
                const b = band(r.allowed);
                return <td key={to} title={`${from} to ${to}: ${fmt(r.allowed)} allowed, ${fmt(r.potentially_blocked)} potentially blocked, ${fmt(r.blocked)} blocked`} style={{ ...cell, background: bandBg(b), color: bandFg(b), fontWeight: 600 }}>{compact(r.allowed)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Allowed connections between environments, whole window; the largest crossing is {top.from} to {top.to} with {fmt(top.allowed)} allowed and {fmt(top.blocked)} blocked.</div>
    </Scroll>
  );
}

function DriftTable({ rows, headline }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>
        Enabled provisioned override denies whose named traffic is reported allowed. A provisioned override deny on an enforcing workload reports blocked, so before adding rules check the enforcing side's mode, the rule's scope, its update time and the data itself. {fmt(headline.override_denies_unchecked)} override denies use shapes this check does not cover.
      </div>
      <Table head={["Ruleset", "Should stop", "Reported allowed", "Basis", "Enforced on", "Rule updated"]} min={760}>
        {rows.map((d, i) => (
          <tr key={i} style={{ background: i % 2 ? BAND : C.white }}>
            <td style={TDK}>{d.ruleset}</td>
            <td style={{ ...TD, minWidth: 220 }}>{arr(d.consumers).join(", ")} to {arr(d.providers).join(", ")} on {arr(d.services).join(", ")}</td>
            <td style={TDN}>{fmt(d.allowed_connections)}</td><td style={TD}>{d.basis}</td><td style={TD}>{d.enforced_on}</td>
            <td style={{ ...TD, whiteSpace: "nowrap" }}>{String(d.rule_updated_at || "?").slice(0, 10)}{d.changed_in_window ? " (changed inside the window)" : ""}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function EvidenceTab() {
  const r = obj(EV.readiness), h = obj(EV.headline), apps = arr(EV.apps), m = arr(EV.env_matrix), drift = arr(EV.rule_drift), fix = arr(EV.fix_first);
  const v = verdictStyle[r.verdict] || verdictStyle.ready;
  return (
    <>
      <div style={{ fontSize: 12, color: C.text, marginTop: 16, lineHeight: 1.5, background: C.white, border: `1px solid ${C.gray200}`, padding: "10px 14px" }}>
        <b style={{ color: C.slate }}>This is the rapid-risk-reduction risk map, unchanged.</b> The ladder's level 4 and 5 gates read these measures. Every line's score, its draft rule and its call plan live in that run's call-plans.md; nothing here is a new finding.
      </div>
      {EV.takeaway && <div style={{ fontSize: 15, color: C.slate, marginTop: 16, lineHeight: 1.45, maxWidth: 820 }}>{EV.takeaway}</div>}
      <Section title="Labelling readiness">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: C.text, flexWrap: "wrap" }}>
          <Badge label={v.label} bg={v.bg} color={v.color} />
          <div style={{ minWidth: 0, flex: 1 }}>
            {r.workloads ? `${fmt(r.labelled)} of ${fmt(r.workloads)} workloads carry app and env labels (${fmt(r.unlabelled)} without).` : "No workloads in the inventory."}
            {arr(r.notes).length > 0 && <span> {arr(r.notes).join("; ")}.</span>}
            {r.verdict && r.verdict !== "ready" && <span> Scoped fixes (ringfences, environment denies, the grid) cover labelled workloads only.</span>}
            {arr(r.unlabelled_examples).length > 0 && <span style={{ color: C.muted }}> Examples: {arr(r.unlabelled_examples).join(", ")}.</span>}
          </div>
        </div>
        <Legend items={LEGEND.verdict} />
      </Section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 16 }}>
        <KPICard label="Workloads in full enforcement" value={h.full_enforcement} subtitle={`of ${fmt(h.workloads)} · ${fmt(h.selective)} selective, ${fmt(h.not_enforcing)} not enforcing`} />
        <KPICard label="Unmanaged admin-port sources" value={h.unmanaged_admin_sources} attention="medium"
          subtitle={h.unmanaged_admin_public > 0 ? `${fmt(h.unmanaged_admin_internal)} internal, ${fmt(h.unmanaged_admin_public)} public` : h.unmanaged_admin_sources > 0 ? "all internal: identify first" : "none in this window"} />
        <KPICard label="Apps reaching most of the estate" value={h.wide_reach_apps} subtitle={h.wide_reach_apps == null ? "no lateral-movement result" : `of ${fmt(h.apps_in_graph)} apps, three quarters or more, ${fmt(h.lateral_days)} days${h.wide_reach_lower_bound ? " (lower bound)" : ""}`} />
        <KPICard label="Override denies not showing" value={h.override_denies_not_showing} attention="high" subtitle={`${fmt(h.override_denies_unchecked)} not checked (other rule shapes)`} />
      </div>
      <Section title="KPI borders"><Legend items={LEGEND.mapKpi} /></Section>
      <Section title="Where the risk sits">
        <HeatGrid apps={apps} headline={h} />
        <Legend items={LEGEND.grid} />
      </Section>
      <Section title="Traffic between environments">
        <EnvMatrix m={m} />
        <Legend items={LEGEND.matrix} />
      </Section>
      <Section title="Rules not showing in traffic">
        {drift.length ? <DriftTable rows={drift} headline={h} /> : <div style={empty}>{h.override_denies_not_showing === 0 ? "Every enabled provisioned override deny shows in the traffic as expected." : "Not checked: no rulesets saved."}</div>}
        <Legend items={LEGEND.plain} />
      </Section>
      <Section title="Fix first">
        {fix.length ? (
          <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: 13, color: C.text, lineHeight: 1.5 }}>
            {fix.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
          </ol>
        ) : <div style={empty}>Nothing stands out in this window.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Generated by rapid-risk-reduction from the evidence above; nothing has been changed on the PCE.</div>
        <Legend items={[["list text: no colour, no meaning", C.gray300]]} />
      </Section>
    </>
  );
}

function MethodTab() {
  const inputs = obj(RRR.inputs), trunc = obj(RRR.truncated), missing = arr(RRR.missing_inputs), notes = arr(D.notes), files = obj(D.inputs);
  const truncated = Object.keys(trunc).filter((k) => trunc[k]);
  const absent = Object.keys(inputs).filter((k) => !inputs[k]);
  return (
    <>
      <Section title="The gates in words">
        {LADDER.length ? (
          <Table head={["Level", "Gate", "Passes when", "Holds"]} min={640}>
            {LADDER.flatMap((l) => (arr(l.gates).length ? arr(l.gates).map((g, j) => ({ l, g, j })) : [{ l, g: null, j: 0 }])).map(({ l, g, j }, i) => (
              <tr key={`${l.level}|${g}`} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TDK}>{j === 0 ? <LevelBadge level={l.level} name={l.name} /> : ""}</td>
                <td style={{ ...TD, fontFamily: MONO, whiteSpace: "nowrap" }}>{g || "none"}</td>
                <td style={{ ...TD, minWidth: 300 }}>{g ? GATE_TEXT[g] || "no text" : "the level 1 gates fail"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{j === 0 ? (l.human_dependent ? "depends on a human noticing" : "holds without one") : ""}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No ladder in the data.</div>}
        <div style={{ fontSize: 12, color: C.text, marginTop: 8, lineHeight: 1.5 }}>
          Level = the highest level whose gates, and every lower level's gates, all pass. A gate is pass, fail or unknown; unknown never passes. Workloads without both app and env form one row, unlabelled, at level 0. {ruleText(EST.threshold)} Crown jewels are flagged and sort first; nothing else differs for them.
        </div>
        <Legend items={LEGEND.level} />
      </Section>
      <Section title="Illumio semantics the gates rest on">
        <ul style={{ margin: "0 0 0 18px", padding: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>
          <li style={{ marginBottom: 4 }}>Selective enforcement enforces deny rules only; everything a deny does not catch is reported allowed.</li>
          <li style={{ marginBottom: 4 }}>Full enforcement is default deny: only what an allow rule admits gets through.</li>
          <li style={{ marginBottom: 4 }}>A provisioned ruleset scoped to a workload in visibility-only changes nothing; the workload reports what would happen.</li>
          <li style={{ marginBottom: 4 }}>A drafted rule changes nothing until it is provisioned.</li>
          <li style={{ marginBottom: 4 }}>Labels are never assumed complete: the unlabelled row counts against the estate, and a missing label hides an app from every scoped measure.</li>
          <li style={{ marginBottom: 4 }}>Nothing in this skill writes to the PCE; it reads a rapid-risk-reduction run and grades it.</li>
        </ul>
        <Legend items={LEGEND.plain} />
      </Section>
      <Section title="Inputs">
        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
          Rapid-risk-reduction run of {RRR.date || "unknown date"} · traffic window {String(obj(RRR.window).start || "?").slice(0, 10)} to {String(obj(RRR.window).end || "?").slice(0, 10)} ({fmt(RRR.window_days)} days) · lateral movement over {fmt(RRR.lateral_days)} days · policy read: {RRR.policy_view === "draft" ? "provisioned and draft" : "provisioned only"} · crown jewels: {arr(RRR.crown_jewels).join(", ") || "none"} ({RRR.crown_jewels_source || "no source recorded"}).
        </div>
        <div style={{ fontSize: 12, color: C.text, marginTop: 6 }}>Files: {Object.keys(files).length ? Object.entries(files).map(([k, v]) => `${k} ${v == null ? "missing" : v}`).join(", ") : "none recorded"}. Pulls saved by that run: {Object.keys(inputs).filter((k) => inputs[k]).join(", ") || "none"}.</div>
        {truncated.length > 0 && <InfoLine>Truncated: {truncated.join(", ")}. The tool hit its row cap; every count that rests on that pull is a lower bound.</InfoLine>}
        {(absent.length > 0 || missing.length > 0) && <InfoLine>Missing: {[...new Set([...absent, ...missing])].join(", ")}. Gates that need it read unknown, and unknown never passes.</InfoLine>}
        {!truncated.length && !absent.length && !missing.length && <div style={{ ...empty, fontSize: 12, marginTop: 6 }}>No input was truncated or missing.</div>}
        <Legend items={LEGEND.info} />
      </Section>
      <Section title="Notes">
        {notes.length ? <ul style={{ margin: "0 0 0 18px", padding: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{notes.map((n, i) => <li key={i} style={{ marginBottom: 4 }}>{n}</li>)}</ul> : <div style={empty}>No notes.</div>}
        <Legend items={LEGEND.plain} />
      </Section>
    </>
  );
}

export default function App() {
  const tabs = ["Readiness", "Apps", "Next steps", "Evidence", "Method"];
  const [tab, setTab] = useState("Readiness");
  const date = D.date || String(D.generated || "").slice(0, 10) || "unknown date";
  const w = obj(RRR.window);
  const subtitle = `Graded ${date} from the rapid-risk-reduction run of ${RRR.date || "?"} · traffic ${String(w.start || "?").slice(0, 10)} to ${String(w.end || "?").slice(0, 10)} (${fmt(RRR.window_days)} days) · ${fmt(EST.workloads)} workloads, ${fmt(APPS.length)} rows · estate at level ${EST.level == null ? "?" : `${EST.level} ${levelName(EST.level)}`}`;

  return (
    <div style={{ fontFamily: FONT, background: C.gray50, minHeight: "100vh", padding: 16, color: C.text, boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 300, color: C.slate, letterSpacing: -0.2 }}>Mythos readiness</div>
          <div style={{ width: 40, height: 2, background: C.accent, margin: "6px 0 8px" }} />
          <div style={{ fontSize: 13, color: C.muted }}>{subtitle}</div>
        </div>
        <Badge label="READ ONLY · NOTHING CHANGED ON THE PCE" bg={C.gray100} color={C.gray700} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <ColourKey />
      </div>

      {tab === "Readiness" && <ReadinessTab />}
      {tab === "Apps" && <AppsTab />}
      {tab === "Next steps" && <NextStepsTab />}
      {tab === "Evidence" && <EvidenceTab />}
      {tab === "Method" && <MethodTab />}

      <div style={{ fontSize: 11, color: C.muted, marginTop: 20, lineHeight: 1.5 }}>
        Method: a rapid-risk-reduction run (plan.json, workloads.json, lateral.json) graded by references/ladder.md: six levels, each a set of gates that pass, fail or read unknown; unknown never passes; levels 0 to 2 depend on a human noticing, 3 to 5 hold without one. An estate or environment is at level L when at least {pct(EST.threshold)} of its managed labelled workloads sit in apps at level L or above. Scores and call plans stay in the rapid-risk-reduction run. Every number is from readiness.json; nothing on the PCE was read or changed to produce this page.
      </div>
    </div>
  );
}
