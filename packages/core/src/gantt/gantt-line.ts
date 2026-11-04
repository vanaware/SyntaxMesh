/**
 * GanttLine (Fase 15.10) — uma linha (propriedade) do Gantt.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttLine.rb`.
 *
 * Cada linha representa uma property. Dependendo do tipo e do contexto:
 * - tarefa não aninhada → `GanttTaskBar`, `GanttMilestone` ou `GanttContainer`;
 * - tarefa aninhada em recurso → `GanttLoadStack` (trabalho no escopo);
 * - recurso (aninhado ou não) → `GanttLoadStack`.
 *
 * O `chart` é consumido por uma **interface estrutural** (`GanttLineChart`)
 * para quebrar a referência circular com `GanttChart` (15.11). Como no Ruby,
 * as chamadas a `getEffectiveWork`/`getEffectiveFreeWork`/`getScenario` são
 * polimórficas (lá via `PropertyTreeNode#method_missing`): aqui a property é
 * vista como `GanttLineProperty`, cujo `scenarioData(scIdx)` expõe os três
 * métodos usados pela linha.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.10)
 */
import type { Query, } from "../query/query.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { Task, } from "../model/task.ts";
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";
import type { CellSettingPatternList, } from "../reports/table-column-definition.ts";
import {
  lineToHTML as graphicsLineToHTML,
  rectToHTML as graphicsRectToHTML,
} from "./html-graphics.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { ZoneRouter, } from "./gantt-router.ts";
import { GanttMilestone, } from "./gantt-milestone.ts";
import { GanttContainer, } from "./gantt-container.ts";
import { GanttLoadStack, type LoadStackHost, } from "./gantt-load-stack.ts";
import { GanttTaskBar, } from "./gantt-task-bar.ts";

/** Intervalo devolvido por `collectTimeOffIntervals` (`[start, end]`). */
export interface TimeOffInterval {
  readonly start: TjTime;
  readonly end: TjTime;
}

/** Subconjunto do *Scenario usado por `GanttLine` (Ruby `method_missing`). */
export interface GanttLineScenario {
  /**
   * Ruby `getEffectiveWork(startIdx, endIdx[, scope])`: em `TaskScenario` é o
   * *effective work* da tarefa (com `scope` = recurso); em `ResourceScenario`
   * é o trabalho alocado (com `scope` = tarefa).
   */
  getEffectiveWork(
    startIdx: number,
    endIdx: number,
    scope?: GanttLineProperty,
  ): number;
  /** Ruby `getEffectiveFreeWork(startIdx, endIdx)` (só em recursos). */
  getEffectiveFreeWork(startIdx: number, endIdx: number,): number;
  /** Ruby `collectTimeOffIntervals(iv, minDuration)`. */
  collectTimeOffIntervals(
    iv: TimeOffInterval,
    minDuration: number,
  ): readonly TimeOffInterval[];
}

/** Property (`Task`/`Resource`) vista pela linha. */
export interface GanttLineProperty {
  /** Ruby `property['id', scenarioIdx]`. */
  getForScenario(id: string, scenarioIdx: number,): unknown;
  /** Ruby `property.container?`. */
  container(): boolean;
  /** Ruby `property.getScenario(scenarioIdx)` (via `method_missing`). */
  scenarioData(scenarioIdx: number,): GanttLineScenario;
}

/** Projeto visto pela linha. */
export interface GanttLineProject {
  /** Ruby `project['start']` / `project['end']`. */
  get(id: string,): unknown;
  /** Ruby `project.dateToIdx(date)`. */
  dateToIdx(date: TjTime,): number;
  /** Ruby `project.reportContexts` (para `rollupTask`). */
  readonly reportContexts: ReadonlyArray<{
    readonly report: { get(id: string,): unknown };
  }>;
}

/** Legenda do `TableReport` (Fase 14.14). */
export interface GanttLineLegend {
  showGanttItems: boolean;
  addGanttItem(label: string, category: string,): void;
}

