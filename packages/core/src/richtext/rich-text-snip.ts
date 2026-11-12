/**
 * RichTextSnip — building block of a `RichTextDocument` (Phase 12.9).
 *
 * In Ruby a Snip reads a structured text file through `File.open` and writes a
 * matching HTML file with `HTMLDocument#write`. In the browser (PWA) there is no
 * file system: the **content is injected** by the caller (the `text` parameter)
 * and {@link generateHTML} **returns the `<html>` element** instead of writing to
 * disk. All the remaining structure (name without directories, shared section
 * counters, `linkTarget`/`cssClass` delegation, TOC, internal references,
 * prev/next navigation bar) is faithful to `Snip.rb`.
 *
 * Faithful port of `RichText/Snip.rb:24-103`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Snip.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichText, } from "./rich-text.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import type { TableOfContents, } from "./table-of-contents.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
// Circular reference — `import type` (Document imports Snip as a value).
import type { RichTextDocument, } from "./rich-text-document.ts";

/**
 * One section of a multi-file RichText document, rendered into its own HTML
 * page.
 */
export class RichTextSnip {
  /** Snip name (file name without directories). */
  readonly name: string;
  /**
   * Previous/next snip in the document sequence (chained by crossReference).
   */
  prevSnip: RichTextSnip | null = null;
  /** Snip that follows this one in the document sequence, or `null`. */
  nextSnip: RichTextSnip | null = null;

  /** Owning document (source of handlers and abstract generators). */
  private readonly document: RichTextDocument;
  /** Intermediate representation of the text (RichTextElement tree). */
  private readonly richText: RichTextIntermediate;

  /**
   * Creates a snip. `fileName` may contain directories — they are stripped as in
   * Ruby (`@name` uses `rindex('/')`). `text` is the file content; in Ruby it
   * would be read through `File.open`. `sectionCounter` (3 numbers) is shared by
   * the snips of the document and advanced by the parser. The generated HTML is
   * returned as an element (writing to disk is delegated to Phase 17).
   *
   * @param document Document that owns this snip.
   * @param fileName File name, possibly prefixed with directories.
   * @param sectionCounter Shared section counter advanced while parsing.
   * @param text RichText source text of this snip.
   * @throws {Error} When the text cannot be parsed.
   */
  constructor(
    document: RichTextDocument,
    fileName: string,
    sectionCounter: number[],
    text: string,
  ) {
    this.document = document;
    // Strip any directories from fileName (Snip.rb:37-38).
    const slash = fileName.lastIndexOf("/",);
    this.name = slash >= 0 ? fileName.slice(slash + 1,) : fileName;

    const rText = new RichText(text, this.document.functionHandlers,);
    const rti = rText.generateIntermediateFormat(sectionCounter,);
    if (!rti) {
      // Ruby: `exit` — in the browser the error aborts only the assembly.
      throw new Error(`RichText error in snip "${this.name}"`,);
    }
    this.richText = rti;
  }

  /** Sets the target of every link in the snip (delegated to the RTI). */
  setLinkTarget(target: string | null,): void {
    this.richText.linkTarget = target;
  }

  /** Sets the CSS class of the snip (delegated to the RTI). */
  setCssClass(css: string | null,): void {
    this.richText.cssClass = css;
  }

  /** Collects the section titles into `toc` under `fileName`. */
  tableOfContents(toc: TableOfContents, fileName: string,): void {
    this.richText.tableOfContents(toc, fileName,);
  }

  /** Names of snips referenced by internal `[[...]]` links (without `:`). */
  internalReferences(): string[] {
    return this.richText.internalReferences();
  }

  /**
   * Plain-text rendering of the snip (the intermediate format's `to_s`):
   * titles, paragraphs and lists without any HTML. LSP-only projection
   * (22.1b.5.14) — Ruby's `Snip` only generates HTML.
   */
  toText(): string {
    return this.richText.to_s();
  }

  /**
   * Generates the HTML version of the snip. In Ruby the result was written to
   * `directory + name + '.html'`; here the serialized string (doctype + full
   * document) is returned — same structure: head + stylesheet, header, navbar,
   * 90% div, content, navbar, footer (Snip.rb:77-93).
   */
  generateHTML(): string {
    const doc = new HTMLDocument();
    // `generateHead` returns `doc.html` (as in Ruby): the stylesheet ends up
    // as a sibling of `<head>`, not inside it (Snip.rb:78-79).
    const head = doc.generateHead(this.name,);
    head.append(this.document.generateStyleSheet(),);

    const body = new XMLElement("body",);
    doc.html.append(body,);
    body.append(this.document.generateHTMLHeader(),);
    body.append(this.generateHTMLNavigationBar(),);

    const div = new XMLElement("div", {
      style: "width:90%; margin-left:5%; margin-right:5%",
    },);
    const content = this.richText.to_html();
    if (content) div.append(content,);
    body.append(div,);
    body.append(this.generateHTMLNavigationBar(),);
    body.append(this.document.generateHTMLFooter(),);

    // `write('.')` is the `puts` form of serializing (equivalent to Ruby's
    // `html.write(filename)`), with `\n` after each top-level element.
    return doc.write(".",) ?? "";
  }

  /** Prev/next navigation bar (names + `.html`), as in Snip.rb:97-103. */
  private generateHTMLNavigationBar(): XMLElementLike {
    const prev = this.prevSnip;
    const next = this.nextSnip;
    return this.document.generateHTMLNavigationBar(
      prev ? prev.name : null,
      prev ? `${prev.name}.html` : null,
      next ? next.name : null,
      next ? `${next.name}.html` : null,
    );
  }
}
