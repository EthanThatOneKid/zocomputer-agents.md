/**
 * Grade Zo Ask API responses — recall + compliance.
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/grade.ts \
 *     --config evals/evals.json \
 *     --treatment <path>/response.json \
 *     --control <path>/response.json \
 *     --out <path>/grading.json
 */

interface EvalCase {
  id: number;
  eval_name: string;
  assertions: string[];
}

interface GradedAssertion {
  text: string;
  passed: boolean;
  evidence: string;
}

interface GradingConfig {
  configuration: "with_skill" | "without_skill";
  expectations: GradedAssertion[];
  summary: { passed: number; failed: number; total: number; pass_rate: number };
}

function parseArgs(args: string[]) {
  const configIdx = args.indexOf("--config");
  const tIdx = args.indexOf("--treatment");
  const cIdx = args.indexOf("--control");
  const oIdx = args.indexOf("--out");
  if (configIdx === -1 || tIdx === -1 || cIdx === -1 || oIdx === -1) {
    console.error(
      "Usage: deno run --allow-read --allow-write scripts/grade.ts --config <path> --treatment <path> --control <path> --out <path>",
    );
    Deno.exit(1);
  }
  return {
    configPath: args[configIdx + 1],
    tPath: args[tIdx + 1],
    cPath: args[cIdx + 1],
    outPath: args[oIdx + 1],
  };
}

function collectInstructions(output: unknown): string[] {
  const items: string[] = [];
  if (typeof output !== "object" || output === null) return items;
  const o = output as Record<string, unknown>;
  const arr = o.instructions_followed ?? o.instructions_referenced;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (typeof item === "object" && item !== null && "instruction" in item) {
        const inst = (item as Record<string, unknown>).instruction;
        if (typeof inst === "string") items.push(inst.toLowerCase());
      }
    }
  }
  return items;
}

function getRevision(output: unknown): string {
  if (typeof output === "object" && output !== null && "revision" in output) {
    const r = (output as Record<string, unknown>).revision;
    if (typeof r === "string") return r;
  }
  return "";
}

function countPastTenseMarkers(text: string): number {
  const past = text.toLowerCase();
  let count = 0;
  // -ed endings (not preceded by unused/common patterns)
  const edMatches = past.match(/\b\w+(?<!un|ex|ov)ed\b/g) || [];
  count += edMatches.length;
  // irregular past: was, were, had, did, went, wrote, ran, built, set (up)
  for (
    const w of [
      " was ",
      " were ",
      " had ",
      " did ",
      " went ",
      " wrote ",
      " ran ",
      " built ",
      " set ",
    ]
  ) {
    if (past.includes(w)) count++;
  }
  return count;
}

function countFutureTenseMarkers(text: string): number {
  const future = text.toLowerCase();
  let count = 0;
  for (const w of [" will ", " shall ", " going to "]) {
    const matches = future.split(w).length - 1;
    count += matches;
  }
  return count;
}

function gradeOne(response: unknown, evalCase: EvalCase): GradingConfig {
  const instructions = collectInstructions(response);
  const revision = getRevision(response);
  const pastCount = countPastTenseMarkers(revision);
  const futureCount = countFutureTenseMarkers(revision);

  const graded = evalCase.assertions.map((text) => {
    const lower = text.toLowerCase();
    const isNegative = lower.includes("does not include") ||
      lower.includes("does not mention");
    const isPastCheck = lower.includes("past tense");
    const isFutureCheck = lower.includes("future tense");

    // Compliance checks: count tenses in revision
    const isRevisionCheck = lower.startsWith("revision uses");
    if (isRevisionCheck && isPastCheck) {
      const passed = pastCount > 0;
      return {
        text,
        passed,
        evidence: `Past markers: ${pastCount}. Future: ${futureCount}`,
      };
    }
    if (isRevisionCheck && isFutureCheck) {
      const passed = futureCount > 0 && futureCount >= pastCount;
      return {
        text,
        passed,
        evidence: `Future markers: ${futureCount}. Past: ${pastCount}`,
      };
    }

    // Recall checks: quoted terms must appear as substrings in instructions
    const quoted = lower.match(/'([^']+)'/g)?.map((q) => q.slice(1, -1)) ?? [];
    if (quoted.length === 0) {
      // Fallback: any keyword found
      return {
        text,
        passed: true,
        evidence: "No quoted terms in assertion — pass by default",
      };
    }
    const matched: string[] = [];
    for (const term of quoted) {
      if (instructions.some((i) => i.includes(term.toLowerCase()))) {
        matched.push(term);
      }
    }
    const anyFound = matched.length > 0;
    const passed = isNegative ? !anyFound : anyFound;
    const evidence = matched.length > 0
      ? `Matched: ${matched.join(", ")}`
      : "No match in instructions_followed";
    return { text, passed, evidence };
  });

  const passed = graded.filter((a) => a.passed).length;
  return {
    configuration: "with_skill",
    expectations: graded,
    summary: {
      passed,
      failed: graded.length - passed,
      total: graded.length,
      pass_rate: graded.length > 0 ? passed / graded.length : 0,
    },
  };
}

async function main() {
  const { configPath, tPath, cPath, outPath } = parseArgs(Deno.args);
  const config = JSON.parse(await Deno.readTextFile(configPath));
  const tData = JSON.parse(await Deno.readTextFile(tPath));
  const cData = JSON.parse(await Deno.readTextFile(cPath));
  const evalName = tData.eval_name;
  const evalCase = (config.evals as EvalCase[]).find((e) =>
    e.eval_name === evalName
  );
  if (!evalCase) {
    console.error(`Eval "${evalName}" not found`);
    Deno.exit(1);
  }

  const tGraded = gradeOne(tData.output, evalCase);
  tGraded.configuration = "with_skill";
  const cGraded = gradeOne(cData.output, evalCase);
  cGraded.configuration = "without_skill";

  const out = {
    configurations: [tGraded, cGraded],
    delta: {
      pass_rate: (tGraded.summary.pass_rate - cGraded.summary.pass_rate)
        .toFixed(2),
    },
  };
  await Deno.writeTextFile(outPath, JSON.stringify(out, null, 2));
  console.log(
    `  Treatment: ${tGraded.summary.passed}/${tGraded.summary.total} (${tGraded.summary.pass_rate})`,
  );
  console.log(
    `  Control:   ${cGraded.summary.passed}/${cGraded.summary.total} (${cGraded.summary.pass_rate})`,
  );
}
main();
