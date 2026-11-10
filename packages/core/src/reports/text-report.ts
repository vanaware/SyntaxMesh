/**
 * TextReport (phase 14.17) — the most basic kind of report.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/TextReport.rb`.
 * Five RichText blocks (header, left, center, right, footer); the widths and
 * paddings of the side columns are computed from the presence of each block.
 * It has no CSV conversion (it emits the `text_report_no_csv` warning).
 *
 * The content is registered in the content factory (14.11) under `textreport`.
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

/** Renders the `textreport` page with its RichText blocks. */
export class TextReport extends ReportBase {
  /** Width (%) of the left column (`0` means flexible). */
  private lWidth = 0;
  /** Width (%) of the center column (`0` means flexible). */
  private cWidth = 0;
  /** Width (%) of the right column (`0` means flexible). */
  private rWidth = 0;
  /** Right padding (%) of the left column. */
  private lPadding = 0;
  /** Right padding (%) of the center column. */
  private cPadding = 0;
  /** Right padding (%) of the right column. */
  private rPadding = 0;

  /**
   * Creates the text report generator.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Computes the widths from the presence of the sections (no `a('center')`). */
  override generateIntermediateFormat(): void {
    // Propagates the current Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    // A width of 0 means the column is flexible.
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

  /** Header, column table (when there are side blocks) and footer. */
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

  /** A `textreport` cannot be converted into CSV (faithful to Ruby). */
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
   * Markdown document (SyntaxMesh extension — addendum §10): the header, the
   * left/center/right columns become sections and the footer closes the page.
   * TaskJuggler's plain text has no equivalent — here the reading order is
   * preserved.
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

// Registers the `textreport` content in the factory (14.11).
registerContentFactory(
  "textreport",
  (report: unknown,): TextReport => new TextReport(report as Report,),
);
