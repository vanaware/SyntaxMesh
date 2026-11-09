/**
 * `docgen/mod.ts` — barril do `doc-core` (subfase 22.1b).
 *
 * Ponto de entrada publicado como `@vanaware/syntaxmesh/doc-core`. Não é
 * reexportado pelo `mod.ts` da raiz: a referência de sintaxe monta as tabelas
 * do parser e custa caro, então quem não gera documentação não a paga.
 *
 * Restrição de fronteira (verificada por `deno task check:doccore`): nenhum
 * arquivo sob `src/docgen/` usa `Deno.*`, `node:` ou `npm:` — o pacote devolve
 * **dado** e nada escreve, lê, imprime ou encerra o processo.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco D/F/G
 * @see ./man.ts (fachada usada pela seção `man` da Fase 24)
 */

export { blue, bold, cyan, paint, red, } from "./ansi.ts";
export { ExampleSnippet, } from "./example-snippet.ts";
export { KeywordDocumentation, } from "./keyword-documentation.ts";
export { generateMan, } from "./man.ts";
export type {
  ManFile,
  ManFormat,
  ManMessage,
  ManOutput,
  ManRequest,
} from "./man.ts";
export type { ManualPageContext, } from "./manual-context.ts";
export {
  resetSyntaxReferenceCache,
  SyntaxReference,
  syntaxReference,
} from "./syntax-reference.ts";
export { UserManual, } from "./user-manual.ts";
export type { UserManualOptions, } from "./user-manual.ts";
export { MANUAL_CHAPTER_NAMES, MANUAL_CHAPTERS, } from "./manual/chapters.ts";
export type { ManualChapter, } from "./manual/chapters.ts";
export { EXAMPLE_CORPUS, } from "./manual/example-corpus.ts";
export {
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
} from "./manual/manual-css.ts";