/** Cabeçalho consumido pela linha (15.9). */
export interface GanttLineHeader {
  readonly height: number;
  readonly gridLines: readonly number[];
  readonly cellStartDates: readonly TjTime[];
  readonly nowLineX: number | null;
  readonly markdateLineX: number | null;
}

/** Chart consumido pela linha (15.11), em forma estrutural. */
export interface GanttLineChart {
  readonly width: number;
  readonly start: TjTime;
  readonly end: TjTime;
  readonly header: GanttLineHeader;
  /** Escala corrente: só `minTimeOff` importa aqui. */
  readonly scale: { readonly minTimeOff: number };
  readonly table: { readonly legend: GanttLineLegend } | null;
  /** Ruby `chart.dateToX(date)` (já truncado). */
  dateToX(date: TjTime,): number;
  /** Ruby `chart.addLine(line)` (registra a linha). */
  addLine(line: GanttLine,): void;
  /** Ruby `chart.addTask(task, line)` (linhas primárias de tarefa). */
  addTask(task: PropertyTreeNode, line: GanttLine,): void;
}

/** Elemento de conteúdo de uma linha (barra, marco, container, pilha). */
export interface GanttContent {
  to_html(): XMLElementLike[] | null;
  addBlockedZones(router: ZoneRouter,): void;
}

/**
 * Conteúdo que expõe as âncoras das setas de dependência (15.11):
 * `GanttTaskBar`, `GanttMilestone` e `GanttContainer`.
 */
export interface DepLineContent extends GanttContent {
  startDepLineStart(): [number, number,];
  startDepLineEnd(): [number, number,];
  endDepLineStart(): [number, number,];
  endDepLineEnd(): [number, number,];
}

/** Expressão lógica do `rollupTask` (Fase 11). */
interface RollupExpression {
  eval(query: Query,): boolean;
}

/** Uma linha do Gantt chart. */
export class GanttLine implements LoadStackHost {
  private readonly chart: GanttLineChart;
  readonly query: Query;
  private readonly tooltip: CellSettingPatternList | null;
  /** Cor de fundo da linha (`taskcellN`/`resourcecellN`). */
  private category: string | null = null;
  /** Y absoluto do topo da linha (já inclui o cabeçalho). */
  readonly y: number;
  /** Altura da linha em pixels. */
  readonly height: number;
  private readonly lineIndex: number;
  /** Zonas de folga como `[startX, width]`. */
  private timeOffZones: Array<[number, number,]> = [];
  private content: GanttContent[] = [];

  constructor(
    chart: GanttLineChart,
    query: Query,
    y: number,
    height: number,
    lineIndex: number,
    tooltip: CellSettingPatternList | null,
  ) {
    this.chart = chart;
    // Registra a linha no chart (antes de tudo, como o Ruby).
    this.chart.addLine(this,);

    this.query = query;
    this.tooltip = tooltip;
    this.category = null;
    this.y = y + chart.header.height + 1;
    this.height = height;
    this.lineIndex = lineIndex;
    this.timeOffZones = [];

    this.generate();
  }

  /** Converte a linha abstrata em `<div>`s (Ruby `to_html`). */
  to_html(): XMLElementLike {
    const div = new SimpleXMLElement("div", {
      class: this.category ?? "",
      style: "margin:0px; padding:0px; position:absolute; " +
        `left:0px; top:${this.y}px; ` +
        `width:${Math.trunc(this.chart.width,)}px; ` +
        `height:${this.height}px; ` +
        "font-size:10px;",
    },);
    // Zonas de folga.
    for (const zone of this.timeOffZones) {
      div.append(
        this.rectToHTML(zone[0], 0, zone[1], this.height, "offduty",),
      );
    }

    // Linhas de grade (escala grande do cabeçalho).
    for (const line of this.chart.header.gridLines) {
      div.append(this.rectToHTML(line, 0, 1, this.height, "tabvline",),);
    }

    // Conteúdo (barras, marcos, pilhas de carga).
    for (const c of this.content) {
      const html = c.to_html();
      if (html && html[0]) {
        this.addHtmlTooltip(this.tooltip, this.query, html[0], div,);
        for (const el of html) div.append(el,);
      }
    }

    // Linha "now".
    const nowLineX = this.chart.header.nowLineX;
    if (nowLineX !== null) {
      div.append(this.rectToHTML(nowLineX, 0, 1, this.height, "nowline",),);
    }

    // Linha "markdate".
    const markdateLineX = this.chart.header.markdateLineX;
    if (markdateLineX !== null) {
      div.append(
        this.rectToHTML(markdateLineX, 0, 1, this.height, "markdateline",),
      );
    }

    return div;
  }

