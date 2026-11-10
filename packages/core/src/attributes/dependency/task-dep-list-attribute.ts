/**
 * Task dependency list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Task dependency list attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute
 */
export class TaskDepListAttribute extends ListAttributeBase<
  { fullId: string } | [{ fullId: string }, boolean,]
> {
  /**
   * Attribute type ID for TaskDepListAttribute.
   */
  static readonly tjpId = "taskdeplist";

  /**
   * Converts the value to a string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        // item can be a task object or a [task, onEnd] pair
        if (Array.isArray(item,)) {
          for (const entry of item) {
            if (entry && typeof entry === "object" && "fullId" in entry) {
              out.push(entry.fullId,);
            }
          }
        } else if (item && typeof item === "object" && "fullId" in item) {
          out.push(item.fullId,);
        }
      }
    }
    return out.join(", ",);
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:TaskDepListAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    const out = [];
    if (val) {
      for (const item of val) {
        // item can be a task object or a [task, onEnd] pair
        if (Array.isArray(item,)) {
          for (const entry of item) {
            if (entry && typeof entry === "object" && "fullId" in entry) {
              out.push(entry.fullId,);
            }
          }
        } else if (item && typeof item === "object" && "fullId" in item) {
          out.push(item.fullId,);
        }
      }
    }
    return `${this.tjpId} ${out.join(", ",)}`;
  }
}
