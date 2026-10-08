import { TjError, } from "../attributes/errors.ts";

/**
 * Erro interno — usado para situações impossíveis.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:$DEBUG
 */
export class TjInternalError extends TjError {
  constructor(message: string,) {
    super(message,);
    this.name = "TjInternalError";
  }
}
