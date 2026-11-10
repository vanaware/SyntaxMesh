/**
 * MdastToRichText — converts an `mdast` AST into `RichTextElement[]`
 * (phase 13.2).
 *
 * It takes the `mdast` root (already post-processed by the extensions) and
 * produces `RichTextElement` nodes compatible with the phase 12 pipeline. Each
 * node type (`heading`, `paragraph`, `emphasis`, `list`, …) maps to a
 * `RichTextElement` category. Extension nodes (`richtextExtension`) are
 * translated into `fontCol`/`inlinefunc`/`blockfunc`.
 *
 * @see ADR 026 (Markdown as the going-forward format)
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.2)
 */

import type {
  BlockContent,
  Blockquote,
  Break,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Strong,
  Table,
  Text,
  ThematicBreak,
} from "mdast";
import type { MdastExtension, MdastRoot, } from "./types.ts";
import { RichTextElement, } from "../richtext/rich-text-element.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { RichTextImage, } from "../richtext/rich-text-image.ts";
import type {
  RichTextCategory,
  RichTextFuncData,
} from "../richtext/rich-text-element.ts";
import { sanitizeHtml, } from "./extensions/html-sanitizer.ts";

/** Maximum nesting depth supported for lists (1-4). */
const MAX_LIST_DEPTH = 4;

/** Converts a post-processed `mdast` tree into rich text elements. */
export class MdastToRichText {
  private readonly rti: RichTextIntermediate;
  /** Section counters for the headings (13.2.2). */
  private sectionCounter: number[] = [0, 0, 0, 0,];
  /** Per-level counters for the ordered lists. */
  private numberListCounter: number[] = [0, 0, 0, 0,];

  /**
   * Creates a converter bound to the target intermediate representation.
   *
   * @param rti Intermediate representation the elements belong to.
   */
  constructor(rti: RichTextIntermediate,) {
    this.rti = rti;
  }

  /**
   * Converts the `mdast` root into an array of `RichTextElement` (13.2.3).
   *
   * @param root Post-processed Markdown AST.
   * @returns The rich text elements of the document body.
   */
  convert(root: MdastRoot,): RichTextElement[] {
    return this.convertBlockChildren(root.children,);
  }

  /**
   * Converts an array of block nodes.
   *
   * @param nodes Block nodes to convert.
   * @returns The rich text elements produced by the nodes.
   */
  private convertBlockChildren(
    nodes: RootContent[],
  ): RichTextElement[] {
    const out: RichTextElement[] = [];
    for (const node of nodes) {
      out.push(...this.convertBlock(node, 0,),);
    }
    return out;
  }

  /**
   * Dispatches a block node to the matching handler.
   *
   * @param node Block node to convert.
   * @param listDepth Current list nesting depth.
   * @returns The rich text elements produced by the node.
   */
  private convertBlock(
    node: RootContent,
    listDepth: number,
  ): RichTextElement[] {
    switch (node.type) {
      case "heading":
        return this.handleHeading(node,);
      case "paragraph":
        return this.handleParagraph(node,);
      case "code":
        return this.handleCodeBlock(node,);
      case "list":
        return this.handleList(node, listDepth,);
      case "blockquote":
        return this.handleBlockquote(node,);
      case "thematicBreak":
        return this.handleThematicBreak(node,);
      case "html":
        return this.handleHtml(node,);
      case "table":
        return this.handleTable(node,);
      default:
        // Unknown or synthetic nodes: try to convert their children.
        return this.fallbackBlock(node,);
    }
  }

  // ─── Heading (13.2.4–13.2.7) ─────────────────────────────────────────────────

  /**
   * Converts a heading into a `title1`…`title4` element numbered by section.
   *
   * @param node Heading node to convert.
   * @returns A single-element array with the heading element.
   */
  private handleHeading(node: Heading,): RichTextElement[] {
    const level = Math.min(node.depth, 4,) as 1 | 2 | 3 | 4;
    // Bumps the counter and resets the lower levels (13.2.17).
    this.sectionCounter[level - 1]! += 1;
    for (let i = level; i < 4; i++) this.sectionCounter[i] = 0;

    const category = `title${level}` as RichTextCategory;
    const children = this.convertInlineChildren(node.children,);
    const el = new RichTextElement(this.rti, category, children,);
    el.data = this.sectionCounter.slice();
    return [el,];
  }

