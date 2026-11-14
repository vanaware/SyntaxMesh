/**
 * `commands/input-language.ts` — pure rewrite of the `language` directive
 * (22.7.4).
 *
 * The Switch Language command edits the input-file `language "..."` directive
 * (a SyntaxMesh prolog extension that must appear before the project
 * declaration). This is the pure text transform: it replaces the value of an
 * existing directive in place — preserving its indentation and everything else
 * — or inserts a new directive at the top when none exists. Switching the input
 * language is distinct from translating the UI (plan §8.2); the host wires this
 * to the active editor (22.7.6).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.2 (Switch Language)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.4
 */

/**
 * The prolog directive: a line-anchored `language "..."` with its leading
 * horizontal whitespace captured (group 1) so indentation is preserved.
 */
const DIRECTIVE = /^([ \t]*)language[ \t]+"([^"]+)"/m;

/**
 * Rewrites the `language "..."` directive of a master file to `locale`.
 *
 * When a directive exists its quoted value is replaced in place (indentation
 * and the rest of the line/file are kept); otherwise a new directive is
 * prepended before the project declaration. The transform is idempotent:
 * applying the same locale twice yields the same text.
 *
 * @param text full master-file text.
 * @param locale language code to set (`en`/`pt-BR`/`es`).
 * @returns the rewritten text, never mutating the input.
 */
export function rewriteLanguageDirective(
  text: string,
  locale: string,
): string {
  const match = text.match(DIRECTIVE,);
  if (match !== null) {
    const indent = match[1] ?? "";
    return text.replace(DIRECTIVE, () => `${indent}language "${locale}"`,);
  }
  return `language "${locale}"\n${text}`;
}
