import { type Pattern, } from "../parser/pattern.ts";

/**
 * TokenDoc — stores the name and description of a token used by the syntactic
 * parser.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/TokenDoc.rb
 */
export class TokenDoc {
  /** Name of the token, or `null` when it is anonymous. */
  readonly name: string | null;
  /** Literal text of the token, or `null` when it is pattern based. */
  readonly text: string | null;
  /** Type specification of the token, when one was assigned. */
  readonly typeSpec: string | null;
  /** Pattern that recognizes the token, or `null` for a literal token. */
  readonly pattern: Pattern | null;

  /**
   * Ruby `initialize(name, arg)` — `arg` is either the literal text or a
   * pattern.
   *
   * @param name Name of the token, or `null`.
   * @param arg Literal text of the token, or the pattern that recognizes it.
   */
  constructor(name: string | null, arg: string | Pattern,) {
    this.name = name;
    if (typeof arg === "string") {
      this.text = arg;
      this.pattern = null;
    } else {
      this.text = null;
      this.pattern = arg;
    }
    this.typeSpec = null;
  }
}
