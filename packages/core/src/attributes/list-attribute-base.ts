/**
 * Classe base para atributos que contêm listas (arrays).
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:ListAttributeBase
 */

import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "./attribute-container.ts";
import { type AttributeDefinition, } from "./attribute-definition.ts";
import { AttributeBase, } from "./attribute-base.ts";

/**
 * Classe base para atributos de lista.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:ListAttributeBase
 */
export abstract class ListAttributeBase<T,> extends AttributeBase<T[]> {
  /**
   * Verifica se o atributo é uma lista.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:isList?
   */
  override isList(): boolean {
    return true;
  }

  /**
   * Converte a lista para string (join com vírgula).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_s
   */
  override to_s(): string {
    const val = this.get();
    if (val === null) {
      return "";
    }
    return val.join(", ",);
  }
}
