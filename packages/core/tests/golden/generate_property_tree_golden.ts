#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Regenerates `property-tree.golden.json` from the Ruby golden script.
 *
 * Usage: deno task golden:generate:property-tree
 *
 * Requires: `ruby` on PATH.
 */

const rubyScript = new URL(
  "../../../../scripts/golden/property-tree.rb",
  import.meta.url,
);
const outputPath = new URL("./property-tree.golden.json", import.meta.url,);

const proc = new Deno.Command("ruby", {
  args: [rubyScript.pathname,],
  stdout: "piped",
  stderr: "piped",
},);

const result = proc.outputSync();

if (!result.success) {
  const stderr = new TextDecoder().decode(result.stderr,);
  console.error(`Ruby script failed:\n${stderr}`,);
  Deno.exit(1,);
}

const stdout = new TextDecoder().decode(result.stdout,);

// Validar e re-serializar no estilo do `deno fmt` (JSON.stringify indent 2):
// o `JSON.pretty_generate` do Ruby formata arrays vazias em várias linhas.
let parsed: unknown;
try {
  parsed = JSON.parse(stdout,);
} catch (e) {
  console.error("Ruby output is not valid JSON:", e,);
  Deno.exit(1,);
}

await Deno.writeTextFile(
  outputPath,
  JSON.stringify(parsed, null, 2,) + "\n",
);
console.log(`Generated ${outputPath.pathname}`,);
