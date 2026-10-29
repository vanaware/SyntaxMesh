/**
 * RichTextFunctionHandler — base abstrata de todos os handlers de função do
 * RichText (Fase 12.11).
 *
 * Um handler responde por uma função embutida no markup (`[[query:…]]`,
 * `[[report:…]]`, `[[example:…]]`, `[[navigator:…]]`). Cada subclasse
 * implementa `to_s`, `to_html` e `to_tagged`, que recebem os argumentos da
 * função. No Ruby esses métodos têm acesso a `error`/`warning`/`info` via
 * `include MessageHandler`; no port o relatório é feito pelo singleton
 * `MessageHandlerInstance` (Fase 9), então a base só oferece um helper
 * protegido que o envolve.
 *
 * Port fiel de `RichText/FunctionHandler.rb:28-40`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionHandler.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import { MessageHandlerInstance, } from "../../message-handler.ts";

/** Argamento das funções: mapa chave→valor (ex.: `{ attribute: "effort" }`). */
export type RichTextFunctionArgs = Record<string, string>;

export abstract class RichTextFunctionHandler {
  /** Nome da função (ex.: `query`, `report`, `example`). */
  readonly function: string;
  /** Verdadeiro quando a função ocupa um bloco inteiro (não inline). */
  blockFunction: boolean;
  /** Informação de origem, para relatório de erros. */
  readonly sourceFileInfo: SourceFileInfo | null;

  constructor(
    functionName: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.function = functionName;
    this.blockFunction = false;
    this.sourceFileInfo = sourceFileInfo;
  }

  /** Representação em texto puro. */
  abstract to_s(args: RichTextFunctionArgs,): string;

  /** Representação como árvore de elementos (substituída na Fase 17). */
  abstract to_html(args: RichTextFunctionArgs,): XMLElementLike | null;

  /** Representação marcada (`<func:…>`); `null` quando não suportada. */
  abstract to_tagged(args: RichTextFunctionArgs,): string | null;

  /**
   * Cópia rasa do handler (equivalente ao `Object#dup` do Ruby). Usada por
   * `RichTextIntermediate.registerFunctionHandler` para que cada RichText tenha
   * sua própria instância (o `@query` dos handlers é mutável). Subclasses com
   * estado além dos campos próprios não precisam sobrescrever — a cópia
   * preserva todos os campos enumeráveis via `Object.assign`.
   */
  dup(): this {
    const copy = Object.create(Object.getPrototypeOf(this,),) as this;
    return Object.assign(copy, this,);
  }

  /** Registra um erro não-fatal no MessageHandler (equivalente ao Ruby). */
  protected error(id: string, message: string,): void {
    MessageHandlerInstance.instance.error(id, message, this.sourceFileInfo,);
  }

  /** Registra um aviso não-fatal no MessageHandler. */
  protected warning(id: string, message: string,): void {
    MessageHandlerInstance.instance.warning(id, message, this.sourceFileInfo,);
  }
}
