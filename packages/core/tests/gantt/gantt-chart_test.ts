/**
 * Testes de GanttChart (Fase 15.11).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.11)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { GanttChart, } from "../../src/gantt/gantt-chart.ts";
import type { GanttChartTable, } from "../../src/gantt/gantt-chart.ts";
import { GanttLine, } from "../../src/gantt/gantt-line.ts";
import type { GanttLineChart, } from "../../src/gantt/gantt-line.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Projeto de teste com período de 28 dias em janeiro de 2027. */
function project2027(): Project {
  const project = createTestProject();
  project.set("start", D("2027-01-01",),);
  project.set("end", D("2027-01-29",),);
  return project;
}

/** Definição de coluna `chart` com a escala pedida. */
function columnDef(scale = "week",): TableColumnDefinition {
  const def = new TableColumnDefinition("chart", "Chart",);
  def.scale = scale;
  return def;
}

/** Chart já gerado por escala para 2027-01-01 … 2027-01-29. */
function chartOf(
  scale = "week",
  table: GanttChartTable | null = null,
): GanttChart {
  const chart = new GanttChart(
    D("2027-01-04",),
    true,
    columnDef(scale,),
    table,
  );
  chart.generateByScale(D("2027-01-01",), D("2027-01-29",), scale,);
  return chart;
}

/** Tarefa folha com intervalo explícito. */
function task(
  project: Project,
  id: string,
  start: string,
  end: string,
  parent: Task | null = null,
): Task {
  const t = new Task(project, id, id, parent,);
  t.setForScenario("start", D(start,), 0,);
  t.setForScenario("end", D(end,), 0,);
  return t;
}

/** Cria a linha do Gantt para a property no chart. */
function addLine(
  chart: GanttChart,
  project: Project,
  property: Task,
  y: number,
  lineIndex = 0,
): GanttLine {
  const query = new Query({ project, property, scenarioIdx: 0, },);
  return new GanttLine(
    chart as unknown as GanttLineChart,
    query,
    y,
    19,
    lineIndex,
    null,
  );
}

/** Elemento filho (nunca texto nem ausente). */
function child(
  el: XMLElementLike,
  index: number,
): XMLElementLike {
  const c = el.children[index];
  if (c === undefined || typeof c === "string") {
    throw new Error(`filho ${index} não é um elemento`,);
  }
  return c;
}

/** `td > div.tabback (view) > div (chart)`. */
function chartDiv(td: XMLElementLike,): XMLElementLike {
  return child(child(td, 0,), 0,);
}

/** Classes dos filhos diretos (texto vira string vazia). */
function classesOf(el: XMLElementLike,): string[] {
  return el.children.map((c: XMLElementLike | string,) =>
    typeof c === "string" ? c : (c.attrs.class ?? "")
  );
}

