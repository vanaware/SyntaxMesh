/**
 * Base class for attributes that contain lists (arrays).
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

/** Display name of a list item (Ruby `r.name`). */
function itemName(item: { name?: string },): string {
  return item.name ?? "";
}

/**
 * Base class for list attributes.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:ListAttributeBase
 */
export abstract class ListAttributeBase<T,> extends AttributeBase<T[]> {
  /**
   * Checks whether the attribute is a list.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:isList?
   */
  override isList(): boolean {
    return true;
  }

  /**
   * Converts the list to a string (join with a comma).
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
   * Converts the list to an RTI (Rich Text Intermediate).
   *
   * Port of `ListAttributeBase#to_rti` (Attributes.rb l.498):
   * - with `query.listItem`, each item becomes an RTI of the template
   *   (re-evaluated with `q.property = item`) inside `<nowiki>` and the list is
   *   returned through `query.assignList`;
   * - without a template, each item becomes `<nowiki>name</nowiki>`;
   * - without a query, the list becomes a single RTI `a, b, c`.
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
   * Converts the value to TJP (TaskJuggler format).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  override to_tjp(): string {
    const val = this.get();
    return `${this.tjpId} ${val?.join(", ",) ?? ""}`;
  }
}
