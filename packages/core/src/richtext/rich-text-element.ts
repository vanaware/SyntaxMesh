/**
 * RichTextElement — nó da árvore intermediária do RichText (Fase 12.3).
 *
 * Cada nó tem uma `category` (`richtext`, `title1`…, `paragraph`, `bulletitem1`…,
 * `inlinefunc`, …) e filhos que são outros elementos ou strings cruas. A partir
 * da árvore é possível gerar texto puro (`to_s`), saída marcada para testes
 * (`to_tagged`) e a árvore HTML (`to_html`, via `XMLElementLike`).
 *
 * Port fiel de `RichText/Element.rb` (RichTextElement, 40-581). Convenções do
 * port:
 *   - símbolos Ruby (`:title1`) viram strings idênticas sem os dois-pontos;
 *   - `@data` (polimórfico no Ruby) é `unknown` com casts locais por categoria;
 *   - `XMLText.new(s)` → `appendRichText()` (string cruas viram nós de texto
 *     escapeáveis e o null é ignorado, como no Ruby);
 *   - o 4º argumento do `XMLElement.new` (bloco) não tem equivalente e é
 *     ignorado pelo upstream em todas as categorias daqui.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Element.rb
 * @see ADR 025 (RichText e function handlers)
 */

import {
  createBlob,
  SimpleXMLElement,
  type XMLElementLike,
} from "./xml-like.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import type { RichTextImage, } from "./rich-text-image.ts";
import { TOCEntry, } from "./toc-entry.ts";
import type { TableOfContents, } from "./table-of-contents.ts";
import { TextFormatter, } from "../utils/text-formatter.ts";

/** Categorias reconhecidas (os símbolos de `Element.rb` sem os dois-pontos). */
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

/** Args de uma função embutida (`[[name: key value …]]`). */
export type RichTextFunctionArgs = Record<string, string>;

/** `data` das categorias `*func`: `[nome, args | null]`. */
export type RichTextFuncData = [string, RichTextFunctionArgs | null,];

/** Anexa `child` (elemento ou texto cruo) a `el`, ignorando `null`. */
function appendRichText(
  el: XMLElementLike,
  child: XMLElementLike | string | null,
): void {
  if (child !== null && child !== undefined) el.append(child,);
}

export class RichTextElement {
  /** RTI dono deste elemento (fonte dos parâmetros de formatação). */
  readonly richText: RichTextIntermediate;
  readonly category: RichTextCategory;
  // `cleanUp` reatribui o array (promoção de filhos do paragraph), como no
  // Ruby — daí não ser `readonly`.
  children: Array<RichTextElement | string>;
  /**
   * Dados adicionais por categoria: contadores (`title*`/`numberitem*`),
   * `RichTextImage` (`img`), string (`ref`/`href`/`fontCol`) ou
   * `[nome, args]` (`blockfunc`/`inlinefunc`).
   */
  data: unknown;
  appendSpace: boolean;

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
   * Remove o nó `paragraph` quando é o único filho de `richtext`, promovendo
   * os filhos dele (Element.rb:76-82).
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

  /** Verdadeiro se a árvore `richtext` não tem filhos. */
  empty(): boolean {
    return this.category === "richtext" && this.children.length === 0;
  }

  /** Coleta os títulos `title1-4` em `toc`, recursando pelos demais nós. */
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