  /** Só faz sentido para linhas primárias de tarefa (Ruby `getTask`). */
  getTask(): GanttContent | null {
    return this.content.length === 1 ? this.content[0]! : null;
  }

  /** Delega o registro das zonas bloqueadas ao conteúdo (Ruby idem). */
  addBlockedZones(router: ZoneRouter,): void {
    for (const c of this.content) c.addBlockedZones(router,);
  }

  /** Ruby `HTMLGraphics#lineToHTML` (usado pelos `GanttLoadStack`). */
  lineToHTML(
    xs: number,
    ys: number,
    xe: number,
    ye: number,
    category: string,
  ): XMLElementLike {
    return graphicsLineToHTML(xs, ys, xe, ye, category,);
  }

  /** Ruby `HTMLGraphics#rectToHTML` (usado pelos `GanttLoadStack`). */
  rectToHTML(
    x: number,
    y: number,
    w: number,
    h: number,
    category: string,
  ): XMLElementLike {
    return graphicsRectToHTML(x, y, w, h, category,);
  }

  /** Gera o conteúdo abstrato desta linha (Ruby `generate`). */
  private generate(): void {
    this.content = [];
    this.generateTimeOffZones();

    if (this.isTask()) {
      this.generateTask();
    } else {
      this.generateResource();
    }
  }

  /** `true` se a property é uma `Task` (Ruby `is_a?(Task)`). */
  private isTask(): boolean {
    return this.query.property instanceof Task;
  }

  /** Property da consulta como fonte de trabalho. */
  private get property(): GanttLineProperty {
    return asGanttProperty(this.propertyNode,)!;
  }

  /** Nó real da property (para as APIs do modelo e para o chart). */
  private get propertyNode(): PropertyTreeNode {
    const node = this.query.property;
    if (node === null) {
      throw new Error("GanttLine requires a property in the query",);
    }
    return node;
  }

  /** Property de escopo (recurso ou tarefa), se houver. */
  private get scopeProperty(): GanttLineProperty | null {
    return asGanttProperty(this.query.scopeProperty,);
  }

  /** Projeto da consulta (o Gantt sempre roda dentro de um projeto). */
  private get project(): GanttLineProject {
    const project = this.query.project;
    if (project === null) {
      throw new Error("GanttLine requires a project in the query",);
    }
    return project as unknown as GanttLineProject;
  }

  /** Índice do cenário da consulta (0 quando ausente, como `TableReport`). */
  private get scenarioIdx(): number {
    return this.query.scenarioIdx ?? 0;
  }

