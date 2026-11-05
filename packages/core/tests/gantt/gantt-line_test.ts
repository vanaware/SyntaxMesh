/**
 * Testes de GanttLine (Fase 15.10).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttLine.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.10)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import type { ReportContext, } from "../../src/reports/report-context.ts";
import {
  CellSettingPattern,
  CellSettingPatternList,
} from "../../src/reports/table-column-definition.ts";
import type { LogicalExpression, } from "../../src/logical/logical-expression.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { XMLText, } from "../../src/xml/xml-element.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { GanttRouter, } from "../../src/gantt/gantt-router.ts";
import { GanttTaskBar, } from "../../src/gantt/gantt-task-bar.ts";
import { GanttMilestone, } from "../../src/gantt/gantt-milestone.ts";
import { GanttContainer, } from "../../src/gantt/gantt-container.ts";
import { GanttLoadStack, } from "../../src/gantt/gantt-load-stack.ts";
import { IntervalList, } from "../../src/time/interval-list.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import {
  GanttLine,
  type GanttLineChart,
  type GanttLineProperty,
} from "../../src/gantt/gantt-line.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Células semanais cobrindo 2027-01-01 … 2027-01-29. */
const CELL_DATES = [
  "2027-01-01",
  "2027-01-08",
  "2027-01-15",
  "2027-01-22",
  "2027-01-29",
];

/** Chart falso que satisfaz `GanttLineChart`. */
class FakeChart implements GanttLineChart {
  readonly width: number;
  readonly start = D("2027-01-01",);
  readonly end = D("2027-01-29",);
  readonly header: {
    height: number;
    gridLines: number[];
    cellStartDates: TjTime[];
    nowLineX: number | null;
    markdateLineX: number | null;
  };
  readonly scale: { minTimeOff: number };
  readonly table: {
    legend: {
      showGanttItems: boolean;
      addGanttItem(label: string, category: string,): void;
    };
  } | null;
  readonly legendItems: Array<[string, string,]> = [];
  readonly lines: GanttLine[] = [];
  readonly tasks: Array<[PropertyTreeNode, GanttLine,]> = [];
  showGanttItems = false;

  constructor(
    options: {
      width?: number;
      gridLines?: number[];
      nowLineX?: number | null;
      markdateLineX?: number | null;
      minTimeOff?: number;
      withTable?: boolean;
      headerHeight?: number;
    } = {},
  ) {
    this.width = options.width ?? 700;
    this.header = {
      height: options.headerHeight ?? 39,
      gridLines: options.gridLines ?? [],
      cellStartDates: CELL_DATES.map((d,) => D(d,)),
      nowLineX: options.nowLineX ?? null,
      markdateLineX: options.markdateLineX ?? null,
    };
    this.scale = { minTimeOff: options.minTimeOff ?? 0, };
    this.table = options.withTable === false ? null : {
      legend: {
        showGanttItems: false,
        addGanttItem: (label: string, category: string,) => {
          this.legendItems.push([label, category,],);
        },
      },
    };
  }

  dateToX(date: TjTime,): number {
    const span = this.end.toSeconds() - this.start.toSeconds();
    return Math.trunc(
      (this.width / span) * (date.toSeconds() - this.start.toSeconds()),
    );
  }

  addLine(line: GanttLine,): void {
    this.lines.push(line,);
  }

  addTask(property: PropertyTreeNode, line: GanttLine,): void {
    this.tasks.push([property, line,],);
  }
}

/** Projeto de teste com start/end de 2027 e uma tarefa de 10 dias. */
function project2027(): Project {
  const project = createTestProject();
  project.set("start", D("2027-01-01",),);
  project.set("end", D("2027-01-29",),);
  return project;
}

function leafTask(project: Project,): Task {
  const task = new Task(project, "t1", "Task 1", null,);
  task.setForScenario("start", D("2027-01-04",), 0,);
  task.setForScenario("end", D("2027-01-14",), 0,);
  return task;
}

function query(project: Project, property: Task | Resource,): Query {
  return new Query({ project, property, scenarioIdx: 0, },);
}

