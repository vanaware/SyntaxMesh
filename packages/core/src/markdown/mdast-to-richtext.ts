/**
 * MdastToRichText — converte AST `mdast` para `RichTextElement[]` (Fase 13.2).
 *
 * Recebe a raiz `mdast` (já pós-processada pelas extensões) e produz elementos
 * `RichTextElement` compatíveis com o pipeline da Fase 12. Cada tipo de nó
 * (`heading`, `paragraph`, `emphasis`, `list`, …) mapeia para uma categoria
 * `RichTextElement`. Nós de extensão (`richtextExtension`) são traduzidos para
 * `fontCol`/`inlinefunc`/`blockfunc`.
 *
 * @see ADR 026 (Markdown como formato going-forward)
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

/** Profundidade máxima suportada para listas (1-4). */
const MAX_LIST_DEPTH = 4;

export class MdastToRichText {
  private readonly rti: RichTextIntermediate;
  /** Contador de seções para títulos (13.2.2). */
  private sectionCounter: number[] = [0, 0, 0, 0,];
  /** Contadores por nível para listas numeradas. */
  private numberListCounter: number[] = [0, 0, 0, 0,];

  constructor(rti: RichTextIntermediate,) {
    this.rti = rti;
  }

  /** Converte a raiz `mdast` em array de `RichTextElement` (13.2.3). */
  convert(root: MdastRoot,): RichTextElement[] {
    return this.convertBlockChildren(root.children,);
  }

  /** Converte um array de nós de bloco. */
  private convertBlockChildren(
    nodes: RootContent[],
  ): RichTextElement[] {
    const out: RichTextElement[] = [];
    for (const node of nodes) {
      out.push(...this.convertBlock(node, 0,),);
    }
    return out;
  }

