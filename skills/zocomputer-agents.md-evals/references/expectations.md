# Expected instruction recall per test case

## Eval 1 — alpha-past-tense

Target: `examples/demo-project/alpha/entry.md` Scope: root → project → alpha

### Must appear (ancestor chain)

- Root: "design proposal", "deterministic resolver", "derived context"
- Project: "Be concise", "Avoid redundant phrasing", "reversible changes"
- Alpha: "Use past tense in all output"

### Must NOT appear (sibling)

- Beta: "Use future tense in all output"

### Behavioral (compliance)

- `revision` text must use past tense, not future tense

---

## Eval 2 — beta-future-tense

Target: `examples/demo-project/beta/entry.md` Scope: root → project → beta

### Must appear (ancestor chain)

- Root: "design proposal", "deterministic", "source-linked"
- Project: "Be concise", "reversible changes"
- Beta: "Use future tense in all output"

### Must NOT appear (sibling)

- Alpha: "Use past tense in all output"

### Behavioral (compliance)

- `revision` text must use future tense, not past tense

---

## Eval 3 — root-conciseness

Target: `deno.json` Scope: root only

### Must appear

- Root: at least one repo-level instruction

### Must NOT appear

- Project / Alpha / Beta: no directory-specific rules
