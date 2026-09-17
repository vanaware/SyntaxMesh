/**
 * Atributo de lista de dependências.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DependencyListAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { ListAttributeBase } from "../list-attribute-base.ts";

/**
 * Atributo de lista de dependências.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DependencyListAttribute
 */
export class DependencyListAttribute extends ListAttributeBase<{ task: { fullId: string } }> {
  /**
   * ID do tipo de atributo para DependencyListAttribute.
   */
  static readonly tjpId = "dependencylist";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DependencyListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const t of val) {
        if (t.task) {
          out.push(t.task.fullId);
        }
      }
    }
    return out.join(", ");
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:DependencyListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const taskDep of val) {
        if (taskDep.task) {
          out.push(taskDep.task.fullId);
        }
      }
    }
    return `${this.type.id} ${out.join(", ")}`;
  }
}