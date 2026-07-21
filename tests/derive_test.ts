import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { derive } from "../src/derive.ts";

const root = new URL("../", import.meta.url).pathname;

Deno.test("derives AGENTS.md from broad to narrow scope", async () => {
  const result = await derive(
    root,
    "examples/demo-project/alpha/entry.md",
  );

  assertEquals(result.target, "examples/demo-project/alpha/entry.md");
  assertEquals(result.targetExists, true);
  assertEquals(result.sources.map((source) => source.path), [
    "AGENTS.md",
    "examples/demo-project/AGENTS.md",
    "examples/demo-project/alpha/AGENTS.md",
  ]);
  assertStringIncludes(result.context, "Be concise.");
  assertStringIncludes(result.context, "Use past tense in all output.");
  assertEquals(result.diagnostics, []);
});

Deno.test("excludes sibling AGENTS.md from non-ancestor directories", async () => {
  const result = await derive(
    root,
    "examples/demo-project/alpha/entry.md",
  );

  assertEquals(result.sources.length, 3);
  const paths = result.sources.map((s) => s.path);
  assertEquals(
    paths.includes("examples/demo-project/beta/AGENTS.md"),
    false,
  );
  assertEquals(result.context.includes("future tense"), false);
});

Deno.test("reports a missing target without inventing sources", async () => {
  const result = await derive(
    root,
    "examples/demo-project/alpha/missing.md",
  );

  assertEquals(result.targetExists, false);
  assertEquals(result.sources, []);
  assertEquals(result.diagnostics, [
    "Target does not exist: examples/demo-project/alpha/missing.md",
    "No applicable AGENTS.md files found.",
  ]);
});
