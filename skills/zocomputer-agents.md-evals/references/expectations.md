# Expected instruction recall per test case

## Eval 1 — full-three-level-hierarchy

Target: `examples/demo-project/wiki/importer.ts` Scope: root → project → wiki

### Root AGENTS.md (must appear in both treatment and control)

- "This repository is a design proposal and Deno prototype"
- "Keep the resolver deterministic, inspectable, and source-linked"
- "Treat derived context as temporary project input, not a hidden permanent
  rule"

### Project AGENTS.md (must appear in treatment; control may miss)

- "Read the project README before editing"
- "Prefer small, reversible changes"
- "Keep generated artifacts out of source directories"

### Wiki AGENTS.md (most likely missed by control without deeper file discovery)

- "Use `wiki query` for knowledge-base searches"
- "Run `deno test` after changes"
- "Keep private data local; do not publish it by default"

---

## Eval 2 — two-level-project-scope

Target: `examples/demo-project/README.md` Scope: root → project

### Must appear

- Root instructions (at least one)
- Project instructions (at least two)

### Must NOT appear (verifying scoping correctness)

- Wiki-level instructions (these are in a sibling directory, not an ancestor)

---

## Eval 3 — root-level-only

Target: `deno.json` Scope: root only

### Must appear

- Root instructions (at least one)

### Must NOT appear

- Project instructions
- Wiki instructions
