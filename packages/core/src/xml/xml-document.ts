/**
 * XMLDocument — faithful port of `XMLDocument.rb` (phase 17.2).
 *
 * Container of top-level elements. It is not an `XMLElement`: it only
 * accumulates children and concatenates them on serialization (`to_s` calls
 * `element.to_s(0)` on each one, with no separator at all).
 *
 * Differences between `XMLDocument#<<` and `XMLElement#<<` that the port
 * preserves:
 *   - `XMLDocument` **flattens** the array (`arg.flatten`) and **validates
 *     nothing** — it does not even remove `nil` from inside the array. In Ruby
 *     a `nil` there becomes `nil.to_s == ''`; our `to_s` mirrors that
 *     (Category C). `XMLElement#<<` does not flatten and throws for
 *     non-`XMLElement` values.
 *   - `initialize(&block)` assigns the block result **without** any processing
 *     (Ruby does not accept a block that returns a lone element).
 *
 * Writing to a file (17.2.7): the browser has no filesystem (ADR 027).
 * `write('.')` — which in Ruby dumps to `$stdout` — returns the document string;
 * any other name is a no-op with a warning, following the precedent of
 * `CSVFile.write`. Real writing is anchored in phase 19 (ADR 037).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLDocument.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.2)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { type XmlChild, XMLElement, } from "./xml-element.ts";

/** Constructor block: returns the list of top-level elements. */
export type XmlDocumentBlock = (
  block: XmlDocumentBlock,
) => XMLElement[] | void;

/**
 * Argument accepted by `append` (Ruby `<<`). Nested arrays are accepted because
 * Ruby runs `arg.flatten` before accumulating.
 */
export type XmlDocumentChild = XmlChild | XmlDocumentChild[];

/**
 * Ruby `arg.flatten`: flattens only sub-arrays; `null` stays in the list
 * (unlike `compact`). Own implementation because `Array.flat(Infinity)` with the
 * recursive type `XmlDocumentChild` blows up TS instantiation.
 */
function flattenRuby(arg: XmlDocumentChild,): XmlDocumentChild[] {
  const out: XmlDocumentChild[] = [];
  const walk = (item: XmlDocumentChild,): void => {
    if (Array.isArray(item,)) {
      for (const nested of item as XmlDocumentChild[]) walk(nested,);
    } else out.push(item,);
  };
  walk(arg,);
  return out;
}

/** XML document: aggregator of top-level elements. */
export class XMLDocument {
  /** Top-level elements (Ruby `@elements`). Protected in Ruby; same here. */
  protected readonly elements: XMLElement[];

  /**
   * Ruby `initialize(&block)` — the block result becomes the element list.
   *
   * @param block Callback that returns the top-level elements.
   */
  constructor(block?: XmlDocumentBlock,) {
    this.elements = block ? ((block(block,) ?? []) as XMLElement[]) : [];
  }

  /**
   * Ruby `<<` (17.2.4–5): appends one element or flattens a list of them.
   *
   * @param arg Element or (nested) list of elements to append.
   * @throws Error When the argument is neither an array, `null` nor an
   *   `XMLElement`.
   */
  append(arg: XmlDocumentChild,): void {
    if (Array.isArray(arg,)) {
      // Ruby: `@elements += arg.flatten` — flattened and validated nothing.
      for (const item of flattenRuby(arg,)) {
        this.elements.push(item as XMLElement,);
      }
    } else if (arg === null || arg === undefined) {
      // Ruby: `elsif arg.nil? then # do nothing`
    } else if (arg instanceof XMLElement) {
      this.elements.push(arg,);
    } else {
      throw new Error(
        `Unsupported argument of type ${
          (arg as object).constructor?.name ?? typeof arg
        }: ${JSON.stringify(arg,)}`,
      );
    }
  }

  /**
   * Ruby `to_s` (17.2.6) — concatenates every element with zero indentation.
   *
   * @returns The document as XML text.
   */
  to_s(): string {
    let str = "";
    for (const element of this.elements) {
      // Ruby calls `element.to_s` even on `nil` → `nil.to_s == ''`.
      if (element === null || element === undefined) continue;
      str += element.to_s(0,);
    }
    return str;
  }

  /**
   * Ruby `write(filename)` (17.2.7): `'.'` goes to `$stdout`; file names open
   * and close a `File`. In the browser we return the string for the `'.'` case
   * and warn for the others.
   *
   * ⚠️ Ruby uses `f.puts element.to_s(0)` — `puts` only appends `\n` when the
   * string does not already end with `\n`. That makes `write('.')` **differ**
   * from `to_s()`, which concatenates with no separator at all. The port
   * preserves the difference.
   *
   * @param filename `'.'` for the document text; anything else is a no-op.
   * @returns The document text for `'.'`, `undefined` otherwise.
   */
  write(filename: string,): string | undefined {
    if (filename === ".") {
      let str = "";
      for (const element of this.elements) {
        // `nil.to_s == ''` in Ruby, and `puts ''` prints a blank line.
        const text = element === null || element === undefined ?
          "" :
          element.to_s(0,);
        str += text.endsWith("\n",) ? text : text + "\n";
      }
      return str;
    }
    MessageHandlerInstance.instance.warning(
      "xml_document_write_noop",
      `XMLDocument.write('${filename}') is a no-op in the browser; use to_s()`,
      null,
    );
    return undefined;
  }
}
