# Label advice report

`scripts/advise.py` writes `suggestions.md` in this shape; the skill presents
it as the report (chat, Claude Doc or .docx). Every number comes from
`advice.json`; the report never re-derives a count or a confidence from prose.
Nothing in it has been written to the PCE unless the apply section at the end
says so.

## 0. Header

`Label advice, <date>: <window start> to <window end>, scope <scope>`

Opening lines, one each: the mode (suggest, or apply with its preferences);
the dimensions read (`role`, `app`, `env`, `loc`, plus the custom keys found,
or "no custom dimension has labels yet"); the calls made and which hit a cap
("full detail for 10.20.3.x was truncated and re-read in ten slices";
"3 of 12 flow queries hit the 500-flow cap: peer evidence for those batches
is a sample"); the files not read (`infra.json` absent on an estate without
app labels) and what that cost.

## 1. Readiness

Opens with the verdict: "`<n>` workloads: `<a>` fully labelled, `<b>` partly,
`<c>` not at all." Then the coverage table, one row per dimension
(labelled, missing, share), the VEN line ("`<x>` workloads report listeners,
`<y>` report none: role evidence for those comes from traffic only"), the
unmanaged count (no VEN, no listeners, traffic only) and the readiness notes
from the script. When no workload carries any label, say that no convention
could be mined and that `app`, `env` and `loc` suggestions therefore rest on
subnets and peers only.

## 2. Conventions found

One line per mined rule, with its support and counter-examples: "hostname
token 1 `prd` means `env=Production` (12 labelled hosts, 0 counter-examples)";
"subnet 10.20.3.0/24 is `loc=FRA` on 9 of 9 labelled hosts". A section that is
empty says why (nothing labelled, or no consistent pattern).

## 3. Infrastructure hubs

The destinations most of the estate talks to, with the port, the process
where known, the distinct-source count, the role the port implies and where
the hub came from (the infrastructure-service tool, or fan-in). State that
hubs received role suggestions only and were excluded as peer evidence.

## 4. Suggestions

Grouped by dimension, then by confidence (high, medium, low). One line per
suggestion: hostname, value, confidence, source (script or model), the
evidence sentences joined with semicolons, and "new value" when the value is
not yet in the vocabulary. After each dimension, the count line: "`<n>`
suggestions for `env`: `<h>` high, `<m>` medium, `<l>` low; `<k>` new values".

The confidence words mean what `references/inference.md` says: high is two
independent signals in agreement or a convention with support of five and no
counter-example; medium is one signal; low is model knowledge only.

## 5. Conflicts

Workloads whose existing label disagrees with the evidence: hostname,
dimension, existing value, suggested value, confidence, evidence. The
section opens with "Nothing here is changed by this skill in any mode; these
are for a human to check." Empty is a finding too: "no conflict found on the
`<n>` labelled workloads".

## 6. Unresolved

Two lists. Listening processes and ports the role table does not know
(process, port, protocol, OS, number of workloads, example hosts), and
workloads with nothing to go on (hostname, missing dimensions, why: no
convention match, no labelled peers, no traffic in the window, no
listeners). After the model pass, say what the model added and what it left
alone.

## 7. Apply plan

The preferences line ("every dimension, confidence high, whole estate, dry
run"), the counts line ("`<w>` workloads, `<a>` labels to add, `<c>` labels
to create") and the table: hostname, before, additions, after, confidence.
Then the new values that would be created, per key. In suggest mode the
section ends with "Nothing has been written. Say apply to go through the
plan." In apply mode it ends with the log: written, skipped and why, labels
created, the verification result, and the rollback pointer ("`plan.md`
holds one `update-workload` call per workload restoring its previous set").
