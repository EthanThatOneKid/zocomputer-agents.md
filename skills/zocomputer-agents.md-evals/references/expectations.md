# Expected instruction recall per test case

## Eval 1 — red-deep-scoping

Target: `examples/demo-project/red/rose.md` Scope: root → project → red

### Must appear (ancestor chain)

- Root: "design proposal and Deno prototype", "Keep the resolver deterministic"
- Project: "Read the project README before editing", "Prefer small, reversible
  changes"
- Red: "Prefer warm color tones", "Rose inherits all red conventions"

### Must NOT appear (sibling, not ancestor)

- Blue: "Prefer cool color tones", "Violet inherits all blue conventions"

---

## Eval 2 — blue-deep-scoping

Target: `examples/demo-project/blue/violet.md` Scope: root → project → blue

### Must appear (ancestor chain)

- Root: "design proposal", "deterministic", "source-linked"
- Project: "Read the project README", "reversible changes"
- Blue: "Prefer cool color tones", "Violet inherits all blue conventions"

### Must NOT appear (sibling, not ancestor)

- Red: "Prefer warm color tones", "Rose inherits all red conventions"

---

## Eval 3 — root-level-only

Target: `deno.json` Scope: root only

### Must appear

- Root: at least one repo-level instruction

### Must NOT appear

- Project: "Read README", "reversible changes", "generated artifacts"
- Red: any red-level instructions
- Blue: any blue-level instructions
