/**
 * Bloco A da Fase 17 — estrutura XML (`XMLElement` e `XMLDocument`).
 *
 * O re-export no `src/mod.ts` top-level só acontece em 17.12, quando
 * `reports/xml-node.ts` (duplicata mínima com os mesmos cinco nomes) for
 * migrada e apagada. Enquanto isso este `mod.ts` é o ponto de entrada do bloco.
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./xml-document.ts";
export * from "./xml-element.ts";
