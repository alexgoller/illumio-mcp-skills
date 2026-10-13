# Lessons

## 2026-09-17 illumio-agentic-ai-risk-assessment
- Check the MCP server source (git/illumio-mcp-server) before writing call
  shapes into a skill; the handoff had two wrong parameter names and one wrong
  claim about `truncated`.

## 2026-10-13 illumio-app-profile (issue #1)
- Skills in this repo use illumio-mcp tools only. Do not ship Python helper
  scripts; the agent does the analysis on tool results. When a needed
  capability does not exist in the server, file an issue on
  alexgoller/illumio-mcp-server and reference it from the skill's gap table.
