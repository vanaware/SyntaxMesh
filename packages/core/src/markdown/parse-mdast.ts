/**
 * parseMdast — integração com `micromark` (Fase 13.1).
 *
 * `micromark`/`@deno/gfm` renderizam HTML; o que o SyntaxMesh precisa é a
 * **AST** (`mdast`), obtida com `mdast-util-from-markdown` + extensões GFM
 * (tabelas, `~~strikethrough~~`, autolinks, task lists). É a decisão da
 * ADR 026: parser que devolve árvore, não markup.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see https://github.com/syntax-tree/mdast
 */

import { fromMarkdown, } from "mdast-util-from-markdown";
import { gfm, } from "micromark-extension-gfm";
import { gfmFromMarkdown, } from "mdast-util-gfm";
import type { PhrasingContent, } from "mdast";
import type { MdastRoot, } from "./types.ts";
// O augmentation dos tipos `mdast` (nó `richtextExtension`) vive aqui.
import "./types.ts";

/**
 * Parseia Markdown (CommonMark + GFM) para a AST `mdast`.
 *
 * @param text fonte Markdown (já pré-processada pelas extensões, se houver)
 */
export function parseMdast(text: string,): MdastRoot {
  return fromMarkdown(text, {
    extensions: [gfm(),],
    mdastExtensions: [gfmFromMarkdown(),],
  },);
}

/**
 * Parseia um trecho **inline** e devolve os filhos do parágrafo resultante.
 * Usado pelas extensões para reprocessar o conteúdo de `<fcol:…>…</fcol>`.
 */
export function parseMdastInline(text: string,): PhrasingContent[] {
  if (text === "") return [];
  const root = parseMdast(text,);
  const first = root.children[0];
  if (first && first.type === "paragraph" && root.children.length === 1) {
    // `Paragraph.children` é `PhrasingContent[]`; o union `RootContent` não
    // expõe o campo, então estreitamos pelo `type` acabado de verificar.
    return (first as unknown as { children: PhrasingContent[] }).children;
  }
  // Conteúdo que não é um único parágrafo (ex.: começa com `#`): preservamos
  // o texto cru em vez de descartar a markup.
  return [{ type: "text", value: text, },];
}
