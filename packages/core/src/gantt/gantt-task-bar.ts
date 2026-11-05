/**
 * GanttTaskBar (Fase 15.4) — barra de uma tarefa folha com progresso.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttTaskBar.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.4)
 */
import { rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Consulta mínima usada para ler o atributo `complete` (Fase 11). */
export interface GanttBarQuery {
  attributeId: string | null;
  process(): void;
  result(): unknown;
}

/** Meia-altura da barra, em pixels. */
const SIZE = 6;

/** Barra de tarefa folha no Gantt. */
export class GanttTaskBar {
  /** Ruby `@@size`: meia-altura da barra (centro → topo/base). */
  static readonly SIZE = SIZE;

  private readonly query: GanttBarQuery | null;
  private readonly lineHeight: number;
  private readonly start: number;
  private readonly end: number;
  private readonly y: number;

  constructor(
    query: GanttBarQuery | null,
    lineHeight: number,
    xStart: number,
    xEnd: number,
    y: number,
  ) {
    this.query = query;
    this.lineHeight = lineHeight;
    this.start = xStart;
    this.end = xEnd;
    this.y = y;
  }

  /** Ponto onde as linhas de dependência que **saem** do início nascem. */
  startDepLineStart(): [number, number,] {
    return [this.start + 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **chegam** ao início terminam. */
  startDepLineEnd(): [number, number,] {
    return [this.start - 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **saem** do fim nascem. */
  endDepLineStart(): [number, number,] {
    return [this.end + 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **chegam** ao fim terminam. */
  endDepLineEnd(): [number, number,] {
    return [this.end - 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Marca as zonas que o roteador não pode cruzar (Ruby `addBlockedZones`). */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Bloqueio horizontal da barra inteira.
    router.addZone(
      this.start,
      centerY - SIZE - 1,
      this.end - this.start + 1,
      2 * SIZE + 3,
      true,
      false,
    );
    // Bloqueio da ponta da seta.
    router.addZone(this.start - 9, centerY - 7, 10, 15, true, true,);
    // Bloqueio vertical das bordas.
    router.addZone(this.start - 2, this.y, 5, this.lineHeight, false, true,);
    router.addZone(this.end - 2, this.y, 5, this.lineHeight, false, true,);
  }

  /** Converte a barra abstrata em `<div>`s (Ruby `to_html`). */
  to_html(): XMLElementLike[] {
    const xStart = Math.trunc(this.start,);
    const yCenter = Math.trunc(this.lineHeight / 2,);
    const width = Math.trunc(this.end,) - Math.trunc(this.start,) + 1;

    const html: XMLElementLike[] = [];

    // Moldura invisível que dispara os tooltips.
    html.push(
      rectToHTML(xStart, 0, width, this.lineHeight, "tj_gantt_frame",),
    );

    // Moldura da barra.
    html.push(
      rectToHTML(xStart, yCenter - SIZE, width, 2 * SIZE, "taskbarframe",),
    );

    // Preenchimento.
    html.push(
      rectToHTML(
        xStart + 1,
        yCenter - SIZE + 1,
        width - 2,
        2 * SIZE - 2,
        "taskbar",
      ),
    );

    // Barra de progresso; sem query o Ruby assume 50%.
    let completion: number;
    if (this.query) {
      this.query.attributeId = "complete";
      this.query.process();
      const res = this.query.result();
      // Ruby `res ? res / 100.0 : 0.0` — `complete` é numérico ou nulo.
      completion = typeof res === "number" ? res / 100 : 0;
    } else {
      completion = 0.5;
    }
    html.push(
      rectToHTML(
        xStart + 1,
        yCenter - Math.trunc(SIZE / 2,),
        (width - 2) * completion,
        SIZE,
        "progressbar",
      ),
    );

    return html;
  }
}
