/**
 * Atributo de referência (URL + label opcional).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute
 */

import { type PropertyLike } from "../../model/property-like.ts";
import { type AttributeContainer } from "../attribute-container.ts";
import { type AttributeDefinition } from "../attribute-definition.ts";
import { AttributeBase } from "../attribute-base.ts";
import { NotYetImplementedError } from "../errors.ts";

/**
 * Atributo de referência (URL + label opcional).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute
 */
export class ReferenceAttribute extends AttributeBase<{ url: string; label?: string }> {
  /**
   * ID do tipo de atributo para ReferenceAttribute.
   */
  static readonly tjpId = "reference";

  /**
   * Converte o valor para string.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_s
   */
  override to_s(): string {
    const val = this.get();
    return val ? val.url : "";
  }

  /**
   * Converte o valor para RTI (Rich Text Intermediate).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_rti
   */
  override to_rti(): unknown {
    // TODO Fase 12: usar RichText quando disponível
    throw new NotYetImplementedError("12", "to_rti");
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ReferenceAttribute#to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    if (!val) return "";
    const urlPart = `"${val.url}"`;
    const labelPart = val.label ? ` { label "${val.label}" }` : "";
    return `${this.type.id} ${urlPart}${labelPart}`;
  }

  /**
   * Obtém a URL do valor.
   */
  url(): string | null {
    const val = this.get();
    return val ? val.url : null;
  }

  /**
   * Obtém o label do valor.
   */
  label(): string | null {
    const val = this.get();
    if (!val) return null;
    return val.label || null;
  }
}