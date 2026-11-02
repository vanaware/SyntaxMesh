/**
 * Classe base para atributos que contêm listas (arrays).
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:ListAttributeBase
 */

import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "./attribute-container.ts";
import { type AttributeDefinition, } from "./attribute-definition.ts";
import { AttributeBase, } from "./attribute-base.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { Query, } from "../query/query.ts";

/** Nome exibido de um item de lista (Ruby `r.name`). */
function itemName(item: { name?: string },): string {
  return item.name ?? "";
}

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

  /**
   * Converte a lista para RTI (Rich Text Intermediate).
   *
   * Port de `ListAttributeBase#to_rti` (Attributes.rb l.498):
   * - com `query.listItem`, cada item vira um RTI do template (reavaliado com
   *   `q.property = item`) dentro de `<nowiki>` e a lista é devolvida por
   *   `query.assignList`;
   * - sem template, cada item vira `<nowiki>name</nowiki>`;
   * - sem query, a lista vira um único RTI `a, b, c`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Attributes.rb:ListAttributeBase#to_rti
   */
  override to_rti(query?: Query | null,): unknown {
    const items = (this.get() ?? []) as Array<{
      name?: string;
      project?: unknown;
    }>;

    if (!query) {
      const text = items.map((item,) => itemName(item,)).join(", ",);
      return new RichText(text,).generateIntermediateFormat();
    }

    const out: string[] = [];
    for (const item of items) {
      if (query.listItem) {
        const rti = new RichText(
          query.listItem,
          RTFHandlers.create(
            (item.project ?? null) as never,
          ),
        ).generateIntermediateFormat();
        if (!rti) continue;
        const q = query.dup();
        q.property = item as never;
        rti.setQuery(q,);
        out.push(`<nowiki>${rti.to_s()}</nowiki>`,);
      } else {
        out.push(`<nowiki>${itemName(item,)}</nowiki>`,);
      }
    }
    query.assignList(out,);
    return null;
  }

  /**
   * Converte o valor para TJP (formato TaskJuggler).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.tjpId} ${val?.join(", ",) ?? ""}`;
  }
}
