/**
 * Testes de GanttHeader (Fase 15.9).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttHeader.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.9)
 */
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { compat, } from "../../src/compat.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import {
  TableColumnDefinition,
} from "../../src/reports/table-column-definition.ts";
import {
  GanttHeader,
  type GanttHeaderChart,
} from "../../src/gantt/gantt-header.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { XMLText, } from "../../src/xml/xml-element.ts";

/** Opções do chart falso. */
interface FakeChartOptions {
  start: string;
  end: string;
  now?: string;
  markdate?: string | null;
  weekStartsMonday?: boolean;
  width?: number;
  scale?: string;
}

/**
 * Chart mínimo que satisfaz `GanttHeaderChart`. `dateToX` reproduz a fórmula
 * linear do Ruby: `((width / (end - start)) * (date - start)).to_i`.
 */
class FakeChart implements GanttHeaderChart {
  readonly start: TjTime;
  readonly end: TjTime;
  readonly now: TjTime;
  readonly markdate: TjTime | null;
  readonly weekStartsMonday: boolean;
  readonly width: number;
  readonly scale: { readonly name: string };

  constructor(options: FakeChartOptions,) {
    this.start = TjTime.fromString(options.start,);
    this.end = TjTime.fromString(options.end,);
    this.now = TjTime.fromString(options.now ?? options.start,);
    this.markdate = options.markdate
      ? TjTime.fromString(options.markdate,)
      : null;
    this.weekStartsMonday = options.weekStartsMonday ?? true;
    this.width = options.width ?? 1000;
    this.scale = { name: options.scale ?? "day", };
  }

  dateToX(date: TjTime,): number {
    const span = this.end.toSeconds() - this.start.toSeconds();
    return Math.trunc(
      (this.width / span) * (date.toSeconds() - this.start.toSeconds()),
    );
  }
}

function newColumnDef(): TableColumnDefinition {
  return new TableColumnDefinition("chart", undefined,);
}

function header(
  options: FakeChartOptions,
  columnDef: TableColumnDefinition = newColumnDef(),
): GanttHeader {
  return new GanttHeader(columnDef, new FakeChart(options,),);
}

/** Extrai o elemento filho `index`, exigindo que seja um nó (não texto). */
function childAt(html: XMLElementLike, index: number,): XMLElementLike {
  const child = html.children[index];
  if (child === null || child === undefined || typeof child === "string") {
    throw new Error(`filho ${index} não é um elemento`,);
  }
  return child;
}

/** Extrai o `left`/`top`/`width`/`height` do style de uma célula. */
function cell(header: GanttHeader, index: number,) {
  const div = childAt(header.to_html(), index,);
  return { label: labelOf(div,), style: div.attrs.style ?? "", };
}

function labelOf(div: XMLElementLike,): string {
  const inner = childAt(div, 0,);
  const txt = inner.children[0];
  // O rótulo é um nó XMLText (XMLElement real, ex-SimpleXMLElement).
  if (txt instanceof XMLText) return txt.to_s();
  return String(txt ?? "",);
}