describe("GanttChart", () => {
  beforeEach(() => {
    TjTime.setTimeZone("UTC",);
  },);

  describe("constructor", () => {
    it("guarda now/weekStartsMonday/table/markdate e nasce sem período", () => {
      const table: GanttChartTable = {
        legend: { showGanttItems: false, addGanttItem: () => {}, },
      };
      const chart = new GanttChart(
        D("2027-01-04",),
        true,
        columnDef(),
        table,
        D("2027-01-20",),
      );
      assertEquals(chart.now.toSeconds(), D("2027-01-04",).toSeconds(),);
      assertEquals(chart.weekStartsMonday, true,);
      assertEquals(chart.table, table,);
      assertEquals(chart.markdate?.toSeconds(), D("2027-01-20",).toSeconds(),);
      // Ruby: `@start = @end = @scale = @header = nil`.
      assertEquals(chart.start, null,);
      assertEquals(chart.end, null,);
      assertEquals(chart.scale, null,);
      assertEquals(chart.header, null,);
      assertEquals(chart.width, 0,);
      assertEquals(chart.viewWidth, null,);
    });

    it("default: sem table e sem markdate", () => {
      const chart = new GanttChart(D("2027-01-04",), false, columnDef(),);
      assertEquals(chart.table, null,);
      assertEquals(chart.markdate, null,);
      assertEquals(chart.weekStartsMonday, false,);
    });

    it("SCROLLBARHEIGHT === 20", () => {
      assertEquals(GanttChart.SCROLLBARHEIGHT, 20,);
    });
  });

  describe("escalas", () => {
    it("expõe as 6 escalas do Ruby, da mais fina à mais grossa", () => {
      const chart = new GanttChart(D("2027-01-04",), true, columnDef(),);
      assertEquals(chart.scales, [
        {
          name: "hour",
          stepSize: 20,
          stepsToFunc: "hoursTo",
          minTimeOff: 300,
        },
        {
          name: "day",
          stepSize: 20,
          stepsToFunc: "daysTo",
          minTimeOff: 21600,
        },
        {
          name: "week",
          stepSize: 20,
          stepsToFunc: "weeksTo",
          minTimeOff: 86400,
        },
        {
          name: "month",
          stepSize: 35,
          stepsToFunc: "monthsTo",
          minTimeOff: 432000,
        },
        {
          name: "quarter",
          stepSize: 28,
          stepsToFunc: "quartersTo",
          minTimeOff: -1,
        },
        { name: "year", stepSize: 20, stepsToFunc: "yearsTo", minTimeOff: -1, },
      ],);
      assertEquals(GanttChart.SCALES.length, 6,);
    });
  });

  describe("generateByScale", () => {
    it("day: 28 passos × 20px = 560px", () => {
      const chart = chartOf("day",);
      assertEquals(chart.width, 560,);
      assertEquals(chart.scale?.name, "day",);
      assertEquals(chart.start?.toSeconds(), D("2027-01-01",).toSeconds(),);
      assertEquals(chart.end?.toSeconds(), D("2027-01-29",).toSeconds(),);
    });

    it("week: 4 passos × 20px = 80px", () => {
      assertEquals(chartOf("week",).width, 80,);
    });

    it("month: 3 passos × 35px = 105px", () => {
      const chart = new GanttChart(
        D("2027-01-04",),
        true,
        columnDef("month",),
      );
      chart.generateByScale(D("2027-01-01",), D("2027-04-01",), "month",);
      assertEquals(chart.width, 105,);
    });

    it("cria o GanttHeader (altura 39)", () => {
      const chart = chartOf("day",);
      assert(chart.header !== null,);
      assertEquals(chart.header.height, 39,);
      assertEquals(chart.header.gridLines.length > 0, true,);
      assertEquals(chart.header.cellStartDates.length > 0, true,);
    });

    it("escala desconhecida lança erro", () => {
      const chart = new GanttChart(D("2027-01-04",), true, columnDef(),);
      let message = "";
      try {
        chart.generateByScale(D("2027-01-01",), D("2027-01-29",), "decade",);
      } catch (e) {
        message = String(e,);
      }
      assert(message.includes("Unknown scale decade",), message,);
    });

    it("generateByWidth só define período e largura (TODO do Ruby)", () => {
      const chart = new GanttChart(D("2027-01-04",), true, columnDef(),);
      chart.generateByWidth(D("2027-01-01",), D("2027-01-29",), 450,);
      assertEquals(chart.width, 450,);
      assertEquals(chart.start?.toSeconds(), D("2027-01-01",).toSeconds(),);
      assertEquals(chart.scale, null,);
      assertEquals(chart.header, null,);
    });
  });

  describe("dateToX", () => {
    it("dateToX(start) === 0 e dateToX(end) === width", () => {
      const chart = chartOf("day",);
      assertEquals(chart.dateToX(D("2027-01-01",),), 0,);
      assertEquals(chart.dateToX(D("2027-01-29",),), 560,);
    });

    it("interpola linearmente e trunca (20px por dia)", () => {
      const chart = chartOf("day",);
      assertEquals(chart.dateToX(D("2027-01-11",),), 200,);
      // 12h de 2027-01-12 → 220.5 → 220 (`to_i`).
      assertEquals(chart.dateToX(D("2027-01-12T12:00",),), 220,);
    });

    it("datas fora do período geram X negativo/maior que width", () => {
      const chart = chartOf("day",);
      assertEquals(chart.dateToX(D("2026-12-31",),), -20,);
      assertEquals(chart.dateToX(D("2027-01-30",),), 580,);
    });

    it("antes de gerar lança erro", () => {
      const chart = new GanttChart(D("2027-01-04",), true, columnDef(),);
      let message = "";
      try {
        chart.dateToX(D("2027-01-01",),);
      } catch (e) {
        message = String(e,);
      }
      assert(message.includes("generateByScale or generateByWidth",), message,);
    });
  });

  describe("addLine", () => {
    it("antes de generateByScale lança erro", () => {
      const project = project2027();
      const chart = new GanttChart(D("2027-01-04",), true, columnDef(),);
      let message = "";
      try {
        addLine(
          chart,
          project,
          task(project, "t1", "2027-01-04", "2027-01-08",),
          0,
        );
      } catch (e) {
        message = String(e,);
      }
      assert(message.includes("generateByScale or generateByWidth",), message,);
    });

    it("registra as linhas na ordem de criação", () => {
      const project = project2027();
      const chart = chartOf("day",);
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      addLine(
        chart,
        project,
        task(project, "t2", "2027-01-11", "2027-01-15",),
        19,
        1,
      );
      const div = chartDiv(chart.to_html(),);
      // [header, linha de t1, linha de t2] — ordem de criação.
      assertEquals(
        child(div, 1,).attrs.style?.includes("top:40px",),
        true,
      );
      assertEquals(
        child(div, 2,).attrs.style?.includes("top:59px",),
        true,
      );
    });
  });

  describe("hasScrollbar", () => {
    it("false sem viewWidth", () => {
      assertEquals(chartOf("day",).hasScrollbar(), false,);
    });

    it("false quando viewWidth >= width", () => {
      const chart = chartOf("day",);
      chart.viewWidth = 560;
      assertEquals(chart.hasScrollbar(), false,);
      chart.viewWidth = 1000;
      assertEquals(chart.hasScrollbar(), false,);
    });

    it("true quando viewWidth < width", () => {
      const chart = chartOf("day",);
      chart.viewWidth = 450;
      assertEquals(chart.hasScrollbar(), true,);
    });

    it("com scrollbar a view usa viewWidth e ganha 20px de altura", () => {
      const project = project2027();
      const chart = chartOf("day",);
      chart.viewWidth = 450;
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      const td = chart.to_html();
      const view = child(td, 0,);
      assertEquals(td.attrs.rowspan, "4",);
      assertEquals(view.attrs.style?.includes("width:450px;",), true,);
      assertEquals(view.attrs.style?.includes("height:79px;",), true,);
    });
  });

  describe("to_html", () => {
    it("td com padding e rowspan 2 + linhas (sem scrollbar)", () => {
      const project = project2027();
      const chart = chartOf("day",);
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      addLine(
        chart,
        project,
        task(project, "t2", "2027-01-11", "2027-01-15",),
        19,
        1,
      );
      const td = chart.to_html();
      assertEquals(td.tag, "td",);
      assertEquals(td.attrs.rowspan, "4",);
      assertEquals(td.attrs.style, "padding:0px; vertical-align:top;",);
      assertEquals(child(td, 0,).attrs.class, "tabback",);
      assertEquals(child(td, 0,).attrs.style?.includes("width:560px;",), true,);
    });

    it("div interna posicionada com largura e altura do chart", () => {
      const project = project2027();
      const chart = chartOf("day",);
      assert(
        addLine(
          chart,
          project,
          task(project, "t1", "2027-01-04", "2027-01-08",),
          0,
        ),
      );
      const div = chartDiv(chart.to_html(),);
      assertEquals(
        div.attrs.style,
        "margin:0px; padding:0px; position:absolute; overflow:hidden; " +
          "top:0px; left:0px; width:560px; height:59px; font-size:10px;",
      );
    });

    it("altura = maior (line.y + line.height)", () => {
      const project = project2027();
      const chart = chartOf("day",);
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      addLine(
        chart,
        project,
        task(project, "t2", "2027-01-11", "2027-01-15",),
        19,
        1,
      );
      const div = chartDiv(chart.to_html(),);
      assertEquals(div.attrs.style?.includes("height:78px;",), true,);
    });

    it("anexa o cabeçalho antes das linhas", () => {
      const project = project2027();
      const chart = chartOf("day",);
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      const div = chartDiv(chart.to_html(),);
      // O header também é um `div.tabback`.
      assertEquals(child(div, 0,).attrs.class, "tabback",);
      assertEquals(
        child(div, 0,).attrs.style?.includes("height:39px;",),
        true,
      );
    });

    it("completeChart é idempotente (mesma saída em 2 chamadas)", () => {
      const project = project2027();
      const chart = chartOf("day",);
      addLine(
        chart,
        project,
        task(project, "t1", "2027-01-04", "2027-01-08",),
        0,
      );
      const first = classesOf(chartDiv(chart.to_html(),),);
      const second = classesOf(chartDiv(chart.to_html(),),);
      assertEquals(second, first,);
    });

    it("to_csv devolve 0 (Gantt não vai para CSV)", () => {
      assertEquals(chartOf("day",).to_csv([], 0,), 0,);
    });
  });

  describe("dependências", () => {
    it("gera depline e uma ponta de seta por dependência", () => {
      const project = project2027();
      const chart = chartOf("day",);
      const t1 = task(project, "t1", "2027-01-04", "2027-01-08",);
      const t2 = task(project, "t2", "2027-01-11", "2027-01-15",);
      addLine(chart, project, t1, 0,);
      addLine(chart, project, t2, 19, 1,);
      t1.scenarioData(0,).startsuccs = () => [[t2, false,],];

      const classes = classesOf(chartDiv(chart.to_html(),),);
      assertEquals(classes.includes("tj_arrow_head",), true,);
      assertEquals(classes.filter((c,) => c === "depline").length > 0, true,);
    });

    it("deduplica a ponta quando duas tarefas chegam ao mesmo ponto", () => {
      const project = project2027();
      const chart = chartOf("day",);
      const t1 = task(project, "t1", "2027-01-04", "2027-01-08",);
      const t2 = task(project, "t2", "2027-01-04", "2027-01-08",);
      const t3 = task(project, "t3", "2027-01-18", "2027-01-22",);
      addLine(chart, project, t1, 0,);
      addLine(chart, project, t2, 19, 1,);
      addLine(chart, project, t3, 38, 2,);
      t1.scenarioData(0,).startsuccs = () => [[t3, false,],];
      t2.scenarioData(0,).startsuccs = () => [[t3, false,],];

      const classes = classesOf(chartDiv(chart.to_html(),),);
      assertEquals(
        classes.filter((c,) => c === "tj_arrow_head").length,
        1,
      );
    });

    it("ignora sucessora ausente do chart", () => {
      const project = project2027();
      const chart = chartOf("day",);
      const t1 = task(project, "t1", "2027-01-04", "2027-01-08",);
      const invisible = task(project, "t9", "2027-01-18", "2027-01-22",);
      addLine(chart, project, t1, 0,);
      t1.scenarioData(0,).startsuccs = () => [[invisible, false,],];

      const classes = classesOf(chartDiv(chart.to_html(),),);
      assertEquals(classes.includes("tj_arrow_head",), false,);
      assertEquals(classes.includes("depline",), false,);
    });
  });
});
