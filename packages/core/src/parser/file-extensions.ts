/**
 * Extensões de arquivo aceitas pelo parser (Fase 24, 24.2.36).
 *
 * Decisão de 2026-11-07 (plano §1.6): o SyntaxMesh adota **`.smx`** como
 * extensão nativa de projetos e folhas. As formas do TaskJuggler (`.tjp`,
 * `.tji`) continuam aceitas por compatibilidade — `.tjp`/`.tji` em material
 * novo são permitidos só como legado, nunca gerados.
 *
 * Este módulo fica fora de `project-file-parser.ts` porque as regras de
 * gramática (`rules/project.ts`) também precisam dos mesmos nomes, e importar
 * o parser a partir das regras criaria ciclo (`parser → rules → parser`).
 *
 * ⚠️ Desvio **validado** da regra zero (ADR 011): o Ruby exigia `.tjp` e
 * `.tji`. O aditamento do ADR 037 registra a decisão (24.2.35).
 */

/** Extensões aceitas para o arquivo **mestre** do projeto. */
export const PROJECT_FILE_EXTENSIONS = [".tjp", ".smx",] as const;

/** Extensões aceitas para um arquivo **incluído** (`include "…"`). */
export const INCLUDE_FILE_EXTENSIONS = [".tji", ".smx",] as const;

/** `true` quando o nome termina com uma das extensões informadas. */
function hasExtension(
  fileName: string,
  extensions: readonly string[],
): boolean {
  return extensions.some((ext,) => fileName.endsWith(ext,));
}

/** `true` quando o nome tem uma das extensões de arquivo mestre. */
export function isProjectFileName(fileName: string,): boolean {
  return hasExtension(fileName, PROJECT_FILE_EXTENSIONS,);
}

/** `true` quando o nome tem uma das extensões de arquivo incluído. */
export function isIncludeFileName(fileName: string,): boolean {
  return hasExtension(fileName, INCLUDE_FILE_EXTENSIONS,);
}

/** Lista humana das extensões (`'.tjp' or '.smx'`). */
export function formatExtensionList(extensions: readonly string[],): string {
  return extensions.map((ext,) => `'${ext}'`).join(" or ",);
}
