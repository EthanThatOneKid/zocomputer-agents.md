import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { derive } from "../src/derive.ts";

const root = new URL("../", import.meta.url).pathname;

Deno.test("derives AGENTS.md from broad to narrow scope", async () => {
  const result = await derive(root, "examples/demo-project/wiki/importer.ts");

  assertEquals(result.target, "wiki/importer.ts");
  assertEquals(result.targetExists, true);
  assertEquals(result.sources.map((source) => source.path), [
    "AGENTS.md",
    "wiki/AGENTS.md",
  ]);
  assertStringIncludes(
    result.context,
    "Read the project README before editing.",
  );
  assertStringIncludes(result.context, "Use `wiki query`");
  assertEquals(result.diagnostics, []);
});

Deno.test("reports a missing target without inventing sources", async () => {
  const result = await derive(root, "examples/demo-project/wiki/missing.ts");

  assertEquals(result.targetExists, false);
  assertEquals(result.sources, []);
  assertEquals(result.diagnostics, [
    "Target does not exist: examples/demo-project/wiki/missing.ts",
    "No applicable AGENTS.md files found.",
  ]);
});
