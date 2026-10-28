#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Regenerates `attributes.golden.json` from the Ruby golden script.
 *
 * Usage: deno task golden:generate
 *
 * Requires: `tj3` (TaskJuggler Ruby) on PATH.
 */

const scripts: Array<{ name: string; rubyScript: URL; outputPath: URL }> = [
  {
    name: "attributes",
    rubyScript: new URL(
      "../../../../scripts/golden/attributes.rb",
      import.meta.url,
    ),
    outputPath: new URL("./attributes.golden.json", import.meta.url,),
  },
  {
    name: "attribute-definitions",
    rubyScript: new URL(
      "../../../../scripts/golden/attribute-definitions.rb",
      import.meta.url,
    ),
    outputPath: new URL(
      "./attribute-definitions.golden.json",
      import.meta.url,
    ),
  },
  {
    name: "limits",
    rubyScript: new URL(
      "../../../../scripts/golden/limits.rb",
      import.meta.url,
    ),
    outputPath: new URL("./limits.golden.json", import.meta.url,),
  },
  {
    name: "shift-assignments",
    rubyScript: new URL(
      "../../../../scripts/golden/shift-assignments.rb",
      import.meta.url,
    ),
    outputPath: new URL("./shift-assignments.golden.json", import.meta.url,),
  },
  {
    name: "finance-mwe004",
    rubyScript: new URL(
      "../../../../scripts/golden/finance-mwe004.rb",
      import.meta.url,
    ),
    outputPath: new URL("./finance-mwe004.golden.json", import.meta.url,),
  },
  {
    name: "finance-variations",
    rubyScript: new URL(
      "../../../../scripts/golden/finance-variations.rb",
      import.meta.url,
    ),
    outputPath: new URL("./finance-variations.golden.json", import.meta.url,),
  },
  {
    name: "logical-expressions",
    rubyScript: new URL(
      "../../../../scripts/golden/logical-expressions.rb",
      import.meta.url,
    ),
    outputPath: new URL(
      "./logical-expressions.golden.json",
      import.meta.url,
    ),
  },
];

for (const { name, rubyScript, outputPath, } of scripts) {
  const proc = new Deno.Command("ruby", {
    args: [rubyScript.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);

  const result = proc.outputSync();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr,);
    console.error(`Ruby script ${name} failed:\n${stderr}`,);
    Deno.exit(1,);
  }

  let stdout = new TextDecoder().decode(result.stdout,);

  // Normalize Ruby proc memory addresses to a stable placeholder.
  // The address is non-deterministic between runs; the path and line number
  // are preserved because the rehydration regex extracts the line number.
  stdout = stdout.replace(
    /#<Proc:(0x[0-9a-f]+) (.+\/scripts\/golden\/\w+\.rb:\d+ \(lambda\))>/g,
    "#<Proc:0x000000000000 $2>",
  );

  // Extract the last JSON object from stdout. Ruby scripts may emit
  // informational `puts` messages before the JSON output; we grab the
  // trailing JSON object so the parser doesn't choke on log lines.
  const jsonMatch = stdout.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${name} has no JSON object:\n${stdout}`,);
    Deno.exit(1,);
  }
  stdout = jsonMatch[0];

  // Validate JSON before writing
  try {
    JSON.parse(stdout,);
  } catch (e) {
    console.error(`Ruby output ${name} is not valid JSON:`, e,);
    console.error(`Raw output:\n${stdout}`,);
    Deno.exit(1,);
  }

  await Deno.writeTextFile(outputPath, stdout + "\n",);
  console.log(`Generated ${outputPath.pathname}`,);
}

// ---------------------------------------------------------------------------
// Parser golden (10.19): 9 scripts de MWE (tj3 --check-syntax) + Correct +
// Errors (API Ruby MessageChecker-style), mesclados em parser.golden.json.
// ---------------------------------------------------------------------------

const parserScripts = [
  ...Array.from(
    { length: 9, },
    (_, i,) => `parser-mwe${String(i + 1,).padStart(3, "0",)}.rb`,
  ),
  "parser-syntax-correct.rb",
  "parser-syntax-errors.rb",
];

type ParserCase = {
  file: string;
  ok: boolean;
  messages: unknown[];
};

const parserCases: ParserCase[] = [];
for (const script of parserScripts) {
  const url = new URL(`../../../../scripts/golden/${script}`, import.meta.url,);
  const proc = new Deno.Command("ruby", {
    args: [url.pathname,],
    stdout: "piped",
    stderr: "piped",
  },);
  const result = proc.outputSync();
  if (!result.success) {
    console.error(
      `Ruby script ${script} failed:\n` +
        new TextDecoder().decode(result.stderr,),
    );
    Deno.exit(1,);
  }
  const text = new TextDecoder().decode(result.stdout,);
  const jsonMatch = text.match(/\{[\s\S]*\}/,);
  if (!jsonMatch) {
    console.error(`Ruby output ${script} has no JSON object:\n${text}`,);
    Deno.exit(1,);
  }
  const parsed = JSON.parse(jsonMatch[0],) as {
    cases?: ParserCase[];
    file?: string;
  };
  if (parsed.cases) {
    parserCases.push(...parsed.cases,);
  } else {
    parserCases.push(parsed as ParserCase,);
  }
}

const parserOut = new URL("./parser.golden.json", import.meta.url,);
await Deno.writeTextFile(
  parserOut,
  JSON.stringify({ cases: parserCases, }, null, 2,) + "\n",
);
console.log(
  `Generated ${parserOut.pathname} (${parserCases.length} cases)`,
);