  // ─── Paragraph (13.2.8) ──────────────────────────────────────────────────────

  /**
   * Converts a paragraph, dropping it when it has no content.
   *
   * @param node Paragraph node to convert.
   * @returns The paragraph element, or an empty array.
   */
  private handleParagraph(node: Paragraph,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    if (children.length === 0) return [];
    return [new RichTextElement(this.rti, "paragraph", children,),];
  }

  // ─── Code block (13.2.10) ────────────────────────────────────────────────────

  /**
   * Converts a fenced code block into a `pre` element.
   *
   * @param node Code block node to convert.
   * @returns A single-element array with the `pre` element.
   */
  private handleCodeBlock(node: Code,): RichTextElement[] {
    return [new RichTextElement(this.rti, "pre", node.value,),];
  }

  // ─── Lists (13.2.11) ─────────────────────────────────────────────────────────

  /**
   * Converts a list into a `bulletlistN`/`numberlistN` element.
   *
   * @param node List node to convert.
   * @param listDepth Depth of the enclosing list (0 at top level).
   * @returns A single-element array with the list element.
   */
  private handleList(node: List, listDepth: number,): RichTextElement[] {
    const depth = Math.min(listDepth + 1, MAX_LIST_DEPTH,);
    const isOrdered = !!node.ordered;
    const listCategory = `${
      isOrdered ? "numberlist" : "bulletlist"
    }${depth}` as RichTextCategory;

    // Resets the ordered counter at the start of each list.
    if (isOrdered) this.numberListCounter[depth - 1] = 0;

    const items: RichTextElement[] = [];
    for (const item of node.children) {
      if (isOrdered) this.numberListCounter[depth - 1]! += 1;
      items.push(...this.handleListItem(item, depth, isOrdered,),);
    }

    return [new RichTextElement(this.rti, listCategory, items,),];
  }

  /**
   * Converts one list item, appending its nested sub-lists.
   *
   * @param node List item node to convert.
   * @param depth Depth of the list the item belongs to.
   * @param isOrdered Whether the enclosing list is ordered.
   * @returns The item element followed by the elements of its sub-lists.
   */
  private handleListItem(
    node: ListItem,
    depth: number,
    isOrdered: boolean,
  ): RichTextElement[] {
    const itemCategory = `${
      isOrdered ? "numberitem" : "bulletitem"
    }${depth}` as RichTextCategory;

    // Splits inline content from nested sub-lists.
    const inlineChildren: PhrasingContent[] = [];
    const subBlocks: BlockContent[] = [];
    for (const child of node.children) {
      if (child.type === "list") subBlocks.push(child as BlockContent,);
      else if (child.type === "paragraph") {
        inlineChildren.push(...(child as Paragraph).children,);
      } else {
        subBlocks.push(child as BlockContent,);
      }
    }

    const content = this.convertInlineChildren(inlineChildren,);
    const el = new RichTextElement(this.rti, itemCategory, content,);
    if (isOrdered) {
      el.data = this.numberListCounter.slice(0, depth,);
    }

    const out: RichTextElement[] = [el,];
    // Nested sub-lists:
    for (const sub of subBlocks) {
      if (sub.type === "list") {
        out.push(...this.handleList(sub as List, depth,),);
      }
    }
    return out;
  }

  // ─── Blockquote (13.2.12) ────────────────────────────────────────────────────

  /**
   * Converts a blockquote into a paragraph prefixed with `"> "`.
   *
   * @param node Blockquote node to convert.
   * @returns A single-element array with the paragraph.
   */
  private handleBlockquote(node: Blockquote,): RichTextElement[] {
    // Markdown blockquote → paragraph with the "> " prefix.
    const inner: RichTextElement[] = [];
    for (const child of node.children) {
      inner.push(...this.convertBlock(child as BlockContent, 0,),);
    }
    const prefix = new RichTextElement(this.rti, "text", "> ",);
    return [
      new RichTextElement(this.rti, "paragraph", [prefix, ...inner,],),
    ];
  }

  // ─── ThematicBreak (13.2.14) ─────────────────────────────────────────────────

