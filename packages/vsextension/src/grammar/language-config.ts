/**
 * `grammar/language-config.ts` — pure language configuration generator (22.3.3).
 *
 * Projects {@link SyntaxCore.indentSettings} into a VS Code
 * `language-configuration.json` **as data** (no file IO, no `vscode` runtime):
 * bracket pairs, auto-closing/surrounding pairs, comment delimiters, folding
 * markers, indentation rules and the word pattern. The generate script (22.3.5)
 * serializes the result.
 *
 * Block structure comes from the Vim `cinkeys` (`0{,0}`): `{` opens and `}`
 * closes a block. Folding markers are built from the `cinwords` (the option
 * blocks Vim folds), so a foldable region starts at an option-block header
 * ending in `{` and ends at a lone `}` — faithful to `VimSyntax#regions`.
 *
 * ⚠️ ADAPTAÇÃO: VS Code allows a single `lineComment`; `#` is chosen as the
 * toggle-comment delimiter (the most common in `.tjp`). `//` is still
 * highlighted by the grammar, and `/* … *\/` is the block comment.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.3
 */

import { SyntaxCore, } from "@vanaware/syntaxmesh/doc-core";
import type { LanguageConfiguration, } from "./types.ts";
import { alternation, } from "./pattern-utils.ts";

/**
 * Generates the SyntaxMesh language configuration from the shared indent
 * settings. Pure and deterministic.
 *
 * @param core highlight data source; defaults to a fresh {@link SyntaxCore}.
 * @returns the language configuration as data, ready to serialize.
 */
export function generateLanguageConfiguration(
  core: SyntaxCore = new SyntaxCore(),
): LanguageConfiguration {
  const indent = core.indentSettings();
  // Option-block headers (cinwords) open a foldable region ending in `{`.
  const foldStart = `^\\s*(?:${alternation(indent.cinwords,)})\\b.*\\{\\s*$`;

  return {
    comments: {
      lineComment: "#",
      blockComment: ["/*", "*/",],
    },
    brackets: [
      { open: "{", close: "}", },
      { open: "[", close: "]", },
    ],
    autoClosingPairs: [
      { open: "{", close: "}", },
      { open: "[", close: "]", },
      { open: "'", close: "'", notIn: ["string", "comment",], },
      { open: '"', close: '"', notIn: ["string", "comment",], },
    ],
    surroundingPairs: [
      { open: "{", close: "}", },
      { open: "[", close: "]", },
      { open: "'", close: "'", },
      { open: '"', close: '"', },
    ],
    folding: {
      start: foldStart,
      end: "^\\s*\\}\\s*$",
    },
    indentationRules: {
      increaseIndentPattern: "\\{\\s*$",
      decreaseIndentPattern: "^\\s*\\}",
    },
    wordPattern: "[A-Za-z_][A-Za-z0-9_]*",
  };
}
