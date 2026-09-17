/**
 * Atributo de lista de ordenação de diários.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:JournalSortListAttribute
 */

import { type PropertyLike, } from "../../model/property-like.ts";
import { type AttributeContainer, } from "../attribute-container.ts";
import { type AttributeDefinition, } from "../attribute-definition.ts";
import { ListAttributeBase, } from "../list-attribute-base.ts";

/**
 * Atributo de lista de ordenação de diários.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:JournalSortListAttribute
 */
export class JournalSortListAttribute extends ListAttributeBase<unknown> {
  /**
   * ID do tipo de atributo para JournalSortListAttribute.
   */
  static readonly tjpId = "journalsorting";
}
