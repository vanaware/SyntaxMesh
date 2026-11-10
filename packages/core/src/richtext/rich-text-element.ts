/**
 * RichTextElement — node of the intermediate RichText tree (Phase 12.3).
 *
 * Each node has a `category` (`richtext`, `title1`..., `paragraph`,
 * `bulletitem1`..., `inlinefunc`, ...) and children that are either other
 * elements or raw strings. From the tree it is possible to generate plain text
 * (`to_s`), tagged output for tests (`to_tagged`) and the HTML tree (`to_html`,
 * through `XMLElementLike`).
 *
 * Faithful port of `RichText/Element.rb` (RichTextElement, 40-581). Port
 * conventions:
 *   - Ruby symbols (`:title1`) become identical strings without the colon;
 *   - `@data` (polymorphic in Ruby) is `unknown` with local casts per category;
 *   - `XMLText.new(s)` → `appendRichText()` (raw strings become escapable text
 *     nodes and `null` is ignored, as in Ruby);
 *   - the 4th argument of `XMLElement.new` (a block) has no equivalent and is
 *     ignored upstream in every category here.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Element.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { XMLBlob, XMLElement, XMLText, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import type { RichTextImage, } from "./rich-text-image.ts";
import { TOCEntry, } from "./toc-entry.ts";
import type { TableOfContents, } from "./table-of-contents.ts";
import { TextFormatter, } from "../utils/text-formatter.ts";

/** Recognized categories (the symbols of `Element.rb` without the colon). */
export type RichTextCategory =
  | "richtext"
  | "title1"
  | "title2"
  | "title3"
  | "title4"
  | "hline"
  | "paragraph"
  | "pre"
  | "bulletlist1"
  | "bulletitem1"
  | "bulletlist2"
  | "bulletitem2"
  | "bulletlist3"
  | "bulletitem3"
  | "bulletlist4"
  | "bulletitem4"
  | "numberlist1"
  | "numberitem1"
  | "numberlist2"
  | "numberitem2"
  | "numberlist3"
  | "numberitem3"
  | "numberlist4"
  | "numberitem4"
  | "img"
  | "ref"
  | "href"
  | "blockfunc"
  | "inlinefunc"
  | "italic"
  | "bold"
  | "fontCol"
  | "code"
  | "text"
  | "htmlblob";

/**
 * Arguments of an inline function (`[[name: key value …]]`).
 *
 * Re-exported from the handler base so both spellings resolve to the same
 * type; `RichTextFuncData` below is built from it.
 */
export type { RichTextFunctionArgs, } from "./handlers/function-handler.ts";
import type { RichTextFunctionArgs, } from "./handlers/function-handler.ts";

/** `data` of the `*func` categories: `[name, args | null]`. */
export type RichTextFuncData = [string, RichTextFunctionArgs | null,];

/** Appends `child` (element or raw text) to `el`, ignoring `null`. */
function appendRichText(
  el: XMLElementLike,
  child: XMLElementLike | string | null,
): void {
  if (child !== null && child !== undefined) el.append(child,);
}

/**
 * One node of the intermediate RichText tree.
 */
export class RichTextElement {
  /** RTI that owns this element (source of the formatting parameters). */
  readonly richText: RichTextIntermediate;
  /** Node category, which selects the serialization behaviour. */
  readonly category: RichTextCategory;
  /**
   * Child nodes, in output order: nested elements or raw strings.
   *
   * Not `readonly` because `cleanUp` reassigns the array when it promotes the
   * children of the single `paragraph` child, as in Ruby.
   */
  children: Array<RichTextElement | string>;
  /**
   * Additional data per category: counters (`title*`/`numberitem*`),
   * `RichTextImage` (`img`), string (`ref`/`href`/`fontCol`) or `[name, args]`
   * (`blockfunc`/`inlinefunc`).
   */
  data: unknown;
  /** Whether a space must be appended after this node when serializing. */
  appendSpace: boolean;

