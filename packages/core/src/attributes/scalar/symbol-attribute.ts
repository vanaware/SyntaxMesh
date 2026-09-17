/**
 * Atributo escalar símbolo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { AttributeBase } from "../attribute-base.ts";

/**
 * Atributo escalar símbolo.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:SymbolAttribute
 */
export class SymbolAttribute extends AttributeBase<string> {
  /**
   * ID do tipo de atributo para SymbolAttribute.
   */
  static readonly tjpId = "symbol";
}