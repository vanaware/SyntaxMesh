/**
 * GanttChart (Fase 15.11) — chart abstrato de uma coluna `chart`.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb`.
 *
 * O chart é gerado em duas etapas, como no Ruby:
 * 1. `generateByScale(start, end, scale)` define período, escala e largura e
 *    cria o `GanttHeader`;
 * 2. as `GanttLine`s são criadas por quem consome o chart (`TableReport`,
 *    15.12) e registradas via `addLine`/`addTask`;
 * 3. `to_html()` chama `completeChart()` (lazy) — calcula a altura, roteia as
 *    linhas de dependência e deduplica as pontas de seta — e devolve o `<td>`.
 *
 * Saída é HTML+CSS puro (ADR 028).
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.11)
 */
import type { SpecialCell, } from "../reports/report-table-cell.ts";
import type { TableColumnDefinition, } from "../reports/table-column-definition.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { Task, } from "../model/task.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import {
  arrowHeadToHTML,
  lineToHTML as graphicsLineToHTML,
} from "./html-graphics.ts";
import { GanttHeader, } from "./gantt-header.ts";
import type { GanttHeaderChart, } from "./gantt-header.ts";
import type {
  DepLineContent,
  GanttLine,
  GanttLineChart,
  GanttLineLegend,
} from "./gantt-line.ts";
import { GanttRouter, } from "./gantt-router.ts";
import type { FromToPoint, RoutePoint, } from "./gantt-router.ts";

/** Método de `TjTime` que conta os passos entre duas datas (Ruby `:sym`). */
export type StepsToFunc =
  | "hoursTo"
  | "daysTo"
  | "weeksTo"
  | "monthsTo"
  | "quartersTo"
  | "yearsTo";

/** Uma escala horizontal do chart (Ruby hash de `@@scales`). */
export interface GanttScale {
  readonly name: string;
  /** Largura de um passo da escala em pixels. */
  readonly stepSize: number;
  /** `TjTime` que conta os passos entre o início e o fim do período. */
  readonly stepsToFunc: StepsToFunc;
  /**
   * Duração mínima (segundos) de um intervalo de folga para ser desenhado.
   * `<= 0` desativa as zonas nesta escala (`GanttLine#generateTimeOffZones`).
   */
  readonly minTimeOff: number;
}

/** O `TableReport` visto pelo chart (só a legenda é usada aqui). */
export interface GanttChartTable {
  readonly legend: GanttLineLegend;
}

/**
 * Chart do Gantt: uma coluna inteira da tabela de relatório.
 *
 * Implementa `SpecialCell` (Fase 14) para ser plugado como célula especial.
 * Depois de `generateByScale` ele satisfaz estruturalmente `GanttHeaderChart`
 * (15.9) e `GanttLineChart` (15.10); antes disso `start`/`end`/`scale`/`header`
 * são `null`, exatamente como os `nil` do Ruby.
 */
export class GanttChart implements SpecialCell {
  /** Altura de uma barra de rolagem horizontal no HTML. */
  static readonly SCROLLBARHEIGHT = 20;

  /**
   * Escalas possíveis, da mais fina para a mais grossa (Ruby `@@scales`).
   *
   * `stepSize` é a largura de um passo em pixels; `stepsToFunc` o método de
   * `TjTime` que conta os passos; `minTimeOff` a folga mínima visível.
   */
  static readonly SCALES: readonly GanttScale[] = [
    { name: "hour", stepSize: 20, stepsToFunc: "hoursTo", minTimeOff: 5 * 60, },
    {
      name: "day",
      stepSize: 20,
      stepsToFunc: "daysTo",
      minTimeOff: 6 * 60 * 60,
    },
    {
      name: "week",
      stepSize: 20,
      stepsToFunc: "weeksTo",
      minTimeOff: 24 * 60 * 60,
    },
    {
      name: "month",
      stepSize: 35,
      stepsToFunc: "monthsTo",
      minTimeOff: 5 * 24 * 60 * 60,
    },
    {
      name: "quarter",
      stepSize: 28,
      stepsToFunc: "quartersTo",
      minTimeOff: -1,
    },
    { name: "year", stepSize: 20, stepsToFunc: "yearsTo", minTimeOff: -1, },
  ];

