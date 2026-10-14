# illumio-unknown-endpoints skill — build plan (2026-10-14)

Request (verbatim): "create a skill to recognize things not mapped as
unmanaged workloads or managed workloads. like rogue/unknown IP adresses
reporting, especially with remarkable traffic profiles, but also general"

Rules: illumio-mcp tools only, read-only, gentle on the PCE, gaps become
server issues (see tasks/lessons.md).

## Plan

- [ ] Server facts from the local illumio-mcp-server checkout (Explore
      subagent): how a non-workload endpoint shows in traffic rows, IP-list
      tool, workload IP fields, group_by options, truncation fields
- [ ] Design: classification of a flow endpoint (managed / unmanaged /
      IP-list-known / unknown), noise exclusions, traffic-profile shapes
      (scanner, server, egress, admin-port, chatty), findings U1..Un,
      suggestions (unmanaged workload, IP list, VEN, deny) never executed
- [ ] `illumio-unknown-endpoints/SKILL.md` — frontmatter, inputs, PCE
      budget, Steps 0..6, verification checklist, gap table, mistakes table
- [ ] `references/findings-rubric.md` — U-findings and profile shapes
- [ ] `references/report-template.md` — report skeleton
- [ ] Server issues for missing capabilities, cited from the gap table
- [ ] README entry; package.sh build
- [ ] Cold-read test by a fresh agent on scenario questions
- [ ] Commit on branch `unknown-endpoints-skill`, push, open PR

## Review

(pending)