  /** Despacha um nó de bloco para o handler adequado. */
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
        // Nós desconhecidos ou sintéticos: tenta converter children.
        return this.fallbackBlock(node,);
    }
  }

  // ─── Heading (13.2.4–13.2.7) ─────────────────────────────────────────────────

  private handleHeading(node: Heading,): RichTextElement[] {
    const level = Math.min(node.depth, 4,) as 1 | 2 | 3 | 4;
    // Incrementa o contador e reseta os níveis inferiores (13.2.17).
    this.sectionCounter[level - 1]! += 1;
    for (let i = level; i < 4; i++) this.sectionCounter[i] = 0;

    const category = `title${level}` as RichTextCategory;
    const children = this.convertInlineChildren(node.children,);
    const el = new RichTextElement(this.rti, category, children,);
    el.data = this.sectionCounter.slice();
    return [el,];
  }

  // ─── Paragraph (13.2.8) ──────────────────────────────────────────────────────

  private handleParagraph(node: Paragraph,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    if (children.length === 0) return [];
    return [new RichTextElement(this.rti, "paragraph", children,),];
  }

  // ─── Code block (13.2.10) ────────────────────────────────────────────────────

  private handleCodeBlock(node: Code,): RichTextElement[] {
    return [new RichTextElement(this.rti, "pre", node.value,),];
  }

  // ─── Lists (13.2.11) ─────────────────────────────────────────────────────────

  private handleList(node: List, listDepth: number,): RichTextElement[] {
    const depth = Math.min(listDepth + 1, MAX_LIST_DEPTH,);
    const isOrdered = !!node.ordered;
    const listCategory = `${
      isOrdered ? "numberlist" : "bulletlist"
    }${depth}` as RichTextCategory;

    // Reseta o contador numerado no início de cada lista.
    if (isOrdered) this.numberListCounter[depth - 1] = 0;

    const items: RichTextElement[] = [];
    for (const item of node.children) {
      if (isOrdered) this.numberListCounter[depth - 1]! += 1;
      items.push(...this.handleListItem(item, depth, isOrdered,),);
    }

    return [new RichTextElement(this.rti, listCategory, items,),];
  }

  private handleListItem(
    node: ListItem,
    depth: number,
    isOrdered: boolean,
  ): RichTextElement[] {
    const itemCategory = `${
      isOrdered ? "numberitem" : "bulletitem"
    }${depth}` as RichTextCategory;

    // Separa conteúdo inline de sub- listas.
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
    // Sub-listas aninhadas:
    for (const sub of subBlocks) {
      if (sub.type === "list") {
        out.push(...this.handleList(sub as List, depth,),);
      }
    }
    return out;
  }

  // ─── Blockquote (13.2.12) ────────────────────────────────────────────────────

  private handleBlockquote(node: Blockquote,): RichTextElement[] {
    // Markdown blockquote → paragraph com prefixo "> ".
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

  private handleThematicBreak(_node: ThematicBreak,): RichTextElement[] {
    return [new RichTextElement(this.rti, "hline",),];
  }

  // ─── HTML (13.2.15) ──────────────────────────────────────────────────────────

  private handleHtml(node: Html,): RichTextElement[] {
    const sanitized = sanitizeHtml(node.value,);
    if (sanitized === "") return [];
    return [new RichTextElement(this.rti, "htmlblob", sanitized,),];
  }

  // ─── Table fallback (13.2.16) ────────────────────────────────────────────────

  private handleTable(node: Table,): RichTextElement[] {
    // Tabelas não têm representação nativa em RichText. Fallback: cada
    // tableRow vira um paragraph com cells separadas por " | ".
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

  private convertInlineChildren(nodes: PhrasingContent[],): RichTextElement[] {
    const out: RichTextElement[] = [];
    for (const node of nodes) {
      out.push(...this.convertInline(node,),);
    }
    return out;
  }

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

  private handleInlineText(node: Text,): RichTextElement[] {
    return [new RichTextElement(this.rti, "text", node.value,),];
  }

  private handleEmphasis(node: Emphasis,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    return [new RichTextElement(this.rti, "italic", children,),];
  }

  private handleStrong(node: Strong,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    return [new RichTextElement(this.rti, "bold", children,),];
  }

  private handleInlineCode(node: InlineCode,): RichTextElement[] {
    return [new RichTextElement(this.rti, "code", node.value,),];
  }

  // ─── Link → href (13.2.13) ───────────────────────────────────────────────────

  private handleLink(node: Link,): RichTextElement[] {
    const children = this.convertInlineChildren(node.children,);
    const el = new RichTextElement(this.rti, "href", children,);
    // `data` de `href` é um RichTextElement(richtext) com o URL (Fase 12 rules).
    el.data = new RichTextElement(this.rti, "richtext", [
      new RichTextElement(this.rti, "text", node.url,),
    ],);
    return [el,];
  }

  // ─── Image → img (13.2.13) ───────────────────────────────────────────────────

  private handleImage(node: Image,): RichTextElement[] {
    const img = new RichTextImage(node.url,);
    if (node.alt) img.altText = node.alt;
    const el = new RichTextElement(this.rti, "img",);
    el.data = img;
    return [el,];
  }

  // ─── Break (13.2.14) ─────────────────────────────────────────────────────────

  private handleBreak(_node: Break,): RichTextElement[] {
    // LINEBREAK representado como text com \n.
    return [new RichTextElement(this.rti, "text", "\n",),];
  }

  // ─── Strikethrough / Delete ──────────────────────────────────────────────────

  private handleDelete(node: Delete,): RichTextElement[] {
    // Não há categoria nativa strikethrough em RichText. Fallback: bold+italic
    // não é fiel; mantemos texto puro com ~~ marcador inline.
    const children = this.convertInlineChildren(node.children,);
    const open = new RichTextElement(this.rti, "text", "~~",);
    const close = new RichTextElement(this.rti, "text", "~~",);
    return [open, ...children, close,];
  }

  // ─── richtextExtension (fontCol/inlinefunc/blockfunc) ────────────────────────

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

  private handleTextBlock(node: Text,): RichTextElement[] {
    return [
      new RichTextElement(this.rti, "paragraph", [
        new RichTextElement(this.rti, "text", node.value,),
      ],),
    ];
  }

  private fallbackBlock(node: unknown,): RichTextElement[] {
    // Nó desconhecido: tenta extrair children como inline.
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
