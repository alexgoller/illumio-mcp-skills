# Installing the skills

Every skill in this repo is one folder with a `SKILL.md` at its top, plus
`references/` and, for three of them, a stdlib Python script in `scripts/`.
Install the folder where your Claude client looks for skills, connect the
[illumio-mcp](https://github.com/alexgoller/illumio-mcp-server) server to the
same client, and the skill triggers on its own when you ask the question it
answers (or when you call it by name from the `/` menu).

This page covers three clients:

- [Claude Code](#claude-code) (the CLI and the Code tab of the Desktop app)
- [Claude Desktop](#claude-desktop) (the chat app, including Cowork)
- [claude.ai](#claudeai) (the web app)

Verified on Claude Code 2.1.318 on macOS, 2026-11-05. Menu names in the Desktop
and web apps come from the Anthropic help centre and change from time to time;
the links point at the current articles.

## Before you start

**The illumio-mcp server.** Every skill reads the PCE through it and nothing
else. Install it from its
[installation page](https://alexgoller.github.io/illumio-mcp-server/installation.html):
Python 3.12 or 3.13, `uv` (recommended; pip and Docker also work), a clone of
the repo, `uv sync`. You need a PCE API key: host, port, org id, key name and
secret. Some skills need a minimum server version:

| Skill | Invocation name | Needs server | Why |
|---|---|---|---|
| illumio-rapid-risk-reduction | `illumio-rapid-risk-reduction` | 0.13.1 | `find-unknown-endpoints`, `get-traffic-timeline`, `detect-lateral-movement-paths`, `build-identity-graph` |
| illumio-mythos-readiness | `illumio-mythos-readiness` | 0.13.1 | reads a rapid-risk-reduction run; install that skill too |
| illumio-compliance-evidence | `illumio-compliance-evidence` | 0.13.0 | `collect-compliance-evidence` |
| illumio-label-advisor | `illumio-label-advisor` | 0.13.0 | `group_by` on `get-traffic-flows`, label shorthand in include filters, `detail_level` on `get-workloads` |
| illumio-unknown-endpoints | `illumio-unknown-endpoints` | 0.13.0 | `find-unknown-endpoints` (the v1.1.0 release of this repo works on older servers) |
| illumio-app-profile | `illumio-app-profile` | 0.10.0 | `get-traffic-timeline`, `get-rulesets pversion` (older servers work, one query per timeline bucket) |
| illumio-agentic-ai-risk-assessment | `illumio-agentic-ai-risk-assessment` | any | |
| illumio-pce-assessment | `illumio-pce-assessment` | any | |
| illumio-daily-assessment | `illumio-daily-assessment` | any | |
| illumio-security-dashboard | `illumio-security-dashboard` | any | |

A skill checks the server version on its first call (`get-server-changelog`)
and tells you when the server is too old.

**Python 3** on the path for the five skills that ship a script
(`illumio-app-profile`, `illumio-agentic-ai-risk-assessment`,
`illumio-rapid-risk-reduction`, `illumio-label-advisor`, `illumio-mythos-readiness`). The scripts use the standard library only and
never talk to the PCE.

**Anthropic's document skills** for the skills that write Word or PowerPoint
files: `illumio-pce-assessment` (docx), `illumio-compliance-evidence` (docx,
pptx) and, on request, `illumio-agentic-ai-risk-assessment` and
`illumio-rapid-risk-reduction` (docx). `illumio-security-dashboard` reads the
`frontend-design` skill when present. claude.ai and Claude Desktop have the
document skills built in. In Claude Code you install them, see
[Document skills in Claude Code](#document-skills-in-claude-code).

## Claude Code

### 1. Connect the server

One command registers the server for every project. Replace the path and the
five PCE values (this is the command from the
[server README](https://github.com/alexgoller/illumio-mcp-server#using-with-claude-code)):

```bash
claude mcp add -s user illumio-mcp \
  -e PCE_HOST=https://your-pce.example.com \
  -e PCE_PORT=443 \
  -e PCE_ORG_ID=1 \
  -e API_KEY=api_xxxxxxxxxxxxxxxx \
  -e API_SECRET=your_api_secret \
  -- uv --directory /path/to/illumio-mcp-server run illumio-mcp
```

Add `-e PCE_TLS_VERIFY=false` for a self-signed PCE certificate. `-s project`
writes a shareable `.mcp.json` into the current repo instead; do not put
credentials in that one. Check it:

```bash
claude mcp get illumio-mcp     # Status: ✔ Connected
claude mcp list                # every server and whether it connects
```

Inside a session `/mcp` shows the same status. The server's tools appear to
Claude as `mcp__illumio-mcp__<tool>`, for example
`mcp__illumio-mcp__check-pce-connection`. The skills name the tools without
the prefix; that is fine.

### 2. Install the skills

Pick one route. The first is the one to use unless you have a reason not to.

#### Route A: the plugin (recommended)

The repo is a Claude Code plugin marketplace with one plugin, `illumio`, that
holds all eight skills. In a session:

```
/plugin install illumio --marketplace alexgoller/illumio-mcp-skills
```

(Claude Code 2.1.275 or later. On older builds use two steps:
`/plugin marketplace add alexgoller/illumio-mcp-skills`, then
`/plugin install illumio@illumio-mcp-skills`.)

The same from the shell, with a scope if you want it:

```bash
claude plugin marketplace add alexgoller/illumio-mcp-skills
claude plugin install illumio@illumio-mcp-skills --scope user   # user | project | local
```

The skills appear in the `/` menu as `/illumio:<name>`, for example
`/illumio:illumio-app-profile`. They trigger on their descriptions as well, so
"tell me everything about app shop in prod" runs the app profile without the
slash command.

Later:

```bash
claude plugin update illumio@illumio-mcp-skills     # pull the latest, restart to apply
claude plugin details illumio@illumio-mcp-skills    # the eight skills and their token cost
claude plugin uninstall illumio@illumio-mcp-skills
```

#### Route B: skill folders, no plugin

Use this when plugins are blocked for you or you want one skill only. Get the
zips from the latest [release](https://github.com/alexgoller/illumio-mcp-skills/releases)
(or build them with `./package.sh`, which writes `dist/`), then unzip the ones
you want into a skills directory:

```bash
# for every project
unzip illumio-app-profile.zip -d ~/.claude/skills/
# for one project
unzip illumio-app-profile.zip -d /path/to/project/.claude/skills/
```

Each zip unpacks to one folder named after the skill with `SKILL.md` inside,
which is what Claude Code expects. The folder name is the invocation name
(`/illumio-app-profile`), so use the zips rather than copying directories out
of this repo: two repo directories are named differently from their skills
(`illumio-pce-security-assessment/` holds `illumio-pce-assessment`,
`illumio-security-dashboard-skill/` holds `illumio-security-dashboard`).

Claude Code picks up changes inside an existing skills directory live. If you
just created `~/.claude/skills/` or `.claude/skills/`, run `/reload-skills` or
start a new session. To update, replace the folder with the new zip's content.

#### Route C: one session only

Load a zip straight from disk or from a release URL for the current session,
nothing is installed:

```bash
claude --plugin-dir dist/illumio-app-profile.zip --plugin-dir dist/illumio-unknown-endpoints.zip
claude --plugin-url https://github.com/alexgoller/illumio-mcp-skills/releases/download/v1.3.0/illumio-unknown-endpoints.zip
```

Each zip becomes a session plugin named after its folder, so the skill is
`/illumio-app-profile:illumio-app-profile` (`--plugin-url` prefixes the name
with `url-0-`). Pointing `--plugin-dir` at a folder full of zips loads nothing;
pass each zip. An unpacked skill folder works the same way as its zip.

#### Route D: upload once on claude.ai

Skills enabled for your claude.ai account are also loaded by Claude Code
sessions signed in with that account (and by the Desktop app). If you already
uploaded the zips on claude.ai or in Claude Desktop, see
[claude.ai](#claudeai) below, they show in the `/` menu with the synced
bundle's prefix, and you have nothing to install in Claude Code. Organisations
can switch this off (`disableSideloadFlags`).

### 3. Check it works

1. Type `/` in a session: the illumio skills are listed (`/illumio:...` for
   the plugin, `/illumio-...` for folders).
2. `claude plugin list` shows `illumio@illumio-mcp-skills` enabled (Route A).
3. Ask something a skill answers, for example "what can we block today?" or
   `/illumio:illumio-app-profile app=shop env=prod`. The skill's first PCE
   call is `check-pce-connection`; if that fails, go back to step 1.

### Document skills in Claude Code

claude.ai ships Anthropic's `docx`, `pptx`, `xlsx` and `pdf` skills; Claude
Code does not. Install them from Anthropic's skills marketplace, and the
`frontend-design` plugin from the official marketplace:

```bash
claude plugin marketplace add anthropics/skills
claude plugin install document-skills@anthropic-agent-skills
claude plugin install frontend-design@claude-plugins-official
```

Two SKILL.md files point at `/mnt/skills/public/docx/SKILL.md` and
`/mnt/skills/public/frontend-design/SKILL.md`; those paths exist on claude.ai
only. In Claude Code the same skills are the installed plugin skills (find
them in the `/` menu), and Claude reads them from there.

### Dashboards in Claude Code

Several skills write a single-file React dashboard (`dashboard.jsx`). claude.ai
renders such a file as an artifact; Claude Code leaves it on disk. To look at
it, upload the file to a claude.ai conversation, or ask Claude Code to bundle
it into one HTML page and publish that as an artifact.

## Claude Desktop

The Desktop app has two places that run skills: the chat (and Cowork), which
shares its configuration with claude.ai, and the Code tab, which is Claude Code
and shares its configuration with the CLI.

### Chat and Cowork

1. **Turn on file creation.** Settings > Capabilities > "Create and edit
   files" (older layouts call it "Code execution and file creation"). Skills
   run in that environment; without it the Skills section is missing. On Team
   and Enterprise plans an owner enables it under Organization settings >
   Plugins & skills.
2. **Upload each skill.** Customize (in the sidebar) > Skills > `+` >
   Create skill > Upload a skill, then pick the zip from the latest
   [release](https://github.com/alexgoller/illumio-mcp-skills/releases). One
   zip per skill. The skill appears in the list with a toggle. Uploads sync
   through your claude.ai account, so the same skills are available on the web
   and in Claude Code sessions signed in with that account.
   Help centre: [Use skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude),
   [How to create custom skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills).
3. **Connect the server.** Settings > Developer > Edit Config opens
   `claude_desktop_config.json` (macOS:
   `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows:
   `%APPDATA%\Claude\claude_desktop_config.json`). Add the block from the
   [server README](https://github.com/alexgoller/illumio-mcp-server#using-uv-and-claude-desktop),
   with absolute paths:

   ```json
   {
     "mcpServers": {
       "illumio-mcp": {
         "command": "uv",
         "args": ["--directory", "/path/to/illumio-mcp-server", "run", "illumio-mcp"],
         "env": {
           "PCE_HOST": "https://your-pce.example.com",
           "PCE_PORT": "443",
           "PCE_ORG_ID": "1",
           "API_KEY": "api_xxxxxxxxxxxxxxxx",
           "API_SECRET": "your_api_secret"
         }
       }
     }
   }
   ```

   Quit the app fully and reopen it; the server shows under Customize >
   Connectors. Help centre:
   [Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).
   If the server runs centrally in
   [HTTP mode](https://alexgoller.github.io/illumio-mcp-server/operations/http-mode.html),
   add it as a custom connector instead (Customize > Connectors).
4. **Check.** Start a chat, ask "check the PCE connection", then ask a skill
   question, for example "what can we block today?".

### The Code tab

A local session in the Code tab is Claude Code, so everything under
[Claude Code](#claude-code) applies:

- Skills come from `~/.claude/skills/`, from installed plugins and from the
  skills enabled for your claude.ai account. Plugins can also be added from
  the composer: `+` next to the prompt box > Add plugins.
- MCP servers come from `~/.claude.json` and `.mcp.json` (what `claude mcp
  add` writes) and, in addition, from `claude_desktop_config.json`. A server
  defined in both places connects once, with the Desktop definition. The
  standalone CLI does not read the Desktop file; `claude mcp
  add-from-claude-desktop` copies those servers into `~/.claude.json` on
  macOS.

## claude.ai

1. Settings > Capabilities: turn on "Create and edit files" (Team and
   Enterprise: an owner does this under Organization settings > Plugins &
   skills, and can upload skills for everyone there).
2. Customize > Skills > `+` > Create skill > Upload a skill, one zip per skill
   from the latest [release](https://github.com/alexgoller/illumio-mcp-skills/releases).
   claude.ai accepts a SKILL.md description of at most 1024 characters;
   `package.sh` fails the build above that, so a release zip always uploads.
3. The server has to be reachable from claude.ai, which means running it
   centrally in [HTTP mode](https://alexgoller.github.io/illumio-mcp-server/operations/http-mode.html)
   and adding it as a custom connector (Settings > Connectors > Add custom
   connector). A server on your laptop is only reachable from the Desktop app
   and Claude Code.

## Troubleshooting

- **The skill is not in the `/` menu.** For folders: the zip must unpack to a
  single folder with `SKILL.md` directly inside it, and a skills directory
  created during a session needs `/reload-skills`. For the plugin: `claude
  plugin list` shows whether it is enabled; `claude plugin update` then a
  restart applies a new version.
- **`claude plugin validate illumio-app-profile` reports "No manifest found".**
  Expected: a bare skill folder is not a plugin. Validate the repo root
  instead (`claude plugin validate .`), which checks the marketplace manifest.
- **Claude says the server is too old.** `get-server-changelog` reports the
  server version; compare it with the table above and update the server, or
  use the older skill release named there.
- **Tool calls fail or hang.** `claude mcp get illumio-mcp` (or `/mcp`) shows
  whether the server connected. A self-signed PCE certificate needs
  `PCE_TLS_VERIFY=false`; `MCP_LOG_LEVEL=DEBUG` writes `illumio-mcp.log` into
  the server directory. The server's
  [troubleshooting page](https://alexgoller.github.io/illumio-mcp-server/operations/troubleshooting.html)
  covers the PCE side.
- **The Word or PowerPoint step fails in Claude Code.** The document skills
  are not installed; see [Document skills in Claude Code](#document-skills-in-claude-code).
- **Uploading a zip to claude.ai fails.** The folder inside the zip must match
  the skill's `name`, `SKILL.md` must be present, and the description must be
  at most 1024 characters; the zips from `package.sh` and the releases satisfy
  all three.
