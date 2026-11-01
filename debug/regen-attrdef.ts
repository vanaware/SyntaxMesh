#!/usr/bin/env deno run --allow-read --allow-write --allow-run
/**
 * Regenera APENAS attribute-definitions.golden.json (mesmo pipeline de
 * `generate_golden.ts`: ruby → extrai JSON → JSON.stringify(_, null, 2) + \n).
 * Uso: deno run --allow-read --allow-write --allow-run debug/regen-attrdef.ts
 */
const rubyScript = new URL(
  "../scripts/golden/attribute-definitions.rb",
  import.meta.url,
);
const out = new URL(
  "../packages/core/tests/golden/attribute-definitions.golden.json",
  import.meta.url,
);
const proc = new Deno.Command("ruby", {
  args: [rubyScript.pathname,],
  stdout: "piped",
  stderr: "piped",
},);
const result = proc.outputSync();
if (!result.success) {
  console.error(new TextDecoder().decode(result.stderr,));
  Deno.exit(1,);
}
const text = new TextDecoder().decode(result.stdout,);
const m = text.match(/\{[\s\S]*\}/,);
if (!m) {
  console.error("sem JSON na saída do ruby:\n" + text,);
  Deno.exit(1,);
}
const parsed = JSON.parse(m[0],);
await Deno.writeTextFile(out, JSON.stringify(parsed, null, 2,) + "\n",);
console.log(`Generated ${out.pathname} (${parsed.cases.length} cases)`,);