  /**
   * Creates an element.
   *
   * @param rti Intermediate representation this element belongs to.
   * @param category Node category.
   * @param arg Initial child, list of children, or nothing.
   * @throws {Error} When `arg` is not a supported child type.
   */
  constructor(
    rti: RichTextIntermediate,
    category: RichTextCategory,
    arg?: RichTextElement | string | Array<RichTextElement | string> | null,
  ) {
    this.richText = rti;
    this.category = category;
    if (typeof arg === "string") {
      this.children = [arg,];
    } else if (arg instanceof RichTextElement) {
      this.children = [arg,];
    } else if (Array.isArray(arg,)) {
      this.children = arg;
    } else if (arg === null || arg === undefined) {
      this.children = [];
    } else {
      throw new Error(
        `Element must be of type RichTextElement instead of ${typeof arg}`,
      );
    }
    this.data = null;
    this.appendSpace = false;
  }

  /**
   * Removes the `paragraph` node when it is the only child of `richtext`,
   * promoting its children (Element.rb:76-82).
   */
  cleanUp(): RichTextElement {
    if (
      this.category === "richtext" && this.children.length === 1 &&
      this.children[0] instanceof RichTextElement &&
      this.children[0].category === "paragraph"
    ) {
      this.children = this.children[0].children;
    }
    return this;
  }

  /** True when the `richtext` tree has no children. */
  empty(): boolean {
    return this.category === "richtext" && this.children.length === 0;
  }

  /** Collects the `title1-4` titles into `toc`, recursing through the nodes. */
  tableOfContents(toc: TableOfContents, fileName: string,): void {
    let number: string | null = null;
    const counters = this.data as number[];
    switch (this.category) {
      case "title1":
        number = `${counters[0]} `;
        break;
      case "title2":
        number = `${counters[0]}.${counters[1]} `;
        break;
      case "title3":
        number = `${counters[0]}.${counters[1]}.${counters[2]} `;
        break;
      case "title4":
        number = `${counters[0]}.${counters[1]}.${counters[2]}.${counters[3]} `;
        break;
      default:
        number = null;
    }
    if (number !== null) {
      const title = this.children_to_s();
      toc.addEntry(
        new TOCEntry(number, title, fileName, this.convertToID(title,),),
      );
    } else {
      for (const el of this.children) {
        if (el instanceof RichTextElement) el.tableOfContents(toc, fileName,);
      }
    }
  }

  /** Names of the snippets referenced by internal `ref` links (without `:`). */
  internalReferences(): string[] {
    const references: string[] = [];
    if (this.category === "ref" && !String(this.data,).includes(":",)) {
      references.push(String(this.data,),);
    } else {
      for (const el of this.children) {
        if (el instanceof RichTextElement) {
          references.push(...el.internalReferences(),);
        }
      }
    }
    // Each reference only matters once.
    return [...new Set(references,),];
  }

