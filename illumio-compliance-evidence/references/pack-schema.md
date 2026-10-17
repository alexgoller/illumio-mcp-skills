# Pack model (JSON)

The pack is one JSON document, `pack.json`, written before any other
format. Every other output (Markdown, Word, PowerPoint, dashboard) is a
rendering of this file and shows nothing that is not in it. The JSON is
itself a deliverable: it is what a GRC tool, a SIEM or the next run's
drift comparison reads.

Field names are fixed. Dates are ISO 8601 with zone. Results are one of
`PASS`, `FAIL`, `EXCEPTION`, `ATTESTED`, `NOT_TESTED`.

```json
{
  "pack": {
    "schema": "illumio-compliance-evidence/1",
    "framework": "pci-dss",                 "framework_version": "v4.0.1",
    "scope_name": "CDE prod",               "run_at": "2026-10-17T09:30:00+02:00",
    "run_number": 3,                        "previous_run_at": "2026-09-17T09:12:00+02:00",
    "pce": "pce.example.com:8443",          "org_id": 1,
    "pce_version": null,                    "server_version": "0.12.0",
    "window": { "start": "2026-07-19", "end": "2026-10-17", "days": 90 },
    "queries": 35,                          "policy_version": "active",
    "overall": "FAIL",
    "disclaimer": "Evidence of segmentation controls collected from the Illumio PCE. Supports the controls in `requirements`; not a certification; `not_covered` lists what it does not claim."
  },
  "scope": {
    "pairs": [
      { "app": "pay", "env": "prod", "app_href": "/orgs/1/labels/12", "env_href": "/orgs/1/labels/3",
        "workloads": 6, "managed": 6, "data_tier": false }
    ],
    "connected_systems": [],
    "confirmed_by": "Alex Goller", "confirmed_at": "2026-10-17T09:05:00+02:00"
  },
  "inputs": {
    "approved_services": [ { "port": 443, "proto": "tcp", "direction": "in", "peer": "web/prod", "justification": "API", "reference": "CHG-1203" } ],
    "attestation_inputs_supplied": ["review", "drill"]
  },
  "tests": [
    { "id": "T2", "name": "Enforcement", "scope": "pair",
      "rule": "enforcement_mode equals full for 100% of managed workloads",
      "result": "FAIL",
      "per_pair": {
        "pay/prod": { "result": "FAIL", "measured": "5 of 6 full; 1 selective, no justification",
                      "evidence": ["05-get-workloads-pay-prod.json"],
                      "rows": [ { "workload": "pay-web-03", "mode": "selective", "justification": null } ] }
      }
    }
  ],
  "requirements": [
    { "id": "1.4.1", "title": "NSCs between trusted and untrusted networks",
      "citation": "PCI DSS v4.0.1, Requirement 1.4.1", "text": "<quoted from the official document>",
      "control": "CDE workloads in full enforcement with healthy VENs, so default deny is live.",
      "tests": ["T2", "T3"], "result": "FAIL",
      "gap": "pay-web-03 is in selective enforcement.", "remediation": "Move to full after the pending rule review.", "owner": null,
      "not_covered": "perimeter firewalls" }
  ],
  "attestations": [
    { "id": "A1", "statement": "Rules for the scope were reviewed", "cadence": "6 months",
      "attested_by": "Alex Goller", "date": "2026-08-30", "document": "Review minutes 2026-08-30", "result": "ATTESTED" },
    { "id": "A2", "statement": "Isolation drill executed", "attested_by": null, "date": null, "document": null, "result": "NOT_TESTED" }
  ],
  "findings": [
    { "requirement": "1.4.1", "test": "T2", "result": "FAIL", "pair": "pay/prod",
      "detail": "pay-web-03 selective, no justification", "remediation": "Move to full", "owner": null }
  ],
  "boundary": {
    "pay/prod": {
      "inbound_admitted": [ { "peer": "web (prod)", "port": 443, "proto": "tcp", "connections": 120400, "approved": true } ],
      "inbound_potentially_blocked": 0, "inbound_blocked_connections": 3120,
      "outbound_admitted": [ { "destination": "10.0.0.53", "fqdn": null, "port": 53, "proto": "udp", "connections": 41200, "approved": null } ],
      "timeline": { "bucket": "1d", "effective_bucket": "1d", "series": [ { "bucket_start": "2026-10-16T00:00:00Z", "blocked": 40, "potentially_blocked": 0 } ],
                    "worst_spike": null, "caveat": null }
    }
  },
  "drift": { "previous_run_at": "2026-09-17T09:12:00+02:00",
             "items": [ { "item": "T2 pay/prod", "previous": "PASS", "current": "FAIL", "change": "changed" } ] },
  "evidence_index": [
    { "file": "05-get-workloads-pay-prod.json", "tool": "get-workloads",
      "arguments": { "labels": "app=pay", "detail_level": "compact", "max_results": 10000 },
      "collected_at": "2026-10-17T09:31:12+02:00", "rows": 6, "tests": ["T1", "T2", "T3", "T4"],
      "sha256": "9f2c…" }
  ],
  "not_covered": [ "2.x secure configurations", "3.x to 4.x data protection" ]
}
```

Rules:

- `tests[].result` is the worst `per_pair` result; `requirements[].result`
  is the worst of its tests; `pack.overall` is the worst requirement, in
  the order FAIL, EXCEPTION, NOT_TESTED, ATTESTED, PASS.
- `evidence` entries are file names from `evidence_index`; every test row
  cites at least one.
- `requirements[].text` holds the quoted official text or `null` with
  `citation` set, never matrix wording.
- `boundary` holds the admitted-service and crossing tables that the
  Markdown, Word and dashboard renderers draw; the raw grouped flows stay
  in the evidence files.
- `drift.items` is empty with `previous_run_at` null on a first run.
