# Lessons

## 2026-09-17 illumio-agentic-ai-risk-assessment
- Check the MCP server source (git/illumio-mcp-server) before writing call
  shapes into a skill; the handoff had two wrong parameter names and one wrong
  claim about `truncated`.

## 2026-10-14 illumio-unknown-endpoints
- A tool schema's description is not proof the parameter works. The traffic
  tools documented IP/FQDN/IP-list include filters that the SDK rejects
  before the query is sent (illumio-mcp-server#47). When a skill step
  depends on an input form, build the query in the server venv and look at
  the JSON, or find a test that covers it, before writing the call shape.
- Check the server's open and closed issues and recent commits before
  reusing workarounds from an older skill; #43-#45 shipped overnight and
  made the app-profile workarounds obsolete.
