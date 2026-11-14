/**
 * `scripts/generate-snapshots.ts` — seeds the golden grammar fixtures (22.3.6).
 *
 * Serializes the pure generators (22.3.1–22.3.4) to
 * `tests/grammar/fixtures/*.golden.json` with the exact same formatting as
 * `generate-grammar.ts`, so the snapshot test compares byte-for-byte. Run after
 * an intentional generator change with `deno task generate:snapshots`; the
 * snapshot test then guards against accidental drift.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.6
 */

import { generateGrammar, } from "../src/grammar/textmate.ts";
import { generateTjiGrammar, } from "../src/grammar/tji.ts";
import { generateLanguageConfiguration, } from "../src/grammar/language-config.ts";
import { SNIPPETS, } from "../src/grammar/snippets.ts";

/** Package root (this script lives in `scripts/`). */
const ROOT = new URL("..", import.meta.url,);

/** Serializes a value exactly like `generate-grammar.ts` (2-space + newline). */
function json(value: unknown,): string {
  return JSON.stringify(value, null, 2,) + "\n";
}

/** The four golden fixtures, keyed by file name. */
const FIXTURES: { name: string; value: unknown }[] = [
  { name: "textmate.golden.json", value: generateGrammar(), },
  { name: "tji.golden.json", value: generateTjiGrammar(), },
  {
    name: "language-config.golden.json",
    value: generateLanguageConfiguration(),
  },
  { name: "snippets.golden.json", value: SNIPPETS, },
];

const dir = new URL("tests/grammar/fixtures/", ROOT,);
await Deno.mkdir(dir, { recursive: true, },);
for (const fixture of FIXTURES) {
  await Deno.writeTextFile(new URL(fixture.name, dir,), json(fixture.value,),);
  console.log(`wrote tests/grammar/fixtures/${fixture.name}`,);
}
