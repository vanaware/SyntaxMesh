/**
 * TextReport (Fase 14.17) — o tipo mais básico de relatório.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TextReport.rb`.
 * Cinco blocos de RichText (header, left, center, right, footer); as
 * larguras/padding das colunas laterais são calculados conforme a presença
 * de cada bloco. Não tem conversão para CSV (avisa `text_report_no_csv`).
 *
 * O conteúdo é registrado na fábrica de conteúdo (14.11) sob `textreport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.17)
 */
import type { Report, } from "../model/report.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { ReportBase, } from "./report-base.ts";
import { markdownSections, } from "./markdown.ts";
import { registerContentFactory, } from "../model/report-content.ts";

export class TextReport extends ReportBase {
  /** Larguras (%) das colunas esquerda/centro/direita (0 = flexível). */
  private lWidth = 0;
  private cWidth = 0;
  private rWidth = 0;
  /** Paddings (%) à direita de cada coluna. */
  private lPadding = 0;
  private cPadding = 0;
  private rPadding = 0;

  constructor(report: Report,) {
    super(report,);
  }

  /** Calcula as larguras conforme a presença das seções (sem `a('center')`). */
  override generateIntermediateFormat(): void {
    // Propaga o Query corrente aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    // A width of 0 means, the columns flexible.
    if (this.a("center",)) {
      if (this.a("left",) && this.a("right",)) {
        this.lWidth = this.rWidth = 20;
        this.cWidth = 60;
        this.lPadding = this.cPadding = 2;
      } else if (this.a("left",) && !this.a("right",)) {
        this.lWidth = 25;
        this.cWidth = 75;
        this.lPadding = 2;
      } else if (!this.a("left",) && this.a("right",)) {
        this.cWidth = 75;
        this.rWidth = 25;
        this.cPadding = 2;
      } else {
        this.cWidth = 100;
      }
    } else if (this.a("left",) && this.a("right",)) {
      this.lWidth = this.rWidth = 50;
      this.lPadding = 2;
    } else if (this.a("left",)) {
      this.lWidth = 100;
    } else if (this.a("right",)) {
      this.rWidth = 100;
    }
  }

  /** Header, tabela de colunas (se houver blocos laterais) e footer. */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];

    const header = this.rt_to_html("header",);
    if (header) html.push(header,);

    if (this.a("left",) || this.a("center",) || this.a("right",)) {
      const table = new XMLElement("table", {
        class: "tj_text_page",
        cellspacing: "0",
      },);
      const row = new XMLElement("tr", { class: "tj_text_row", },);
      const widths = { l: this.lWidth, c: this.cWidth, r: this.rWidth, };
      const paddings = {
        l: this.lPadding,
        c: this.cPadding,
        r: this.rPadding,
      };
      for (const name of ["left", "center", "right",] as const) {
        const key = name[0] as "l" | "c" | "r";
        const block = this.rt_to_html(name,);
        if (block) {
          const col = new XMLElement("td", {
            class: `tj_column_${name}`,
          },);
          let style = "";
          if (widths[key] > 0) style += `width:${widths[key]}%; `;
          if (paddings[key] > 0) style += `padding-right:${paddings[key]}%; `;
          col.attrs.style = style;
          col.append(block,);
          row.append(col,);
        }
      }
      table.append(row,);
      html.push(table,);
    }

    const footer = this.rt_to_html("footer",);
    if (footer) html.push(footer,);

    return html;
  }

  /** Um textreport não pode ser convertido em CSV (fiel a Ruby). */
  to_csv(): null {
    MessageHandlerInstance.instance.warning(
      "text_report_no_csv",
      `textreport '${this.report.fullId}' cannot be converted into ` +
        "CSV format",
      this.report.sourceFileInfo,
      null,
      null,
      null,
    );
    return null;
  }

  /**
   * Documento Markdown (extensão SyntaxMesh — adendo §10): header, as colunas
   * left/center/right viram seções e o footer fecha. O texto puro do
   * TaskJuggler não tem equivalente — aqui a ordem de leitura é preservada.
   */
  to_markdown(): string {
    return markdownSections([
      this.rt_to_markdown("header",),
      this.rt_to_markdown("left",),
      this.rt_to_markdown("center",),
      this.rt_to_markdown("right",),
      this.rt_to_markdown("footer",),
    ],);
  }
}

// Registra o conteúdo de `textreport` na fábrica (14.11).
registerContentFactory(
  "textreport",
  (report: unknown,): TextReport => new TextReport(report as Report,),
);