  /** Início do período reportado (`null` antes de gerar). */
  start: TjTime | null = null;
  /** Fim do período reportado (`null` antes de gerar). */
  end: TjTime | null = null;
  /** Data usada como "hoje" (linha vertical `nowline`). */
  readonly now: TjTime;
  /** `true` se as semanas começam na segunda-feira. */
  readonly weekStartsMonday: boolean;
  /** Cabeçalho do chart (criado por `generateByScale`). */
  header: GanttHeader | null = null;
  /** Largura do chart em pixels. */
  width = 0;
  /** Escala corrente (`null` antes de gerar, como no Ruby). */
  scale: GanttScale | null = null;
  /** `TableReport` dono do chart (para a legenda). */
  table: GanttChartTable | null = null;
  /** Data de referência da linha `markdateline` (opcional). */
  readonly markdate: TjTime | null;
  /** Largura visível; menor que `width` → scrollbar. */
  viewWidth: number | null = null;

  private readonly columnDef: TableColumnDefinition;
  /** Altura do chart (sem o cabeçalho), calculada em `completeChart`. */
  private height = 0;
  /** Largura de um passo da escala corrente. */
  private stepSize = 0;
  /** Linhas do chart, na ordem de criação. */
  private lines: GanttLine[] = [];
  /** Roteador das linhas de dependência (criado em `completeChart`). */
  private router: GanttRouter | null = null;
  /** Linhas primárias de tarefa, indexadas pela `Task` (Ruby `@tasks`). */
  private tasks = new Map<PropertyTreeNode, GanttLine[]>();
  /** Caminhos roteados das dependências (pares de pontos). */
  private depArrows: RoutePoint[][] = [];
  /** Pontas das setas, deduplicadas por coordenada. */
  private arrowHeads: RoutePoint[] = [];
  /** Guard de idempotência de `completeChart`. */
  private completed = false;

  /**
   * Cria o chart sem gerá-lo: ainda faltam período e escala.
   *
   * `now` é a data considerada "hoje"; `weekStartsMonday` decide o início das
   * semanas; `table` é o `TableReport` dono (opcional); `markdate` a data da
   * linha de referência (opcional).
   */
  constructor(
    now: TjTime,
    weekStartsMonday: boolean,
    columnDef: TableColumnDefinition,
    table: GanttChartTable | null = null,
    markdate: TjTime | null = null,
  ) {
    this.now = now;
    this.columnDef = columnDef;
    this.table = table;
    this.markdate = markdate;
    this.weekStartsMonday = weekStartsMonday;
  }

  /** Escalas disponíveis (Ruby `attr_reader :scales`). */
  get scales(): readonly GanttScale[] {
    return GanttChart.SCALES;
  }

  /**
   * Registra uma linha primária de tarefa (Ruby `addTask`). Relatórios
   * multi-cenário produzem várias linhas para a mesma `Task`.
   */
  addTask(task: PropertyTreeNode, line: GanttLine,): void {
    const lines = this.tasks.get(task,);
    if (lines) {
      lines.push(line,);
    } else {
      this.tasks.set(task, [line,],);
    }
  }

