# Agent catalog

Process names that identify agentic AI clients on managed workloads, plus the
vendor endpoints they talk to. Extend the table with one line per new agent.

## Matching rules

1. Normalise the process string: replace every `\` with `/`, take the basename
   (text after the last `/`), lower-case it.
2. Match each catalog pattern as a **substring** of the normalised basename.
   `C:\Users\jdoe\AppData\Local\AnthropicClaude\Claude.exe` and
   `/Applications/Claude.app/Contents/MacOS/Claude` both resolve to `claude`.
3. When several patterns match, the longest pattern wins (`chatgpt` beats
   `gpt`, `claude-code` beats `claude`).
4. Windows paths carry the user in the path (`C:\Users\<user>\...`). Extract it
   and keep it per flow; macOS and Linux paths carry no user.
5. Empty process, `-`, or `unknown` is **unattributed**. Count it as a coverage
   gap (VEN process visibility off), never as agent traffic.

## Catalog

| Agent family | Windows process | macOS / Linux process | Class | Ambiguous |
| --- | --- | --- | --- | --- |
| Claude desktop | `Claude.exe` | `Claude` (Claude.app) | agentic chat client | no |
| Claude Code | `claude.exe`; `node.exe` with `claude` in cmdline (rarely visible) | `claude`, `node` | agentic CLI | `node` only |
| ChatGPT desktop | `ChatGPT.exe` | `ChatGPT` (ChatGPT.app) | agentic chat client | no |
| Codex CLI | `codex.exe` | `codex` | agentic CLI | no |
| Cursor | `Cursor.exe` | `Cursor` (Cursor.app) | agentic IDE | no |
| Windsurf | `Windsurf.exe` | `Windsurf` | agentic IDE | no |
| GitHub Copilot in VS Code | `Code.exe` | `Electron` (Visual Studio Code.app), `Code` | host IDE | yes |
| Copilot desktop | `Copilot.exe`, `M365Copilot.exe` | `Copilot` | chat client | no |
| Gemini CLI / desktop | `gemini.exe` | `gemini` | agentic CLI | no |
| Aider, OpenHands, Goose, OpenClaw | `aider.exe`, `goose.exe`, `openclaw.exe`, `python.exe` | `aider`, `goose`, `openclaw`, `python3` | agentic CLI | `python` only |
| Local model runtimes | `ollama.exe`, `LM Studio.exe` | `ollama`, `LM Studio` | local inference, egress-light | no |
| Browser-hosted agents | `chrome.exe`, `msedge.exe` | `Google Chrome`, `Microsoft Edge` | host browser | yes |

Substring patterns, in the order the script tries them (longest first):

```
unambiguous: chatgpt, claude, cursor, windsurf, codex, gemini, copilot,
             m365copilot, aider, goose, openclaw, ollama, lm studio, lmstudio
ambiguous:   code.exe, electron, msedge, chrome, python, node
```

`copilot` covers both `Copilot.exe` and `M365Copilot.exe`; VS Code with the
Copilot extension shows as `Code.exe` / `Electron` and stays ambiguous.

## Scoring rules

- **Unambiguous** families count as agentic AI with no further evidence and
  enter the inventory, the reach analysis, the Sankey and the risk register.
- **Ambiguous** hosts go in a separate "possible agent hosts" table with flow
  and connection counts. They are not scored unless the user asks. Say so in
  the scope section. Example: `Code.exe` on vdi-03 reaching `hrm-app01` on
  443 is one row in the possible-hosts table and nothing in the register,
  even though VS Code may be running Copilot. Ask the user before scoring it.
- **Unattributed** flows are reported once, as a percentage of all rows from
  the source population, under coverage gaps. Above 10 percent triggers R9.

## Vendor egress hints

Confirm by reverse DNS or by the FQDN the PCE resolved. Without either, label
the provider as "likely".

| Provider | IP hints | FQDNs |
| --- | --- | --- |
| Anthropic | `160.79.104.0/23` | `api.anthropic.com`, `claude.ai`, `statsig.anthropic.com` |
| OpenAI | Cloudflare-fronted: `162.159.0.0/16`, `172.66.0.0/16`, `104.18.0.0/16` | `api.openai.com`, `chatgpt.com`, `oaistatic.com`, `oaiusercontent.com` |
| Cursor | Cloudflare and AWS, no stable range | `api2.cursor.sh`, `api3.cursor.sh`, `repo42.cursor.sh`, `marketplace.cursorapi.com` plus the model vendor the user picked |
| GitHub Copilot | GitHub ranges `140.82.112.0/20`, `143.55.64.0/20` | `api.githubcopilot.com`, `copilot-proxy.githubusercontent.com`, `default.exp-tas.com` |
| Google | Google ranges `142.250.0.0/15`, `172.217.0.0/16` | `generativelanguage.googleapis.com`, `aiplatform.googleapis.com`, `gemini.google.com` |
| Microsoft Copilot | Azure Front Door, no stable range | `copilot.microsoft.com`, `substrate.office.com`, `api.cortana.ai` |
| Codeium / Windsurf | AWS, no stable range | `server.codeium.com`, `api.codeium.com`, `windsurf.com` |

Cloudflare-fronted addresses are shared by thousands of tenants. An address in
`162.159.x.x` reached by `ChatGPT.exe` is "likely OpenAI"; the same address
reached by `chrome.exe` is just Cloudflare.

## Non-vendor egress

Any egress destination inside RFC1918 (`10/8`, `172.16/12`, `192.168/16`) that
is not in the workload map is an **unmanaged internal host**, not vendor
egress. Report it in its own row group and cross-check whether the same
address appears as a source of blocked or potentially blocked traffic against
the endpoints. If it does, call it a possible foothold (R7).
