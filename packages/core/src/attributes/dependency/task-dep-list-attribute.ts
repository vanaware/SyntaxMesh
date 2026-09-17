/**
 * Atributo de lista de dependências de tarefas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { ListAttributeBase } from "../list-attribute-base.ts";

/**
 * Atributo de lista de dependências de tarefas.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute
 */
export class TaskDepListAttribute extends ListAttributeBase<{ task: { fullId: string }; onEnd: boolean }> {
  /**
   * ID do tipo de atributo para TaskDepListAttribute.
   */
  static readonly tjpId = "taskdeplist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const t of val) {
        out.push(t.task.fullId);
      }
    }
    return out.join(", ");
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const t of val) {
        out.push(t.task.fullId);
      }
    }
    return `${this.type.id} ${out.join(", ")}`;
  }
}