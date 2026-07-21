---
name: zocomputer-agents.md-evals
description: >
  Evaluates whether Zo Rules derived from recursive AGENTS.md files fire via
  the Zo Ask API. Each test case is a POST /zo/ask call with a structured
  output_format — treatment runs with rules active, control runs without.
  Use whenever iterating on the derive + rules pipeline, or checking whether
  derived Zo Rules surface AGENTS.md instructions through the API.
---

# Derive + Rules Evaluator (API)

Evaluates the derive pipeline via the [Zo Ask API][ask]. Each eval sends a
prompt to `https://api.zo.computer/zo/ask` with `output_format` to force
structured, machine-checkable results.

## Prerequisites

- `ZO_API_KEY` environment variable set to a Zo access token.
- The `zocomputer-agents.md` repo cloned to Zo at `/root/zocomputer-agents.md/`.
- Deno available on the machine running the eval scripts.

## Workflow

### Step 1 — Setup

Create Zo Rules from derived AGENTS.md context:

```
ZO_API_KEY=... deno run --env scripts/setup.ts
```

Alternatively, use the Zo MCP `zo_create_rule` tool. Rules are created from
broadest to narrowest scope so root instructions are always present.

### Step 2 — Treatment run (rules active)

For each eval, call the Ask API. Zo Rules are active and will inject context
automatically.

```
ZO_API_KEY=... deno run --env --allow-net --allow-read --allow-write \
  scripts/ask.ts \
  --eval-id <N> \
  --config evals/evals.json \
  --out <workspace>/iteration-N/<eval-name>/with_skill/outputs/response.json
```

Run all treatment calls in sequence (not parallel — rate limits apply).

### Step 3 — Teardown

Delete all iteration rules via `zo_delete_rule` MCP or a teardown script.

### Step 4 — Control run (no rules)

Same Ask API calls, now without Zo Rules active:

```
ZO_API_KEY=... deno run --env --allow-net --allow-read --allow-write \
  scripts/ask.ts \
  --eval-id <N> \
  --config evals/evals.json \
  --out <workspace>/iteration-N/<eval-name>/without_skill/outputs/response.json
```

### Step 5 — Grade

Compare structured outputs:

```
deno run --allow-read --allow-write scripts/grade.ts \
  --config evals/evals.json \
  --treatment <path/to/with_skill/outputs/response.json> \
  --control <path/to/without_skill/outputs/response.json> \
  --out <eval-dir>/grading.json
```

### Step 6 — Benchmark and viewer

Run the skill-creator aggregation and viewer:

```
python <skill-creator>/eval-viewer/generate_review.py \
  <workspace>/iteration-N \
  --skill-name "zocomputer-agents.md-evals" \
  --benchmark <workspace>/iteration-N/benchmark.json \
  --static <workspace>/iteration-N/review.html
```

## Reference files

- `evals/evals.json` — Eval definitions with `output_format` schemas
- `scripts/ask.ts` — Calls Zo Ask API with structured output
- `scripts/grade.ts` — Parses structured API responses, grades per assertion
- `references/expectations.md` — Expected instruction recall per eval

## Model

All API calls use `zo:openai/gpt-5.6-luna`. The `output_format` parameter
ensures structured responses compatible with deterministic grading.

[ask]: https://docs.zocomputer.com/api#post-zo-ask