  /** Forma abstrata de uma linha de tarefa (Ruby `generateTask`). */
  private generateTask(): void {
    this.category = `taskcell${(this.lineIndex + 1) % 2 + 1}`;

    const project = this.project;
    const property = this.property;
    const scopeProperty = this.scopeProperty;
    const scIdx = this.scenarioIdx;
    const taskStart = (property.getForScenario("start", scIdx,) ??
      project.get("start",)) as TjTime;
    const taskEnd = (property.getForScenario("end", scIdx,) ??
      project.get("end",)) as TjTime;

    if (scopeProperty) {
      // Tarefa aninhada em recurso: pilha de carga relativa ao escopo.
      let x: number | null = null;
      let startDate: TjTime | null = null;
      let endDate: TjTime | null = null;
      const categories: Array<string | null> = ["busy", null,];

      for (const date of this.chart.header.cellStartDates) {
        if (x === null) {
          endDate = date;
          x = Math.trunc(this.chart.dateToX(endDate,),);
          continue;
        }
        const xNew = Math.trunc(this.chart.dateToX(date,),);
        let w = xNew - x;
        startDate = endDate!;
        endDate = date;

        // Só interessam pilhas que sobrepõem o intervalo da tarefa de escopo.
        if (!taskStart.lessThan(endDate,) || !startDate.lessThan(taskEnd,)) {
          continue;
        }
        if (startDate.lessThan(taskStart,) && taskStart.lessThan(endDate,)) {
          // Alinha a borda esquerda da primeira pilha ao início do escopo.
          startDate = taskStart;
          x = this.chart.dateToX(startDate,);
          w = xNew - x + 1;
        } else if (
          startDate.lessThan(taskEnd,) && taskEnd.lessThan(endDate,)
        ) {
          // Alinha a borda direita da última pilha ao fim do escopo.
          endDate = taskEnd;
          w = this.chart.dateToX(endDate,) - x;
        }
        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scopeScenario = scopeProperty.scenarioData(scIdx,);

        const overallWork = scopeScenario.getEffectiveWork(startIdx, endIdx,) +
          scopeScenario.getEffectiveFreeWork(startIdx, endIdx,);
        const workThisTask = property.scenarioData(scIdx,).getEffectiveWork(
          startIdx,
          endIdx,
          scopeProperty,
        );
        // Sem trabalho em nenhum dos lados: mostra uma moldura vazia.
        const values = overallWork === 0 && workThisTask === 0
          ? [0, 1,]
          : [workThisTask, overallWork - workThisTask,];
        this.content.push(
          new GanttLoadStack(this, x + 1, w - 2, values, categories,),
        );

        x = xNew;
      }
      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
      }
      return;
    }

    // Tarefa primária: barra clássica, marco ou container.
    const xStart = this.chart.dateToX(taskStart,);
    const xEnd = this.chart.dateToX(taskEnd,);
    // O chart indexa as linhas pelo nó real (`@tasks.include?(task)`).
    this.chart.addTask(this.propertyNode, this,);

    if (property.getForScenario("milestone", scIdx,)) {
      this.content.push(new GanttMilestone(this.height, xStart, this.y,),);
    } else if (property.container() && !this.isRollupTask()) {
      this.content.push(
        new GanttContainer(this.height, xStart, xEnd, this.y,),
      );
    } else {
      this.content.push(
        new GanttTaskBar(this.query, this.height, xStart, xEnd, this.y,),
      );
    }

