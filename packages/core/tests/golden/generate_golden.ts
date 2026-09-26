#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Regenerates `attributes.golden.json` from the Ruby golden script.
 *
 * Usage: deno task golden:generate
 *
 * Requires: `tj3` (TaskJuggler Ruby) on PATH.
 */

const rubyScript = new URL(
  "../../../../scripts/golden/attributes.rb",
  import.meta.url,
);
const outputPath = new URL("./attributes.golden.json", import.meta.url,);

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

// Validate JSON before writing
try {
  JSON.parse(stdout,);
} catch (e) {
  console.error("Ruby output is not valid JSON:", e,);
  Deno.exit(1,);
}

await Deno.writeTextFile(outputPath, stdout + "\n",);
console.log(`Generated ${outputPath.pathname}`,);
