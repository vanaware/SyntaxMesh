/**
 * Referências `include` de um texto TJP (Fase 24 — tarefa 24.3.6).
 *
 * A CLI precisa entregar o **fechamento completo** de `include`s dentro de
 * `request.files` antes de chamar `execute`: o core resolve por *lookup* em
 * memória e nunca toca no disco. Como o parser só descobre os arquivos
 * incluídos durante o scan, esta função faz a leitura estática do texto.
 *
 * Regras:
 *  - por linha, um comentário `#` fora de string é descartado;
 *  - o primeiro identificador da linha precisa ser o keyword `include` —
 *    canônico ou sinônimo de qualquer idioma registrado (`incluir` em pt-BR/es,
 *    ADR 023). É leitura estática: o idioma real do arquivo não é resolvido
 *    aqui, então o conjunto de sinônimos é a união de todos os registrados;
 *  - o caminho é o primeiro literal entre aspas.
 *
 * Cobre as três formas da gramática: `prologInclude` (antes do cabeçalho),
 * `projectBodyInclude` (dentro do cabeçalho, com atributos) e `includeFile`
 * (`include "arquivo"` no corpo) — todas começam por `include "nome"`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1
 * @see packages/core/src/parser/rules/project.ts (regras `include*`)
 */
import { globalRegistry, type LanguageRegistry, } from "../i18n/mod.ts";

/**
 * Palavras que abrem um `include`, união de todos os idiomas registrados.
 *
 * O canônico entra sempre, mesmo que nenhum idioma o liste.
 */
export function includeKeywords(
  registry: LanguageRegistry = globalRegistry,
): string[] {
  const words = new Set<string>(["include",],);
  for (const language of registry.all()) {
    for (const synonym of language.keywords.include ?? []) {
      words.add(synonym,);
    }
  }
  return [...words,];
}

/** Remove um comentário `#` que esteja fora de uma string. */
function stripComment(line: string,): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "#" && !quoted) {
      return line.slice(0, i,);
    }
  }
  return line;
}

/** Identificador na coluna inicial seguido de string: `include "x"`. */
const INCLUDE_LINE = /^\s*([A-Za-z_][\w-]*)\s+"([^"]*)"/;

/**
 * Caminhos referenciados por `include` no texto, na ordem de aparição.
 *
 * Devolve os nomes **como escritos** (relativos ao arquivo que inclui ou
 * absolutos); a resolução contra o caminho do pai é do chamador.
 */
export function scanIncludeReferences(
  content: string,
  keywords: readonly string[] = includeKeywords(),
): string[] {
  const known = new Set(keywords,);
  const references: string[] = [];
  for (const raw of content.split("\n",)) {
    const match = stripComment(raw,).match(INCLUDE_LINE,);
    if (match === null) continue;
    if (!known.has(match[1]!,)) continue;
    references.push(match[2]!,);
  }
  return references;
}