/** Primeiro content da linha (o único nos casos de teste). */
function onlyContent(line: GanttLine,) {
  const content = (line as unknown as { content: unknown[] }).content;
  assertEquals(content.length, 1,);
  return content[0];
}

describe("GanttLine", () => {
  beforeEach(() => {
    TjTime.setTimeZone("UTC",);
  },);

  describe("constructor", () => {
    it("posiciona a linha abaixo do cabeçalho (y + height + 1)", () => {
      const project = project2027();
      const line = new GanttLine(
        new FakeChart(),
        query(project, leafTask(project,),),
        5,
        19,
        0,
        null,
      );
      assertEquals(line.y, 5 + 39 + 1,);
      assertEquals(line.height, 19,);
      assertEquals(line.query.property?.id, "t1",);
    });

    it("registra a linha no chart antes de gerar o conteúdo", () => {
      const chart = new FakeChart();
      const project = project2027();
      new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      assertEquals(chart.lines.length, 1,);
    });

    it("sem property lança erro ao gerar", () => {
      const project = project2027();
      const empty = new Query({ project, scenarioIdx: 0, },);
      let threw = false;
      try {
        new GanttLine(new FakeChart(), empty, 0, 19, 0, null,);
      } catch (e) {
        threw = true;
        assert(String(e,).includes("requires a property",),);
      }
      assert(threw,);
    });
  });

  describe("generateTask (tarefa primária)", () => {
    it("folha vira GanttTaskBar e usa taskcell1/taskcell2 alternado", () => {
      const project = project2027();
      const chart = new FakeChart();
      // Ruby: `"taskcell#{(lineIndex + 1) % 2 + 1}"` → índice 0 cai na 2.
      const line0 = new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      assert(onlyContent(line0,) instanceof GanttTaskBar,);
      assertEquals(
        line0.to_html().attrs.class,
        "taskcell2",
      );

      const chart2 = new FakeChart();
      const line1 = new GanttLine(
        chart2,
        query(project, leafTask(project,),),
        19,
        19,
        1,
        null,
      );
      assertEquals(line1.to_html().attrs.class, "taskcell1",);
    });

    it("registra a tarefa no chart (chart.addTask)", () => {
      const chart = new FakeChart();
      const project = project2027();
      new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      assertEquals(chart.tasks.length, 1,);
    });

    it("milestone vira GanttMilestone", () => {
      const project = project2027();
      const task = leafTask(project,);
      task.setForScenario("milestone", true, 0,);
      const line = new GanttLine(
        new FakeChart(),
        query(project, task,),
        0,
        19,
        0,
        null,
      );
      assert(onlyContent(line,) instanceof GanttMilestone,);
    });

    it("container sem rollupTask vira GanttContainer", () => {
      const project = project2027();
      const container = new Task(project, "c1", "Container", null,);
      container.setForScenario("start", D("2027-01-04",), 0,);
      container.setForScenario("end", D("2027-01-14",), 0,);
      const child = new Task(project, "c1.1", "Child", container,);
      child.setForScenario("start", D("2027-01-04",), 0,);
      child.setForScenario("end", D("2027-01-08",), 0,);

      const line = new GanttLine(
        new FakeChart(),
        query(project, container,),
        0,
        19,
        0,
        null,
      );
      assert(onlyContent(line,) instanceof GanttContainer,);
    });

    it("container com rollupTask casando vira GanttTaskBar", () => {
      const project = project2027();
      const container = new Task(project, "c1", "Container", null,);
      container.setForScenario("start", D("2027-01-04",), 0,);
      container.setForScenario("end", D("2027-01-14",), 0,);
      const child = new Task(project, "c1.1", "Child", container,);

      // rollupTask que casa com todas as queries.
      project.reportContexts.push({
        report: {
          get: () => ({ eval: () => true, }),
        },
      } as unknown as ReportContext,);

      const line = new GanttLine(
        new FakeChart(),
        query(project, container,),
        0,
        19,
        0,
        null,
      );
      assert(onlyContent(line,) instanceof GanttTaskBar,);
    });

    it("liga showGanttItems e registra 'Off-duty period' na legenda", () => {
      const project = project2027();
      const chart = new FakeChart();
      new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      assertEquals(chart.table!.legend.showGanttItems, true,);
      assertEquals(chart.legendItems, [
        ["Off-duty period", "offduty",],
      ],);
    });

    it("getTask devolve o único content (e null quando há mais)", () => {
      const project = project2027();
      const line = new GanttLine(
        new FakeChart(),
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      assert(line.getTask() instanceof GanttTaskBar,);

      // Com 2 contents (forçado) → null.
      (line as unknown as { content: unknown[] }).content.push(
        line.getTask(),
      );
      assertEquals(line.getTask(), null,);
    });
  });

  describe("generateResource", () => {
    it("recurso folha vira load stacks (uma por célula) em resourcecell2", () => {
      const project = project2027();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const sc = resource.scenarioData(0,);
      sc.getEffectiveWork = () => 2;
      sc.getEffectiveFreeWork = () => 1;

      const line = new GanttLine(
        new FakeChart(),
        query(project, resource,),
        0,
        19,
        0,
        null,
      );
      const content = (line as unknown as { content: unknown[] }).content;
      // 5 cellStartDates → 4 intervalos.
      assertEquals(content.length, 4,);
      assert(content[0] instanceof GanttLoadStack,);
      // Ruby: `"resourcecell#{(lineIndex + 1) % 2 + 1}"` → índice 0 cai na 2.
      assertEquals(line.to_html().attrs.class, "resourcecell2",);
    });

    it("registra busy/free/offduty na legenda", () => {
      const project = project2027();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const chart = new FakeChart();
      new GanttLine(chart, query(project, resource,), 0, 19, 0, null,);
      assertEquals(
        chart.legendItems.map(([label,],) => label),
        [
          "Resource assigned to task(s)",
          "Resource available",
          "Off-duty period",
        ],
      );
    });

    it("recurso em escopo de tarefa usa 3 categorias e 4 itens de legenda", () => {
      const project = project2027();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const task = leafTask(project,);
      const q = query(project, resource,);
      q.scopeProperty = task;

      const chart = new FakeChart();
      const line = new GanttLine(chart, q, 0, 19, 0, null,);
      const content = (line as unknown as { content: unknown[] }).content;
      // Só as células que sobrepõem 2027-01-04 … 2027-01-14.
      assertEquals(content.length, 2,);
      assertEquals(chart.legendItems.length, 4,);
      assertEquals(chart.legendItems[0]![0], "Resource assigned to this task",);
    });
  });

  describe("generateTask em escopo de recurso", () => {
    it("gera load stacks com categorias [busy, null]", () => {
      const project = project2027();
      const task = leafTask(project,);
      const resource = new Resource(project, "r1", "Res 1", null,);
      const sc = resource.scenarioData(0,);
      sc.getEffectiveWork = () => 8;
      sc.getEffectiveFreeWork = () => 2;

      const q = query(project, task,);
      q.scopeProperty = resource;

      const chart = new FakeChart();
      const line = new GanttLine(chart, q, 0, 19, 0, null,);
      const content = (line as unknown as { content: unknown[] }).content;
      assertEquals(content.length, 2,);
      assert(content[0] instanceof GanttLoadStack,);
      // Só a legenda de recurso designado à tarefa.
      assertEquals(chart.legendItems, [
        ["Resource assigned to task(s)", "busy",],
      ],);
    });
  });

  describe("generateTimeOffZones", () => {
    it("ignora as zonas quando minTimeOff <= 0", () => {
      const project = project2027();
      const task = leafTask(project,);
      const sc = task.scenarioData(0,);
      let called = false;
      sc.collectTimeOffIntervals = () => {
        called = true;
        return new IntervalList<TimeInterval>();
      };

      const chart = new FakeChart({ minTimeOff: -1, },);
      const line = new GanttLine(chart, query(project, task,), 0, 19, 0, null,);
      assertEquals(called, false,);
      assertEquals(offdutyRects(line,), [],);
    });

    it("converte os intervalos em [startX, width]", () => {
      const project = project2027();
      const task = leafTask(project,);
      const sc = task.scenarioData(0,);
      sc.collectTimeOffIntervals = () => {
        const list = new IntervalList<TimeInterval>();
        list.push(new TimeInterval(D("2027-01-08",), D("2027-01-15",),),);
        return list;
      };

      // 700px em 28 dias → 25px/dia; 7 dias → 175px.
      const chart = new FakeChart({ minTimeOff: 3600, },);
      const line = new GanttLine(chart, query(project, task,), 0, 19, 0, null,);
      const rects = offdutyRects(line,);
      assertEquals(rects.length, 1,);
      assertEquals(
        rects[0]!.attrs.style,
        "left:175px; top:0px; width:175px; height:19px;",
      );
    });
  });

  describe("to_html", () => {
    it("gera a div da linha com categoria, y e largura truncada", () => {
      const project = project2027();
      const chart = new FakeChart({ width: 700.9, },);
      const line = new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      const html = line.to_html();
      assertEquals(html.tag, "div",);
      assertEquals(
        html.attrs.style,
        "margin:0px; padding:0px; position:absolute; " +
          "left:0px; top:40px; width:700px; height:19px; font-size:10px;",
      );
    });

    it("desenha a grade, a linha now e a linha markdate", () => {
      const project = project2027();
      const chart = new FakeChart({
        gridLines: [100, 200,],
        nowLineX: 50,
        markdateLineX: 150,
      },);
      const html = new GanttLine(
        chart,
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      ).to_html();
      const classes = html.children.map((c,) =>
        typeof c === "string" ? c : c.attrs.class
      );
      assertEquals(classes, [
        "tabvline",
        "tabvline",
        // GanttTaskBar emite 4 `<div>`s (frame, barra, progresso, frame).
        "tj_gantt_frame",
        "taskbarframe",
        "taskbar",
        "progressbar",
        "nowline",
        "markdateline",
      ],);
    });

    it("addBlockedZones delega ao conteúdo", () => {
      const project = project2027();
      const line = new GanttLine(
        new FakeChart(),
        query(project, leafTask(project,),),
        0,
        19,
        0,
        null,
      );
      const router = new GanttRouter(700, 19,);
      line.addBlockedZones(router,);
      assert(router.to_html().length > 0,);
    });

    it("acrescenta o tooltip (onclick + div.tj_tooltip_box)", () => {
      const project = project2027();
      const tooltip = new CellSettingPatternList();
      tooltip.addPattern(
        new CellSettingPattern("Dica", {
          eval: () => true,
        } as unknown as LogicalExpression,),
      );
      const q = query(project, leafTask(project,),);
      // Evita depender do pipeline de atributos no teste.
      q.process = () => true;
      q.to_s = () => "Task 1";

      const html = new GanttLine(
        new FakeChart(),
        q,
        0,
        19,
        0,
        tooltip,
      ).to_html();

      // O tooltip é aplicado a `html[0]` do conteúdo (o primeiro `<div>`
      // emitido pelo GanttTaskBar).
      const frame = html.children[1] as XMLElementLike;
      assertEquals(frame.attrs.class, "tj_gantt_frame",);
      assert(
        String(frame.attrs["onclick"],).startsWith("TagToTip('ID",),
        frame.attrs["onclick"],
      );
      assert(
        String(frame.attrs["onclick"],).endsWith("', TITLE, 'Task 1')",),
        frame.attrs["onclick"],
      );
      assertEquals(frame.attrs["style"]?.endsWith("cursor:help; ",), true,);

      // Como no Ruby, o tooltip é anexado ao `div` da linha **antes** dos
      // elementos do conteúdo (`addHtmlTooltip(...)` precede `div << html`).
      const box = html.children[0] as XMLElementLike;
      assertEquals(box.attrs.class, "tj_tooltip_box",);
      // O texto do tooltip vira um nó XMLText (XMLElement real).
      const tipText = box.children[0];
      assertEquals(tipText instanceof XMLText, true,);
      assertEquals((tipText as XMLText).to_s(), "Dica",);
    });
  });
});

/** Zonas `offduty` renderizadas na linha. */
function offdutyRects(line: GanttLine,): XMLElementLike[] {
  return line.to_html().children.filter((c,) =>
    typeof c !== "string" && c.attrs.class === "offduty"
  ) as XMLElementLike[];
}
