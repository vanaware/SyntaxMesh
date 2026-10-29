/**
 * RTFWithQuerySupport — base para handlers de função que resolvem um `Query`
 * (Fase 12.13).
 *
 * Adiciona ao {@link RichTextFunctionHandler} um campo `query` (o modelo
 * preenchido pelo `ReportContext`) e um setter `setQuery` que **duplica** a
 * query recebida — o handler a modifica durante `prepareQuery`, então não pode
 * contaminar a instância original. `RichTextIntermediate.setQuery` propaga a
 * query aos handlers que expõem este método.
 *
 * Port fiel de `RichText/RTFWithQuerySupport.rb:19-33`. O `dup()` da base
 * (cópia rasa) preserva `query` automaticamente.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Query, } from "../../query/query.ts";

export abstract class RTFWithQuerySupport extends RichTextFunctionHandler {
  /** Query-modelo registrada pelo contexto; `null` até `setQuery`. */
  protected query: Query | null = null;

  constructor(
    type: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super(type, sourceFileInfo,);
    this.query = null;
  }

  /**
   * Registra a `Query` usada para resolver as consultas. Duplica o objeto, pois
   * ele será modificado (RTFWithQuerySupport.rb:29-31).
   */
  setQuery(query: Query,): void {
    this.query = query.dup();
  }
}