describe("GanttHeader", () => {
  // Os resultados dependem de TjTime em UTC (como os golden tests).
  beforeEach(() => {
    TjTime.setTimeZone("UTC",);
  },);
  afterEach(() => {
    TjTime.setTimeZone("UTC",);
    compat.keepRubyBugs = true;
  },);

  describe("constructor", () => {
    it("inicia com altura de 39px (2 linhas de 19px + borda)", () => {
      assertEquals(
        header({ start: "2027-01-01", end: "2027-02-02", },).height,
        39,
      );
    });

    it("consome o chart e popula gridLines/cellStartDates", () => {
      const h = header({ start: "2027-01-01", end: "2027-02-02", },);
      assertEquals(h.gridLines.length, 2,);
      assertEquals(h.cellStartDates.length, 33,);
    });
  });

  describe("escala day", () => {
    const opts: FakeChartOptions = {
      start: "2027-01-01",
      end: "2027-02-02",
      now: "2027-01-06",
      markdate: "2027-01-08",
    };

    it("rótulos da escala grande são mês/ano (format1 padrão)", () => {
      const h = header(opts,);
      assertEquals(cell(h, 0,).label, "Jan 2027",);
      assertEquals(cell(h, 1,).label, "Feb 2027",);
    });

    it("marca as linhas de grade nos fins de mês (xR = x - 1)", () => {
      assertEquals(header(opts,).gridLines, [967, 1842,],);
    });

    it("escala grande fica na linha de cima (top:0, height:19)", () => {
      const h = header(opts,);
      assertEquals(
        cell(h, 0,).style,
        "font-weight:bold; position:absolute; left:0px; top:0px; " +
          "width:967px; height:19px; ",
      );
    });

    it("escala pequena fica abaixo (top:20) com 1px de borda", () => {
      const h = header(opts,);
      // Índice 2 = primeiro dia, logo após as 2 células grandes.
      assertEquals(cell(h, 2,).label, "01",);
      assertEquals(
        cell(h, 2,).style,
        "font-weight:bold; position:absolute; left:0px; top:20px; " +
          "width:30px; height:19px; ",
      );
      assertEquals(cell(h, 3,).label, "02",);
    });

    it("cellStartDates cobre todos os dias + a data final", () => {
      const h = header(opts,);
      assertEquals(h.cellStartDates[0]!.to_s("%Y-%m-%d",), "2027-01-01",);
      assertEquals(h.cellStartDates[31]!.to_s("%Y-%m-%d",), "2027-02-01",);
      assertEquals(
        h.cellStartDates[h.cellStartDates.length - 1]!.to_s("%Y-%m-%d",),
        "2027-02-02",
      );
    });

    it("calcula as linhas now e markdate", () => {
      const h = header(opts,);
      assertEquals(h.nowLineX, 156,);
      assertEquals(h.markdateLineX, 218,);
    });

    it("markdate nulo deixa markdateLineX em null", () => {
      assertEquals(header({ ...opts, markdate: null, },).markdateLineX, null,);
    });
  });

  describe("escala hour", () => {
    const opts: FakeChartOptions = {
      start: "2027-01-01-00:00",
      end: "2027-01-01-03:00",
      width: 300,
      scale: "hour",
    };

    it("escala grande usa '%A %Y-%m-%d' por dia", () => {
      const h = header(opts,);
      assertEquals(cell(h, 0,).label, "Friday 2027-01-01",);
      assertEquals(h.gridLines, [2399,],);
    });

    it("escala pequena usa '%H' por hora", () => {
      const h = header(opts,);
      assertEquals(
        [cell(h, 1,).label, cell(h, 2,).label, cell(h, 3,).label,],
        ["00", "01", "02",],
      );
      assertEquals(
        cell(h, 1,).style,
        "font-weight:bold; position:absolute; left:0px; top:20px; " +
          "width:99px; height:19px; ",
      );
    });

    it("cellStartDates termina no fim do período", () => {
      const h = header(opts,);
      assertEquals(h.cellStartDates.length, 4,);
      assertEquals(
        h.cellStartDates[3]!.to_s("%Y-%m-%d-%H:%M",),
        "2027-01-01-03:00",
      );
    });
  });

  describe("escala week", () => {
    const opts: FakeChartOptions = {
      start: "2027-01-06",
      end: "2027-03-06",
      scale: "week",
    };

    it("alinha as semanas na segunda-feira por padrão", () => {
      const h = header(opts,);
      assertEquals(h.cellStartDates[0]!.to_s("%Y-%m-%d",), "2027-01-04",);
      assertEquals(h.cellStartDates.length, 10,);
    });

    it("alinha no domingo quando weekStartsMonday = false", () => {
      const h = header({ ...opts, weekStartsMonday: false, },);
      assertEquals(h.cellStartDates[0]!.to_s("%Y-%m-%d",), "2027-01-03",);
    });

    it("escala grande continua mensal", () => {
      const h = header(opts,);
      assertEquals(
        [cell(h, 0,).label, cell(h, 1,).label, cell(h, 2,).label,],
        ["Jan 2027", "Feb 2027", "Mar 2027",],
      );
      assertEquals(h.gridLines, [439, 914, 1439,],);
    });
  });

  describe("escala month", () => {
    const opts: FakeChartOptions = {
      start: "2026-11-15",
      end: "2027-02-15",
      scale: "month",
    };

    it("escala grande usa '%Y' por ano", () => {
      const h = header(opts,);
      assertEquals([cell(h, 0,).label, cell(h, 1,).label,], ["2026", "2027",],);
      assertEquals(h.gridLines, [509, 4477,],);
    });

    it("escala pequena usa '%b' por mês", () => {
      const h = header(opts,);
      assertEquals(
        [
          cell(h, 2,).label,
          cell(h, 3,).label,
          cell(h, 4,).label,
          cell(h, 5,).label,
        ],
        ["Nov", "Dec", "Jan", "Feb",],
      );
      assertEquals(h.cellStartDates.length, 5,);
    });
  });

  describe("escala quarter", () => {
    const opts: FakeChartOptions = {
      start: "2027-01-01",
      end: "2027-08-01",
      width: 800,
      scale: "quarter",
    };

    it("escala pequena usa 'Q%Q'", () => {
      const h = header(opts,);
      assertEquals(
        [cell(h, 1,).label, cell(h, 2,).label, cell(h, 3,).label,],
        ["Q1", "Q2", "Q3",],
      );
    });

    it("cada trimestre termina 1px antes do próximo", () => {
      const h = header(opts,);
      assertEquals(
        cell(h, 1,).style,
        "font-weight:bold; position:absolute; left:0px; top:20px; " +
          "width:338px; height:19px; ",
      );
      assertEquals(h.cellStartDates.length, 4,);
    });
  });

  describe("escala year (Categoria B)", () => {
    const opts: FakeChartOptions = {
      start: "2027-01-01",
      end: "2029-01-02",
      scale: "year",
    };

    it("com keepRubyBugs=true a 1ª célula vai para gridLines", () => {
      // Ruby compara Arrays por conteúdo: [].== [] é true, então a escala
      // "grande" (vazia) e a pequena são indistinguíveis na 1ª iteração.
      compat.keepRubyBugs = true;
      const h = header(opts,);
      assertEquals(h.gridLines, [497,],);
      // O push final (data de término) continua acontecendo: com o flag,
      // sameItems(smallScale, smallScale) é sempre true.
      assertEquals(
        h.cellStartDates.map((t,) => t.to_s("%Y-%m-%d",)),
        ["2028-01-01", "2029-01-01", "2030-01-01",],
      );
    });

    it("com keepRubyBugs=false todas as células viram cellStartDates", () => {
      compat.keepRubyBugs = false;
      const h = header(opts,);
      assertEquals(h.gridLines, [],);
      assertEquals(
        h.cellStartDates.map((t,) => t.to_s("%Y-%m-%d",)),
        ["2027-01-01", "2028-01-01", "2029-01-01", "2030-01-01",],
      );
    });
  });

  describe("formatos das colunas", () => {
    it("timeformat1/timeformat2 sobrescrevem os padrões", () => {
      const columnDef = newColumnDef();
      columnDef.timeformat1 = "%Y/%m";
      columnDef.timeformat2 = "%d/%m";
      const h = header(
        { start: "2027-01-01", end: "2027-02-02", },
        columnDef,
      );
      assertEquals(cell(h, 0,).label, "2027/01",);
      assertEquals(cell(h, 2,).label, "01/01",);
    });
  });

  describe("erros", () => {
    it("rejeita escala desconhecida", () => {
      assertThrows(
        () =>
          header({ start: "2027-01-01", end: "2027-02-02", scale: "foo", },),
        Error,
        "Unknown scale: foo",
      );
    });
  });

  describe("to_html", () => {
    const opts: FakeChartOptions = { start: "2027-01-01", end: "2027-02-02", };

    it("gera div.tabback com largura, altura e font-size", () => {
      const html = header(opts,).to_html();
      assertEquals(html.tag, "div",);
      assertEquals(html.attrs.class, "tabback",);
      assertEquals(
        html.attrs.style,
        "margin:0px; padding:0px; position:relative; " +
          "width:1000px; height:39px; font-size:9px; ",
      );
    });

    it("trunca largura e altura com to_i (font-size = height / 4)", () => {
      const h = header({ ...opts, width: 1000.9, },);
      h.height = 45;
      assertEquals(
        h.to_html().attrs.style,
        "margin:0px; padding:0px; position:relative; " +
          "width:1000px; height:45px; font-size:11px; ",
      );
    });

    it("empilha a escala grande antes da pequena", () => {
      const html = header(opts,).to_html();
      // 2 meses + 32 dias.
      assertEquals(html.children.length, 34,);
      assertEquals(childAt(html, 0,).attrs.style?.includes("top:0px;",), true,);
      assertEquals(
        childAt(html, 2,).attrs.style?.includes("top:20px;",),
        true,
      );
    });
  });
});
