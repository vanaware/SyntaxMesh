/**
 * RichText — entrada/saída do subsistema de markup MediaWiki (Fase 12.18).
 *
 * Envolve o texto bruto e os {@link RichTextFunctionHandler} e, ao chamar
 * {@link RichText.generateIntermediateFormat}, monta um {@link RichTextIntermediate}
 * com a árvore de {@link RichTextElement} já construída pelo {@link RichTextParser}.
 * O parser é um singleton compartilhado entre instâncias (Ruby `@@parser`),
 * reposicionado a cada chamada via {@link RichTextParser.reuse}.
 *
 * Port fiel de `RichText.rb:74-135`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextParser, } from "./rich-text-parser.ts";
import { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import { RichTextElement, } from "./rich-text-element.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";

export class RichText {
  /** Texto de entrada com markup. */
  readonly inputText: string;
  /** Handlers de função fornecidos (copiados ao RTI no processamento). */
  private readonly functionHandlers: RichTextFunctionHandler[];
  /** Parser compartilhado entre todas as instâncias (Ruby `@@parser`). */
  private static parser: RichTextParser | null = null;

  constructor(
    text: string,
    functionHandlers: RichTextFunctionHandler[] = [],
  ) {
    this.inputText = text;
    this.functionHandlers = functionHandlers;
  }

  /**
   * Converte {@link inputText} na representação intermediária. Retorna `null`
   * quando o parser falha (equivalente ao `== false` do Ruby).
   *
   * @param sectionCounter contadores iniciais de seção (Ruby `[0, 0, 0]`)
   * @param tokenSet subconjunto de tokens a aceitar (ou `null` = todos)
   */
  generateIntermediateFormat(
    sectionCounter: number[] = [0, 0, 0,],
    tokenSet: string[] | null = null,
  ): RichTextIntermediate | null {
    const rti = new RichTextIntermediate(this,);
    // Copia os handlers de função (o RTI duplica cada um, como no Ruby).
    for (const h of this.functionHandlers) {
      rti.registerFunctionHandler(h,);
    }

    // Reusa o parser singleton quando já existe; senão cria um.
    if (RichText.parser) {
      RichText.parser.reuse(rti, sectionCounter, tokenSet,);
    } else {
      RichText.parser = new RichTextParser(rti, sectionCounter, tokenSet,);
    }

    RichText.parser.open(this.inputText,);
    const tree = RichText.parser.parse("richtext",);
    if (tree === false) return null;

    // Resultado vazio: usa um elemento raiz `richtext` sem filhos.
    const root = tree
      ? (tree as RichTextElement)
      : new RichTextElement(rti, "richtext", null,);
    root.cleanUp();
    rti.tree = root;
    return rti;
  }

  /**
   * Retorna o handler da função `name`; `block` distingue função de bloco de
   * função inline (RichText.rb:125-131).
   */
  functionHandler(
    name: string,
    block: boolean,
  ): RichTextFunctionHandler | null {
    for (const handler of this.functionHandlers) {
      if (handler.function === name && handler.blockFunction === block) {
        return handler;
      }
    }
    return null;
  }
}
