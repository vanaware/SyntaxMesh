/**
 * ReportTableCell + PlaceHolderCell (Fase 14.9).
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportTableCell.rb`.
 * Uma célula é a representação independente de formato de uma célula de tabela:
 * texto sobre fundo colorido, com ícone, tooltip, indentação e alinhamento.
 * Via `special`, pode delegar a renderização a um objeto externo (tabelas
 * aninhadas — ColumnTable, Fase 14.13).
 *
 * ⚠️ Browser (ADR 027): `to_html` constrói uma árvore `XMLElementLike`; o
 * tooltip usa `TagToTip(...)` como no Ruby. Nenhuma escrita a disco.
 *
 * Interfaces estruturais (`TableCellLine`/`TableCellTable`/`SpecialCell`)
 * quebram o ciclo com ReportTable/ReportTableLine, permitindo construir a
 * folha primeiro.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.9)
 */
import { XMLElement, XMLText, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import type { Query, } from "../query/query.ts";
import { CSVFile, } from "./csv-file.ts";

export type CellAlignment = "left" | "center" | "right";

/** Subconjunto de ReportTable usado pela célula (evita ciclo de import). */
export interface TableCellTable {
  maxIndent: number;
  equiLines: boolean;
  selfcontained: boolean;
  auxDir: string;
}

/** Subconjunto de ReportTableLine usado pela célula. */
export interface TableCellLine {
  addCell(cell: ReportTableCell | PlaceHolderCell,): void;
  height: number;
  table: TableCellTable;
}

/** Objeto `special`: delegação de renderização (tabelas aninhadas). */
export interface SpecialCell {
  to_html(): XMLElementLike | null;
  to_csv(csv: unknown[][], startColumn: number,): number;
}

/** Linha embutida referenciada por uma `PlaceHolderCell`. */
export interface EmbeddedLine {
  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number;
}

/** Objeto de texto da célula: string ou RichText. */
type CellText = string | RichTextIntermediate;

let idCounter = 0;
const idMap = new WeakMap<object, number>();
/** Id único estável por objeto (equivalente ao `object_id` do Ruby). */
function objectId(obj: object,): number {
  let id = idMap.get(obj,);
  if (id === undefined) {
    id = ++idCounter;
    idMap.set(obj, id,);
  }
  return id;
}

/** `nil? || empty?` do Ruby sobre string ou RichText. */
function isEmptyText(value: unknown,): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  const s = (value as RichTextIntermediate).to_s?.();
  return s === undefined ? false : s.length === 0;
}

export class ReportTableCell {
  readonly line: TableCellLine | null;
  readonly headerCell: boolean;
  readonly query: Query | null;
  text: CellText;
  tooltip: CellText | null = null;
  showTooltipHint = true;
  data: unknown = null;
  category: string | null = null;
  hidden = false;
  alignment: CellAlignment = "center";
  padding = 3;
  force_string = false;
  indent: number | null = null;
  icon: string | null = null;
  iconTooltip: CellText | null = null;
  fontSize: number | null = null;
  cellColor: string | null = null;
  fontColor: string | null = null;
  bold = false;
  width: number | null = null;
  rows = 1;
  columns = 1;
  special: SpecialCell | null = null;

  protected leftIndent = 0;
  protected rightIndent = 0;

  constructor(
    line: TableCellLine | null,
    query: Query | null,
    text: CellText | null = null,
    headerCell = false,
  ) {
    this.line = line;
    if (line) line.addCell(this,);
    this.headerCell = headerCell;
    this.query = query ? query.dup() : null;
    this.text = text ?? "";
  }

  /** Duas células são mescláveis quando texto/estética coincidem. */
  equals(c: ReportTableCell,): boolean {
    return (
      this.text === c.text &&
      this.tooltip === c.tooltip &&
      this.alignment === c.alignment &&
      this.padding === c.padding &&
      this.indent === c.indent &&
      this.cellColor === c.cellColor &&
      this.category === c.category
    );
  }

  /** Converte a célula em árvore HTML; `null` se oculta. */
  to_html(): XMLElementLike | null {
    if (this.hidden) return null;
    if (this.special) return this.special.to_html();

    const attribs: Record<string, string> = {};
    if (this.rows > 1) attribs["rowspan"] = `${this.rows}`;
    if (this.columns > 1) attribs["colspan"] = `${this.columns}`;
    attribs["class"] = this.category ?? "tabcell";
    let style = "";
    if (this.cellColor) style += `background-color: ${this.cellColor}; `;
    if (style) attribs["style"] = style;
    const cell = new XMLElement("td", attribs,);

    const table = new XMLElement("table", {
      class: this.category ? "tj_table_cell" : "tj_table_header_cell",
      cellspacing: "0",
      style: this.cellStyle(),
    },);
    cell.append(table,);
    const row = new XMLElement("tr",);
    table.append(row,);

    this.calculateIndentation();

    // Célula de padding para a indentação esquerda.
    if (this.leftIndent > 0) {
      row.append(
        new XMLElement("td", { style: `width:${this.leftIndent}px; `, },),
      );
    }
    const icon = this.cellIcon(cell,);
    if (icon) row.append(icon,);

    const [labelDiv, rawTooltip,] = this.cellLabel();
    if (labelDiv) row.append(labelDiv,);

    // Sobrescreve o tooltip se o usuário forneceu um customizado.
    const tooltip = this.tooltip ?? rawTooltip;
    if (tooltip && !isEmptyText(tooltip,) && !this.selfcontained()) {
      if (this.showTooltipHint) {
        const td = new XMLElement("td",);
        td.append(
          new XMLElement("img", {
            src: `${this.auxDir()}icons/details.png`,
            class: "tj_table_cell_tooltip",
          },),
        );
        this.addHtmlTooltip(tooltip, td, cell,);
        row.append(td,);
      } else {
        this.addHtmlTooltip(tooltip, cell,);
      }
    }

    // Célula de padding para a indentação direita.
    if (this.rightIndent > 0) {
      row.append(
        new XMLElement("td", {
          style: `width:${this.rightIndent}px; `,
        },),
      );
    }

    return cell;
  }

