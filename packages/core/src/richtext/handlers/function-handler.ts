/**
 * RichTextFunctionHandler — abstract base of every RichText function handler
 * (Phase 12.11).
 *
 * A handler is responsible for one function embedded in the markup
 * (`[[query:...]]`, `[[report:...]]`, `[[example:...]]`, `[[navigator:...]]`).
 * Each subclass implements `to_s`, `to_html` and `to_tagged`, which receive the
 * function arguments. In Ruby those methods reach `error`/`warning`/`info`
 * through `include MessageHandler`; in the port reporting goes through the
 * `MessageHandlerInstance` singleton (Phase 9), so the base only offers a
 * protected helper wrapping it.
 *
 * Faithful port of `RichText/FunctionHandler.rb:28-40`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionHandler.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
import { MessageHandlerInstance, } from "../../message-handler.ts";

/** Function arguments: a key→value map (e.g. `{ attribute: "effort" }`). */
export type RichTextFunctionArgs = Record<string, string>;

/**
 * Base class for the function handlers registered on a RichText instance.
 */
export abstract class RichTextFunctionHandler {
  /** Function name (e.g. `query`, `report`, `example`). */
  readonly function: string;
  /** True when the function takes up a whole block (not inline). */
  blockFunction: boolean;
  /** Source information, used to report errors. */
  readonly sourceFileInfo: SourceFileInfo | null;

  /**
   * Creates a handler.
   *
   * @param functionName Name of the function it handles.
   * @param sourceFileInfo Origin of the markup, used in diagnostics.
   */
  constructor(
    functionName: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.function = functionName;
    this.blockFunction = false;
    this.sourceFileInfo = sourceFileInfo;
  }

  /** Plain-text representation. */
  abstract to_s(args: RichTextFunctionArgs,): string;

  /** Representation as an element tree (replaced in Phase 17). */
  abstract to_html(args: RichTextFunctionArgs,): XMLElementLike | null;

  /** Tagged representation (`<func:...>`); `null` when not supported. */
  abstract to_tagged(args: RichTextFunctionArgs,): string | null;

  /**
   * Shallow copy of the handler (equivalent to Ruby's `Object#dup`). Used by
   * `RichTextIntermediate.registerFunctionHandler` so each RichText gets its own
   * instance (the handlers' `@query` is mutable). Subclasses with state beyond
   * their own fields do not need to override it — the copy preserves every
   * enumerable field through `Object.assign`.
   */
  dup(): this {
    const copy = Object.create(Object.getPrototypeOf(this,),) as this;
    return Object.assign(copy, this,);
  }

  /** Reports a non-fatal error to the MessageHandler (equivalent to Ruby). */
  protected error(id: string, message: string,): void {
    MessageHandlerInstance.instance.error(id, message, this.sourceFileInfo,);
  }

  /** Reports a non-fatal warning to the MessageHandler. */
  protected warning(id: string, message: string,): void {
    MessageHandlerInstance.instance.warning(id, message, this.sourceFileInfo,);
  }
}
