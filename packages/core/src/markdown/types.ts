/**
 * Tipos compartilhados do subsistema Markdown (Fase 13).
 *
 * O parser base é `micromark` + `mdast-util-from-markdown` (+ GFM), que produz
 * uma AST `mdast`. Como Markdown não cobre `<fcol:…>`, `[[func:…]]` e `<-…->`,
 * as extensões **pré/pós-processam** o texto e injetam um nó sintético na AST
 * (`richtextExtension`) — é por isso que aumentamos os mapas de conteúdo do
 * módulo `mdast` aqui, em vez de criar um tipo paralelo.
 *
 * @see ADR 026 (Markdown como formato going-forward)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md §4.2
 */

import type { PhrasingContent, Root, } from "mdast";

declare module "mdast" {
  /**
   * Nó sintético criado pelas extensões Markdown (13.4–13.8). Não existe no
   * vocabulário `mdast`; carrega a categoria do elemento `RichTextElement`
   * equivalente e o seu `payload`.
   */
  interface RichTextExtensionNode {
    type: "richtextExtension";
    /** Categoria do elemento RichText que será construído (13.2). */
    category: "fontCol" | "inlinefunc" | "blockfunc";
    /**
     * `data` do elemento RichText: string (cor) para `fontCol`, ou
     * `[nome, args]` para `inlinefunc`/`blockfunc`.
     */
    payload: string | [string, Record<string, string>,];
    /** Conteúdo interno (só `fontCol` tem filhos). */
    children: PhrasingContent[];
  }

  interface ContentMap {
    richtextExtension: RichTextExtensionNode;
  }

  interface PhrasingContentMap {
    richtextExtension: RichTextExtensionNode;
  }
}

/** Raiz da AST `mdast` produzida por {@link parseMdast}. */
export type MdastRoot = Root;

/** Qualquer nó `mdast` que percorremos (raiz, blocos e inline). */
export type MdastNode = Root | Root["children"][number] | PhrasingContent;

/** Nós inline (filhos de parágrafo, título, link, …). */
export type MdastInline = PhrasingContent;

/** Nó sintético das extensões (re-export para conveniência). */
export type MdastExtension = import("mdast").RichTextExtensionNode;

/** Categorias RichText que as extensões markdown produzem. */
export type ExtensionCategory = "fontCol" | "inlinefunc" | "blockfunc";

/** Extração genérica registrada pelo pipeline (13.8.2). */
export interface Extraction {
  /** Placeholder único deixado no texto (`§COLOR_0§`). */
  placeholder: string;
  /** Categoria do elemento RichText resultante. */
  category: ExtensionCategory;
  /** `data` do elemento (`color` ou `[nome, args]`). */
  payload: string | [string, Record<string, string>,];
  /** Texto original capturado (inclui a markup da extensão). */
  source: string;
  /** Conteúdo interno a reprocessar (só `<fcol:…>…</fcol>`). */
  content?: string;
}

/** Resultado de um `preprocess*` de extensão (13.4.3, 13.6.3, 13.7.2). */
export interface PreprocessResult<T,> {
  /** Texto com os placeholders no lugar das extensões. */
  text: string;
  /** Extrações registradas nesta passada. */
  extractions: T[];
}

/**
 * Funções que, sozinhas num parágrafo, viram `blockfunc` (13.6.8).
 * Espelha `blockFunction = true` dos handlers da Fase 12 (`RTFReport`,
 * `RTFNavigator`).
 */
export const DEFAULT_BLOCK_FUNCTIONS = ["report", "navigator",];

/** Nome da função `[[name:…]]`/`<-[name …]->` reconhecidos pela Fase 12. */
export const DEFAULT_KNOWN_FUNCTIONS = [
  "query",
  "report",
  "reportlink",
  "navigator",
];