    // Garante que a legenda inclua os símbolos do Gantt.
    if (this.chart.table) {
      this.chart.table.legend.showGanttItems = true;
      this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
    }
  }

  /**
   * `true` quando o `rollupTask` do relatório casa com esta property (nesSe
   * caso um container vira barra). Porta de `!rollupExpr.eval(@query)` com o
   * `nil?` do Ruby.
   */
  private isRollupTask(): boolean {
    const contexts = this.project.reportContexts;
    const last = contexts[contexts.length - 1];
    // RUBY-COMPAT-FIX: o Ruby estouraria com `nil.report`; sem contexto de
    // relatório o `rollupTask` é inexistente, logo não é rollup.
    if (!last) return false;
    const rollupExpr = last.report.get("rollupTask",);
    // RUBY-COMPAT-FIX: o Ruby estouraria com `nil.report`; sem `rollupTask`
    // a tarefa não faz rollup.
    if (rollupExpr === null || rollupExpr === undefined) return false;
    return (rollupExpr as RollupExpression).eval(this.query,);
  }

  /** Forma abstrata de uma linha de recurso (Ruby `generateResource`). */
  private generateResource(): void {
    this.category = `resourcecell${(this.lineIndex + 1) % 2 + 1}`;

    const project = this.project;
    const property = this.property;
    const scopeProperty = this.scopeProperty;
    const scIdx = this.scenarioIdx;

    let categories: Array<string | null>;
    let taskStart: TjTime | null = null;
    let taskEnd: TjTime | null = null;

    // Recurso aninhado em tarefa: alocado a esta tarefa, a outras e livre.
    if (scopeProperty) {
      categories = ["assigned", "busy", "free",];
      taskStart = (scopeProperty.getForScenario("start", scIdx,) ??
        project.get("start",)) as TjTime;
      taskEnd = (scopeProperty.getForScenario("end", scIdx,) ??
        project.get("end",)) as TjTime;

      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to this task",
          "assigned",
        );
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
        this.chart.table.legend.addGanttItem("Resource available", "free",);
        this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
      }
    } else {
      categories = ["busy", "free",];
      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
        this.chart.table.legend.addGanttItem("Resource available", "free",);
        this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
      }
    }

    // O último elemento de `cellStartDates` é o fim da última célula: o
    // deslocamento garante que cada pilha use [início, fim] da célula.
    let startDate: TjTime | null = null;
    let endDate: TjTime | null = null;
    for (const date of this.chart.header.cellStartDates) {
      if (endDate === null) {
        endDate = date;
        continue;
      }
      startDate = endDate;
      endDate = date;

      let values: number[];
      if (scopeProperty && taskStart && taskEnd) {
        // Só pilhas que sobrepõem o intervalo da tarefa de escopo.
        if (!taskStart.lessThan(endDate,) || !startDate.lessThan(taskEnd,)) {
          continue;
        }
        if (startDate.lessThan(taskStart,)) startDate = taskStart;
        if (taskEnd.lessThan(endDate,)) endDate = taskEnd;

        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scenario = property.scenarioData(scIdx,);

        const taskWork = scenario.getEffectiveWork(
          startIdx,
          endIdx,
          scopeProperty,
        );
        const overallWork = scenario.getEffectiveWork(startIdx, endIdx,);
        const freeWork = scenario.getEffectiveFreeWork(startIdx, endIdx,);
        values = [taskWork, overallWork - taskWork, freeWork,];
      } else {
        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scenario = property.scenarioData(scIdx,);

        values = [
          scenario.getEffectiveWork(startIdx, endIdx,),
          scenario.getEffectiveFreeWork(startIdx, endIdx,),
        ];
      }

      const x = this.chart.dateToX(startDate,);
      const w = this.chart.dateToX(endDate,) - x + 1;
      this.content.push(
        new GanttLoadStack(this, x + 1, w - 2, values, categories,),
      );
    }
  }

  /**
   * Marca as zonas de folga da property (Ruby `generateTimeOffZones`). Só
   * períodos maiores ou iguais a `minTimeOff` da escala são mostrados.
   */
  private generateTimeOffZones(): void {
    const iv: TimeOffInterval = {
      start: this.chart.start,
      end: this.chart.end,
    };
    const minTimeOff = this.chart.scale.minTimeOff;
    // Escalas grosseiras (trimestre/ano) desativam as zonas.
    if (minTimeOff <= 0) return;

    const zones = this.property.scenarioData(this.scenarioIdx,)
      .collectTimeOffIntervals(iv, minTimeOff,);
    // Converte datas em `[startX, width]`.
    const result: Array<[number, number,]> = [];
    for (const zone of zones) {
      const s = this.chart.dateToX(zone.start,);
      result.push([s, this.chart.dateToX(zone.end,) - s,],);
    }
    this.timeOffZones = result;
  }

  /**
   * Acrescenta o tooltip do conteúdo (Ruby `addHtmlTooltip`): `onclick` com
   * `TagToTip` mais a `div.tj_tooltip_box`.
   */
  private addHtmlTooltip(
    tooltip: CellSettingPatternList | null,
    query: Query,
    trigger: XMLElementLike,
    hook: XMLElementLike | null = null,
  ): void {
    if (!tooltip) return;

    const pattern = tooltip.getPattern(query,);
    if (pattern === null || pattern === undefined) return;
    if (typeof pattern === "string" && pattern.length === 0) return;

    if (
      typeof (pattern as { functionHandler?: unknown }).functionHandler ===
        "function"
    ) {
      (pattern as { setQuery(q: Query,): void }).setQuery(query,);
    }
    let title = "";
    if (query) {
      query.attributeId = "name";
      query.process();
      title = query.to_s();
    }

    const id = objectId(trigger,);
    trigger.attrs["onclick"] = `TagToTip('ID${id}', TITLE, '${
      title.replace(/'/g, "&apos;",)
    }')`;
    trigger.attrs["style"] = (trigger.attrs["style"] ?? "") + "cursor:help; ";

    const hookEl = hook ?? trigger;
    const ltDiv = new SimpleXMLElement("div", {
      class: "tj_tooltip_box",
      id: `ID${id}`,
    },);
    const content = typeof (pattern as { to_html?: unknown }).to_html ===
        "function"
      ? (pattern as { to_html(): XMLElementLike | string }).to_html()
      : String(pattern,);
    ltDiv.append(
      typeof content === "string" ? content : content ?? "",
    );
    hookEl.append(ltDiv,);
  }
}

