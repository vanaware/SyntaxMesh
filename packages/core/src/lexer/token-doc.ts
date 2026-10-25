import { type Pattern, } from "../parser/pattern.ts";

/**
 * TokenDoc — armazena nome e descrição de um token usado pelo parser sintático.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/TokenDoc.rb
 */
export class TokenDoc {
  readonly name: string | null;
  readonly text: string | null;
  readonly typeSpec: string | null;
  readonly pattern: Pattern | null;

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