  /** Plain text (Element.rb:143-235). */
  to_s(): string {
    const rt = this.richText;
    let pre = "";
    const post = "";
    switch (this.category) {
      case "richtext":
        break;
      case "title1":
        return this.textBlockFormat(
          rt.indent + rt.titleIndent,
          this.sTitle(1,),
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "title2":
        return this.textBlockFormat(
          rt.indent + rt.titleIndent,
          this.sTitle(2,),
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "title3":
        return this.textBlockFormat(
          rt.indent + rt.titleIndent,
          this.sTitle(3,),
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "title4":
        return this.textBlockFormat(
          rt.indent + rt.titleIndent,
          this.sTitle(4,),
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "hline":
        return " ".repeat(rt.indent,) +
          "-".repeat(rt.lineWidth - rt.indent,) + "\n";
      case "paragraph":
        return this.textBlockFormat(
          rt.indent + rt.parIndent,
          "",
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "pre":
        return new TextFormatter(rt.lineWidth, rt.indent + rt.preIndent,)
          .indent(this.children_to_s(),) + "\n";
      case "bulletlist1":
        break;
      case "bulletitem1":
        return this.textBlockFormat(
          rt.indent + rt.listIndent,
          "* ",
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "bulletlist2":
        break;
      case "bulletitem2":
        return this.textBlockFormat(
          rt.indent + rt.listIndent * 2,
          "* ",
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "bulletlist3":
        break;
      case "bulletitem3":
        return this.textBlockFormat(
          rt.indent + rt.listIndent * 3,
          "* ",
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "bulletlist4":
        break;
      case "bulletitem4":
        return this.textBlockFormat(
          rt.indent + rt.listIndent * 4,
          "* ",
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      case "numberlist1":
        break;
      case "numberitem1": {
        const d = this.data as number[];
        return this.textBlockFormat(
          rt.indent + rt.listIndent,
          `${d[0]}. `,
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      }
      case "numberlist2":
        break;
      case "numberitem2": {
        const d = this.data as number[];
        return this.textBlockFormat(
          rt.indent + rt.listIndent,
          `${d[0]}.${d[1]} `,
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      }
      case "numberlist3":
        break;
      case "numberitem3": {
        const d = this.data as number[];
        return this.textBlockFormat(
          rt.indent + rt.listIndent,
          `${d[0]}.${d[1]}.${d[2]} `,
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      }
      case "numberlist4":
        break;
      case "numberitem4": {
        const d = this.data as number[];
        return this.textBlockFormat(
          rt.indent + rt.listIndent,
          `${d[0]}.${d[1]}.${d[2]}.${d[3]} `,
          this.children_to_s(),
          rt.lineWidth,
        ) + "\n";
      }
      case "img": {
        const img = this.data as RichTextImage;
        if (img.altText) pre = img.altText;
        break;
      }
      case "ref":
      case "href":
      case "blockfunc":
        // Empty `when` in Ruby (Element.rb:217-220): falls through to the tail
        // and renders children_to_s. `ref`/`href` show the link text;
        // `blockfunc` is a childless block → ''. Only `inlinefunc` dispatches
        // to the handler.
        break;
      case "inlinefunc": {
        this.checkHandler();
        const [name, args,] = this.data as RichTextFuncData;
        pre = this.richText.functionHandler(name,)!.to_s(args ?? {},);
        break;
      }
      case "italic":
      case "bold":
      case "fontCol":
      case "code":
      case "text":
        // Empty `when` → tail: the children text is preserved in the plain
        // output.
        break;
      case "htmlblob":
        // Raw HTML has no plain-text equivalent.
        return "";
      default:
        throw new Error(`Unknown RichTextElement category ${this.category}`,);
    }

    return pre + this.children_to_s() + post;
  }

  /** Tagged output for tests (Element.rb:240-374). */
  to_tagged(): string {
    const d = this.data as number[];
    let pre = "";
    let post = "";
    switch (this.category) {
      case "richtext":
        pre = "<div>";
        post = "</div>";
        break;
      case "title1":
        pre = `<h1>${d[0]} `;
        post = "</h1>\n\n";
        break;
      case "title2":
        pre = `<h2>${d[0]}.${d[1]} `;
        post = "</h2>\n\n";
        break;
      case "title3":
        pre = `<h3>${d[0]}.${d[1]}.${d[2]} `;
        post = "</h3>\n\n";
        break;
      case "title4":
        pre = `<h4>${d[0]}.${d[1]}.${d[2]}.${d[3]} `;
        post = "</h4>\n\n";
        break;
      case "hline":
        pre = "<hr>";
        post = "</hr>\n";
        break;
      case "paragraph":
        pre = "<p>";
        post = "</p>\n\n";
        break;
      case "pre":
        pre = "<pre>";
        post = "</pre>\n\n";
        break;
      case "bulletlist1":
      case "bulletlist2":
      case "bulletlist3":
      case "bulletlist4":
        pre = "<ul>";
        post = "</ul>";
        break;
      case "bulletitem1":
        pre = "<li>* ";
        post = "</li>\n";
        break;
      case "bulletitem2":
        pre = "<li> * ";
        post = "</li>\n";
        break;
      case "bulletitem3":
        pre = "<li>  * ";
        post = "</li>\n";
        break;
      case "bulletitem4":
        pre = "<li>   * ";
        post = "</li>\n";
        break;
      case "numberlist1":
      case "numberlist2":
      case "numberlist3":
      case "numberlist4":
        pre = "<ol>";
        post = "</ol>";
        break;
      case "numberitem1":
        pre = `<li>${d[0]} `;
        post = "</li>\n";
        break;
      case "numberitem2":
        pre = `<li>${d[0]}.${d[1]} `;
        post = "</li>\n";
        break;
      case "numberitem3":
        pre = `<li>${d[0]}.${d[1]}.${d[2]} `;
        post = "</li>\n";
        break;
      case "numberitem4":
        pre = `<li>${d[0]}.${d[1]}.${d[2]}.${d[3]} `;
        post = "</li>\n";
        break;
      case "img": {
        const img = this.data as RichTextImage;
        pre = `<img file="${img.fileName}"/>`;
        break;
      }
      case "ref":
        pre = `<ref data="${this.data}">`;
        post = "</ref>";
        break;
      case "href":
        pre = `<a href="${this.hrefUrl()}" ${
          this.richText.linkTarget ? `target="${this.richText.linkTarget}"` : ""
        }>`;
        post = "</a>";
        break;
      case "blockfunc": {
        const [name, args,] = this.data as RichTextFuncData;
        pre = `<blockfunc:${name}`;
        if (args) {
          for (const key of Object.keys(args,).sort()) {
            pre += ` ${key}="${String(args[key],).replace(/"/g, '\\"',)}"`;
          }
        }
        post = "/>";
        break;
      }
      case "inlinefunc": {
        const [name, args,] = this.data as RichTextFuncData;
        pre = `<inlinefunc:${name}`;
        if (args) {
          for (const key of Object.keys(args,).sort()) {
            pre += ` ${key}="${args[key]}"`;
          }
        }
        post = "/>";
        break;
      }
      case "italic":
        pre = "<i>";
        post = "</i>";
        break;
      case "bold":
        pre = "<b>";
        post = "</b>";
        break;
      case "fontCol":
        pre = `<fcol:${this.data}>`;
        post = "</fcol>";
        break;
      case "code":
        pre = "<code>";
        post = "</code>";
        break;
      case "htmlblob":
        pre = "<html>";
        post = "</html>";
        break;
      case "text":
        pre = "[";
        post = "]";
        break;
      default:
        throw new Error(`Unknown RichTextElement category ${this.category}`,);
    }

    let out = "";
    for (const el of this.children) {
      if (el instanceof RichTextElement) {
        out += el.to_tagged() + (el.appendSpace ? " " : "");
      } else {
        out += el;
      }
    }
    return pre + out + post;
  }

  /** HTML tree (Element.rb:377-488). */
  to_html(): XMLElementLike | null {
    const rt = this.richText;
    let noChilds = false;
    const attrs: Record<string, string> = {};
    if (rt.cssClass) attrs["class"] = rt.cssClass;

    let html: XMLElementLike | null = null;
    switch (this.category) {
      case "richtext":
        html = new XMLElement(rt.blockMode ? "div" : "span", attrs,);
        break;
      case "title1":
        html = this.htmlTitle(1,);
        break;
      case "title2":
        html = this.htmlTitle(2,);
        break;
      case "title3":
        html = this.htmlTitle(3,);
        break;
      case "title4":
        html = this.htmlTitle(4,);
        break;
      case "hline":
        noChilds = true;
        html = new XMLElement("hr", attrs, true,);
        break;
      case "paragraph":
        html = new XMLElement("p", attrs,);
        break;
      case "pre": {
        noChilds = true;
        attrs["codesection"] = "1";
        const div = new XMLElement("div", attrs,);
        const pre = new XMLElement("pre", attrs,);
        div.append(pre,);
        pre.append(String(this.children[0] ?? "",),);
        html = div;
        break;
      }
      case "bulletlist1":
      case "bulletlist2":
      case "bulletlist3":
      case "bulletlist4":
        html = new XMLElement("ul", {},);
        break;
      case "bulletitem1":
      case "bulletitem2":
      case "bulletitem3":
      case "bulletitem4":
        html = new XMLElement("li", {},);
        break;
      case "numberlist1":
      case "numberlist2":
      case "numberlist3":
      case "numberlist4":
        html = new XMLElement("ol", {},);
        break;
      case "numberitem1":
      case "numberitem2":
      case "numberitem3":
      case "numberitem4":
        html = new XMLElement("li", {},);
        break;
      case "img":
        html = this.htmlObject();
        break;
      case "ref": {
        const data = String(this.data,);
        const href = data.includes("#",)
          ? (() => {
            const [base, anchor,] = data.split("#",);
            return `${base}.html#${anchor}`;
          })()
          : `${data}.html`;
        html = new XMLElement("a", { href: href, },);
        break;
      }
      case "href": {
        const a = new XMLElement("a", { href: this.hrefUrl(), },);
        if (rt.linkTarget) a.attrs["target"] = rt.linkTarget;
        html = a;
        break;
      }
      case "blockfunc":
      case "inlinefunc": {
        noChilds = true;
        this.checkHandler();
        const [name, args,] = this.data as RichTextFuncData;
        html = rt.functionHandler(name,)!.to_html(args ?? {},);
        break;
      }
      case "italic":
        html = new XMLElement("i", {},);
        break;
      case "bold":
        html = new XMLElement("b", {},);
        break;
      case "fontCol":
        html = new XMLElement("span", { style: `color:${this.data}`, },);
        break;
      case "code":
        html = new XMLElement("code", attrs,);
        break;
      case "htmlblob":
        noChilds = true;
        html = new XMLBlob(String(this.children[0] ?? "",),);
        break;
      case "text":
        noChilds = true;
        html = new XMLText(String(this.children[0] ?? "",),);
        break;
      default:
        throw new Error(`Unknown RichTextElement category ${this.category}`,);
    }

    // Some elements never have leaves.
    if (noChilds || html === null) return html;

    for (const el of this.children) {
      const childHtml = el instanceof RichTextElement
        ? el.to_html()
        : String(el,);
      appendRichText(html, childHtml,);
      if (el instanceof RichTextElement && el.appendSpace) {
        html.append(" ",);
      }
    }
    return html;
  }

  /** Concatenates the children into plain text, with a space when `appendSpace`. */
  children_to_s(): string {
    let text = "";
    for (const c of this.children) {
      const s = c instanceof RichTextElement ? c.to_s() : String(c,);
      text += s + (c instanceof RichTextElement && c.appendSpace ? " " : "");
    }
    return text;
  }

  /** Validates the function handler registered for `data[0]`. */
  checkHandler(): void {
    const [name,] = this.data as RichTextFuncData;
    if (!name || typeof name !== "string") {
      throw new Error(`Bad RichText function '${name}' requested`,);
    }
    if (this.richText.functionHandler(name,) === null) {
      throw new Error(`No handler for ${name} registered`,);
    }
  }

  /** URL of an `href`: normalizes `data` (a `richtext` subtree or a string) to text. */
  private hrefUrl(): string {
    return this.data instanceof RichTextElement
      ? this.data.to_s()
      : String(this.data,);
  }

  /** Normalizes `text` into an HTML-acceptable ID (Element.rb:510-519). */
  convertToID(text: string,): string {
    let out = "";
    for (const c of [...text,]) {
      if (
        (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") ||
        (c >= "0" && c <= "9")
      ) out += c;
      if (c === " ") out += "_";
    }
    // chomp('_'): removes a single trailing underscore.
    if (out.endsWith("_",)) out = out.slice(0, -1,);
    return out;
  }

  /** Section number in plain text: `"1.2) "` (or '' when unnumbered). */
  private sTitle(level: number,): string {
    let s = "";
    if (this.richText.sectionNumbers) {
      const d = this.data as number[];
      for (let i = 1; i <= level; i++) {
        if (s !== "") s += ".";
        s += `${d[i - 1]}`;
      }
      s += ") ";
    }
    return s;
  }

  /** `<hN id=...>` with the optional number (Element.rb:535-549). */
  private htmlTitle(level: number,): XMLElementLike {
    const attrs: Record<string, string> = {
      id: this.convertToID(this.children_to_s(),),
    };
    if (this.richText.cssClass) attrs["class"] = this.richText.cssClass;
    const el = new XMLElement(`h${level}`, attrs,);
    if (this.richText.sectionNumbers) {
      const d = this.data as number[];
      let s = "";
      for (let i = 1; i <= level; i++) {
        if (s !== "") s += ".";
        s += `${d[i - 1]}`;
      }
      s += " ";
      el.append(s,);
    }
    return el;
  }

  /** `<object>` for images with a known extension (Element.rb:551-570). */
  private htmlObject(): XMLElementLike | null {
    const fileTypes: Record<string, Record<string, string>> = {
      "png": { "type": "image/png", },
      "gif": { "type": "image/gif", },
      "jpg": { "type": "image/jpg", },
      "svg": { "type": "image/svg+xml", "class": "img", },
    };
    // The parser already validated the file; unknown extension → no element.
    const img = this.data as RichTextImage;
    const index = img.fileName.lastIndexOf(".",);
    if (index < 0) return null;
    const extension = img.fileName.slice(index + 1,).toLowerCase();
    const attributes = fileTypes[extension];
    if (!attributes) return null;
    attributes["data"] = img.fileName;

    const el = new XMLElement("object", attributes,);
    if (img.altText) el.attrs["alt"] = img.altText;
    if (img.verticalAlign) {
      el.attrs["style"] = `vertical-align:${img.verticalAlign}; `;
    }
    return el;
  }

  /** Formats a plain-text block with a hanging label (Element.rb:572-575). */
  private textBlockFormat(
    indent: number,
    label: string,
    str: string,
    width: number,
  ): string {
    const labLen = label.length;
    return new TextFormatter(width, indent + labLen, indent,).format(
      label + str,
    );
  }

  /**
   * Serializes the tree to Markdown (Phase 13.9).
   * One-way: does not guarantee a perfect round-trip with the Markdown parser.
   */
  to_markdown(): string {
    switch (this.category) {
      case "richtext":
        return this.children_markdown();
      case "title1":
        return `# ${this.children_markdown()}\n\n`;
      case "title2":
        return `## ${this.children_markdown()}\n\n`;
      case "title3":
        return `### ${this.children_markdown()}\n\n`;
      case "title4":
        return `#### ${this.children_markdown()}\n\n`;
      case "hline":
        return "---\n\n";
      case "paragraph":
        return this.children_markdown() + "\n\n";
      case "pre": {
        const raw = this.children.map((c,) =>
          c instanceof RichTextElement ? c.to_markdown() : String(c,)
        ).join("",);
        return "```\n" + raw + "\n```\n\n";
      }
      case "bulletlist1":
      case "bulletlist2":
      case "bulletlist3":
      case "bulletlist4":
        return this.children_markdown();
      case "bulletitem1":
        return `- ${this.children_markdown()}\n`;
      case "bulletitem2":
        return `  - ${this.children_markdown()}\n`;
      case "bulletitem3":
        return `    - ${this.children_markdown()}\n`;
      case "bulletitem4":
        return `      - ${this.children_markdown()}\n`;
      case "numberlist1":
      case "numberlist2":
      case "numberlist3":
      case "numberlist4":
        return this.children_markdown();
      case "numberitem1": {
        const d = this.data as number[];
        return `${d[0]}. ${this.children_markdown()}\n`;
      }
      case "numberitem2": {
        const d = this.data as number[];
        return `  ${d[1] ?? 1}. ${this.children_markdown()}\n`;
      }
      case "numberitem3": {
        const d = this.data as number[];
        return `    ${d[2] ?? 1}. ${this.children_markdown()}\n`;
      }
      case "numberitem4": {
        const d = this.data as number[];
        return `      ${d[3] ?? 1}. ${this.children_markdown()}\n`;
      }
      case "img": {
        const img = this.data as RichTextImage;
        return `![${img.altText ?? ""}](${img.fileName})`;
      }
      case "ref":
        return `[[${String(this.data,)}]]`;
      case "href":
        return `[${this.children_markdown()}](${this.hrefUrl()})`;
      case "blockfunc": {
        const [name, args,] = this.data as RichTextFuncData;
        return `[[${name}:${this.formatFuncArgs(args,)}]]\n\n`;
      }
      case "inlinefunc": {
        const [name, args,] = this.data as RichTextFuncData;
        return `[[${name}:${this.formatFuncArgs(args,)}]]`;
      }
      case "italic":
        return `*${this.children_markdown()}*`;
      case "bold":
        return `**${this.children_markdown()}**`;
      case "fontCol":
        return `<fcol:${this.data}>${this.children_markdown()}</fcol>`;
      case "code": {
        const inner = this.children_markdown();
        return "`" + inner + "`";
      }
      case "htmlblob":
        return String(this.children[0] ?? "",);
      case "text":
        return String(this.children[0] ?? "",);
      default:
        throw new Error(`Unknown category for to_markdown: ${this.category}`,);
    }
  }

  /** Concatenates the Markdown serialization of the children. */
  private children_markdown(): string {
    let out = "";
    for (const c of this.children) {
      const s = c instanceof RichTextElement ? c.to_markdown() : String(c,);
      out += s + (c instanceof RichTextElement && c.appendSpace ? " " : "");
    }
    return out;
  }

  /** Formats function args as `key=value key2="val 2"`. */
  private formatFuncArgs(args: Record<string, string> | null,): string {
    if (!args) return "";
    const parts: string[] = [];
    for (const [key, value,] of Object.entries(args,)) {
      if (value.includes(" ",)) parts.push(`${key}="${value}"`,);
      else parts.push(`${key}=${value}`,);
    }
    return parts.join(" ",);
  }
}
