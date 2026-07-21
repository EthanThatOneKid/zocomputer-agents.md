/**
 * Grade a single eval run by checking assertions against the agent's response.
 *
 * Usage: deno run --allow-read scripts/grade.ts \
 *   --treatment <path/to/treatment/response.md> \
 *   --control <path/to/control/response.md> \
 *   --assertions '["phrase 1","phrase 2"]' \
 *   --out <path/to/grading.json>
 */

interface Assertion {
  text: string;
  passed: boolean;
  evidence: string;
}

interface GradingResult {
  configuration: "with_skill" | "without_skill";
  expectations: Assertion[];
  summary: {
    passed: number;
    failed: number;
    total: number;
    pass_rate: number;
  };
  file_reads_detected: boolean;
}

async function readTranscript(path: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return "";
  }
}

function gradeAssertions(
  transcript: string,
  assertions: string[],
): Assertion[] {
  const lowerTranscript = transcript.toLowerCase();
  return assertions.map((text) => {
    const keywords = text.replace(/^Agent (mentions|does NOT mention) /i, "")
      .replace(/^Treatment pass /i, "");
    const searchTerms = extractSearchTerms(keywords);
    const found = searchTerms.some((term) =>
      lowerTranscript.includes(term.toLowerCase())
    );

    const isNegative = text.toLowerCase().includes("does not mention") ||
      text.toLowerCase().includes("does not read");

    const passed = isNegative ? !found : found;
    const evidence = found
      ? `Found match for: ${
        searchTerms.filter((t) => lowerTranscript.includes(t.toLowerCase()))
          .join(", ")
      }`
      : "No match found in transcript";

    return { text, passed, evidence };
  });
}

function extractSearchTerms(phrase: string): string[] {
  const quoted = phrase.match(/'([^']+)'/g);
  if (quoted) {
    return quoted.map((q) => q.slice(1, -1));
  }
  const words = phrase.split(/\s+/).filter((w) => w.length > 4);
  return words.length > 0 ? [words.join(" ")] : [phrase];
}

function detectFileReads(transcript: string): boolean {
  const patterns = [
    /read.*AGENTS\.md/i,
    /open.*AGENTS\.md/i,
    /Read.*AGENTS\.md/i,
    /read_file.*agents/i,
  ];
  return patterns.some((p) => p.test(transcript));
}

async function main() {
  const args = Deno.args;
  const treatmentIdx = args.indexOf("--treatment");
  const controlIdx = args.indexOf("--control");
  const assertionsIdx = args.indexOf("--assertions");
  const outIdx = args.indexOf("--out");

  if (
    treatmentIdx === -1 || controlIdx === -1 || assertionsIdx === -1 ||
    outIdx === -1
  ) {
    console.error(
      "Usage: deno run --allow-read scripts/grade.ts --treatment <path> --control <path> --assertions '<json>' --out <path>",
    );
    Deno.exit(1);
  }

  const treatmentPath = args[treatmentIdx + 1];
  const controlPath = args[controlIdx + 1];
  const assertions: string[] = JSON.parse(args[assertionsIdx + 1]);
  const outPath = args[outIdx + 1];

  const treatmentTranscript = await readTranscript(treatmentPath);
  const controlTranscript = await readTranscript(controlPath);

  const treatmentResults: GradingResult = {
    configuration: "with_skill",
    expectations: gradeAssertions(treatmentTranscript, assertions),
    summary: { passed: 0, failed: 0, total: assertions.length, pass_rate: 0 },
    file_reads_detected: detectFileReads(treatmentTranscript),
  };
  treatmentResults.summary.passed =
    treatmentResults.expectations.filter((a) => a.passed).length;
  treatmentResults.summary.failed = treatmentResults.summary.total -
    treatmentResults.summary.passed;
  treatmentResults.summary.pass_rate = treatmentResults.summary.total > 0
    ? treatmentResults.summary.passed / treatmentResults.summary.total
    : 0;

  const controlResults: GradingResult = {
    configuration: "without_skill",
    expectations: gradeAssertions(controlTranscript, assertions),
    summary: { passed: 0, failed: 0, total: assertions.length, pass_rate: 0 },
    file_reads_detected: detectFileReads(controlTranscript),
  };
  controlResults.summary.passed =
    controlResults.expectations.filter((a) => a.passed).length;
  controlResults.summary.failed = controlResults.summary.total -
    controlResults.summary.passed;
  controlResults.summary.pass_rate = controlResults.summary.total > 0
    ? controlResults.summary.passed / controlResults.summary.total
    : 0;

  const output = {
    configurations: [treatmentResults, controlResults],
    delta: {
      pass_rate: (treatmentResults.summary.pass_rate -
        controlResults.summary.pass_rate).toFixed(2),
      treatment_reads_agents: treatmentResults.file_reads_detected,
      control_reads_agents: controlResults.file_reads_detected,
    },
  };

  await Deno.writeTextFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Grading written to ${outPath}`);
  console.log(
    `Treatment: ${treatmentResults.summary.passed}/${treatmentResults.summary.total} (${treatmentResults.summary.pass_rate}) reads_agents=${treatmentResults.file_reads_detected}`,
  );
  console.log(
    `Control:   ${controlResults.summary.passed}/${controlResults.summary.total} (${controlResults.summary.pass_rate}) reads_agents=${controlResults.file_reads_detected}`,
  );
}

main();
