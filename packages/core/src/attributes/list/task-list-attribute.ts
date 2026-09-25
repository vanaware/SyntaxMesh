/**
 * Atributo de lista de tarefas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de tarefas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute
 */
export class TaskListAttribute
  extends ListAttributeBase<{ id: string; name: string; fullId: string }> {
  /**
   * ID do tipo de atributo para TaskListAttribute.
   */
  static readonly tjpId = "tasklist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.map((item,) => item.id).join(", ",) : "";
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = val ? val.map((item,) => item.id) : [];
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
