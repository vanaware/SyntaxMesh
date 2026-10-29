/**
 * TOCEntry — entrada de um TableOfContents (Fase 12.7).
 *
 * Guarda o número da seção, o título, o arquivo e uma tag opcional dentro do
 * arquivo; converte-se em elementos HTML. Port fiel de
 * `RichText/TOCEntry.rb:29-80`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/TOCEntry.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "./xml-like.ts";
import { SimpleXMLElement, } from "./xml-like.ts";

/** Tamanhos de fonte por nível de seção (Ruby: `[20, 17, 15, 14, 14]`). */
const FONT_SIZES = [20, 17, 15, 14, 14,] as const;

export class TOCEntry {
  /** Número da seção como String (ex.: `1.2.3`). */
  readonly number: string;
  /** Título da seção. */
  readonly title: string;
  /** Nome do arquivo (sem sufixo). */
  readonly file: string;
  /** Tag (âncora) opcional dentro do arquivo. */
  readonly tag: string | null;

  constructor(
    number: string,
    title: string,
    file: string,
    tag?: string | null,
  ) {
    this.number = number;
    this.title = title;
    this.file = file;
    this.tag = tag ?? null;
  }

  /**
   * Entradas HTML desta entrada de TOC (pode ser 2 linhas quando nível 0,
   * com espaçamento extra acima de capítulos principais).
   */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    const lev = this.level();

    if (lev === 0) {
      // Linha extra para dar distância acima de capítulos principais.
      const spacer = new SimpleXMLElement("tr", {},);
      const td = new SimpleXMLElement("td", {},);
      td.append(new SimpleXMLElement("div", { style: "height:10px", },),);
      spacer.append(td,);
      html.push(spacer,);
    }

    const tr = new SimpleXMLElement("tr", {
      style: `font-size:${
        FONT_SIZES[Math.min(lev, FONT_SIZES.length - 1,)]
      }px;`,
    },);
    const tdNum = new SimpleXMLElement("td", { style: "width:30px;", },);
    // Capítulos de nível 0 têm o número na coluna esquerda.
    if (lev === 0) tdNum.append(this.number,);
    tr.append(tdNum,);

    const td = new SimpleXMLElement("td", {},);
    if (lev > 0) {
      // Níveis inferiores têm o número à direita, junto do título.
      const span = new SimpleXMLElement("span", {
        style: "padding-right:15px;",
      },);
      span.append(this.number,);
      td.append(span,);
    }
    const anchor = this.tag ? `#${this.tag}` : "";
    const a = new SimpleXMLElement("a", {
      href: `${this.file}.html${anchor}`,
    },);
    a.append(this.title,);
    td.append(a,);
    tr.append(td,);
    html.push(tr,);

    return html;
  }

  /**
   * Nível da seção — conta os pontos no número (`1` → 0, `1.2` → 1, …).
   * Equivalente ao Ruby: só `.` é character-acceptable; a versão real usa o
   * número formatado com pontos entre dígitos.
   */
  private level(): number {
    let lev = 0;
    for (const c of [...this.number,]) {
      if (c === ".") lev += 1;
    }
    return lev;
  }
}
