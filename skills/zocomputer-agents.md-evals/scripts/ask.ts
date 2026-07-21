/**
 * Call the Zo Ask API with a structured output_format.
 *
 * Usage:
 *   ZO_API_KEY=... deno run --env --allow-net --allow-read --allow-write \
 *     scripts/ask.ts \
 *     --eval-id 1 \
 *     --config evals/evals.json \
 *     --out <output-path>/response.json
 *
 * Reads the eval prompt and output_format from evals.json,
 * posts to https://api.zo.computer/zo/ask, saves the response.
 */

const API_URL = "https://api.zo.computer/zo/ask";
const MODEL_NAME = "zo:openai/gpt-5.6-luna";

interface EvalCase {
  id: number;
  eval_name: string;
  prompt: string;
  output_format?: Record<string, unknown>;
  assertions: string[];
}

function parseArgs(args: string[]): {
  evalId: number;
  configPath: string;
  outPath: string;
} {
  const evalIdIdx = args.indexOf("--eval-id");
  const configIdx = args.indexOf("--config");
  const outIdx = args.indexOf("--out");

  if (evalIdIdx === -1 || configIdx === -1 || outIdx === -1) {
    console.error(
      "Usage: deno run --env --allow-net --allow-read --allow-write scripts/ask.ts --eval-id <n> --config <path> --out <path>",
    );
    Deno.exit(1);
  }

  return {
    evalId: parseInt(args[evalIdIdx + 1]),
    configPath: args[configIdx + 1],
    outPath: args[outIdx + 1],
  };
}

async function main() {
  const { evalId, configPath, outPath } = parseArgs(Deno.args);
  const apiKey = Deno.env.get("ZO_API_KEY");

  if (!apiKey) {
    console.error("ZO_API_KEY environment variable is required.");
    console.error("  $env:ZO_API_KEY = 'zo_sk_...'");
    console.error("  deno run --env --allow-net ...");
    Deno.exit(1);
  }

  const configText = await Deno.readTextFile(configPath);
  const config = JSON.parse(configText);
  const evalCase = (config.evals as EvalCase[]).find((e) => e.id === evalId);

  if (!evalCase) {
    console.error(`Eval ${evalId} not found in ${configPath}`);
    Deno.exit(1);
  }

  const outputFormat = evalCase.output_format ?? {
    type: "object",
    properties: {
      instructions_referenced: {
        type: "array",
        items: {
          type: "object",
          properties: {
            instruction: { type: "string" },
            source: { type: "string" },
          },
          required: ["instruction", "source"],
        },
      },
    },
    required: ["instructions_referenced"],
  };

  console.log(`Asking Zo (eval ${evalId}: ${evalCase.eval_name})...`);
  const startMs = Date.now();

  const body = JSON.stringify({
    input: evalCase.prompt,
    model_name: MODEL_NAME,
    output_format: outputFormat,
    conversation_id: null,
    stream: false,
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const durationMs = Date.now() - startMs;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `API error ${response.status}: ${errorText.slice(0, 500)}`,
    );
    Deno.exit(1);
  }

  const data = await response.json();
  const conversationId = response.headers.get("x-conversation-id") ??
    data.conversation_id;

  const result = {
    eval_id: evalId,
    eval_name: evalCase.eval_name,
    prompt: evalCase.prompt,
    output: data.output,
    conversation_id: conversationId,
    duration_ms: durationMs,
    duration_seconds: (durationMs / 1000).toFixed(1),
    model: MODEL_NAME,
  };

  await Deno.writeTextFile(outPath, JSON.stringify(result, null, 2));
  console.log(`  OK (${durationMs}ms) → ${outPath}`);
  console.log(`  conv_id: ${conversationId}`);

  // Also save a timing.json sibling
  const timingPath = outPath.replace(/response\.json$/, "timing.json");
  await Deno.writeTextFile(
    timingPath,
    JSON.stringify(
      {
        total_tokens: 0,
        duration_ms: durationMs,
        total_duration_seconds: (durationMs / 1000).toFixed(1),
      },
      null,
      2,
    ),
  );
}

main();