  /**
   * Converts a thematic break into an `hline` element.
   *
   * @param _node Thematic break node; its value is not used.
   * @returns A single-element array with the `hline` element.
   */
  private handleThematicBreak(_node: ThematicBreak,): RichTextElement[] {
    return [new RichTextElement(this.rti, "hline",),];
  }

  // ─── HTML (13.2.15) ──────────────────────────────────────────────────────────

  /**
   * Converts a raw HTML fragment into a sanitized `htmlblob`.
   *
   * @param node Raw HTML node to convert.
   * @returns The blob element, or an empty array when sanitizing strips it all.
   */
  private handleHtml(node: Html,): RichTextElement[] {
    const sanitized = sanitizeHtml(node.value,);
    if (sanitized === "") return [];
    return [new RichTextElement(this.rti, "htmlblob", sanitized,),];
  }

  // ─── Table fallback (13.2.16) ────────────────────────────────────────────────

  /**
   * Converts a table into one paragraph per row, cells joined by `" | "`.
   *
   * @param node Table node to convert.
   * @returns One paragraph element per row of the table.
   */
  private handleTable(node: Table,): RichTextElement[] {
    // Tables have no native RichText representation. Fallback: each
    // tableRow becomes a paragraph with the cells separated by " | ".
    const out: RichTextElement[] = [];
    for (const row of node.children) {
      const cells: Array<RichTextElement | string> = [];
      for (let i = 0; i < row.children.length; i++) {
        if (i > 0) cells.push(" | ",);
        const cellContent = this.convertInlineChildren(
          row.children[i]!.children as PhrasingContent[],
        );
        cells.push(...cellContent,);
      }
      out.push(new RichTextElement(this.rti, "paragraph", cells,),);
    }
    return out;
  }

  // ─── Inline content ──────────────────────────────────────────────────────────

  /**
   * Converts an array of inline nodes.
   *
   * @param nodes Inline nodes to convert.
   * @returns The rich text elements produced by the nodes.
   */
  private convertInlineChildren(nodes: PhrasingContent[],): RichTextElement[] {
    const out: RichTextElement[] = [];
    for (const node of nodes) {
      out.push(...this.convertInline(node,),);
    }
    return out;
  }

  /**
   * Dispatches an inline node to the matching handler.
   *
   * @param node Inline node to convert.
   * @returns The rich text elements produced by the node.
   */
  private convertInline(node: PhrasingContent,): RichTextElement[] {
    switch (node.type) {
      case "text":
        return this.handleInlineText(node,);
      case "emphasis":
        return this.handleEmphasis(node,);
      case "strong":
        return this.handleStrong(node,);
      case "inlineCode":
        return this.handleInlineCode(node,);
      case "link":
        return this.handleLink(node,);
      case "image":
        return this.handleImage(node,);
      case "break":
        return this.handleBreak(node,);
      case "delete":
        return this.handleDelete(node,);
      case "html":
        return this.handleHtml(node as unknown as Html,);
      case "richtextExtension":
        return this.handleExtension(node as unknown as MdastExtension,);
      default:
        return [];
    }
  }

  /**
   * Converts a plain text run into a `text` element.
   *
   * @param node Text node to convert.
   * @returns A single-element array with the `text` element.
   */
  private handleInlineText(node: Text,): RichTextElement[] {
    return [new RichTextElement(this.rti, "text", node.value,),];
  }

  /**
   * Converts emphasis (`*x*`) into an `italic` element.
   *
   * @param node Emphasis node to convert.
   * @returns A single-element array with the `italic` element.
   */
  private handleEmphasis(node: Emphasis,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    return [new RichTextElement(this.rti, "italic", children,),];
  }

  /**
   * Converts strong emphasis (`**x**`) into a `bold` element.
   *
   * @param node Strong node to convert.
   * @returns A single-element array with the `bold` element.
   */
  private handleStrong(node: Strong,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    return [new RichTextElement(this.rti, "bold", children,),];
  }

  /**
   * Converts inline code into a `code` element.
   *
   * @param node Inline code node to convert.
   * @returns A single-element array with the `code` element.
   */
  private handleInlineCode(node: InlineCode,): RichTextElement[] {
    return [new RichTextElement(this.rti, "code", node.value,),];
  }

