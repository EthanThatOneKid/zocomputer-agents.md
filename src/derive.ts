import { relative, resolve } from "jsr:@std/path@1";

export interface SourceInstruction {
  path: string;
  scope: string;
  lines: Array<{ number: number; text: string }>;
}

export interface DerivedContext {
  target: string;
  targetExists: boolean;
  sources: SourceInstruction[];
  diagnostics: string[];
  context: string;
}

const AGENTS_FILENAME = "AGENTS.md";

function displayPath(root: string, path: string): string {
  const value = relative(root, path);
  return value === "" ? "." : value;
}

function lineNumbered(
  content: string,
): Array<{ number: number; text: string }> {
  return content.split(/\r?\n/).map((text, index) => ({
    number: index + 1,
    text,
  }));
}

async function readSource(
  root: string,
  directory: string,
): Promise<SourceInstruction | undefined> {
  const path = resolve(directory, AGENTS_FILENAME);
  try {
    const content = await Deno.readTextFile(path);
    return {
      path: displayPath(root, path),
      scope: displayPath(root, directory),
      lines: lineNumbered(content),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

function relevantDirectories(root: string, target: string): string[] {
  const targetDirectory = Deno.statSync(target).isDirectory
    ? target
    : resolve(target, "..");
  const directories: string[] = [];
  let current = targetDirectory;

  while (true) {
    directories.unshift(current);
    if (current === root) break;
    const parent = resolve(current, "..");
    if (parent === current || !current.startsWith(`${root}/`)) break;
    current = parent;
  }

  return directories;
}

function renderContext(sources: SourceInstruction[]): string {
  return sources
    .map((source) => {
      const body = source.lines.map(({ number, text }) => `${number}: ${text}`)
        .join("\n");
      return `# ${source.path} (scope: ${source.scope})\n${body}`;
    })
    .join("\n\n");
}

export async function derive(
  rootInput: string,
  targetInput: string,
): Promise<DerivedContext> {
  const root = resolve(rootInput);
  const target = resolve(root, targetInput);
  const diagnostics: string[] = [];
  let targetExists = true;

  try {
    await Deno.stat(target);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      targetExists = false;
      diagnostics.push(`Target does not exist: ${displayPath(root, target)}`);
    } else {
      throw error;
    }
  }

  const sources: SourceInstruction[] = [];
  if (targetExists) {
    for (const directory of relevantDirectories(root, target)) {
      const source = await readSource(root, directory);
      if (source) sources.push(source);
    }
  }

  if (sources.length === 0) {
    diagnostics.push("No applicable AGENTS.md files found.");
  }

  return {
    target: displayPath(root, target),
    targetExists,
    sources,
    diagnostics,
    context: renderContext(sources),
  };
}

if (import.meta.main) {
  const [targetInput, rootInput = "."] = Deno.args;
  if (!targetInput) {
    console.error(
      "Usage: deno run --allow-read src/derive.ts <target-path> [root-path]",
    );
    Deno.exit(1);
  }

  const result = await derive(rootInput, targetInput);
  console.log(JSON.stringify(result, null, 2));
  if (
    result.diagnostics.some((diagnostic) =>
      diagnostic.startsWith("Target does not exist")
    )
  ) {
    Deno.exit(1);
  }
}
