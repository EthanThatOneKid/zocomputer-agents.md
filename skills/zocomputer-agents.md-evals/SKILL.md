---
name: zocomputer-agents.md-evals
description: >
  Evaluates whether Zo Rules derived from recursive AGENTS.md files fire correctly
  at the right times. The skill sets up a treatment group (AGENTS.md content
  compiled into Zo Rules) and a control group (AGENTS.md files on disk only,
  no rules), then compares instruction recall, token efficiency, and whether
  the agent had to manually discover AGENTS.md files. Use this whenever evaluating
  or iterating on the derive + rules pipeline for zocomputer-agents.md, running
  A/B experiments against the derivation system, or checking whether AGENTS.md
  instructions reach the agent through Zo Rules vs file reads.
---

# Derive + Rules Evaluator

Evaluates the end-to-end pipeline: discover AGENTS.md files via the Deno derive
resolver, compile them into Zo Rules, then measure whether the rules actually
surface the right instructions at the right time — without the agent needing to
manually hunt for AGENTS.md files.

## The experiment

For each test case there are two passes:

| Pass          | Zo Rules                                  | AGENTS.md files | What's measured                                                                               |
| ------------- | ----------------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| **Treatment** | Active (derived from AGENTS.md hierarchy) | On disk         | Agent should answer using rule-injected context; should NOT need to `read_file` any AGENTS.md |
| **Control**   | None                                      | On disk         | Agent must discover instructions manually; may miss nested scopes, consume more tokens        |

The core question: **do derived Zo Rules make AGENTS.md instructions reach the
agent without file discovery?**

## Workflow

### Step 1 — Copy the repo to Zo

The `zocomputer-agents.md` repo must exist on Zo's filesystem. If not already
present, copy it. The derive script, test fixtures, and Deno import map all
expect a checkout at `~/zocomputer-agents.md`.

Verify Deno is available (`deno --version`). If Deno is not installed, install
it first.

### Step 2 — Identify test cases

Test cases are defined in `evals/evals.json`. Each has:

- **target**: relative path within the repo (e.g.
  `examples/demo-project/wiki/importer.ts`)
- **prompt**: a read-only question about the file (e.g. "What conventions should
  I follow when working on this file?")
- **expected_sources**: ordered list of AGENTS.md paths that should be
  discovered by the derive resolver
- **expected_instructions**: key phrases from each applicable AGENTS.md that the
  agent should mention

There are three fixture targets available in the repo:

| # | Target                                   | Discovered AGENTS.md files            |
| - | ---------------------------------------- | ------------------------------------- |
| 1 | `examples/demo-project/wiki/importer.ts` | root → demo-project → wiki (3 levels) |
| 2 | `examples/demo-project/README.md`        | root → demo-project (2 levels)        |
| 3 | `deno.json`                              | root only (1 level)                   |

### Step 3 — Run derivation and create Zo Rules

For each test case:

1. Run the derive script on Zo:
   ```
   deno run --allow-read src/derive.ts <target>
   ```
2. Parse the JSON output. Each entry in `sources` maps to one Zo Rule.
3. For each source, create a Zo Rule using `zo_create_rule`:
   - **condition**: `"When working on files in <scope>"` where scope is the
     source's `scope` field
   - **instruction**: the source's content, formatted as bullet points from the
     AGENTS.md body

Rules must be created from broadest to narrowest scope so that the root
instructions are always present, with more-specific instructions layering on
top.

### Step 4 — Treatment run (with Zo Rules active)

For each test case, after rules are created:

1. Read the target file on Zo just to confirm it exists
2. Answer the test prompt — the agent should reference the AGENTS.md
   instructions surfaced by the Zo Rules
3. Save the response transcript to the iteration workspace:
   `<workspace>/iteration-N/<eval-name>/with_skill/outputs/response.md`
4. Record in the transcript whether any `AGENTS.md` files were read during this
   pass. If the rules worked correctly, the agent should NOT need to read them.

### Step 5 — Tear down rules

Delete ALL Zo Rules that were created in Step 3 using `zo_delete_rule`. Verify
with `zo_list_rules` that they are gone before proceeding.

### Step 6 — Control run (no Zo Rules)

For each test case, with rules deleted:

1. Confirm the AGENTS.md files still exist on disk
2. Answer the SAME test prompt — but now without rule-injected context
3. Save the response transcript to:
   `<workspace>/iteration-N/<eval-name>/without_skill/outputs/response.md`
4. Record whether the agent read AGENTS.md files during this pass. Without
   rules, the agent almost certainly needs to read them.

### Step 7 — Grade and compare

For each test case, compare treatment vs control on these dimensions:

1. **Instruction recall**: Which pass mentions more of the expected
   instructions?
2. **AGENTS.md reads**: Did the treatment pass avoid reading AGENTS.md files?
3. **Completeness**: Did the control pass miss deeper-scoped instructions?
4. **Token efficiency**: If timing data is available, compare token counts.

Run `scripts/grade.ts` on the transcripts to produce structured grading output.
Save grading results to `<run-dir>/grading.json`.

### Step 8 — Collect timing data

When each step (derivation, treatment, control, grading) completes within
subagent runs, capture `total_tokens` and `duration_ms` into `timing.json` in
each run directory.

### Step 9 — Aggregate and launch viewer

Run:

```
python <skill-creator-path>/eval-viewer/generate_review.py \
  <workspace>/iteration-N \
  --skill-name "zocomputer-agents.md-evals" \
  --benchmark <workspace>/iteration-N/benchmark.json
```

If the environment has no display, pass `--static <output_path>` to write a
standalone HTML file.

### Step 10 — Collect feedback

After the user reviews in the viewer and clicks "Submit All Reviews", read
`feedback.json` and apply improvements to the derivation pipeline or the
evaluation approach.

## Reference files

- `evals/evals.json` — Test case definitions (prompts, expected sources,
  assertions)
- `references/expectations.md` — Per-test-case instruction phrases to check for
- `scripts/grade.ts` — Compares treatment vs control transcripts

## Model

Use **GPT Luna** for all Zo operations. This ensures consistent evaluation
conditions across runs. Note: the agent executing this skill is already on Zo
and inherits the active model.