  /**
   * Geração por largura (Ruby `generateByWidth`). No Ruby é apenas um TODO:
   * define período e largura, sem escala nem cabeçalho.
   */
  generateByWidth(
    periodStart: TjTime,
    periodEnd: TjTime,
    width: number,
  ): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.width = width;
    // Fiel ao Ruby: aqui **não** se define escala nem se cria o `GanttHeader`.
  }

  /**
   * Gera o chart a partir do período e do nome da escala (Ruby
   * `generateByScale`). Deve ser chamado **antes** de criar `GanttLine`s.
   */
  generateByScale(
    periodStart: TjTime,
    periodEnd: TjTime,
    scaleName: string,
  ): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.scale = this.scaleByName(scaleName,);
    this.stepSize = this.scale.stepSize;
    const steps = periodStart[this.scale.stepsToFunc](periodEnd,);
    this.width = this.stepSize * steps;

    // `this` só satisfaz `GanttHeaderChart` depois de `scale` estar definida;
    // o cast documenta essa pré-condição (o Ruby depende dela em runtime).
    this.header = new GanttHeader(
      this.columnDef,
      this as unknown as GanttHeaderChart,
    );
  }

  /** Converte o chart em `<td>` com as duas `div`s aninhadas (Ruby `to_html`). */
  to_html(): XMLElementLike {
    this.completeChart();

    const scrollbar = this.hasScrollbar();
    // A célula cobre toda a altura da tabela: uma linha por linha do chart,
    // mais a do cabeçalho, mais a linha da barra de rolagem (se houver).
    const td = new XMLElement("td", {
      rowspan: `${Math.trunc(2 + this.lines.length + (scrollbar ? 1 : 0),)}`,
      style: "padding:0px; vertical-align:top;",
    },);

    // `div` externa: a "view". Ganha `SCROLLBARHEIGHT` px quando há scrollbar.
    const scrollDiv = new XMLElement("div", {
      class: "tabback",
      style: "position:relative; overflow:auto; " +
        `width:${scrollbar ? this.viewWidth : this.width}px; ` +
        `height:${
          this.height + (scrollbar ? GanttChart.SCROLLBARHEIGHT : 0)
        }px;`,
    },);
    td.append(scrollDiv,);
    // `div` interna: o chart em si, com coordenadas absolutas.
    const div = new XMLElement("div", {
      style: "margin:0px; padding:0px; position:absolute; overflow:hidden; " +
        "top:0px; left:0px; " +
        `width:${this.width}px; ` +
        `height:${this.height}px; ` +
        "font-size:10px;",
    },);
    scrollDiv.append(div,);

    // Cabeçalho e linhas.
    const header = this.header;
    if (header !== null) div.append(header.to_html(),);
    for (const line of this.lines) div.append(line.to_html(),);

    // Linhas de dependência: cada par consecutivo do caminho vira um `depline`.
    for (const arrow of this.depArrows) {
      let xx: number | null = null;
      let yy = 0;
      for (const [x, y,] of arrow) {
        if (xx !== null) {
          div.append(
            graphicsLineToHTML(xx, yy, x, y, "depline",),
          );
        }
        xx = x;
        yy = y;
      }
    }
    // E as pontas correspondentes.
    for (const [x, y,] of this.arrowHeads) {
      div.append(arrowHeadToHTML(x, y,),);
    }

    return td;
  }

  /** O Gantt não vai para CSV (Ruby `to_csv` devolve 0). */
  to_csv(_csv: unknown[][], _startColumn: number,): number {
    return 0;
  }

  /**
   * Converte uma data em X do chart (Ruby `dateToX`):
   * `((width / (end - start)) * (date - start)).to_i`.
   */
  dateToX(date: TjTime,): number {
    const start = this.start;
    const end = this.end;
    if (start === null || end === null) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    return Math.trunc(
      (this.width / end.diff(start,)) * date.diff(start,),
    );
  }

  /** Registra uma linha no chart (Ruby `addLine`). */
  addLine(line: GanttLine,): void {
    if (this.scale === null) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    this.lines.push(line,);
  }

  /**
   * Visão estrutural do chart para os consumidores (`GanttLineChart`, 15.10).
   *
   * O Ruby dispensa isto: `GanttChart` já satisfaz o contrato em runtime. Em TS
   * os campos são anuláveis antes de `generateByScale`, então a pré-condição
   * ("chart já gerado") fica verificada num único ponto em vez de espalhada
   * em casts pelos chamadores.
   */
  asLineChart(): GanttLineChart {
    if (
      this.start === null || this.end === null ||
      this.scale === null || this.header === null
    ) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    return this as unknown as GanttLineChart;
  }

  /** `true` quando a `view` é mais estreita que o chart (Ruby `hasScrollbar?`). */
  hasScrollbar(): boolean {
    return this.viewWidth !== null && this.viewWidth < this.width;
  }

  /** Procura a escala pelo nome (Ruby `scaleByName`). */
  private scaleByName(name: string,): GanttScale {
    for (const scale of GanttChart.SCALES) {
      if (scale.name === name) return scale;
    }
    throw new Error(`Unknown scale ${name}`,);
  }

  /**
   * Calcula a altura, cria o router, bloqueia as zonas proibidas e gera as
   * setas de dependência (Ruby `completeChart`).
   *
   * Ruby roda isto em toda chamada de `to_html`; o guard `completed` evita
   * duplicar `depArrows`/`arrowHeads` (o chart é imutável depois da 1ª saída).
   */
  private completeChart(): void {
    if (this.completed) return;

    for (const line of this.lines) {
      const bottom = line.y + line.height;
      if (bottom > this.height) this.height = bottom;
    }

    // As linhas de dependência são roteadas por um `GanttRouter` que recebe
    // apenas os pontos inicial e final de cada seta.
    const router = new GanttRouter(this.width, this.height,);
    this.router = router;

    // Barras não devem ser cruzadas por linhas horizontais; marcos não devem
    // ser cruzados em nenhuma direção.
    for (const line of this.lines) line.addBlockedZones(router,);

    // Protege a linha "now" de outras linhas verticais.
    const header = this.header;
    const nowLineX = header?.nowLineX ?? null;
    if (nowLineX !== null) {
      router.addZone(nowLineX - 1, 0, 3, this.height - 1, false, true,);
    }

    // Idem para a data de referência (`markdate`).
    const markdateLineX = header?.markdateLineX ?? null;
    if (markdateLineX !== null) {
      router.addZone(markdateLineX - 1, 0, 3, this.height - 1, false, true,);
    }

    // Setas de dependência de todas as tarefas visíveis.
    for (const [task, lines,] of this.tasks) {
      this.generateDepLines(task as Task, lines,);
    }

    // Uma única ponta de seta por ponto final, mesmo que várias linhas cheguem
    // ao mesmo ponto (`Array#include?` compara por valor).
    for (const line of this.depArrows) {
      const endPoint = line[line.length - 1];
      if (!endPoint) continue;
      if (!this.arrowHeads.some((p,) => samePoint(p, endPoint,))) {
        this.arrowHeads.push(endPoint,);
      }
    }

    this.completed = true;
  }

  /**
   * Gera as setas de dependência de uma tarefa (Ruby `generateDepLines`).
   * Relatórios multi-cenário têm uma linha por cenário.
   */
  private generateDepLines(task: Task, lines: GanttLine[],): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      const scenarioIdx = line.query.scenarioIdx ?? 0;
      const content = depLineContent(line,);
      // O Ruby assume `line.getTask` não-nil (só linhas de tarefa entram em
      // `@tasks`); em TS o retorno é anulável.
      if (content === null) continue;

      // Dependências na entrada da tarefa...
      this.generateTaskDepLines(
        "startsuccs",
        task,
        scenarioIdx,
        lineIndex,
        content.startDepLineStart(),
      );
      // ...e na saída.
      this.generateTaskDepLines(
        "endsuccs",
        task,
        scenarioIdx,
        lineIndex,
        content.endDepLineStart(),
      );
    }
  }

  /**
   * Gera as setas de dependências do início (`startsuccs`) ou do fim
   * (`endsuccs`) de `task` (Ruby `generateTaskDepLines`).
   */
  private generateTaskDepLines(
    kind: "startsuccs" | "endsuccs",
    task: Task,
    scenarioIdx: number,
    lineIndex: number,
    [startX, startY,]: [number, number,],
  ): void {
    const touples: FromToPoint[] = [];
    const taskScenario = task.scenarioData(scenarioIdx,);
    const successors = kind === "startsuccs"
      ? taskScenario.startsuccs()
      : taskScenario.endsuccs();

    for (const [successor, onEnd,] of successors) {
      if (successor === null) continue;
      // Ignora dependências herdadas e tarefas fora do chart. O teste de
      // herança consulta o cenário da tarefa **corrente** (`task`).
      const parent = successor.parent as Task | null;
      if (
        (parent !== null &&
          taskScenario.hasDependency(kind, parent, onEnd,)) ||
        !this.tasks.has(successor,)
      ) {
        continue;
      }
      const successorLines = this.tasks.get(successor,);
      const successorLine = successorLines?.[lineIndex];
      const content = successorLine ? depLineContent(successorLine,) : null;
      if (content === null) continue;

      const [endX, endY,] = onEnd
        ? content.endDepLineEnd()
        : content.startDepLineEnd();
      touples.push([startX, startY, endX, endY,],);
    }

    const router = this.router;
    if (touples.length > 0 && router !== null) {
      this.depArrows.push(...router.routeLines(touples,),);
    }
  }
}

/** Compara duas coordenadas por valor (Ruby `Array#==`). */
function samePoint(a: RoutePoint, b: RoutePoint,): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Conteúdo da linha como fonte de âncoras de dependência. */
function depLineContent(line: GanttLine,): DepLineContent | null {
  return line.getTask() as DepLineContent | null;
}
