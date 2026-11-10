/**
 * RichText — input/output of the MediaWiki markup subsystem (phase 12.18).
 *
 * Wraps the raw text and the {@link RichTextFunctionHandler}s and, on calling
 * {@link RichText.generateIntermediateFormat}, builds a
 * {@link RichTextIntermediate} with the {@link RichTextElement} tree already
 * built by the {@link RichTextParser}. The parser is a singleton shared across
 * instances (Ruby `@@parser`), repositioned on every call through
 * {@link RichTextParser.reuse}.
 *
 * Faithful port of `RichText.rb:74-135`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 * @see ADR 025 (RichText and function handlers)
 */

import { RichTextParser, } from "./rich-text-parser.ts";
import { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import { RichTextElement, } from "./rich-text-element.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";

export class RichText {
  /** Input text with markup. */
  readonly inputText: string;
  /** Supplied function handlers (copied into the RTI while processing). */
  private readonly functionHandlers: RichTextFunctionHandler[];
  /** Parser shared across all instances (Ruby `@@parser`). */
  private static parser: RichTextParser | null = null;

  constructor(
    text: string,
    functionHandlers: RichTextFunctionHandler[] = [],
  ) {
    this.inputText = text;
    this.functionHandlers = functionHandlers;
  }

  /**
   * Converts {@link inputText} into the intermediate representation. Returns
   * `null` when the parser fails (equivalent to Ruby's `== false`).
   *
   * @param sectionCounter initial section counters (Ruby `[0, 0, 0]`)
   * @param tokenSet subset of tokens to accept (or `null` = all)
   */
  generateIntermediateFormat(
    sectionCounter: number[] = [0, 0, 0,],
    tokenSet: string[] | null = null,
  ): RichTextIntermediate | null {
    const rti = new RichTextIntermediate(this,);
    // Copies the function handlers (the RTI duplicates each one, as in Ruby).
    for (const h of this.functionHandlers) {
      rti.registerFunctionHandler(h,);
    }

    // Reuses the singleton parser when it already exists; otherwise creates one.
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
   * Returns the handler of the `name` function; `block` distinguishes a block
   * function from an inline function (RichText.rb:125-131).
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
