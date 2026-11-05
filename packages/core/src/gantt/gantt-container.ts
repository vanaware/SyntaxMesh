/**
 * GanttContainer (Fase 15.6) — barra de uma tarefa container (com sub-tarefas).
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttContainer.rb`.
 * A barra é desenhada com "jags" (colchetes) nas pontas, por isso se estende
 * `SIZE` pixels além de `start`/`end`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.6)
 */
import { jagToHTML, rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Meia-altura da barra, em pixels. */
const SIZE = 5;

/** Barra de tarefa container no Gantt. */
export class GanttContainer {
  /** Ruby `@@size`: meia-altura da barra (centro → topo/base). */
  static readonly SIZE = SIZE;

  private readonly lineHeight: number;
  private readonly start: number;
  private readonly end: number;
  private readonly y: number;

  constructor(lineHeight: number, xStart: number, xEnd: number, y: number,) {
    this.lineHeight = lineHeight;
    this.start = xStart;
    this.end = xEnd;
    this.y = y;
  }

  /** Ponto onde as linhas de dependência que **saem** do início nascem. */
  startDepLineStart(): [number, number,] {
    return [this.start, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **chegam** ao início terminam. */
  startDepLineEnd(): [number, number,] {
    return [this.start - SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **saem** do fim nascem. */
  endDepLineStart(): [number, number,] {
    return [this.end + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **chegam** ao fim terminam. */
  endDepLineEnd(): [number, number,] {
    return [this.end, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Marca as zonas que o roteador não pode cruzar (Ruby `addBlockedZones`). */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Bloqueio horizontal da barra (incluindo os jags).
    router.addZone(
      this.start - SIZE,
      centerY - SIZE - 2,
      this.end - this.start + 1 + 2 * SIZE,
      2 * SIZE + 5,
      true,
      false,
    );
    // Bloqueio da ponta da seta.
    router.addZone(this.start - SIZE - 9, centerY - 7, 10, 15, true, true,);
    // Bloqueio vertical das bordas.
    router.addZone(
      this.start - SIZE - 2,
      this.y,
      2 * SIZE + 5,
      this.lineHeight,
      false,
      true,
    );
    router.addZone(
      this.end - SIZE - 2,
      this.y,
      2 * SIZE + 5,
      this.lineHeight,
      false,
      true,
    );
  }

  /** Converte o container abstrato em `<div>`s (Ruby `to_html`). */
  to_html(): XMLElementLike[] {
    const xStart = Math.trunc(this.start,);
    const yCenter = Math.trunc(this.lineHeight / 2,);
    const width = Math.trunc(this.end,) - Math.trunc(this.start,) + 1;

    const html: XMLElementLike[] = [];

    // Moldura invisível que dispara os tooltips.
    html.push(
      rectToHTML(
        xStart - SIZE,
        0,
        width + 2 * SIZE,
        this.lineHeight,
        "tj_gantt_frame",
      ),
    );

    // A barra.
    html.push(
      rectToHTML(
        xStart - SIZE,
        yCenter - SIZE,
        width + 2 * SIZE,
        SIZE,
        "containerbar",
      ),
    );
    // Jag esquerdo.
    html.push(jagToHTML(xStart, yCenter,),);
    // Jag direito.
    html.push(jagToHTML(xStart + width, yCenter,),);

    return html;
  }
}
