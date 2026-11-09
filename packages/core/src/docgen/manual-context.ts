/**
 * `manual-context.ts` — contrato mínimo que `KeywordDocumentation` pede ao
 * documento que o hospeda (22.1b.3/22.1b.5).
 *
 * O Ruby usa `@manual` (uma instância concreta de `UserManual`) para quatro
 * callbacks de página (`generateStyleSheet`, `generateHTMLHeader`,
 * `generateHTMLFooter`, `generateHTMLNavigationBar`) e para o corpus de
 * exemplos (`TjpExample`). Aqui a dependência fica **estrutural**: o
 * `doc-core` renderiza uma página de keyword sem importar o `UserManual`, o que
 * evita o ciclo `user-manual → syntax-reference → keyword-documentation`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KeywordDocumentation.rb
 */

import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/** Documento que hospeda as páginas de keyword (o `UserManual`). */
export interface ManualPageContext {
  /** `<link>` para a folha de estilos do manual. */
  generateStyleSheet(): XMLElementLike;
  /** Cabeçalho do topo de cada página. */
  generateHTMLHeader(): XMLElementLike;
  /** Rodapé de cada página. */
  generateHTMLFooter(): XMLElementLike;
  /**
   * Barra de navegação `<< anterior · índice · próximo >>`.
   *
   * Os quatro parâmetros são `null` quando não há vizinho (pontas da lista).
   */
  generateHTMLNavigationBar(
    predLabel: string | null,
    predUrl: string | null,
    succLabel: string | null,
    succUrl: string | null,
  ): XMLElementLike;
  /**
   * Trecho de exemplo anotado (`# *** EXAMPLE: <tag> +`), ou `null` quando o
   * arquivo não está no corpus distribuído.
   */
  exampleText(file: string, tag: string | null,): string | null;
}