  // ─── Link → href (13.2.13) ───────────────────────────────────────────────────

  /**
   * Converts a link into an `href` element whose `data` holds the URL.
   *
   * @param node Link node to convert.
   * @returns A single-element array with the `href` element.
   */
  private handleLink(node: Link,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    const el = new RichTextElement(this.rti, "href", children,);
    // `href`'s `data` is a RichTextElement(richtext) holding the URL
    // (phase 12 rules).
    el.data = new RichTextElement(this.rti, "richtext", [
      new RichTextElement(this.rti, "text", node.url,),
    ],);
    return [el,];
  }

  // ─── Image → img (13.2.13) ───────────────────────────────────────────────────

  /**
   * Converts an image into an `img` element whose `data` holds the image.
   *
   * @param node Image node to convert.
   * @returns A single-element array with the `img` element.
   */
  private handleImage(node: Image,): RichTextElement[] {
    const img = new RichTextImage(node.url,);
    if (node.alt) img.altText = node.alt;
    const el = new RichTextElement(this.rti, "img",);
    el.data = img;
    return [el,];
  }

  // ─── Break (13.2.14) ─────────────────────────────────────────────────────────

  /**
   * Converts a hard line break into a `text` element holding `"\n"`.
   *
   * @param _node Break node; its value is not used.
   * @returns A single-element array with the line break text.
   */
  private handleBreak(_node: Break,): RichTextElement[] {
    // LINEBREAK represented as text with \n.
    return [new RichTextElement(this.rti, "text", "\n",),];
  }

  // ─── Strikethrough / Delete ──────────────────────────────────────────────────

  /**
   * Converts a strikethrough run into plain text surrounded by `~~` markers.
   *
   * @param node Delete node to convert.
   * @returns The opening marker, the content and the closing marker.
   */
  private handleDelete(node: Delete,): RichTextElement[] {
    // RichText has no native strikethrough category. Fallback: bold+italic is
    // not faithful; the text is kept plain with inline ~~ markers.
    const children = this.convertInlineChildren(node.children,);
    const open = new RichTextElement(this.rti, "text", "~~",);
    const close = new RichTextElement(this.rti, "text", "~~",);
    return [open, ...children, close,];
  }

  // ─── richtextExtension (fontCol/inlinefunc/blockfunc) ────────────────────────

  /**
   * Converts a Markdown extension node into its rich text counterpart.
   *
   * @param node Extension node produced by the extraction pipeline.
   * @returns The `fontCol`, `inlinefunc` or `blockfunc` element.
   */
  private handleExtension(node: MdastExtension,): RichTextElement[] {
    const category = node.category as RichTextCategory;
    if (category === "fontCol") {
      const color = node.payload as string;
      const children = this.convertInlineChildren(node.children,);
      const el = new RichTextElement(this.rti, "fontCol", children,);
      el.data = color;
      return [el,];
    }
    // inlinefunc / blockfunc
    const [name, args,] = node.payload as [string, Record<string, string>,];
    const data: RichTextFuncData = [name, args,];
    const el = new RichTextElement(this.rti, category,);
    el.data = data;
    return [el,];
  }

  // ─── Fallback ────────────────────────────────────────────────────────────────

  /**
   * Converts a text node into a paragraph holding that text.
   *
   * @param node Text node to convert.
   * @returns A single-element array with the wrapping paragraph.
   */
  private handleTextBlock(node: Text,): RichTextElement[] {
    return [
      new RichTextElement(this.rti, "paragraph", [
        new RichTextElement(this.rti, "text", node.value,),
      ],),
    ];
  }

  /**
   * Converts an unknown node by treating its children as inline content.
   *
   * @param node Node with an optional `children` array.
   * @returns A paragraph with the converted children, or an empty array.
   */
  private fallbackBlock(node: unknown,): RichTextElement[] {
    // Unknown node: try to extract the children as inline content.
    const n = node as { children?: PhrasingContent[] };
    if (n.children && Array.isArray(n.children,)) {
      const children = this.convertInlineChildren(n.children,);
      if (children.length > 0) {
        return [new RichTextElement(this.rti, "paragraph", children,),];
      }
    }
    return [];
  }
}
