/**
 * Parse structured Zo Ask API responses and grade per assertion.
 *
 * Usage:
 *   deno run --allow-read --allow-write scripts/grade.ts \
 *     --config evals/evals.json \
 *     --treatment <workspace>/eval-N/with_skill/outputs/response.json \
 *     --control <workspace>/eval-N/without_skill/outputs/response.json \
 *     --out <workspace>/eval-N/grading.json
 */

interface EvalCase {
  id: number;
  eval_name: string;
  assertions: string[];
}

interface ApiResponse {
  output: {
    instructions_referenced?: Array<{
      instruction: string;
      source: string;
    }>;
    [key: string]: unknown;
  };
}

interface GradedAssertion {
  text: string;
  passed: boolean;
  evidence: string;
}

interface GradingConfig {
  configuration: "with_skill" | "without_skill";
  expectations: GradedAssertion[];
  summary: {
    passed: number;
    failed: number;
    total: number;
    pass_rate: number;
  };
}

function parseArgs(args: string[]) {
  const configIdx = args.indexOf("--config");
  const treatmentIdx = args.indexOf("--treatment");
  const controlIdx = args.indexOf("--control");
  const outIdx = args.indexOf("--out");

  if (
    configIdx === -1 || treatmentIdx === -1 || controlIdx === -1 ||
    outIdx === -1
  ) {
    console.error(
      "Usage: deno run --allow-read --allow-write scripts/grade.ts --config <path> --treatment <path> --control <path> --out <path>",
    );
    Deno.exit(1);
  }

  return {
    configPath: args[configIdx + 1],
    treatmentPath: args[treatmentIdx + 1],
    controlPath: args[controlIdx + 1],
    outPath: args[outIdx + 1],
  };
}

function findAllInstructions(output: ApiResponse["output"]): string[] {
  const instructions: string[] = [];
  if (Array.isArray(output?.instructions_referenced)) {
    for (const item of output.instructions_referenced) {
      if (item.instruction) {
        instructions.push(item.instruction.toLowerCase());
      }
    }
  }
  // Also check top-level keys for alternative output structures
  if (typeof output === "object" && output !== null) {
    for (const [key, value] of Object.entries(output)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (
            typeof item === "object" && item !== null && "instruction" in item
          ) {
            const inst = (item as Record<string, unknown>).instruction;
            if (typeof inst === "string") {
              instructions.push(inst.toLowerCase());
            }
          }
        }
      }
    }
  }
  return instructions;
}

function gradeAssertions(
  instructions: string[],
  assertionTexts: string[],
): GradedAssertion[] {
  return assertionTexts.map((text) => {
    const lowerText = text.toLowerCase();
    const isNegative = lowerText.includes("does not mention") ||
      lowerText.includes("does not read");

    // Extract key phrases from assertion
    const quoted = lowerText.match(/'([^']+)'/g);
    const searchTerms = quoted
      ? quoted.map((q) => q.slice(1, -1))
      : lowerText.replace(/^agent (mentions|does not mention) /i, "")
        .replace(/treatment pass /i, "")
        .split(/\s+/)
        .filter((w) => w.length > 4);

    const found = searchTerms.some((term) =>
      instructions.some((inst) => inst.includes(term)) ||
      lowerText.includes(term)
    );

    const passed = isNegative ? !found : found;
    const evidence = found
      ? `Found instruction matching: ${
        searchTerms.filter((t) => instructions.some((i) => i.includes(t))).join(
          ", ",
        )
      }`
      : "No matching instruction found in response";

    return { text, passed, evidence };
  });
}

async function main() {
  const { configPath, treatmentPath, controlPath, outPath } = parseArgs(
    Deno.args,
  );

  const configText = await Deno.readTextFile(configPath);
  const config = JSON.parse(configText);

  let treatmentData: ApiResponse;
  let controlData: ApiResponse;
  try {
    treatmentData = JSON.parse(await Deno.readTextFile(treatmentPath));
    controlData = JSON.parse(await Deno.readTextFile(controlPath));
  } catch (error) {
    console.error("Failed to read response files:", error);
    Deno.exit(1);
  }

  // Find the eval case by matching eval_name from the response
  const evalName = treatmentData.eval_name;
  const evalCase = (config.evals as EvalCase[]).find((e) =>
    e.eval_name === evalName
  );
  if (!evalCase) {
    console.error(`Eval "${evalName}" not found in config`);
    Deno.exit(1);
  }

  const treatmentInstructions = findAllInstructions(treatmentData.output);
  const controlInstructions = findAllInstructions(controlData.output);

  const treatmentGraded: GradingConfig = {
    configuration: "with_skill",
    expectations: gradeAssertions(
      treatmentInstructions,
      evalCase.assertions,
    ),
    summary: {
      passed: 0,
      failed: 0,
      total: evalCase.assertions.length,
      pass_rate: 0,
    },
  };
  treatmentGraded.summary.passed =
    treatmentGraded.expectations.filter((a) => a.passed).length;
  treatmentGraded.summary.failed = treatmentGraded.summary.total -
    treatmentGraded.summary.passed;
  treatmentGraded.summary.pass_rate = treatmentGraded.summary.total > 0
    ? treatmentGraded.summary.passed / treatmentGraded.summary.total
    : 0;

  const controlGraded: GradingConfig = {
    configuration: "without_skill",
    expectations: gradeAssertions(controlInstructions, evalCase.assertions),
    summary: {
      passed: 0,
      failed: 0,
      total: evalCase.assertions.length,
      pass_rate: 0,
    },
  };
  controlGraded.summary.passed =
    controlGraded.expectations.filter((a) => a.passed).length;
  controlGraded.summary.failed = controlGraded.summary.total -
    controlGraded.summary.passed;
  controlGraded.summary.pass_rate = controlGraded.summary.total > 0
    ? controlGraded.summary.passed / controlGraded.summary.total
    : 0;

  const output = {
    configurations: [treatmentGraded, controlGraded],
    delta: {
      pass_rate: (treatmentGraded.summary.pass_rate -
        controlGraded.summary.pass_rate).toFixed(2),
    },
    treatment_instructions: treatmentInstructions,
    control_instructions: controlInstructions,
  };

  await Deno.writeTextFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Grading written to ${outPath}`);
  console.log(
    `  Treatment: ${treatmentGraded.summary.passed}/${treatmentGraded.summary.total} (${treatmentGraded.summary.pass_rate})`,
  );
  console.log(
    `  Control:   ${controlGraded.summary.passed}/${controlGraded.summary.total} (${controlGraded.summary.pass_rate})`,
  );
}

main();
