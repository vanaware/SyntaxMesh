/**
 * RichTextIntermediate — holder of the intermediate RichText representation
 * (Phase 12.4).
 *
 * Holds the root of the `RichTextElement` tree (`tree`) and all the formatting
 * parameters the elements consult while serializing (`indent`, `lineWidth`,
 * `sectionNumbers`, ...). The function handlers registered here are consulted by
 * `RichTextElement` for `blockfunc`/`inlinefunc`.
 *
 * Faithful port of `RichText.rb:141-233` + the `RTFWithQuerySupport.rb:35-45`
 * reopen (`setQuery`). `registerFunctionHandler` keeps `handler.dup()` as in
 * Ruby (`RichText.rb:186`), using the base `dup()` (12.11.5).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { RichTextElement, } from "./rich-text-element.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";
import type { Query, } from "../query/query.ts";
import type { TableOfContents, } from "./table-of-contents.ts";

/**
 * Intermediate representation of a RichText source: a parsed tree plus the
 * formatting and function-handler configuration used to serialize it.
 */
export class RichTextIntermediate {
  /** Back-reference to the originating `RichText` (opaque in this phase). */
  readonly richText: unknown;
  /** Root of the intermediate tree; `null` until the parser fills it in. */
  tree: RichTextElement | null = null;
  /** Block (default) vs. line mode. */
  blockMode: boolean = true;
  /** Automatic section numbering. */
  sectionNumbers: boolean = true;
  /** Maximum width of the plain text. */
  lineWidth: number = 80;
  /** Base indentation of the whole textual output. */
  indent: number = 0;
  /** Extra indentation for titles. */
  titleIndent: number = 0;
  /** Extra indentation for paragraphs. */
  parIndent: number = 0;
  /** Extra indentation for lists. */
  listIndent: number = 1;
  /** Extra indentation for `<pre>` sections. */
  preIndent: number = 0;
  /** `target` of the hypertext links. */
  linkTarget: string | null = null;
  /** CSS class applied to some HTML elements. */
  cssClass: string | null = null;
  /** Function handlers by name. */
  readonly functionHandlers: Map<string, RichTextFunctionHandler> = new Map();

  /**
   * Creates an empty intermediate representation.
   *
   * @param richText The originating `RichText` (kept as an opaque reference).
   */
  constructor(richText: unknown,) {
    this.richText = richText;
  }

  /** Registers a function handler by its name (copied via `dup`). */
  registerFunctionHandler(handler: RichTextFunctionHandler,): void {
    if (!handler) throw new Error("Bad function handler",);
    this.functionHandlers.set(handler.function, handler.dup(),);
  }

  /** Returns the handler of the `name` function, or `null`. */
  functionHandler(name: string,): RichTextFunctionHandler | null {
    return this.functionHandlers.get(name,) ?? null;
  }

  /**
   * Propagates the `Query` to the handlers that support `setQuery`
   * (RTFWithQuerySupport.rb:37-43).
   */
  setQuery(query: Query,): void {
    for (const handler of this.functionHandlers.values()) {
      const maybe = handler as RichTextFunctionHandler & {
        setQuery?: (q: Query,) => void;
      };
      if (typeof maybe.setQuery === "function") maybe.setQuery(query,);
    }
  }

  /** True when the tree is empty. */
  empty(): boolean {
    return !this.tree || this.tree.empty();
  }

  /** Extracts the titles and builds the `toc` (delegated to the tree). */
  tableOfContents(toc: TableOfContents, fileName: string,): void {
    this.tree?.tableOfContents(toc, fileName,);
  }

  /** Internal references collected by the tree. */
  internalReferences(): string[] {
    return this.tree ? this.tree.internalReferences() : [];
  }

  /** Plain text; strips the trailing line breaks (Ruby `chomp!` loop). */
  to_s(): string {
    let str = this.tree ? this.tree.to_s() : "";
    while (str.endsWith("\n",)) str = str.slice(0, -1,);
    return str;
  }

  /** HTML tree (root element), an empty `<span>` without a tree, or `null`. */
  to_html(): XMLElementLike | null {
    return this.tree ? this.tree.to_html() : new XMLElement("span", {},);
  }

  /** Tagged output for tests. */
  to_tagged(): string {
    return this.tree ? this.tree.to_tagged() : "";
  }

  /** Serializes the tree to Markdown (Phase 13.9). */
  to_markdown(): string {
    return this.tree ? this.tree.to_markdown() : "";
  }
}
