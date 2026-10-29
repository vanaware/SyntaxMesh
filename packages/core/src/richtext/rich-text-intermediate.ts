/**
 * RichTextIntermediate — recipiente da representação intermediária do RichText
 * (Fase 12.4).
 *
 * Guarda a raiz da árvore de {@link RichTextElement} (`tree`) e todos os
 * parâmetros de formatação que os elementos consultam ao serializar (`indent`,
 * `lineWidth`, `sectionNumbers`, …). Os handlers de função registrados aqui são
 * consultados por `RichTextElement` para `blockfunc`/`inlinefunc`.
 *
 * Port fiel de `RichText.rb:141-233` + reopen `RTFWithQuerySupport.rb:35-45`
 * (`setQuery`). No Ruby o `registerFunctionHandler` guarda `handler.dup`; aqui
 * registramos a instância diretamente (o `dup` dos handlers concretos chega com
 * 12.12+, quando `RichTextFunctionHandler.dup()` for implementado por subclasse).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "./xml-like.ts";
import { SimpleXMLElement, } from "./xml-like.ts";
import type { RichTextElement, } from "./rich-text-element.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";
import type { Query, } from "../query/query.ts";
import type { TableOfContents, } from "./table-of-contents.ts";

export class RichTextIntermediate {
  /** De volta ao `RichText` de origem (opaco nesta fase). */
  readonly richText: unknown;
  /** Raiz da árvore intermediária; `null` até o parser popular. */
  tree: RichTextElement | null = null;
  /** Bloco (default) vs. linha. */
  blockMode = true;
  /** Numeração automática de seções. */
  sectionNumbers = true;
  /** Largura máxima do texto puro. */
  lineWidth = 80;
  /** Indentação base de toda a saída textual. */
  indent = 0;
  /** Indentação extra para títulos. */
  titleIndent = 0;
  /** Indentação extra para parágrafos. */
  parIndent = 0;
  /** Indentação extra para listas. */
  listIndent = 1;
  /** Indentação extra para seções `<pre>`. */
  preIndent = 0;
  /** `target` dos links de hipertexto. */
  linkTarget: string | null = null;
  /** Classe CSS aplicada a alguns elementos HTML. */
  cssClass: string | null = null;
  /** Handlers de função por nome. */
  readonly functionHandlers: Map<string, RichTextFunctionHandler> = new Map();

  constructor(richText: unknown,) {
    this.richText = richText;
  }

  /** Registra um handler de função pelo seu nome. */
  registerFunctionHandler(handler: RichTextFunctionHandler,): void {
    if (!handler) throw new Error("Bad function handler",);
    this.functionHandlers.set(handler.function, handler,);
  }

  /** Retorna o handler da função `name`, ou `null`. */
  functionHandler(name: string,): RichTextFunctionHandler | null {
    return this.functionHandlers.get(name,) ?? null;
  }

  /**
   * Propaga o `Query` aos handlers que suportam `setQuery`
   * (RTFWithQuerySupport.rb:37-43).
   */
  setQuery(query: Query,): void {
    for (const handler of this.functionHandlers.values()) {
      const maybe = handler as RichTextFunctionHandler & {
        setQuery?: (q: Query,) => void;
      };
      if (typeof maybe.setQuery === "function") maybe.setQuery(query,);
    }
  }

  /** Verdadeiro se a árvore está vazia. */
  empty(): boolean {
    return !this.tree || this.tree.empty();
  }

  /** Extrai os títulos e monta o `toc` (delegado à árvore). */
  tableOfContents(toc: TableOfContents, fileName: string,): void {
    this.tree?.tableOfContents(toc, fileName,);
  }

  /** Referências internas coletadas pela árvore. */
  internalReferences(): string[] {
    return this.tree ? this.tree.internalReferences() : [];
  }

  /** Texto puro; remove as quebras de linha finais (Ruby `chomp!` loop). */
  to_s(): string {
    let str = this.tree ? this.tree.to_s() : "";
    while (str.endsWith("\n",)) str = str.slice(0, -1,);
    return str;
  }

  /** Árvore HTML (elemento raiz), `<span>` vazio sem árvore, ou `null`. */
  to_html(): XMLElementLike | null {
    return this.tree ? this.tree.to_html() : new SimpleXMLElement("span", {},);
  }

  /** Saída marcada para testes. */
  to_tagged(): string {
    return this.tree ? this.tree.to_tagged() : "";
  }
}
