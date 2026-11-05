/**
 * GanttMilestone (Fase 15.5) — losango de um marco.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttMilestone.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.5)
 */
import { diamondToHTML, rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Meia-largura/altura do losango, em pixels. */
const SIZE = 6;

/** Marco (milestone) no Gantt. */
export class GanttMilestone {
  /** Ruby `@@size`: distância do centro às pontas do losango. */
  static readonly SIZE = SIZE;

  private readonly lineHeight: number;
  private readonly x: number;
  private readonly y: number;

  constructor(lineHeight: number, x: number, y: number,) {
    this.lineHeight = lineHeight;
    this.x = x;
    this.y = y;
  }

  /** Ponto onde as linhas de dependência que **saem** do início nascem. */
  startDepLineStart(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **chegam** ao início terminam. */
  startDepLineEnd(): [number, number,] {
    return [this.x - SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Ponto onde as linhas de dependência que **saem** do fim nascem. */
  endDepLineStart(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Ponto onde as linhas de dependência que **chegam** ao fim terminam.
   *
   * RUBY-COMPAT-DOC: o Ruby usa `@x + @@size` (mesma ponta direita do
   * losango que `startDepLineStart`), não `@x - @@size`. Mantido para
   * paridade de output.
   */
  endDepLineEnd(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /** Marca as zonas que o roteador não pode cruzar (Ruby `addBlockedZones`). */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Área do losango.
    router.addZone(
      this.x - SIZE - 2,
      centerY - SIZE - 2,
      2 * SIZE + 5,
      2 * SIZE + 5,
      true,
      true,
    );
    // Bloqueio da ponta da seta.
    router.addZone(this.x - SIZE - 9, centerY - 7, 10, 15, true, true,);
  }

  /** Converte o marco abstrato em `<div>`s (Ruby `to_html`). */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];

    // Moldura invisível que dispara os tooltips.
    const half = Math.trunc(this.lineHeight / 2,);
    html.push(
      rectToHTML(
        this.x - half,
        0,
        this.lineHeight,
        this.lineHeight,
        "tj_gantt_frame",
      ),
    );

    // Losango (dois `<div>` sobrepostos).
    html.push(...diamondToHTML(this.x, half,),);

    return html;
  }
}