  /** Anexa o texto da célula à forma Array-de-Arrays da tabela. */
  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number {
    // Só a indentação esquerda é suportada em CSV.
    const indent = this.indent !== null && this.alignment === "left"
      ? "  ".repeat(this.indent,)
      : "";
    let columns = 1;
    if (this.special) {
      csv[lineIdx]![columnIdx] = null;
      columns = this.special.to_csv(csv, columnIdx,);
    } else {
      let cell: string | null;
      if (this.data !== null && typeof this.data === "string") {
        cell = this.data;
      } else if (this.text) {
        if (
          typeof (this.text as RichTextIntermediate).functionHandler ===
            "function"
        ) {
          (this.text as RichTextIntermediate).setQuery(this.query!,);
        }
        let str = this.text.toString();
        // Remove quebras de linha finais (sem sentido em CSV).
        while (str.endsWith("\n",)) str = str.slice(0, -1,);
        cell = str;
      } else {
        cell = null;
      }

      const native = this.force_string ? cell : CSVFile.strToNative(cell,);
      csv[lineIdx]![columnIdx] =
        typeof native === "string" && !this.force_string
          ? indent + native
          : native;
    }
    return columns;
  }

  /** Descritor JSON da célula (extensão SyntaxMesh — 14C.0.3). */
  toJSON(): unknown {
    if (this.hidden) return null;
    // Células especiais (calendários ColumnTable) viram descritor fixo.
    if (this.special) return { type: "calendar", };
    let text: string;
    if (typeof this.text === "string") {
      text = this.text;
    } else {
      text = (this.text as RichTextIntermediate).to_s();
    }
    return {
      text,
      indent: this.indent ?? 0,
      alignment: this.alignment,
      bold: this.bold,
    };
  }

  private selfcontained(): boolean {
    return !!this.line?.table.selfcontained;
  }

  private auxDir(): string {
    return this.line ? this.line.table.auxDir : "";
  }

  /**
   * Em modo árvore, células à esquerda/direita recebem indentação via células
   * de padding, conforme o alinhamento.
   */
  protected calculateIndentation(): void {
    this.leftIndent = 0;
    this.rightIndent = 0;
    if (this.indent !== null && this.alignment !== "center") {
      if (this.alignment === "left") {
        this.leftIndent = this.indent * 8;
      } else if (this.alignment === "right") {
        this.rightIndent = ((this.line?.table.maxIndent ?? 0) - this.indent) *
          8;
      }
    }
  }

  protected cellStyle(): string {
    let style = `text-align:${this.alignment}; `;
    if (this.line && this.line.table.equiLines) {
      style += `height:${this.line.height - 7}px; `;
    }
    return style;
  }

  protected cellIcon(cell: XMLElementLike,): XMLElementLike | null {
    if (this.icon && !this.selfcontained()) {
      const td = new XMLElement("td", { class: "tj_table_cell_icon", },);
      td.append(
        new XMLElement("img", {
          src: `${this.auxDir()}icons/${this.icon}.png`,
          alt: "Icon",
        },),
      );
      this.addHtmlTooltip(this.iconTooltip, td, cell,);
      return td;
    }
    return null;
  }

