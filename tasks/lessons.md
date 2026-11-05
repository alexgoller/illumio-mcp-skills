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

## 2026-10-16 colour legends
- A viewer asked what an orange section strip meant against a black one;
  it meant nothing. Rule for every skill: colour, bold and tints carry
  meaning only, decorative accents are one neutral grey, and every section,
  chart, table or diagram that uses colour ends with a legend naming each
  colour where it is used. Now a README convention and a checklist item in
  each skill that renders anything.

## 2026-10-19 parallel agents in one repo
- Two subagents told to "create a branch" in the same checkout stepped on
  each other: one switched the shared working tree, the other had to commit
  through a temporary worktree. Give every parallel agent its own
  `git worktree` (as the server-fix agents had) or run them sequentially.
- A CHANGELOG with per-PR `[Unreleased]` sections conflicts on every merge;
  the union script in the scratchpad (merge_unreleased.py) resolved it, but
  a repo convention (one Unreleased section, bullets appended) would avoid
  the conflict altogether.

## 2026-11-04 illumio-rapid-risk-reduction
- When a rule lives in both a document and a script (capped queries, ease), the
  cold-read catches the two drifting apart within an hour of writing. State the
  rule once in the reference and have the script's output quote it (the legend
  on `would have blocked a/b/c`), rather than paraphrasing it in three places.
- "Requires server X" needs the tool list behind it. The server's prompts
  (`emergency-isolate-application`) look like tools in its own docs; dump the
  registry before promising a call.

## 2026-11-04 bytecode in the merge
- `git add -A` after running `py_compile` committed a `__pycache__` file into PR #12;
  package.sh pruned it from the zips, the repo still carried it. Add generated
  directories to .gitignore before the first `git add -A`, and read the merge diff.

## 2026-11-04 description limit
- claude.ai rejects a SKILL.md whose frontmatter description exceeds 1024
  characters; the rapid-risk-reduction description was 1099 and the v1.2.0 zip
  would not upload. package.sh now fails the build above 1024.

## 2026-11-04 marker strings
- A DATA-block marker mentioned in a header comment matched before the real
  marker and the generated file declared every constant twice. Search for
  markers on their own line (newline-wrapped), never as a bare substring.

## 2026-11-05 risk map: labels and selective enforcement
- Never assume an estate is labelled. The first version exited without app/env columns
  and silently read `-` as an environment, producing six impossible denies. Treat `-`,
  empty and null as missing, count the unlabelled, and make readiness the first finding.
- `allowed` is not one thing. Selective enforcement reports everything a deny does not
  catch as allowed, so on a selective estate the denied share is zero and every deny
  scores as risky. Read the enforcement mode of the enforcing side and the draft rules
  before scoring; say which inference was made.
- An actor list in a rule is a conjunction of labels. Checking actors one by one cited
  `app=swift, env=Production` as a consumer that could be `Users`.
- Seeded demo traffic makes public sources look like the story. Rank on what is true on a
  normal estate and keep anything that may be absent (public sources) as a footnote that
  appears only when present, then test with that input removed.
- zsh: an unquoted variable is not word-split (`$P` with several flags failed argparse);
  use an array. `cp` is aliased interactive; use `command cp -f` in scripts.

## 2026-11-05 policy views
- Score against the policy the data was decided by. Reported policy decisions come from
  the provisioned policy, so reading the draft and explaining "allowed" with draft rules
  mixes two worlds; the draft is only for "what is already waiting".
- A "covers it" check needs precision, not possibility. The first cover rule accepted any
  label key and any named service and marked every exposure as already covered; require
  the exact dimension (env label or all workloads) and treat unresolvable services as
  unchecked.
- A doc patch script that writes one file before asserting the next pair leaves the repo
  half-patched; assert every pair first, or make each step idempotent.