  /** Nomes de snippets referenciados por `ref` internas (sem `:`). */
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
    // Cada referência interessa só uma vez.
    return [...new Set(references,),];
  }

  /** Texto puro (Element.rb:143-235). */
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
        // `when` vazio no Ruby (Element.rb:217-220): cai no tail e renderiza
        // children_to_s. `ref`/`href` mostram o texto do link; `blockfunc` é
        // um bloco sem filhos → ''. Somente `inlinefunc` despacha o handler.
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
        // `when` vazio → tail: o texto dos filhos é preservado na saída plana.
        break;
      case "htmlblob":
        // HTML cru não tem equivalente em texto puro.
        return "";
      default:
        throw new Error(`Unknown RichTextElement category ${this.category}`,);
    }

    return pre + this.children_to_s() + post;
  }

  /** Saída marcada, para testes (Element.rb:240-374). */
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
        pre = `<a href="${this.data}" ${
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

  /** Árvore HTML (Element.rb:377-488). */
  to_html(): XMLElementLike | null {
    const rt = this.richText;
    let noChilds = false;
    const attrs: Record<string, string> = {};
    if (rt.cssClass) attrs["class"] = rt.cssClass;

    let html: XMLElementLike | null = null;
    switch (this.category) {
      case "richtext":
        html = new SimpleXMLElement(rt.blockMode ? "div" : "span", attrs,);
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
        html = new SimpleXMLElement("hr", attrs,);
        break;
      case "paragraph":
        html = new SimpleXMLElement("p", attrs,);
        break;
      case "pre": {
        noChilds = true;
        attrs["codesection"] = "1";
        const div = new SimpleXMLElement("div", attrs,);
        const pre = new SimpleXMLElement("pre", attrs,);
        div.append(pre,);
        pre.append(String(this.children[0] ?? "",),);
        html = div;
        break;
      }
      case "bulletlist1":
      case "bulletlist2":
      case "bulletlist3":
      case "bulletlist4":
        html = new SimpleXMLElement("ul", {},);
        break;
      case "bulletitem1":
      case "bulletitem2":
      case "bulletitem3":
      case "bulletitem4":
        html = new SimpleXMLElement("li", {},);
        break;
      case "numberlist1":
      case "numberlist2":
      case "numberlist3":
      case "numberlist4":
        html = new SimpleXMLElement("ol", {},);
        break;
      case "numberitem1":
      case "numberitem2":
      case "numberitem3":
      case "numberitem4":
        html = new SimpleXMLElement("li", {},);
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
        html = new SimpleXMLElement("a", { href: href, },);
        break;
      }
      case "href": {
        const a = new SimpleXMLElement("a", { href: String(this.data,), },);
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
        html = new SimpleXMLElement("i", {},);
        break;
      case "bold":
        html = new SimpleXMLElement("b", {},);
        break;
      case "fontCol":
        html = new SimpleXMLElement("span", { style: `color:${this.data}`, },);
        break;
      case "code":
        html = new SimpleXMLElement("code", attrs,);
        break;
      case "htmlblob":
        noChilds = true;
        html = createBlob(String(this.children[0] ?? "",),);
        break;
      case "text":
        noChilds = true;
        html = new SimpleXMLElement(null, {},);
        appendRichText(html, String(this.children[0] ?? "",),);
        break;
      default:
        throw new Error(`Unknown RichTextElement category ${this.category}`,);
    }

    // Alguns elementos nunca têm folhas.
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

  /** Concatena os filhos em texto puro, com espaço quando `appendSpace`. */
  children_to_s(): string {
    let text = "";
    for (const c of this.children) {
      const s = c instanceof RichTextElement ? c.to_s() : String(c,);
      text += s + (c instanceof RichTextElement && c.appendSpace ? " " : "");
    }
    return text;
  }

  /** Valida o handler de função registrado para `data[0]`. */
  checkHandler(): void {
    const [name,] = this.data as RichTextFuncData;
    if (!name || typeof name !== "string") {
      throw new Error(`Bad RichText function '${name}' requested`,);
    }
    if (this.richText.functionHandler(name,) === null) {
      throw new Error(`No handler for ${name} registered`,);
    }
  }

  /** Normaliza `text` para um ID aceitável em HTML (Element.rb:510-519). */
  convertToID(text: string,): string {
    let out = "";
    for (const c of [...text,]) {
      if (
        (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") ||
        (c >= "0" && c <= "9")
      ) out += c;
      if (c === " ") out += "_";
    }
    // chomp('_'): remove um único underscore final.
    if (out.endsWith("_",)) out = out.slice(0, -1,);
    return out;
  }

  /** Número da seção em texto puro: `"1.2) "` (ou '' se sem numeração). */
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

  /** `<hN id=…>` com número opcional (Element.rb:535-549). */
  private htmlTitle(level: number,): XMLElementLike {
    const attrs: Record<string, string> = {
      id: this.convertToID(this.children_to_s(),),
    };
    if (this.richText.cssClass) attrs["class"] = this.richText.cssClass;
    const el = new SimpleXMLElement(`h${level}`, attrs,);
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

  /** `<object>` para imagens com extensão conhecida (Element.rb:551-570). */
  private htmlObject(): XMLElementLike | null {
    const fileTypes: Record<string, Record<string, string>> = {
      "png": { "type": "image/png", },
      "gif": { "type": "image/gif", },
      "jpg": { "type": "image/jpg", },
      "svg": { "type": "image/svg+xml", "class": "img", },
    };
    // O parser já validou o arquivo; extensão desconhecida → sem elemento.
    const img = this.data as RichTextImage;
    const index = img.fileName.lastIndexOf(".",);
    if (index < 0) return null;
    const extension = img.fileName.slice(index + 1,).toLowerCase();
    const attributes = fileTypes[extension];
    if (!attributes) return null;
    attributes["data"] = img.fileName;

    const el = new SimpleXMLElement("object", attributes,);
    if (img.altText) el.attrs["alt"] = img.altText;
    if (img.verticalAlign) {
      el.attrs["style"] = `vertical-align:${img.verticalAlign}; `;
    }
    return el;
  }

  /** Formata um bloco de texto puro com rótulo悬挂 (Element.rb:572-575). */
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
}