  /** Monta a célula de rótulo e retorna [td, tooltip]. */
  protected cellLabel(): [XMLElementLike | null, CellText | null,] {
    const fixedHeight = !!(this.line && this.line.table.equiLines);
    const fixedWidth = this.width !== null;
    let style = "";
    if (fixedHeight || fixedWidth) style += "overflow:hidden; ";
    style += `white-space:${
      fixedWidth && !fixedHeight ? "normal" : "nowrap"
    }; `;
    if (fixedHeight && !fixedWidth && this.line) {
      style += `height:${this.line.height - 3}px; `;
    }
    if (this.bold) style += "font-weight:bold; ";
    if (this.fontSize) style += `font-size: ${this.fontSize}px; `;
    if (this.fontColor) style += `color:${this.fontColor}; `;

    if (isEmptyText(this.text,)) return [null, null,];

    let tooltip: CellText | null = null;

    const textAsString = this.textToString();
    if (textAsString === null || textAsString.length === 0) {
      return [null, null,];
    }

    let labelWidth: number | null;
    if (this.width !== null) {
      labelWidth = this.width - 8;
      labelWidth -= this.leftIndent;
      labelWidth -= this.rightIndent;
      if (!this.selfcontained()) {
        if (this.icon) labelWidth -= 20;
        if (tooltip || this.tooltip) labelWidth -= 20;
      }
    } else {
      labelWidth = null;
    }
    const [shortText, singleLine,] = this.shortVersion(
      textAsString,
      labelWidth,
    );

    let tl: XMLElementLike | string;
    if (
      this.line && this.line.table.equiLines && (!singleLine || this.width) &&
      !this.headerCell
    ) {
      // Célula com limite de tamanho: texto curto + conteúdo completo em tooltip.
      if (shortText !== textAsString) tooltip = this.text;
      tl = shortText;
    } else {
      tl = this.isRichText(this.text,)
        ? (this.text as RichTextIntermediate).to_html() ??
          new XMLText("",)
        : this.text as string;
    }

    if (labelWidth !== null) {
      style += `min-width: ${labelWidth}px; max-width: ${labelWidth}px; `;
    }

    const td = new XMLElement("td", {
      class: "tj_table_cell_label",
      style,
    },);
    td.append(tl,);
    return [td, tooltip,];
  }

  private isRichText(value: CellText,): boolean {
    return typeof (value as RichTextIntermediate).to_html === "function";
  }

  private textToString(): string | null {
    if (typeof this.text === "string") return this.text;
    if (
      typeof (this.text as RichTextIntermediate).functionHandler === "function"
    ) {
      (this.text as RichTextIntermediate).setQuery(this.query!,);
    }
    return (this.text as RichTextIntermediate).to_s();
  }

  /** Versão de uma linha, truncada à largura, com reticências se cortada. */
  protected shortVersion(
    itext: string,
    width: number | null,
  ): [string, boolean,] {
    let text = itext;
    let singleLine = true;
    let modified = false;
    const nl = text.indexOf("\n",);
    if (nl >= 0) {
      text = text.slice(0, nl,);
      singleLine = false;
      modified = true;
    }
    if (width !== null) {
      const widthWithoutIcon = width - 20;
      const maxChars = Math.floor(widthWithoutIcon / 7,);
      if (text.length > maxChars) {
        text = maxChars > 0 ? text.slice(0, maxChars,) : "";
        modified = true;
      }
    }
    if (modified) text += "...";
    return [text, singleLine,];
  }

  protected addHtmlTooltip(
    tooltip: CellText | null,
    trigger: XMLElement,
    hook: XMLElementLike | null = null,
  ): void {
    if (!tooltip || isEmptyText(tooltip,) || this.selfcontained()) return;

    const hookEl = hook ?? trigger;
    if (
      typeof (tooltip as RichTextIntermediate).functionHandler === "function"
    ) {
      (tooltip as RichTextIntermediate).setQuery(this.query!,);
    }
    let title = "";
    if (this.query) {
      this.query.attributeId = "name";
      this.query.process();
      title = this.query.to_s();
    }
    const id = objectId(trigger,);
    trigger.attrs["onclick"] = `TagToTip('ID${id}', TITLE, '${
      title.replace(/'/g, "&apos;",)
    }')`;
    trigger.attrs["style"] = trigger.attrs["style"] ?? "cursor:help; ";
    const ltDiv = new XMLElement("div", {
      class: "tj_tooltip_box",
      style: "cursor:help",
      id: `ID${id}`,
    },);
    ltDiv.append(
      typeof (tooltip as RichTextIntermediate).to_html === "function"
        ? (tooltip as RichTextIntermediate).to_html() ??
          new XMLText("",)
        : tooltip as string,
    );
    hookEl.append(ltDiv,);
  }
}

/** Célula-placeholder: representa uma linha de uma ReportTable embutida. */
export class PlaceHolderCell {
  readonly line: TableCellLine | null;
  readonly embeddedLine: EmbeddedLine;

  constructor(line: TableCellLine | null, embeddedLine: EmbeddedLine,) {
    this.line = line;
    if (line) line.addCell(this,);
    this.embeddedLine = embeddedLine;
  }

  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number {
    return this.embeddedLine.to_csv(csv, columnIdx, lineIdx,);
  }

  to_html(): null {
    return null;
  }

  /** Descritor JSON: linha embutida (calendário) vira tipo + células. */
  toJSON(): unknown {
    const line = this.embeddedLine as unknown as {
      indentation: number;
      cells: Array<{ toJSON(): unknown }>;
    };
    return {
      type: "embedded",
      indent: line.indentation,
      cells: line.cells.map((c,) => c.toJSON()),
    };
  }
}

/** Tipo union das duas variantes de célula usadas pelas linhas da tabela. */
export type AnyTableCell = ReportTableCell | PlaceHolderCell;
