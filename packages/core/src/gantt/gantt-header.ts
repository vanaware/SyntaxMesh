/**
 * GanttHeader (Fase 15.9) — cabeçalho de 2 linhas do Gantt.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttHeader.rb`.
 *
 * A linha de cima mostra a escala grande (mês/ano, ano…) e a de baixo a
 * escala pequena (dia, semana…). O cabeçalho também fornece ao chart as
 * posições das linhas de grade (`gridLines`), as datas de início de cada
 * célula pequena (`cellStartDates`) e as linhas `now`/`markdate`.
 *
 * ## Comportamento estranho do Ruby (cheat sheet §12, Categoria B)
 *
 * `genHeaderScale` testa `scale == @largeScale`; em Ruby `Array#==` compara
 * **conteúdo**, não identidade. Na escala `year` (em que a escala grande fica
 * vazia) o primeiro item cai no ramo "grande": a data vai para `gridLines` em
 * vez de `cellStartDates`. Replicado sob `compat.keepRubyBugs`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.9)
 */
import { compat, } from "../compat.ts";
import type { TableColumnDefinition, } from "../reports/table-column-definition.ts";
import { TjTime, } from "../time/tj-time.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { GanttHeaderScaleItem, } from "./gantt-header-scale-item.ts";

/** Visão mínima do chart consumida pelo cabeçalho. */
export interface GanttHeaderChart {
  readonly start: TjTime;
  readonly end: TjTime;
  readonly now: TjTime;
  readonly markdate: TjTime | null;
  readonly weekStartsMonday: boolean;
  readonly width: number;
  readonly scale: { readonly name: string };
  /**
   * X do chart para `date` (Ruby `GanttChart#dateToX`).
   *
   * O Ruby nunca retorna `nil` aqui: a fórmula é linear
   * (`((width / (end - start)) * (date - start)).to_i`). Datas fora do
   * período apenas produzem X negativo ou maior que a largura.
   */
  dateToX(date: TjTime,): number;
}

/** Função de ancoragem do início de uma célula (Ruby `beginOfFunc`). */
type BeginOfFunc = (t: TjTime,) => TjTime;
/** Função que avança uma célula (Ruby `sameTimeNextFunc`). */
type SameTimeNextFunc = (t: TjTime,) => TjTime;

/** Cabeçalho do chart: escalas, grades e linhas de referência. */
export class GanttHeader {
  private readonly columnDef: TableColumnDefinition;
  private readonly chart: GanttHeaderChart;
  private readonly largeScale: GanttHeaderScaleItem[] = [];
  private readonly smallScale: GanttHeaderScaleItem[] = [];

  /** X das linhas verticais que marcam a escala grande. */
  readonly gridLines: number[] = [];
  /** X da linha "now"; `null` se estiver fora do chart. */
  nowLineX: number | null = null;
  /** X da linha `markdate`; `null` se estiver fora do chart. */
  markdateLineX: number | null = null;
  /** Datas de início das células da escala pequena (+ fim da última). */
  readonly cellStartDates: TjTime[] = [];
  /** Altura do cabeçalho em pixels (mutável: o chart ajusta após criar). */
  height = 39;

  constructor(columnDef: TableColumnDefinition, chart: GanttHeaderChart,) {
    this.columnDef = columnDef;
    this.chart = chart;
    this.generate();
  }

  /** Converte o cabeçalho em `<div class="tabback">` (Ruby `to_html`). */
  to_html(): XMLElementLike {
    const div = new XMLElement("div", {
      class: "tabback",
      style: "margin:0px; padding:0px; position:relative; " +
        `width:${Math.trunc(this.chart.width,)}px; ` +
        `height:${Math.trunc(this.height,)}px; ` +
        `font-size:${Math.trunc(this.height / 4,)}px; `,
    },);
    for (const s of this.largeScale) div.append(s.to_html(),);
    for (const s of this.smallScale) div.append(s.to_html(),);
    return div;
  }

  /** Escolhe as escalas conforme `chart.scale.name` (Ruby `generate`). */
  private generate(): void {
    // As 2 linhas do cabeçalho são separadas por uma borda de 1px.
    const h = Math.trunc((this.height - 1) / 2,);
    const fmt1 = (fallback: string,): string =>
      this.columnDef.timeformat1 ?? fallback;
    const fmt2 = (fallback: string,): string =>
      this.columnDef.timeformat2 ?? fallback;

    switch (this.chart.scale.name) {
      case "hour":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.midnight(),
          (t,) => t.sameTimeNextDay(),
          fmt1("%A %Y-%m-%d",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfHour(),
          (t,) => t.sameTimeNextHour(),
          fmt2("%H",),
        );
        break;
      case "day":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt1("%b %Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.midnight(),
          (t,) => t.sameTimeNextDay(),
          fmt2("%d",),
        );
        break;
      case "week":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt1("%b %Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfWeek(this.chart.weekStartsMonday,),
          (t,) => t.sameTimeNextWeek(),
          fmt2("%d",),
        );
        break;
      case "month":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt2("%b",),
        );
        break;
      case "quarter":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfQuarter(),
          (t,) => t.sameTimeNextQuarter(),
          fmt2("Q%Q",),
        );
        break;
      case "year":
        // Só a escala pequena; a grande fica vazia (ver nota Categoria B).
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        break;
      default:
        throw new Error(`Unknown scale: ${this.chart.scale.name}`,);
    }

    this.nowLineX = this.chart.dateToX(this.chart.now,);

    if (this.chart.markdate) {
      this.markdateLineX = this.chart.dateToX(this.chart.markdate,);
    }
  }

  /** Gera as células de uma escala (Ruby `genHeaderScale`). */
  private genHeaderScale(
    scale: GanttHeaderScaleItem[],
    y: number,
    h: number,
    beginOf: BeginOfFunc,
    sameTimeNext: SameTimeNextFunc,
    timeformat: string,
  ): void {
    let t = beginOf(this.chart.start,);
    while (t.lessThan(this.chart.end,)) {
      const nextT = sameTimeNext(t,);
      // Fim da célula, guardando 1px para a borda.
      const xR = this.xOf(nextT,) - 1;
      const x = this.xOf(t,);
      const w = xR - x;
      // Posições da escala grande viram linhas de grade do chart.
      if (this.isLargeScale(scale,)) {
        this.gridLines.push(xR,);
      } else {
        this.cellStartDates.push(t,);
      }
      scale.push(new GanttHeaderScaleItem(t.to_s(timeformat,), x, y, w, h,),);
      t = nextT;
    }
    // Fecha a lista de células com a data final da última.
    if (this.isSmallScale(scale,)) this.cellStartDates.push(t,);
  }

  /**
   * `true` se `scale` é a escala grande. Em Ruby a comparação é `==`
   * (conteúdo); ver nota de Categoria B no topo do arquivo.
   */
  private isLargeScale(scale: GanttHeaderScaleItem[],): boolean {
    return compat.keepRubyBugs
      ? sameItems(scale, this.largeScale,)
      : scale === this.largeScale;
  }

  /** `true` se `scale` é a escala pequena (mesma regra de comparação). */
  private isSmallScale(scale: GanttHeaderScaleItem[],): boolean {
    return compat.keepRubyBugs
      ? sameItems(scale, this.smallScale,)
      : scale === this.smallScale;
  }

  /** Trunca `dateToX(t)` como o `to_i` do Ruby. */
  private xOf(t: TjTime,): number {
    return Math.trunc(this.chart.dateToX(t,),);
  }
}

/** `Array#==` do Ruby: compara conteúdo com identidade dos elementos. */
function sameItems<T,>(a: readonly T[], b: readonly T[],): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
