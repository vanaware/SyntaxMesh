/**
 * `scripts/generate-grammar.ts` — writes the language assets (22.3.5).
 *
 * Runs the pure generators (22.3.1–22.3.4) and serializes their output to the
 * four files the VS Code manifest (`package.json`) contributes:
 * - `syntaxes/syntaxmesh.tmLanguage.json`      (main grammar)
 * - `syntaxes/syntaxmesh-tji.tmLanguage.json`  (include grammar)
 * - `language-configuration.json`              (brackets/comments/folding)
 * - `snippets/syntaxmesh.json`                 (v1 snippets)
 *
 * Output is deterministic (2-space JSON + trailing newline, stable key order),
 * so two consecutive runs are byte-for-byte identical. Invoke with
 * `deno task generate` (root: `deno task generate:vsext`).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.5
 */

import { generateGrammar, } from "../src/grammar/textmate.ts";
import { generateTjiGrammar, } from "../src/grammar/tji.ts";
import { generateLanguageConfiguration, } from "../src/grammar/language-config.ts";
import { SNIPPETS, } from "../src/grammar/snippets.ts";

/** Package root (this script lives in `scripts/`). */
const ROOT = new URL("..", import.meta.url,);

/** Serializes a value as deterministic, human-readable JSON. */
function json(value: unknown,): string {
  return JSON.stringify(value, null, 2,) + "\n";
}

/** The four contributed assets, in manifest order. */
const ASSETS: { path: string; value: unknown }[] = [
  { path: "syntaxes/syntaxmesh.tmLanguage.json", value: generateGrammar(), },
  {
    path: "syntaxes/syntaxmesh-tji.tmLanguage.json",
    value: generateTjiGrammar(),
  },
  {
    path: "language-configuration.json",
    value: generateLanguageConfiguration(),
  },
  { path: "snippets/syntaxmesh.json", value: SNIPPETS, },
];

for (const asset of ASSETS) {
  const target = new URL(asset.path, ROOT,);
  await Deno.mkdir(new URL(".", target,), { recursive: true, },);
  await Deno.writeTextFile(target, json(asset.value,),);
  console.log(`wrote ${asset.path}`,);
}
