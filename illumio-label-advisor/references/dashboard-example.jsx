import React, { useState, useMemo } from "react";

// Label advisor dashboard: what the script found, what it suggests and what the apply step
// would do. scripts/advise.py writes dashboard.jsx by replacing everything between the two
// marker lines below (matched as whole lines) with `const DATA = <advice.json>;`. DATA is
// the advice.json object exactly (references/dashboard-spec.md). This file doubles as the
// template and as a worked example; its DATA is a hand-written sample in the same shape.

// Illumio Field palette (references/dashboard-spec.md, "Illumio Field").
const C = {
  accent: "#FF5500",          // Illumio Orange: active tab underline, title rule; never a status
  slate: "#313638",           // Server Slate: headings, primary text, table header rows, "labelled" bars
  text: "#464A4C",            // body text
  muted: "#64686A",           // captions, labels
  green: "#166644",           // Safeguard Green: high confidence
  greenLight: "rgba(22,102,68,0.10)",
  greenDark: "#11432F",
  teal: "#2D454C",            // System Cyan: info (truncated or missing input), model source
  tealLight: "rgba(45,69,76,0.10)",
  orange: "#F97607",          // Circuit Gold 110: warning, high (unused here)
  orangeLight: "rgba(249,118,7,0.10)",
  amber: "#FFA22F",           // Gold: medium confidence (fill with slate text)
  amberLight: "rgba(255,162,47,0.12)",
  red: "#BE122F",             // Risk Red: conflict with an existing label
  redLight: "rgba(190,18,47,0.10)",
  gray50: "#F7F4EE",          // page ground: Zero Trust Tan
  gray100: "#F5F5F5",         // subtle fills
  gray200: "#D6D7D7",         // borders
  gray300: "#C1C3C3",         // "missing" bars, low confidence
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
  "window": {
    "start": "2026-10-07",
    "end": "2026-11-06",
    "days": 30
  },
  "inputs": {
    "files": [
      "labels.txt",
      "workloads.json",
      "workloads_full_1.json",
      "workloads_full_2.json",
      "workloads_full_3.json",
      "workloads_full_4.json",
      "workloads_full_5.json",
      "workloads_full_6.json",
      "workloads_full_7.json",
      "workloads_full_8.json",
      "flows_dst_1.json",
      "flows_dst_2.json",
      "flows_dst_3.json",
      "flows_dst_4.json",
      "flows_dst_5.json",
      "flows_src_1.json",
      "flows_src_2.json",
      "flows_src_3.json",
      "flows_src_4.json",
      "flows_src_5.json",
      "summary.json",
      "infra.json",
      "model-suggestions.json",
      "preferences.json"
    ],
    "truncated": [
      "flows_dst_1.json"
    ],
    "missing": []
  },
  "dimensions": {
    "standard": [
      "role",
      "app",
      "env",
      "loc"
    ],
    "custom": [
      "bu"
    ],
    "values": {
      "role": [
        "App",
        "Backup",
        "DNS",
        "Database",
        "Directory",
        "Monitoring",
        "Web"
      ],
      "app": [
        "ad",
        "backup",
        "crm",
        "dns",
        "monitoring",
        "pay",
        "shop"
      ],
      "env": [
        "Production",
        "Staging"
      ],
      "loc": [
        "DC1",
        "DC2"
      ],
      "bu": [
        "Corporate",
        "Retail",
        "Sales"
      ]
    }
  },
  "readiness": {
    "workloads": 120,
    "managed": 118,
    "online": 118,
    "unmanaged": 2,
    "fully_labelled": 60,
    "partly_labelled": 20,
    "unlabelled": 40,
    "coverage": {
      "role": {
        "labelled": 70,
        "missing": 50
      },
      "app": {
        "labelled": 67,
        "missing": 53
      },
      "env": {
        "labelled": 68,
        "missing": 52
      },
      "loc": {
        "labelled": 70,
        "missing": 50
      },
      "bu": {
        "labelled": 67,
        "missing": 53
      }
    },
    "process_visibility": {
      "with_listeners": 118,
      "without": 2,
      "flows_with_process": 2442,
      "flows_without_process": 476
    },
    "traffic": {
      "flows": 2477,
      "calls": 10,
      "truncated_calls": 1
    },
    "notes": [
      "fully labelled means all four standard dimensions (role, app, env, loc) are present; custom dimensions (bu) count in the coverage table, not in this verdict",
      "full detail (listener records) read for 120 of 120 workloads; 118 report at least one listener",
      "truncated inputs (counts are lower bounds): flows_dst_1.json",
      "6 hubs (fan-in threshold 20 sources on one port, or listed by identify-infrastructure-services) excluded as peer evidence",
      "model pass: 1 suggestions merged, 5 notes",
      "model: prd-shop-web01 already carries role=Web; ignored",
      "model: unknown href /orgs/1/workloads/00000000-0000-4000-8000-000000000000 ignored",
      "model agrees with the script on stg-crm-util01 app=crm (confidence unchanged)",
      "model: stg-crm-app05 bu=Marketing is not an existing value of a custom dimension; ignored",
      "model agrees with the script on unm01 loc=DC1 (confidence unchanged)"
    ]
  },
  "conventions": [
    {
      "dimension": "role",
      "rule": "hostname part 3 (split on - _ . and letter/digit runs)",
      "token": "app",
      "value": "App",
      "support": 22,
      "counter": 0
    },
    {
      "dimension": "role",
      "rule": "hostname part 3 (split on - _ . and letter/digit runs)",
      "token": "web",
      "value": "Web",
      "support": 21,
      "counter": 0
    },
    {
      "dimension": "role",
      "rule": "hostname part 3 (split on - _ . and letter/digit runs)",
      "token": "db",
      "value": "Database",
      "support": 20,
      "counter": 0
    },
    {
      "dimension": "app",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "shop",
      "value": "shop",
      "support": 21,
      "counter": 0
    },
    {
      "dimension": "app",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "crm",
      "value": "crm",
      "support": 20,
      "counter": 0
    },
    {
      "dimension": "app",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "pay",
      "value": "pay",
      "support": 20,
      "counter": 0
    },
    {
      "dimension": "env",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "stg",
      "value": "Staging",
      "support": 33,
      "counter": 0
    },
    {
      "dimension": "env",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "prd",
      "value": "Production",
      "support": 27,
      "counter": 2
    },
    {
      "dimension": "env",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "01",
      "value": "Production",
      "support": 4,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "prd",
      "value": "DC1",
      "support": 32,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "stg",
      "value": "DC2",
      "support": 32,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "01",
      "value": "DC1",
      "support": 4,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "shop",
      "value": "Retail",
      "support": 22,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "pay",
      "value": "Retail",
      "support": 20,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "hostname part 2 (split on - _ . and letter/digit runs)",
      "token": "crm",
      "value": "Sales",
      "support": 19,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "hostname part 1 (split on - _ . and letter/digit runs)",
      "token": "01",
      "value": "Corporate",
      "support": 4,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.1.0/24",
      "value": "DC1",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.3.0/24",
      "value": "DC1",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.2.0/24",
      "value": "DC2",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.3.0/24",
      "value": "DC2",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.2.0/24",
      "value": "DC1",
      "support": 10,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.1.0/24",
      "value": "DC2",
      "support": 10,
      "counter": 0
    },
    {
      "dimension": "loc",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.0.0/24",
      "value": "DC1",
      "support": 6,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.1.0/24",
      "value": "Retail",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.1.0/24",
      "value": "Retail",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.2.0/24",
      "value": "Retail",
      "support": 11,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.20.3.0/24",
      "value": "Sales",
      "support": 10,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.2.0/24",
      "value": "Retail",
      "support": 9,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.3.0/24",
      "value": "Sales",
      "support": 9,
      "counter": 0
    },
    {
      "dimension": "bu",
      "rule": "subnet /24 majority (80 percent or more)",
      "token": "10.10.0.0/24",
      "value": "Corporate",
      "support": 6,
      "counter": 0
    }
  ],
  "hubs": [
    {
      "href": "/orgs/1/workloads/00000005-87b3-4a1b-9c2d-215b5bab1eec",
      "hostname": "bk01",
      "port": 13720,
      "proto": "tcp",
      "process": "bprd",
      "sources": 117,
      "kind": "backup",
      "from": "fan-in",
      "other_ports": []
    },
    {
      "href": "/orgs/1/workloads/00000001-ecc3-4a1b-9c2d-f2d7c7859fae",
      "hostname": "dc01",
      "port": 88,
      "proto": "tcp",
      "process": "lsass.exe",
      "sources": 117,
      "kind": "directory",
      "from": "fan-in",
      "other_ports": [
        "389/tcp"
      ]
    },
    {
      "href": "/orgs/1/workloads/00000002-4a37-4a1b-9c2d-d463e47682e6",
      "hostname": "dc02",
      "port": 88,
      "proto": "tcp",
      "process": "lsass.exe",
      "sources": 117,
      "kind": "directory",
      "from": "fan-in",
      "other_ports": [
        "389/tcp"
      ]
    },
    {
      "href": "/orgs/1/workloads/00000003-1563-4a1b-9c2d-978f045f21da",
      "hostname": "dns01",
      "port": 53,
      "proto": "udp",
      "process": "named",
      "sources": 117,
      "kind": "dns",
      "from": "fan-in",
      "other_ports": []
    },
    {
      "href": "/orgs/1/workloads/00000004-4e86-4a1b-9c2d-61126c7ab5c9",
      "hostname": "dns02",
      "port": 53,
      "proto": "udp",
      "process": "named",
      "sources": 117,
      "kind": "dns",
      "from": "fan-in",
      "other_ports": []
    },
    {
      "href": "/orgs/1/workloads/00000006-b9d8-4a1b-9c2d-44733126b9c3",
      "hostname": "mon01",
      "port": null,
      "proto": null,
      "process": null,
      "sources": 0,
      "kind": "shared service (consumer)",
      "from": "infra-tool",
      "other_ports": []
    }
  ],
  "suggestions": [
    {
      "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
      "hostname": "prd-crm-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
      "hostname": "prd-crm-app06",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
      "hostname": "prd-crm-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
      "hostname": "prd-crm-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
      "hostname": "prd-crm-db06",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
      "hostname": "prd-crm-web04",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
      "hostname": "prd-crm-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
      "hostname": "prd-pay-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
      "hostname": "prd-pay-app05",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
      "hostname": "prd-pay-app06",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
      "hostname": "prd-pay-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
      "hostname": "prd-pay-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
      "hostname": "prd-pay-db06",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
      "hostname": "prd-pay-web04",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000047-c91d-4a1b-9c2d-2451f4e43210",
      "hostname": "prd-pay-web05",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
      "hostname": "prd-pay-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
      "hostname": "prd-shop-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
      "hostname": "prd-shop-app06",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
      "hostname": "prd-shop-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "mysqld listening on 3306/tcp (table: Database, MySQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000044-f396-4a1b-9c2d-141da91e6cfd",
      "hostname": "prd-shop-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "mysqld listening on 3306/tcp (table: Database, MySQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
      "hostname": "prd-shop-web04",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003e-71d7-4a1b-9c2d-57c0c30d72c2",
      "hostname": "prd-shop-web05",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
      "hostname": "prd-shop-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006d-6616-4a1b-9c2d-5e0ad25d0fbe",
      "hostname": "stg-crm-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
      "hostname": "stg-crm-app05",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
      "hostname": "stg-crm-app06",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
      "hostname": "stg-crm-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000071-d717-4a1b-9c2d-643400cee78a",
      "hostname": "stg-crm-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
      "hostname": "stg-crm-db06",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "postgres listening on 5432/tcp (table: Database, PostgreSQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
      "hostname": "stg-crm-web05",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
      "hostname": "stg-crm-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000064-5ca5-4a1b-9c2d-a6b6881a5829",
      "hostname": "stg-pay-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
      "hostname": "stg-pay-app06",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
      "hostname": "stg-pay-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
      "hostname": "stg-pay-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
      "hostname": "stg-pay-db06",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "sqlservr.exe listening on 1433/tcp (table: Database, SQL Server)"
        },
        {
          "kind": "ven_os",
          "evidence": "windows VEN; the sqlservr.exe row is windows-specific"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
      "hostname": "stg-pay-web04",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000063-f78a-4a1b-9c2d-fdf76d3353a8",
      "hostname": "stg-pay-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
      "hostname": "stg-shop-app04",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
      "hostname": "stg-shop-app05",
      "dimension": "role",
      "value": "App",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token app (part 3) maps to App on 22 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
      "hostname": "stg-shop-db04",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "mysqld listening on 3306/tcp (table: Database, MySQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
      "hostname": "stg-shop-db05",
      "dimension": "role",
      "value": "Database",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "mysqld listening on 3306/tcp (table: Database, MySQL)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token db (part 3) maps to Database on 20 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000058-c32e-4a1b-9c2d-905bfb8c9788",
      "hostname": "stg-shop-web04",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
      "hostname": "stg-shop-web05",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005a-90b4-4a1b-9c2d-9f3c25867fe6",
      "hostname": "stg-shop-web06",
      "dimension": "role",
      "value": "Web",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "nginx listening on 443/tcp (table: Web, reverse proxy or static web)"
        },
        {
          "kind": "hostname_token",
          "evidence": "token web (part 3) maps to Web on 21 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
      "hostname": "prd-crm-app04",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 8 labelled peers (1372 of 1436 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000053-472f-4a1b-9c2d-16ceb0e709fb",
      "hostname": "prd-crm-app05",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (1782 of 1782 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
      "hostname": "prd-crm-app06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (2922 of 2922 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
      "hostname": "prd-crm-db04",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1350 of 1350 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
      "hostname": "prd-crm-db05",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1026 of 1026 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
      "hostname": "prd-crm-db06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1076 of 1076 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
      "hostname": "prd-crm-web04",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1608 of 1608 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000050-4aa8-4a1b-9c2d-51d4ae65e67f",
      "hostname": "prd-crm-web05",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (986 of 986 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
      "hostname": "prd-crm-web06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (992 of 992 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
      "hostname": "prd-pay-app04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 7 labelled peers (2090 of 2090 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
      "hostname": "prd-pay-app05",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 7 labelled peers (3292 of 3292 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
      "hostname": "prd-pay-app06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 9 labelled peers (2436 of 2452 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
      "hostname": "prd-pay-db04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1084 of 1084 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
      "hostname": "prd-pay-db05",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (952 of 952 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
      "hostname": "prd-pay-db06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (508 of 508 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000075-bd96-4a1b-9c2d-b574abf42b14",
      "hostname": "prd-pay-job01",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "8 of 9 labelled peers (3094 of 3108 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
      "hostname": "prd-pay-web04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1144 of 1144 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
      "hostname": "prd-pay-web06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1670 of 1670 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
      "hostname": "prd-shop-app04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "9 of 9 labelled peers (2222 of 2222 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000041-68dc-4a1b-9c2d-c58b4c81c41f",
      "hostname": "prd-shop-app05",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "9 of 9 labelled peers (4030 of 4030 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
      "hostname": "prd-shop-app06",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "9 of 9 labelled peers (3054 of 3054 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
      "hostname": "prd-shop-db04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1420 of 1420 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
      "hostname": "prd-shop-util01",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "2 of 2 labelled peers (70 of 70 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
      "hostname": "prd-shop-web04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (366 of 366 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
      "hostname": "prd-shop-web06",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1728 of 1728 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006d-6616-4a1b-9c2d-5e0ad25d0fbe",
      "hostname": "stg-crm-app04",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "8 of 9 labelled peers (3114 of 3124 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
      "hostname": "stg-crm-app05",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "8 of 8 labelled peers (2432 of 2432 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
      "hostname": "stg-crm-app06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "8 of 8 labelled peers (3056 of 3056 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
      "hostname": "stg-crm-db04",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1872 of 1872 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
      "hostname": "stg-crm-db06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1684 of 1684 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
      "hostname": "stg-crm-util01",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "2 of 2 labelled peers (44 of 44 connections) carry app=crm"
        },
        {
          "kind": "model_knowledge",
          "evidence": "vendord is the crm vendor's integration daemon"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
      "hostname": "stg-crm-web05",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1158 of 1158 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
      "hostname": "stg-crm-web06",
      "dimension": "app",
      "value": "crm",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to crm on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1254 of 1254 connections) carry app=crm"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000064-5ca5-4a1b-9c2d-a6b6881a5829",
      "hostname": "stg-pay-app04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 7 labelled peers (2950 of 2950 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000065-fb3f-4a1b-9c2d-fb7cf4a5ae6a",
      "hostname": "stg-pay-app05",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 7 labelled peers (3264 of 3264 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
      "hostname": "stg-pay-app06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "7 of 7 labelled peers (1972 of 1972 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
      "hostname": "stg-pay-db04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1008 of 1008 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
      "hostname": "stg-pay-db05",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (776 of 776 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
      "hostname": "stg-pay-db06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1174 of 1174 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
      "hostname": "stg-pay-web04",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (784 of 784 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000063-f78a-4a1b-9c2d-fdf76d3353a8",
      "hostname": "stg-pay-web06",
      "dimension": "app",
      "value": "pay",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to pay on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1122 of 1122 connections) carry app=pay"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
      "hostname": "stg-shop-app04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (2140 of 2140 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
      "hostname": "stg-shop-app05",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (2332 of 2332 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005d-ea48-4a1b-9c2d-a79db247d374",
      "hostname": "stg-shop-app06",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (2086 of 2086 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
      "hostname": "stg-shop-db04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (868 of 868 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
      "hostname": "stg-shop-db05",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (720 of 720 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000060-e58b-4a1b-9c2d-4b87b5853aae",
      "hostname": "stg-shop-db06",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1062 of 1062 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000076-fafe-4a1b-9c2d-dfb7ab1f495c",
      "hostname": "stg-shop-job01",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "6 of 6 labelled peers (3234 of 3234 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000058-c32e-4a1b-9c2d-905bfb8c9788",
      "hostname": "stg-shop-web04",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1676 of 1676 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
      "hostname": "stg-shop-web05",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (730 of 730 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005a-90b4-4a1b-9c2d-9f3c25867fe6",
      "hostname": "stg-shop-web06",
      "dimension": "app",
      "value": "shop",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to shop on 21 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_app",
          "evidence": "3 of 3 labelled peers (1732 of 1732 connections) carry app=shop"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
      "hostname": "prd-crm-app04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 8 labelled peers (1372 of 1436 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
      "hostname": "prd-crm-app06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (2922 of 2922 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
      "hostname": "prd-crm-db04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (2036 of 2036 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
      "hostname": "prd-crm-db05",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1216 of 1216 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
      "hostname": "prd-crm-db06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1524 of 1524 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
      "hostname": "prd-crm-web04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (2282 of 2282 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000050-4aa8-4a1b-9c2d-51d4ae65e67f",
      "hostname": "prd-crm-web05",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1258 of 1258 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
      "hostname": "prd-crm-web06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1088 of 1088 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
      "hostname": "prd-pay-app04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (1790 of 1790 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
      "hostname": "prd-pay-app05",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (2788 of 2788 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
      "hostname": "prd-pay-app06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "8 of 8 labelled peers (2288 of 2288 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000075-bd96-4a1b-9c2d-b574abf42b14",
      "hostname": "prd-pay-job01",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 8 labelled peers (2892 of 2928 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
      "hostname": "prd-shop-db04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1550 of 1550 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000044-f396-4a1b-9c2d-141da91e6cfd",
      "hostname": "prd-shop-db05",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1276 of 1276 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000045-e30d-4a1b-9c2d-f5268f93bf92",
      "hostname": "prd-shop-db06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1386 of 1386 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
      "hostname": "prd-shop-util01",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "2 of 2 labelled peers (70 of 70 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
      "hostname": "prd-shop-web04",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1164 of 1164 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003e-71d7-4a1b-9c2d-57c0c30d72c2",
      "hostname": "prd-shop-web05",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1022 of 1022 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
      "hostname": "prd-shop-web06",
      "dimension": "env",
      "value": "Production",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1990 of 1990 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006d-6616-4a1b-9c2d-5e0ad25d0fbe",
      "hostname": "stg-crm-app04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "7 of 7 labelled peers (2328 of 2328 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
      "hostname": "stg-crm-app05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (2280 of 2280 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
      "hostname": "stg-crm-app06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (2602 of 2602 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
      "hostname": "stg-crm-db04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1872 of 1872 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000071-d717-4a1b-9c2d-643400cee78a",
      "hostname": "stg-crm-db05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1636 of 1636 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
      "hostname": "stg-crm-db06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1684 of 1684 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
      "hostname": "stg-crm-util01",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "2 of 2 labelled peers (44 of 44 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006a-50d0-4a1b-9c2d-6d68bc66ab63",
      "hostname": "stg-crm-web04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1818 of 1818 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
      "hostname": "stg-crm-web05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1158 of 1158 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
      "hostname": "stg-crm-web06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "3 of 3 labelled peers (1254 of 1254 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
      "hostname": "stg-pay-app06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "7 of 7 labelled peers (1972 of 1972 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
      "hostname": "stg-pay-db04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "5 of 5 labelled peers (2066 of 2066 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
      "hostname": "stg-pay-db05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "5 of 5 labelled peers (1850 of 1850 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
      "hostname": "stg-pay-db06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "5 of 5 labelled peers (2046 of 2046 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
      "hostname": "stg-pay-web04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "5 of 5 labelled peers (2186 of 2186 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000063-f78a-4a1b-9c2d-fdf76d3353a8",
      "hostname": "stg-pay-web06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "5 of 5 labelled peers (1898 of 1898 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
      "hostname": "stg-shop-app04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "8 of 8 labelled peers (3118 of 3118 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
      "hostname": "stg-shop-app05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "8 of 8 labelled peers (2986 of 2986 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005d-ea48-4a1b-9c2d-a79db247d374",
      "hostname": "stg-shop-app06",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "8 of 8 labelled peers (2766 of 2766 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
      "hostname": "stg-shop-db04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1380 of 1380 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
      "hostname": "stg-shop-db05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1024 of 1024 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000058-c32e-4a1b-9c2d-905bfb8c9788",
      "hostname": "stg-shop-web04",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1932 of 1932 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
      "hostname": "stg-shop-web05",
      "dimension": "env",
      "value": "Staging",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to Staging on 33 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1334 of 1334 connections) carry env=Staging"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
      "hostname": "prd-crm-app04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
      "hostname": "prd-crm-app06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
      "hostname": "prd-crm-db04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
      "hostname": "prd-crm-db05",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
      "hostname": "prd-crm-db06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
      "hostname": "prd-crm-web04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
      "hostname": "prd-crm-web06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.3.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
      "hostname": "prd-pay-app04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
      "hostname": "prd-pay-app05",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
      "hostname": "prd-pay-app06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
      "hostname": "prd-pay-db04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
      "hostname": "prd-pay-db05",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
      "hostname": "prd-pay-db06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000075-bd96-4a1b-9c2d-b574abf42b14",
      "hostname": "prd-pay-job01",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
      "hostname": "prd-pay-web04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
      "hostname": "prd-pay-web06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.10.2.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
      "hostname": "prd-shop-app04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000041-68dc-4a1b-9c2d-c58b4c81c41f",
      "hostname": "prd-shop-app05",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
      "hostname": "prd-shop-app06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
      "hostname": "prd-shop-db04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
      "hostname": "prd-shop-util01",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
      "hostname": "prd-shop-web04",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003e-71d7-4a1b-9c2d-57c0c30d72c2",
      "hostname": "prd-shop-web05",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
      "hostname": "prd-shop-web06",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to DC1 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry loc=DC1"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
      "hostname": "stg-crm-app05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
      "hostname": "stg-crm-app06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
      "hostname": "stg-crm-db04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
      "hostname": "stg-crm-db06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
      "hostname": "stg-crm-util01",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006a-50d0-4a1b-9c2d-6d68bc66ab63",
      "hostname": "stg-crm-web04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
      "hostname": "stg-crm-web05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
      "hostname": "stg-crm-web06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.3.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
      "hostname": "stg-pay-app06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
      "hostname": "stg-pay-db04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
      "hostname": "stg-pay-db05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
      "hostname": "stg-pay-db06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
      "hostname": "stg-pay-web04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000062-2253-4a1b-9c2d-17ad59bc2133",
      "hostname": "stg-pay-web05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000063-f78a-4a1b-9c2d-fdf76d3353a8",
      "hostname": "stg-pay-web06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
      "hostname": "stg-shop-app04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
      "hostname": "stg-shop-app05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005d-ea48-4a1b-9c2d-a79db247d374",
      "hostname": "stg-shop-app06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
      "hostname": "stg-shop-db04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
      "hostname": "stg-shop-db05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000060-e58b-4a1b-9c2d-4b87b5853aae",
      "hostname": "stg-shop-db06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000058-c32e-4a1b-9c2d-905bfb8c9788",
      "hostname": "stg-shop-web04",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
      "hostname": "stg-shop-web05",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005a-90b4-4a1b-9c2d-9f3c25867fe6",
      "hostname": "stg-shop-web06",
      "dimension": "loc",
      "value": "DC2",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token stg (part 1) maps to DC2 on 32 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.1.0/24 carry loc=DC2"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
      "hostname": "prd-crm-app04",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000053-472f-4a1b-9c2d-16ceb0e709fb",
      "hostname": "prd-crm-app05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
      "hostname": "prd-crm-app06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
      "hostname": "prd-crm-db04",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
      "hostname": "prd-crm-db05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
      "hostname": "prd-crm-db06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
      "hostname": "prd-crm-web04",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000050-4aa8-4a1b-9c2d-51d4ae65e67f",
      "hostname": "prd-crm-web05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
      "hostname": "prd-crm-web06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
      "hostname": "prd-pay-app04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
      "hostname": "prd-pay-app05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
      "hostname": "prd-pay-app06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
      "hostname": "prd-pay-db04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
      "hostname": "prd-pay-db05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
      "hostname": "prd-pay-db06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000075-bd96-4a1b-9c2d-b574abf42b14",
      "hostname": "prd-pay-job01",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
      "hostname": "prd-pay-web04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000047-c91d-4a1b-9c2d-2451f4e43210",
      "hostname": "prd-pay-web05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
      "hostname": "prd-pay-web06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "9 of 9 labelled workloads in 10.10.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
      "hostname": "prd-shop-app04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
      "hostname": "prd-shop-app06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
      "hostname": "prd-shop-db04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000045-e30d-4a1b-9c2d-f5268f93bf92",
      "hostname": "prd-shop-db06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
      "hostname": "prd-shop-util01",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
      "hostname": "prd-shop-web04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003e-71d7-4a1b-9c2d-57c0c30d72c2",
      "hostname": "prd-shop-web05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
      "hostname": "prd-shop-web06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.10.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
      "hostname": "stg-crm-app05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
      "hostname": "stg-crm-app06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
      "hostname": "stg-crm-db04",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000071-d717-4a1b-9c2d-643400cee78a",
      "hostname": "stg-crm-db05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
      "hostname": "stg-crm-db06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
      "hostname": "stg-crm-util01",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006a-50d0-4a1b-9c2d-6d68bc66ab63",
      "hostname": "stg-crm-web04",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
      "hostname": "stg-crm-web05",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
      "hostname": "stg-crm-web06",
      "dimension": "bu",
      "value": "Sales",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token crm (part 2) maps to Sales on 19 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "10 of 10 labelled workloads in 10.20.3.0/24 carry bu=Sales"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000065-fb3f-4a1b-9c2d-fb7cf4a5ae6a",
      "hostname": "stg-pay-app05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
      "hostname": "stg-pay-app06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
      "hostname": "stg-pay-db04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
      "hostname": "stg-pay-db05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
      "hostname": "stg-pay-db06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
      "hostname": "stg-pay-web04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000062-2253-4a1b-9c2d-17ad59bc2133",
      "hostname": "stg-pay-web05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token pay (part 2) maps to Retail on 20 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.2.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
      "hostname": "stg-shop-app04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
      "hostname": "stg-shop-app05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005d-ea48-4a1b-9c2d-a79db247d374",
      "hostname": "stg-shop-app06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
      "hostname": "stg-shop-db04",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
      "hostname": "stg-shop-db05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000076-fafe-4a1b-9c2d-dfb7ab1f495c",
      "hostname": "stg-shop-job01",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
      "hostname": "stg-shop-web05",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000005a-90b4-4a1b-9c2d-9f3c25867fe6",
      "hostname": "stg-shop-web06",
      "dimension": "bu",
      "value": "Retail",
      "confidence": "high",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token shop (part 2) maps to Retail on 22 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "subnet_majority",
          "evidence": "11 of 11 labelled workloads in 10.20.1.0/24 carry bu=Retail"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
      "hostname": "prd-shop-util01",
      "dimension": "role",
      "value": "Backup",
      "confidence": "medium",
      "source": "model",
      "new_value": false,
      "signals": [
        {
          "kind": "model_knowledge",
          "evidence": "svc_foo.exe on 9443/tcp is the Foo Backup manager service port"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000076-fafe-4a1b-9c2d-dfb7ab1f495c",
      "hostname": "stg-shop-job01",
      "dimension": "role",
      "value": "App",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "listening_process",
          "evidence": "java listening on 8080/tcp (table: App, Tomcat, Spring Boot, JBoss, Jetty)"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
      "hostname": "prd-pay-db04",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
      "hostname": "prd-pay-db05",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
      "hostname": "prd-pay-db06",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
      "hostname": "prd-pay-web04",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000047-c91d-4a1b-9c2d-2451f4e43210",
      "hostname": "prd-pay-web05",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
      "hostname": "prd-pay-web06",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
      "hostname": "prd-shop-app04",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
      "hostname": "prd-shop-app06",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000077-45db-4a1b-9c2d-2b2cb81e6277",
      "hostname": "unm01",
      "dimension": "env",
      "value": "Production",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token 01 (part 1) maps to Production on 4 labelled hosts, 0 counter-examples"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000077-45db-4a1b-9c2d-2b2cb81e6277",
      "hostname": "unm01",
      "dimension": "loc",
      "value": "DC1",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token 01 (part 1) maps to DC1 on 4 labelled hosts, 0 counter-examples"
        },
        {
          "kind": "model_knowledge",
          "evidence": "10.10.0.0/16 is the DC1 range in the customer's IPAM"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000077-45db-4a1b-9c2d-2b2cb81e6277",
      "hostname": "unm01",
      "dimension": "bu",
      "value": "Corporate",
      "confidence": "medium",
      "source": "script",
      "new_value": false,
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token 01 (part 1) maps to Corporate on 4 labelled hosts, 0 counter-examples"
        }
      ]
    }
  ],
  "conflicts": [
    {
      "href": "/orgs/1/workloads/00000009-0657-4a1b-9c2d-15f51b1c3f27",
      "hostname": "prd-shop-web03",
      "dimension": "env",
      "existing": "Staging",
      "suggested": "Production",
      "confidence": "high",
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "4 of 4 labelled peers (1938 of 1938 connections) carry env=Production"
        }
      ]
    },
    {
      "href": "/orgs/1/workloads/00000015-507b-4a1b-9c2d-15f292af2f03",
      "hostname": "prd-pay-app03",
      "dimension": "env",
      "existing": "Staging",
      "suggested": "Production",
      "confidence": "high",
      "signals": [
        {
          "kind": "hostname_token",
          "evidence": "token prd (part 1) maps to Production on 27 labelled hosts, 2 counter-examples"
        },
        {
          "kind": "peer_env",
          "evidence": "6 of 6 labelled peers (2650 of 2650 connections) carry env=Production"
        }
      ]
    }
  ],
  "unresolved": {
    "processes": [
      {
        "process": "svc_foo.exe",
        "port": 9443,
        "proto": "tcp",
        "os": "windows",
        "workloads": 1,
        "hosts": [
          "prd-shop-util01"
        ]
      },
      {
        "process": "vendord",
        "port": 7777,
        "proto": "tcp",
        "os": "linux",
        "workloads": 1,
        "hosts": [
          "stg-crm-util01"
        ]
      }
    ],
    "workloads": [
      {
        "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
        "hostname": "stg-crm-util01",
        "missing": [
          "role"
        ],
        "why": "role: no convention match"
      },
      {
        "href": "/orgs/1/workloads/00000077-45db-4a1b-9c2d-2b2cb81e6277",
        "hostname": "unm01",
        "missing": [
          "role",
          "app"
        ],
        "why": "role: no convention match | app: no convention match; no traffic in window"
      },
      {
        "href": "/orgs/1/workloads/00000078-24c2-4a1b-9c2d-fbe49a33d5a6",
        "hostname": "unm02",
        "missing": [
          "role",
          "app",
          "env",
          "loc",
          "bu"
        ],
        "why": "role: no convention match | app: no convention match; no traffic in window | env: no convention match; no traffic in window | loc: no convention match; no labelled neighbours in the /24 | bu: no convention match; no labelled neighbours in the /24"
      }
    ]
  },
  "plan": {
    "preferences": {
      "dimensions": [
        "role",
        "app",
        "env",
        "loc",
        "bu"
      ],
      "min_confidence": "high",
      "scope": {
        "type": "all"
      },
      "dry_run": true
    },
    "workloads": [
      {
        "href": "/orgs/1/workloads/00000052-575d-4a1b-9c2d-6336291303c3",
        "hostname": "prd-crm-app04",
        "before": {},
        "add": {
          "role": "App",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "App",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000053-472f-4a1b-9c2d-16ceb0e709fb",
        "hostname": "prd-crm-app05",
        "before": {
          "role": "App",
          "env": "Production",
          "loc": "DC1"
        },
        "add": {
          "app": "crm",
          "bu": "Sales"
        },
        "after": {
          "role": "App",
          "env": "Production",
          "loc": "DC1",
          "app": "crm",
          "bu": "Sales"
        },
        "confidence": {
          "app": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000054-e4a8-4a1b-9c2d-fcf0438e2c78",
        "hostname": "prd-crm-app06",
        "before": {},
        "add": {
          "role": "App",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "App",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000055-80a1-4a1b-9c2d-1c425efd2f02",
        "hostname": "prd-crm-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000056-fd61-4a1b-9c2d-470c1ef53987",
        "hostname": "prd-crm-db05",
        "before": {},
        "add": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000057-712f-4a1b-9c2d-dbb801f17629",
        "hostname": "prd-crm-db06",
        "before": {},
        "add": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "Database",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004f-7f70-4a1b-9c2d-c6e66099ae9d",
        "hostname": "prd-crm-web04",
        "before": {},
        "add": {
          "role": "Web",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000050-4aa8-4a1b-9c2d-51d4ae65e67f",
        "hostname": "prd-crm-web05",
        "before": {
          "role": "Web",
          "loc": "DC1"
        },
        "add": {
          "app": "crm",
          "env": "Production",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "loc": "DC1",
          "app": "crm",
          "env": "Production",
          "bu": "Sales"
        },
        "confidence": {
          "app": "high",
          "env": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000051-ce03-4a1b-9c2d-46104d5b20df",
        "hostname": "prd-crm-web06",
        "before": {},
        "add": {
          "role": "Web",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "app": "crm",
          "env": "Production",
          "loc": "DC1",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000049-2c54-4a1b-9c2d-7306a794fcd3",
        "hostname": "prd-pay-app04",
        "before": {},
        "add": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004a-f466-4a1b-9c2d-6b8314f0d3ac",
        "hostname": "prd-pay-app05",
        "before": {},
        "add": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004b-7aec-4a1b-9c2d-b06298eb288d",
        "hostname": "prd-pay-app06",
        "before": {},
        "add": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004c-b86f-4a1b-9c2d-2d7a8e4d8d3f",
        "hostname": "prd-pay-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004d-4c3c-4a1b-9c2d-e61443f2f773",
        "hostname": "prd-pay-db05",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000004e-39fb-4a1b-9c2d-0fece069e9fa",
        "hostname": "prd-pay-db06",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000075-bd96-4a1b-9c2d-b574abf42b14",
        "hostname": "prd-pay-job01",
        "before": {
          "role": "App"
        },
        "add": {
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "pay",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000046-7318-4a1b-9c2d-b7e7fd0225b4",
        "hostname": "prd-pay-web04",
        "before": {},
        "add": {
          "role": "Web",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000047-c91d-4a1b-9c2d-2451f4e43210",
        "hostname": "prd-pay-web05",
        "before": {
          "app": "pay",
          "loc": "DC1"
        },
        "add": {
          "role": "Web",
          "bu": "Retail"
        },
        "after": {
          "app": "pay",
          "loc": "DC1",
          "role": "Web",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000048-66d9-4a1b-9c2d-cb28341e8364",
        "hostname": "prd-pay-web06",
        "before": {},
        "add": {
          "role": "Web",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "pay",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000040-b010-4a1b-9c2d-69a1cf7b8ac2",
        "hostname": "prd-shop-app04",
        "before": {},
        "add": {
          "role": "App",
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000041-68dc-4a1b-9c2d-c58b4c81c41f",
        "hostname": "prd-shop-app05",
        "before": {
          "role": "App",
          "env": "Production",
          "bu": "Retail"
        },
        "add": {
          "app": "shop",
          "loc": "DC1"
        },
        "after": {
          "role": "App",
          "env": "Production",
          "bu": "Retail",
          "app": "shop",
          "loc": "DC1"
        },
        "confidence": {
          "app": "high",
          "loc": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000042-9c1b-4a1b-9c2d-0d308cc8b432",
        "hostname": "prd-shop-app06",
        "before": {},
        "add": {
          "role": "App",
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000043-1bc3-4a1b-9c2d-a198067a8391",
        "hostname": "prd-shop-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000044-f396-4a1b-9c2d-141da91e6cfd",
        "hostname": "prd-shop-db05",
        "before": {
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail"
        },
        "add": {
          "role": "Database",
          "env": "Production"
        },
        "after": {
          "app": "shop",
          "loc": "DC1",
          "bu": "Retail",
          "role": "Database",
          "env": "Production"
        },
        "confidence": {
          "role": "high",
          "env": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000045-e30d-4a1b-9c2d-f5268f93bf92",
        "hostname": "prd-shop-db06",
        "before": {
          "role": "Database",
          "app": "shop",
          "loc": "DC1"
        },
        "add": {
          "env": "Production",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "shop",
          "loc": "DC1",
          "env": "Production",
          "bu": "Retail"
        },
        "confidence": {
          "env": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000073-08bc-4a1b-9c2d-63fa6bdd4ae4",
        "hostname": "prd-shop-util01",
        "before": {},
        "add": {
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000003d-d016-4a1b-9c2d-40c83d176ac0",
        "hostname": "prd-shop-web04",
        "before": {},
        "add": {
          "role": "Web",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000003e-71d7-4a1b-9c2d-57c0c30d72c2",
        "hostname": "prd-shop-web05",
        "before": {
          "app": "shop"
        },
        "add": {
          "role": "Web",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "app": "shop",
          "role": "Web",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000003f-6a19-4a1b-9c2d-2a43d0524f5e",
        "hostname": "prd-shop-web06",
        "before": {},
        "add": {
          "role": "Web",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "shop",
          "env": "Production",
          "loc": "DC1",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006d-6616-4a1b-9c2d-5e0ad25d0fbe",
        "hostname": "stg-crm-app04",
        "before": {
          "loc": "DC2",
          "bu": "Sales"
        },
        "add": {
          "role": "App",
          "app": "crm",
          "env": "Staging"
        },
        "after": {
          "loc": "DC2",
          "bu": "Sales",
          "role": "App",
          "app": "crm",
          "env": "Staging"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006e-f7af-4a1b-9c2d-8950042d6849",
        "hostname": "stg-crm-app05",
        "before": {},
        "add": {
          "role": "App",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "App",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006f-a19c-4a1b-9c2d-d0556d7a58bc",
        "hostname": "stg-crm-app06",
        "before": {},
        "add": {
          "role": "App",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "App",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000070-eb38-4a1b-9c2d-fb3570ae72f1",
        "hostname": "stg-crm-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "Database",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000071-d717-4a1b-9c2d-643400cee78a",
        "hostname": "stg-crm-db05",
        "before": {
          "app": "crm",
          "loc": "DC2"
        },
        "add": {
          "role": "Database",
          "env": "Staging",
          "bu": "Sales"
        },
        "after": {
          "app": "crm",
          "loc": "DC2",
          "role": "Database",
          "env": "Staging",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "env": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000072-412c-4a1b-9c2d-bcb10e9efe00",
        "hostname": "stg-crm-db06",
        "before": {},
        "add": {
          "role": "Database",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "Database",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000074-59aa-4a1b-9c2d-f169f987e016",
        "hostname": "stg-crm-util01",
        "before": {},
        "add": {
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006a-50d0-4a1b-9c2d-6d68bc66ab63",
        "hostname": "stg-crm-web04",
        "before": {
          "role": "Web",
          "app": "crm"
        },
        "add": {
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006b-2908-4a1b-9c2d-ee5896dea27a",
        "hostname": "stg-crm-web05",
        "before": {},
        "add": {
          "role": "Web",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000006c-3ef5-4a1b-9c2d-50b6f4836c9a",
        "hostname": "stg-crm-web06",
        "before": {},
        "add": {
          "role": "Web",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "after": {
          "role": "Web",
          "app": "crm",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Sales"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000064-5ca5-4a1b-9c2d-a6b6881a5829",
        "hostname": "stg-pay-app04",
        "before": {
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "add": {
          "role": "App",
          "app": "pay"
        },
        "after": {
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail",
          "role": "App",
          "app": "pay"
        },
        "confidence": {
          "role": "high",
          "app": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000065-fb3f-4a1b-9c2d-fb7cf4a5ae6a",
        "hostname": "stg-pay-app05",
        "before": {
          "role": "App",
          "env": "Staging",
          "loc": "DC2"
        },
        "add": {
          "app": "pay",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "env": "Staging",
          "loc": "DC2",
          "app": "pay",
          "bu": "Retail"
        },
        "confidence": {
          "app": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000066-5b4a-4a1b-9c2d-fb63614f0035",
        "hostname": "stg-pay-app06",
        "before": {},
        "add": {
          "role": "App",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000067-d4be-4a1b-9c2d-0a1dec10d87b",
        "hostname": "stg-pay-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000068-59ab-4a1b-9c2d-35d9b9624870",
        "hostname": "stg-pay-db05",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000069-88fb-4a1b-9c2d-35e6296a4837",
        "hostname": "stg-pay-db06",
        "before": {},
        "add": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000061-c54d-4a1b-9c2d-d2560c27eb40",
        "hostname": "stg-pay-web04",
        "before": {},
        "add": {
          "role": "Web",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000062-2253-4a1b-9c2d-17ad59bc2133",
        "hostname": "stg-pay-web05",
        "before": {
          "role": "Web",
          "app": "pay",
          "env": "Staging"
        },
        "add": {
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000063-f78a-4a1b-9c2d-fdf76d3353a8",
        "hostname": "stg-pay-web06",
        "before": {
          "bu": "Retail"
        },
        "add": {
          "role": "Web",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2"
        },
        "after": {
          "bu": "Retail",
          "role": "Web",
          "app": "pay",
          "env": "Staging",
          "loc": "DC2"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005b-1722-4a1b-9c2d-bcff2e2b0cb6",
        "hostname": "stg-shop-app04",
        "before": {},
        "add": {
          "role": "App",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005c-9c60-4a1b-9c2d-5c75adeff0d2",
        "hostname": "stg-shop-app05",
        "before": {},
        "add": {
          "role": "App",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005d-ea48-4a1b-9c2d-a79db247d374",
        "hostname": "stg-shop-app06",
        "before": {
          "role": "App"
        },
        "add": {
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "App",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005e-0a7f-4a1b-9c2d-1ec9f9e7b488",
        "hostname": "stg-shop-db04",
        "before": {},
        "add": {
          "role": "Database",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005f-2ebf-4a1b-9c2d-04e3fc5e0f69",
        "hostname": "stg-shop-db05",
        "before": {},
        "add": {
          "role": "Database",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Database",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000060-e58b-4a1b-9c2d-4b87b5853aae",
        "hostname": "stg-shop-db06",
        "before": {
          "role": "Database",
          "env": "Staging",
          "bu": "Retail"
        },
        "add": {
          "app": "shop",
          "loc": "DC2"
        },
        "after": {
          "role": "Database",
          "env": "Staging",
          "bu": "Retail",
          "app": "shop",
          "loc": "DC2"
        },
        "confidence": {
          "app": "high",
          "loc": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000076-fafe-4a1b-9c2d-dfb7ab1f495c",
        "hostname": "stg-shop-job01",
        "before": {
          "env": "Staging",
          "loc": "DC2"
        },
        "add": {
          "app": "shop",
          "bu": "Retail"
        },
        "after": {
          "env": "Staging",
          "loc": "DC2",
          "app": "shop",
          "bu": "Retail"
        },
        "confidence": {
          "app": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000058-c32e-4a1b-9c2d-905bfb8c9788",
        "hostname": "stg-shop-web04",
        "before": {
          "bu": "Retail"
        },
        "add": {
          "role": "Web",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2"
        },
        "after": {
          "bu": "Retail",
          "role": "Web",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/00000059-0aed-4a1b-9c2d-cea36827db33",
        "hostname": "stg-shop-web05",
        "before": {},
        "add": {
          "role": "Web",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "role": "Web",
          "app": "shop",
          "env": "Staging",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "env": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      },
      {
        "href": "/orgs/1/workloads/0000005a-90b4-4a1b-9c2d-9f3c25867fe6",
        "hostname": "stg-shop-web06",
        "before": {
          "env": "Staging"
        },
        "add": {
          "role": "Web",
          "app": "shop",
          "loc": "DC2",
          "bu": "Retail"
        },
        "after": {
          "env": "Staging",
          "role": "Web",
          "app": "shop",
          "loc": "DC2",
          "bu": "Retail"
        },
        "confidence": {
          "role": "high",
          "app": "high",
          "loc": "high",
          "bu": "high"
        },
        "new_labels": []
      }
    ],
    "new_labels": [],
    "counts": {
      "workloads": 58,
      "labels_added": 237,
      "labels_created": 0
    }
  }
};
// ===== DATA END =====

// Defensive accessors: every tab renders on a partial advice.json (empty arrays, missing keys).
const D = DATA || {};
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const fmt = (n) => (n == null || Number.isNaN(Number(n)) ? "n/a" : Number(n).toLocaleString("en-US"));
const pct = (a, b) => (a + b > 0 ? `${Math.round((100 * a) / (a + b))}%` : "n/a");
const kv = (o) => Object.entries(obj(o)).map(([k, v]) => `${k}=${v}`).join(", ");
const DIMS = [...arr(obj(D.dimensions).standard), ...arr(obj(D.dimensions).custom)];
const CUSTOM = new Set(arr(obj(D.dimensions).custom));
const CONF_ORDER = { high: 0, medium: 1, low: 2 };

// Eyebrows and table headers: Server Slate SemiBold caps.
const eyebrow = { fontSize: 11, color: C.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };
const TH = { textAlign: "left", padding: "8px 10px", background: C.slate, color: C.white, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" };
const TD = { padding: "7px 10px", borderBottom: `1px solid ${C.gray200}`, verticalAlign: "top", fontSize: 12, color: C.text };
const TDK = { ...TD, fontWeight: 600, color: C.slate, whiteSpace: "nowrap" };
const empty = { color: C.muted, fontSize: 13 };

function Badge({ label, color, bg, mono, wrap, outline }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 2, fontSize: 11, fontWeight: 600, lineHeight: "15px",
      background: outline ? "transparent" : bg, color, border: outline ? `1.5px solid ${color}` : "1.5px solid transparent",
      letterSpacing: 0.2, fontFamily: mono ? MONO : FONT, whiteSpace: wrap ? "normal" : "nowrap" }}>
      {label}
    </span>
  );
}

// Confidence: Safeguard Green high, Gold (slate text) medium, grey low. Source: model is a System Cyan outline.
const confStyle = { high: { bg: C.green, color: C.white }, medium: { bg: C.amber, color: C.slate }, low: { bg: C.gray300, color: C.slate } };
const ConfBadge = ({ c }) => { const s = confStyle[c] || confStyle.low; return <Badge label={String(c || "low").toUpperCase()} bg={s.bg} color={s.color} />; };
const SourceBadge = ({ s }) => (s === "model" ? <Badge label="MODEL" color={C.teal} outline /> : <span style={{ fontSize: 12, color: C.muted }}>{s || "script"}</span>);
const NewBadge = () => <Badge label="NEW" bg={C.gray100} color={C.gray700} mono />;
const DimBadge = ({ d }) => <Badge label={CUSTOM.has(d) ? `${d} (custom)` : d} bg={C.gray100} color={C.gray700} mono />;

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
  confidence: [["Safeguard Green: high, two independent signal kinds agree or a convention with support 5 or more and no counter-example", C.green], ["Gold: medium, one signal", C.amber], ["grey: low, model knowledge only", C.gray300], ["System Cyan outline: suggestion written by the model, not the script", C.teal, "outline"]],
  bars: [["Server Slate: workloads that carry the label", C.slate], ["grey: workloads missing it", C.gray300]],
  visibility: [["Server Slate: VEN reports listeners, flows carry a process name", C.slate], ["grey: no listeners reported, no process name", C.gray300]],
  info: [["System Cyan: an input was truncated or missing, counts from it are lower bounds", C.teal]],
  conflict: [["Risk Red tint: the evidence disagrees with a label the workload already carries; nothing is changed, review by hand", C.redLight]],
  plain: [["table text: no colour, no meaning", C.gray300]],
  newBadge: [["NEW badge: a value not yet in the label vocabulary, grey, no meaning", C.gray100]],
  dim: [["dimension badge: grey, no meaning; (custom) marks a non-standard label key", C.gray100]],
};

function ColourKey() {
  const items = [["Safeguard Green: high confidence", C.green, C.white], ["Gold: medium", C.amber, C.slate], ["grey: low", C.gray300, C.slate], ["System Cyan: model source, truncated or missing input", C.teal, C.white], ["Risk Red: conflict with an existing label", C.red, C.white]];
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

// Grey top border always: these counts are facts, not risks.
function Tile({ label, value, subtitle }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 0, padding: "12px 14px", borderTop: `4px solid ${C.gray300}`, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: C.slate, lineHeight: 1.2, marginTop: 4 }}>{fmt(value)}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// System Cyan info line: the one place cyan carries a tint on this page besides the MODEL badge.
function InfoLine({ children }) {
  return <div style={{ background: C.tealLight, borderLeft: `3px solid ${C.teal}`, color: C.teal, fontSize: 12, padding: "8px 10px", marginTop: 8, lineHeight: 1.45 }}>{children}</div>;
}

// Two-segment bar: slate = has it, grey = missing. The scale is the row's own total.
function SplitBar({ label, a, b, aText, bText }) {
  const total = (a || 0) + (b || 0);
  const w = total ? (100 * (a || 0)) / total : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(70px, 130px) 1fr", gap: 10, alignItems: "center", fontSize: 12, marginBottom: 8 }}>
      <span style={{ color: C.slate, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ minWidth: 0 }}>
        <div title={`${fmt(a)} ${aText}, ${fmt(b)} ${bText}`} style={{ display: "flex", height: 14, background: C.gray300, borderRadius: 0, overflow: "hidden" }}>
          <div style={{ width: `${w}%`, background: C.slate }} />
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: MONO }}>{total ? `${fmt(a)} ${aText} · ${fmt(b)} ${bText} · ${pct(a || 0, b || 0)}` : "no data"}</div>
      </div>
    </div>
  );
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
const Signals = ({ s }) => <span style={{ fontSize: 12, color: C.text }}>{arr(s).map((x) => `${x.kind}: ${x.evidence}`).join("; ") || "none"}</span>;

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

function ReadinessTab() {
  const r = obj(D.readiness), cov = obj(r.coverage), pv = obj(r.process_visibility), tr = obj(r.traffic), inp = obj(D.inputs), dims = obj(D.dimensions), vals = obj(dims.values);
  const dimList = DIMS.length ? DIMS : Object.keys(cov);
  const notes = arr(r.notes), hubs = arr(D.hubs);
  const covered = (d) => obj(cov[d]).labelled != null || obj(cov[d]).missing != null;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 16 }}>
        <Tile label="Workloads" value={r.workloads} subtitle={`${fmt(r.managed)} managed, ${fmt(r.unmanaged)} unmanaged · ${fmt(r.online)} online`} />
        <Tile label="Fully labelled" value={r.fully_labelled} subtitle="role, app, env and loc present" />
        <Tile label="Partly labelled" value={r.partly_labelled} subtitle="at least one dimension missing" />
        <Tile label="Unlabelled" value={r.unlabelled} subtitle="no label at all" />
      </div>
      <Section title="Label coverage per dimension">
        {dimList.length ? dimList.map((d) => (
          covered(d)
            ? <SplitBar key={d} label={CUSTOM.has(d) ? `${d} (custom)` : d} a={obj(cov[d]).labelled || 0} b={obj(cov[d]).missing || 0} aText="labelled" bText="missing" />
            : <div key={d} style={{ ...empty, fontSize: 12, marginBottom: 8 }}><b style={{ color: C.slate }}>{d}</b>: no coverage counted.</div>
        )) : <div style={empty}>No dimensions in the advice; the label vocabulary could not be read.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Standard dimensions: {arr(dims.standard).join(", ") || "none"}. Custom: {arr(dims.custom).join(", ") || "none"}. Vocabulary: {Object.keys(vals).length ? Object.keys(vals).map((k) => `${k} ${arr(vals[k]).length} value${arr(vals[k]).length === 1 ? "" : "s"} (${arr(vals[k]).join(", ")})`).join("; ") : "none read"}.</div>
        <Legend items={LEGEND.bars} />
      </Section>
      <Section title="VEN process visibility">
        <SplitBar label="Workloads" a={pv.with_listeners || 0} b={pv.without || 0} aText="with listeners" bText="without" />
        <SplitBar label="Flows" a={pv.flows_with_process || 0} b={pv.flows_without_process || 0} aText="with process" bText="without" />
        <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>
          Traffic read: {fmt(tr.flows)} flows over {fmt(tr.calls)} calls, {fmt(tr.truncated_calls)} truncated, {fmt(obj(D.window).days)} days ({obj(D.window).start || "?"} to {obj(D.window).end || "?"}). Role suggestions from listening processes need the VEN's service report; the grey share has hostname and traffic signals only.
        </div>
        <Legend items={LEGEND.visibility} />
      </Section>
      <Section title="Inputs">
        <div style={{ fontSize: 12, color: C.text }}>{arr(inp.files).length ? `${arr(inp.files).length} files read: ${arr(inp.files).join(", ")}.` : "No input list recorded."}</div>
        {arr(inp.truncated).length > 0 && <InfoLine>Truncated: {arr(inp.truncated).join(", ")}. The tool hit its row cap; every count that rests on that file is a lower bound, and a convention or peer majority from it may be missing counter-examples.</InfoLine>}
        {arr(inp.missing).length > 0 && <InfoLine>Missing: {arr(inp.missing).join(", ")}. The call was not saved; the signals that need it were skipped for the workloads it covers.</InfoLine>}
        {!arr(inp.truncated).length && !arr(inp.missing).length && <div style={{ ...empty, fontSize: 12, marginTop: 6 }}>No input was truncated or missing.</div>}
        <Legend items={LEGEND.info} />
      </Section>
      <Section title="Hubs: services many workloads reach">
        {hubs.length ? (
          <Table head={["Hostname", "Port", "Process", "Sources", "Kind", "Found by"]} min={520}>
            {hubs.map((h, i) => (
              <tr key={h.href || i} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TDK}>{h.hostname}</td><td style={{ ...TD, fontFamily: MONO, whiteSpace: "nowrap" }}>{h.port ? `${h.port}/${h.proto || ""}` : "-"}</td><td style={{ ...TD, fontFamily: MONO }}>{h.process}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{h.sources ? fmt(h.sources) : "-"}</td><td style={TD}>{h.kind}</td><td style={TD}>{h.from === "infra-tool" ? "identify-infrastructure-services" : "fan-in count"}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No hub found: no infrastructure result and no port with wide fan-in.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>A hub's peers say little about its own app or env (a directory serves every env), so peer signals are discounted for hubs and for workloads whose only peers are hubs.</div>
        <Legend items={LEGEND.plain} />
      </Section>
      <Section title="Notes">
        {notes.length ? <ul style={{ margin: "0 0 0 18px", padding: 0, fontSize: 12, color: C.text, lineHeight: 1.5 }}>{notes.map((n, i) => <li key={i} style={{ marginBottom: 4 }}>{n}</li>)}</ul> : <div style={empty}>No notes.</div>}
        <Legend items={LEGEND.plain} />
      </Section>
    </>
  );
}

function SuggestionsTab() {
  const all = arr(D.suggestions);
  const [dim, setDim] = useState("all");
  const [conf, setConf] = useState("all");
  const [src, setSrc] = useState("all");
  const rows = useMemo(() => all.filter((s) => (dim === "all" || s.dimension === dim) && (conf === "all" || s.confidence === conf) && (src === "all" || s.source === src)), [all, dim, conf, src]);
  const count = (k, v) => all.filter((s) => s[k] === v).length;
  const dimOpts = [["all", "all"], ...(DIMS.length ? DIMS : [...new Set(all.map((s) => s.dimension))]).map((d) => [d, CUSTOM.has(d) ? `${d} (custom)` : d])];
  const filters = (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Select label="Dimension" value={dim} onChange={setDim} options={dimOpts} />
      <Select label="Confidence" value={conf} onChange={setConf} options={[["all", "all"], ["high", "high"], ["medium", "medium"], ["low", "low"]]} />
      <Select label="Source" value={src} onChange={setSrc} options={[["all", "all"], ["script", "script"], ["model", "model"]]} />
    </div>
  );
  return (
    <Section title="Suggested labels" right={filters}>
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>
        Showing {fmt(rows.length)} of {fmt(all.length)} suggestions · {fmt(count("confidence", "high"))} high, {fmt(count("confidence", "medium"))} medium, {fmt(count("confidence", "low"))} low · {fmt(count("source", "model"))} from the model · {fmt(all.filter((s) => s.new_value).length)} propose a value not yet in the vocabulary · {fmt(new Set(all.map((s) => s.href || s.hostname)).size)} workloads.
      </div>
      {rows.length ? (
        <Table head={["Hostname", "Dimension", "Value", "Confidence", "Source", "Signals"]} min={720}>
          {rows.map((s, i) => (
            <tr key={`${s.href || s.hostname}|${s.dimension}|${i}`} style={{ background: i % 2 ? BAND : C.white }}>
              <td style={TDK}>{s.hostname}</td>
              <td style={TD}><DimBadge d={s.dimension} /></td>
              <td style={{ ...TD, color: C.slate, fontWeight: 600, whiteSpace: "nowrap" }}>{s.value}{s.new_value && <span> <NewBadge /></span>}</td>
              <td style={TD}><ConfBadge c={s.confidence} /></td>
              <td style={TD}><SourceBadge s={s.source} /></td>
              <td style={{ ...TD, minWidth: 440 }}><Signals s={s.signals} /></td>
            </tr>
          ))}
        </Table>
      ) : <div style={empty}>{all.length ? "No suggestion matches these filters." : "No suggestions: nothing in the evidence passed the confidence rules."}</div>}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>A suggestion never names a dimension the workload already carries; disagreement sits on the Conflicts tab. Custom dimensions use existing values only.</div>
      <Legend items={[...LEGEND.confidence, ...LEGEND.newBadge, ...LEGEND.dim]} />
    </Section>
  );
}

function ConventionsTab() {
  const rows = arr(D.conventions);
  return (
    <Section title="Mined conventions">
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>Patterns the labelled part of the estate already follows, read from hostnames and subnets. Support is the number of labelled workloads that fit; counter is the number that contradict. A convention with support 5 or more and no counter-example is enough for high confidence on its own.</div>
      {rows.length ? (
        <Table head={["Dimension", "Rule", "Token", "Value", "Support", "Counter"]} min={560}>
          {rows.map((c, i) => (
            <tr key={i} style={{ background: i % 2 ? BAND : C.white }}>
              <td style={TD}><DimBadge d={c.dimension} /></td><td style={TD}>{c.rule}</td><td style={{ ...TD, fontFamily: MONO, whiteSpace: "nowrap" }}>{c.token}</td>
              <td style={{ ...TD, color: C.slate, fontWeight: 600 }}>{c.value}</td><td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{fmt(c.support)}</td>
              <td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{fmt(c.counter)}</td>
            </tr>
          ))}
        </Table>
      ) : <div style={empty}>No convention found: too few labelled workloads share a hostname token or a subnet.</div>}
      <Legend items={[...LEGEND.plain, ...LEGEND.dim]} />
    </Section>
  );
}

function ConflictsTab() {
  const rows = arr(D.conflicts);
  return (
    <Section title="Conflicts: evidence against an existing label">
      <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>The workload already carries a value in this dimension and the evidence points elsewhere. Nothing here goes into the apply plan; a person decides whether the label or the evidence is wrong.</div>
      {rows.length ? (
        <Table head={["Hostname", "Dimension", "Existing", "Suggested", "Confidence", "Signals"]} min={700}>
          {rows.map((c, i) => (
            <tr key={`${c.href || c.hostname}|${c.dimension}|${i}`} style={{ background: C.redLight }}>
              <td style={TDK}>{c.hostname}</td><td style={TD}><DimBadge d={c.dimension} /></td>
              <td style={{ ...TD, color: C.slate, fontWeight: 600 }}>{c.existing}</td><td style={{ ...TD, color: C.slate, fontWeight: 600 }}>{c.suggested}</td>
              <td style={TD}><ConfBadge c={c.confidence} /></td><td style={{ ...TD, minWidth: 440 }}><Signals s={c.signals} /></td>
            </tr>
          ))}
        </Table>
      ) : <div style={empty}>No conflicts: the evidence agrees with every existing label it touched.</div>}
      <Legend items={[...LEGEND.conflict, ...LEGEND.confidence.slice(0, 3), ...LEGEND.dim]} />
    </Section>
  );
}

function UnresolvedTab() {
  const u = obj(D.unresolved), procs = arr(u.processes), wls = arr(u.workloads);
  return (
    <>
      <Section title="Processes and ports not in the role table">
        <div style={{ fontSize: 12, color: C.text, marginBottom: 8 }}>Listeners the script could not map to a role. The model reads these (references/process-roles.md, then its own knowledge) and writes model-suggestions.json; those come back as MODEL rows on the Suggestions tab.</div>
        {procs.length ? (
          <Table head={["Process", "Port", "OS", "Workloads", "Hosts"]} min={520}>
            {procs.map((p, i) => (
              <tr key={i} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={{ ...TDK, fontFamily: MONO }}>{p.process}</td><td style={{ ...TD, fontFamily: MONO, whiteSpace: "nowrap" }}>{p.port}/{p.proto}</td><td style={TD}>{p.os}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{fmt(p.workloads)}</td><td style={{ ...TD, minWidth: 200 }}>{arr(p.hosts).join(", ") || "none listed"}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>Every listening process matched the role table.</div>}
        <Legend items={LEGEND.plain} />
      </Section>
      <Section title="Workloads with nothing to go on">
        {wls.length ? (
          <Table head={["Hostname", "Missing", "Why"]} min={480}>
            {wls.map((w, i) => (
              <tr key={w.href || i} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TDK}>{w.hostname}</td><td style={{ ...TD, whiteSpace: "nowrap" }}>{arr(w.missing).map((m) => <span key={m} style={{ marginRight: 4 }}><DimBadge d={m} /></span>)}</td><td style={{ ...TD, minWidth: 220 }}>{w.why}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>Every workload with a missing label has at least one signal.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>These need a person: an owner, a CMDB entry, or a longer traffic window.</div>
        <Legend items={[...LEGEND.plain, ...LEGEND.dim]} />
      </Section>
    </>
  );
}

function PlanTab() {
  const p = obj(D.plan), pref = obj(p.preferences), scope = obj(pref.scope), counts = obj(p.counts), rows = arr(p.workloads), nl = arr(p.new_labels);
  const scopeText = scope.type ? (scope.type === "all" ? "all workloads" : `${scope.type} ${Array.isArray(scope.value) ? scope.value.join(", ") : scope.value == null ? "" : String(scope.value)}`.trim()) : "not set";
  // A row's new_labels may hold "key=value" strings or {key, value} objects; the NEW badge sits on the matching add.
  const newLabel = (x) => (typeof x === "string" ? x : x && typeof x === "object" ? `${x.key}=${x.value}` : String(x));
  const isNew = (w, k, v) => arr(w.new_labels).map(newLabel).includes(`${k}=${v}`);
  if (!p.preferences && !rows.length) return <Section title="Apply plan"><div style={empty}>No plan: the skill was not run in apply mode, or no suggestion met the preferences.</div><Legend items={LEGEND.plain} /></Section>;
  return (
    <>
      <div style={{ fontSize: 13, color: C.text, marginTop: 16, lineHeight: 1.45 }}>
        <b style={{ color: C.slate }}>Preferences.</b> Dimensions {arr(pref.dimensions).join(", ") || "none"} · minimum confidence {pref.min_confidence || "not set"} · scope {scopeText} · {pref.dry_run === false ? "live run requested" : "dry run"}.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
        <Tile label="Workloads to update" value={counts.workloads} subtitle="one update-workload call each" />
        <Tile label="Labels to add" value={counts.labels_added} subtitle="existing labels kept, nothing removed" />
        <Tile label="Labels to create" value={counts.labels_created} subtitle="new values, create-label first" />
      </div>
      <Section title="Per workload">
        {rows.length ? (
          <Table head={["Hostname", "Before", "Adds", "After", "Confidence"]} min={700}>
            {rows.map((w, i) => (
              <tr key={w.href || i} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TDK}>{w.hostname}</td>
                <td style={{ ...TD, fontFamily: MONO, color: Object.keys(obj(w.before)).length ? C.text : C.muted }}>{kv(w.before) || "none"}</td>
                <td style={{ ...TD, fontFamily: MONO, color: C.slate, fontWeight: 600 }}>{Object.keys(obj(w.add)).length ? Object.entries(obj(w.add)).map(([k, v], j) => <span key={k}>{j > 0 && ", "}{k}={v}{isNew(w, k, v) && <span> <NewBadge /></span>}</span>) : "none"}</td>
                <td style={{ ...TD, fontFamily: MONO }}>{kv(w.after) || "none"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{Object.entries(obj(w.confidence)).sort((a, b) => (CONF_ORDER[a[1]] ?? 3) - (CONF_ORDER[b[1]] ?? 3)).map(([k, v]) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 6 }}><span style={{ fontSize: 11, color: C.muted }}>{k}</span><ConfBadge c={v} /></span>)}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No workload meets the preferences.</div>}
        <Legend items={[...LEGEND.confidence.slice(0, 3), ...LEGEND.newBadge]} />
      </Section>
      <Section title="New labels">
        {nl.length ? (
          <Table head={["Key", "Value", "Workloads"]} min={300}>
            {nl.map((l, i) => (
              <tr key={`${l.key}=${l.value}`} style={{ background: i % 2 ? BAND : C.white }}>
                <td style={TD}><DimBadge d={l.key} /></td><td style={{ ...TD, color: C.slate, fontWeight: 600 }}>{l.value} <NewBadge /></td><td style={{ ...TD, textAlign: "right", fontFamily: MONO }}>{fmt(l.workloads)}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={empty}>No new label: every suggested value already exists.</div>}
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Only standard dimensions may get a new value; custom dimensions reuse their existing values.</div>
        <Legend items={[...LEGEND.newBadge, ...LEGEND.dim]} />
      </Section>
      <div style={{ fontSize: 12, color: C.text, marginTop: 14, lineHeight: 1.5, background: C.white, border: `1px solid ${C.gray200}`, padding: "10px 14px" }}>
        <b style={{ color: C.slate }}>This page applies nothing.</b> The apply step belongs to the skill: it confirms the plan with you, then calls create-label for the new values and update-workload per row, with plan.md holding the rollback calls. Labels on the PCE change only in that step, never from this dashboard.
      </div>
    </>
  );
}

export default function App() {
  const tabs = ["Readiness", "Suggestions", "Conventions", "Conflicts", "Unresolved", "Apply plan"];
  const [tab, setTab] = useState("Readiness");
  const w = obj(D.window), r = obj(D.readiness);
  const generated = String(D.generated || "").slice(0, 10) || "unknown date";
  const subtitle = `Advice of ${generated} · traffic window ${w.start || "?"} to ${w.end || "?"} (${fmt(w.days)} days) · ${fmt(r.workloads)} workloads, ${fmt(arr(D.suggestions).length)} suggestions, ${fmt(arr(D.conflicts).length)} conflicts`;

  return (
    <div style={{ fontFamily: FONT, background: C.gray50, minHeight: "100vh", padding: "16px 14px", color: C.text, boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 300, color: C.slate, letterSpacing: -0.2 }}>Label advisor</div>
          <div style={{ width: 40, height: 2, background: C.accent, margin: "6px 0 8px" }} />
          <div style={{ fontSize: 13, color: C.muted }}>{subtitle}</div>
        </div>
        <Badge label="ADVICE ONLY · NOTHING APPLIED" bg={C.gray100} color={C.gray700} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
        <ColourKey />
      </div>

      {tab === "Readiness" && <ReadinessTab />}
      {tab === "Suggestions" && <SuggestionsTab />}
      {tab === "Conventions" && <ConventionsTab />}
      {tab === "Conflicts" && <ConflictsTab />}
      {tab === "Unresolved" && <UnresolvedTab />}
      {tab === "Apply plan" && <PlanTab />}

      <div style={{ fontSize: 11, color: C.muted, marginTop: 20, lineHeight: 1.5 }}>
        Method: read-only illumio-mcp pulls (labels, workloads, listening services, traffic) scored by references/inference.md: high is two independent signal kinds or a mined convention with support 5 or more and no counter-example, medium one signal, low model knowledge. A suggestion never overrides a label; disagreement is a conflict. Every number is from advice.json; nothing on the PCE was changed to produce this page.
      </div>
    </div>
  );
}