let idCounter = 0;
const idMap = new WeakMap<object, number>();

/**
 * Adapta uma property (`Task`/`Resource`) à visão estrutural da linha.
 *
 * RUBY-COMPAT-DOC: em Ruby isto é o `PropertyTreeNode#method_missing`, que
 * delega qualquer método desconhecido ao `*Scenario` do cenário. Aqui a
 * delegação é explícita: `effWorkInPeriod` (Task) e `getEffectiveWork`
 * (Resource) têm a mesma semântica vista pela linha.
 */
export function asGanttProperty(
  node: PropertyTreeNode | null,
): GanttLineProperty | null {
  if (node === null) return null;
  const source: GanttLineProperty = {
    getForScenario: (id, scenarioIdx,) => node.getForScenario(id, scenarioIdx,),
    container: () => node.container(),
    scenarioData: (scenarioIdx,) =>
      adaptScenario(node.scenarioData(scenarioIdx,),),
  };
  // O modelo espera o nó real (`Task`/`Resource`) nos argumentos de escopo.
  nodes.set(source, node,);
  return source;
}

/** Wrapper → nó real do modelo (para repassar escopos às APIs do modelo). */
const nodes = new WeakMap<GanttLineProperty, PropertyTreeNode>();

/** Interface do `*Scenario` que a linha realmente utiliza. */
interface ScenarioLike {
  effWorkInPeriod?(
    startIdx: number,
    endIdx: number,
    resource: GanttLineProperty | null,
  ): number;
  getEffectiveWork(
    startIdx: number,
    endIdx: number,
    task?: GanttLineProperty | null,
  ): number;
  getEffectiveFreeWork(startIdx: number, endIdx: number,): number;
  collectTimeOffIntervals(
    iv: TimeOffInterval,
    minDuration: number,
  ): readonly TimeOffInterval[];
}

/** Adapta o `*Scenario` do modelo à visão usada pela linha. */
function adaptScenario(sd: unknown,): GanttLineScenario {
  const s = sd as ScenarioLike;
  return {
    // TaskScenario: `effWorkInPeriod`; ResourceScenario: `getEffectiveWork`.
    // Os escopos voltam ao nó real (o modelo chama `ptn()` neles).
    getEffectiveWork: (startIdx, endIdx, scope,) => {
      const scopeNode = scope ? nodes.get(scope,) ?? null : null;
      return s.effWorkInPeriod
        ? s.effWorkInPeriod(
          startIdx,
          endIdx,
          scopeNode as GanttLineProperty | null,
        )
        : s.getEffectiveWork(
          startIdx,
          endIdx,
          scopeNode as GanttLineProperty | null,
        );
    },
    getEffectiveFreeWork: (startIdx, endIdx,) =>
      s.getEffectiveFreeWork(startIdx, endIdx,),
    collectTimeOffIntervals: (iv, minDuration,) =>
      s.collectTimeOffIntervals(iv, minDuration,),
  };
}

/**
 * Id único e estável por objeto (equivalente ao `object_id` do Ruby), usado
 * apenas para casar `onclick` com o `id` da `div` do tooltip.
 */
function objectId(obj: object,): number {
  let id = idMap.get(obj,);
  if (id === undefined) {
    id = ++idCounter;
    idMap.set(obj, id,);
  }
  return id;
}
