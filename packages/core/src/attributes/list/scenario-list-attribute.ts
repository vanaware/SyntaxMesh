/**
 * Atributo de lista de cenários.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { ListAttributeBase } from "../list-attribute-base.ts";

/**
 * Atributo de lista de cenários.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute
 */
export class ScenarioListAttribute extends ListAttributeBase<string> {
  /**
   * ID do tipo de atributo para ScenarioListAttribute.
   */
  static readonly tjpId = "scenarios";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ScenarioListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.join(", ") : "";
  }
}