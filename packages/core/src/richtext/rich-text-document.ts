/**
 * RichTextDocument — collection of `RichTextSnip` in a single document
 * (Phase 12.10).
 *
 * Abstract class faithful to `RichText/Document.rb:27-144`: registers handlers,
 * adds snips, aggregates the cross-document table of contents, validates
 * internal references and orchestrates HTML generation. The port-specific
 * variations:
 *
 * - `addSnip(file, text)` receives the **content** as a parameter (Ruby reads the
 *   file through `File.open`; the browser has no file system).
 * - `generateHTML(directory)` **returns a map name→HTML element** instead of
 *   writing `directory + name + '.html'` to disk (writing is delegated to the
 *   export layer / Phase 17).
 * - The unknown-reference warning (a `puts` in Ruby) becomes
 *   `MessageHandlerInstance.warning('rt_doc_unknown_reference', ...)`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Document.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextSnip, } from "./rich-text-snip.ts";
import { TableOfContents, } from "./table-of-contents.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";

/**
 * Base class of the multi-file RichText documents (user manual, tutorial, ...).
 *
 * Holds the shared function handlers, the snips in insertion order, the
 * aggregated table of contents and the anchors/references used to validate
 * internal links.
 */
export abstract class RichTextDocument {
  /** Function handlers shared by every snip of the document. */
  readonly functionHandlers: RichTextFunctionHandler[] = [];
  /** Registered snips, in insertion order. */
  readonly snippets: RichTextSnip[] = [];
  /** Aggregated table of contents (created by `tableOfContents()`). */
  toc: TableOfContents | null = null;
  /** Section counters shared between snips (Ruby `[0, 0, 0]`). */
  readonly sectionCounter: number[] = [0, 0, 0,];
  /** Target of every link in the snips added afterwards. */
  linkTarget: string | null = null;
  /** Known anchors: snip names + `file#tag` of the TOC entries. */
  readonly anchors: string[] = [];
  /** Internal references per snip (`snip.name → targets`). */
  references: Record<string, string[]> = {};

  /** Flags that there are new snips without prev/next wiring (Ruby @dirty). */
  private dirty: boolean = false;

  /** Registers a function handler on the document (no `dup`, as in Ruby). */
  registerFunctionHandler(handler: RichTextFunctionHandler,): void {
    this.functionHandlers.push(handler,);
  }

  /** Adds a snip to the document, propagating the current `linkTarget`. */
  addSnip(file: string, text: string,): RichTextSnip {
    const snippet = new RichTextSnip(this, file, this.sectionCounter, text,);
    this.snippets.push(snippet,);
    snippet.setLinkTarget(this.linkTarget,);
    this.dirty = true;
    return snippet;
  }

  /**
   * Builds the table of contents of every snip and collects anchors/references.
   * Must be called before {@link checkInternalReferences}.
   */
  tableOfContents(): void {
    this.toc = new TableOfContents();
    this.references = {};
    this.anchors.length = 0;
    // Collect all file names as potential anchors.
    for (const snip of this.snippets) {
      snip.tableOfContents(this.toc, snip.name,);
      this.anchors.push(snip.name,);
      const refs = snip.internalReferences();
      if (refs.length > 0) this.references[snip.name] = refs;
    }
    // Then add all section entries as well, HTML-style `<file>#<tag>`.
    for (const tocEntry of this.toc) {
      this.anchors.push(`${tocEntry.file}#${tocEntry.tag}`,);
    }
  }

  /** Warns about internal references that point to unknown anchors. */
  checkInternalReferences(): void {
    for (const snip of Object.keys(this.references,)) {
      for (const reference of this.references[snip] ?? []) {
        if (!this.anchors.includes(reference,)) {
          MessageHandlerInstance.instance.warning(
            "rt_doc_unknown_reference",
            `Rich text file ${snip} references unknown object ${reference}`,
          );
        }
      }
    }
  }

  /**
   * Generates the document HTML: chains prev/next, builds the index and each
   * snip. Returns the map `'toc.html'`/`'<snip>.html'` → complete HTML string
   * (writing to disk is delegated to the export layer / Phase 17).
   */
  generateHTML(directory = "",): Record<string, string> {
    this.crossReference();

    const out: Record<string, string> = {};
    out[directory + "toc.html"] = this.generateHTMLTableOfContents();

    for (const snip of this.snippets) {
      out[directory + snip.name + ".html"] = snip.generateHTML();
    }
    return out;
  }

  // --- Abstract methods (implemented by subclasses, e.g. UserManual) ---

  /** Style sheet of the document (Ruby: `generateStyleSheet`). */
  abstract generateStyleSheet(): XMLElementLike;
  /** Index cover (Ruby: `generateHTMLCover`). */
  abstract generateHTMLCover(): XMLElementLike;
  /** Header of each page (Ruby: `generateHTMLHeader`). */
  abstract generateHTMLHeader(): XMLElementLike;
  /** Footer of each page (Ruby: `generateHTMLFooter`). */
  abstract generateHTMLFooter(): XMLElementLike;
  /** Prev/next navigation bar (Ruby: `generateHTMLNavigationBar`). */
  abstract generateHTMLNavigationBar(
    prevName: string | null,
    prevFile: string | null,
    nextName: string | null,
    nextFile: string | null,
  ): XMLElementLike;

  // --- Private ---

  /**
   * Chains `prevSnip`/`nextSnip` on the new snips. Runs only when `dirty`
   * (Document.rb:113-126) and clears the flag when done.
   */
  private crossReference(): void {
    if (!this.dirty) return;

    let prevSnip: RichTextSnip | null = null;
    for (const snip of this.snippets) {
      if (prevSnip) {
        snip.prevSnip = prevSnip;
        prevSnip.nextSnip = snip;
      }
      prevSnip = snip;
    }

    this.dirty = false;
  }

  /** Index page: cover + TOC + footer (Document.rb:129-142). */
  private generateHTMLTableOfContents(): string {
    const doc = new HTMLDocument();
    doc.generateHead("Index",);
    const body = new XMLElement("body",);
    doc.html.append(body,);

    body.append(this.generateHTMLCover(),);
    if (this.toc) body.append(this.toc.to_html(),);
    body.append(new XMLElement("br", {}, true,),);
    body.append(new XMLElement("hr", {}, true,),);
    body.append(new XMLElement("br", {}, true,),);
    body.append(this.generateHTMLFooter(),);

    return doc.write(".",) ?? "";
  }
}
