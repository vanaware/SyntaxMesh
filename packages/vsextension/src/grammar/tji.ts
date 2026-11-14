/**
 * `grammar/tji.ts` — pure TextMate grammar generator for include files (22.3.2).
 *
 * A `.tji` file is a SyntaxMesh include fragment: it uses the same language as
 * `.smx`/`.tjp`, so this grammar (`source.syntaxmesh.tji`) delegates to the main
 * grammar (`source.syntaxmesh`) and additionally surfaces the `include`
 * directive first — nested includes are the whole point of a `.tji` file
 * (plan §6). The directive is projected from {@link SyntaxCore} so the grammar
 * stays in sync with the shared highlight data.
 *
 * Pure and deterministic; the generate script (22.3.5) serializes the result to
 * `syntaxes/syntaxmesh-tji.tmLanguage.json`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.2
 */

import { SyntaxCore, } from "@vanaware/syntaxmesh/doc-core";
import type {
  TextMateGrammar,
  TextMatePattern,
  TextMateRepositoryEntry,
} from "./types.ts";

/**
 * Generates the SyntaxMesh include grammar (`source.syntaxmesh.tji`). It
 * highlights the `include` directive (when present in the data) and then
 * imports the main `source.syntaxmesh` grammar for everything else.
 *
 * @param core highlight data source; defaults to a fresh {@link SyntaxCore}.
 * @returns the include grammar as data, ready to serialize.
 */
export function generateTjiGrammar(
  core: SyntaxCore = new SyntaxCore(),
): TextMateGrammar {
  const hasInclude = core.tokenRules().some(
    (rule,) => rule.kind === "regexp" && rule.attribute === "Include",
  );

  const patterns: TextMatePattern[] = [];
  const repository: Record<string, TextMateRepositoryEntry> = {};
  if (hasInclude) {
    repository.include = {
      patterns: [{
        name: "keyword.control.include.syntaxmesh",
        // ⚠️ ADAPTAÇÃO: Kate's bare `include.*$`, word-boundary anchored.
        match: "\\binclude\\b.*$",
      },],
    };
    patterns.push({ include: "#include", },);
  }
  patterns.push({ include: "source.syntaxmesh", },);

  return {
    name: "SyntaxMesh Include",
    scopeName: "source.syntaxmesh.tji",
    patterns,
    repository,
  };
}
