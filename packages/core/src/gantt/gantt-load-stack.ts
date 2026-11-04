/**
 * GanttLoadStack (Fase 15.7) — pilha de carga normalizada pela altura da linha.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttLoadStack.rb`.
 * Usada para recursos (e tarefas aninhadas em recursos): mostra a fração de
 * trabalho alocado por categoria de cor.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.7)
 */
import type { XMLElementLike, } from "../richtext/xml-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/**
 * Contrato que `GanttLoadStack` espera da linha que o hospeda. Em Ruby ele
 * chama `@line.lineToHTML`/`@line.rectToHTML` (mix-in `HTMLGraphics`);
 * `GanttLine` (15.10) implementa estes dois métodos.
 */
export interface LoadStackHost {
  /** Altura da linha em pixels (Ruby `line.height`). */
  readonly height: number;
  /** Coordenada Y do topo da linha (Ruby `line.y`). */
  readonly y: number;
  lineToHTML(
    xs: number,
    ys: number,
    xe: number,
    ye: number,
    category: string,
  ): XMLElementLike;
  rectToHTML(
    x: number,
    y: number,
    w: number,
    h: number,
    category: string,
  ): XMLElementLike;
}

/** Pilha de carga de uma linha do Gantt. */
export class GanttLoadStack {
  private readonly line: LoadStackHost;
  private readonly lineHeight: number;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly drawFrame: boolean;
  private readonly categories: ReadonlyArray<string | null>;
  /** Ladrilhos em coordenadas Y; `null` quando a soma dos valores é 0. */
  private readonly yLevels: number[] | null;

  constructor(
    line: LoadStackHost,
    x: number,
    w: number,
    values: readonly number[],
    categories: ReadonlyArray<string | null>,
  ) {
    this.line = line;
    this.lineHeight = line.height;
    this.x = x;
    this.y = line.y;
    // Larguras <= 0 viram 1px.
    this.w = w <= 0 ? 1 : w;
    let drawFrame = false;
    if (values.length !== categories.length) {
      throw new Error(
        "Values and categories must have the same number of entries!",
      );
    }
    this.categories = categories;
    for (let i = 0; i < categories.length; i++) {
      // Categoria sem cor com valor > 0 deixa o fundo aparecendo → moldura.
      if (categories[i] === null && (values[i] ?? 0) > 0) {
        drawFrame = true;
        break;
      }
    }

    let sum = 0;
    for (const v of values) sum += v;
    if (sum === 0) {
      // Soma 0: nada a empilhar, mas a moldura é desenhada.
      this.yLevels = null;
      drawFrame = true;
    } else {
      // Sobra 1px em cima, 1px embaixo e 1px para a moldura.
      // RUBY-COMPAT-DOC: o Ruby divide inteiros com `Integer#/` (floor); os
      // valores reais vêm de `getEffectiveWork` (Float), então a divisão real
      // do TS preserva o comportamento observável.
      this.yLevels = values.map((v,) => (this.lineHeight - 4) * v / sum);
    }
    this.drawFrame = drawFrame;
  }

  /** Marca a zona horizontal da pilha (Ruby `addBlockedZones`). */
  addBlockedZones(router: ZoneRouter,): void {
    router.addZone(
      this.x - 2,
      this.y,
      this.w + 4,
      this.lineHeight,
      true,
      false,
    );
  }

  /** Converte a pilha abstrata em `<div>`s (Ruby `to_html`). */
  to_html(): XMLElementLike[] | null {
    // Nada a desenhar quando todos os valores são 0.
    const levels = this.yLevels;
    if (!levels) return null;

    const html: XMLElementLike[] = [];
    const top = 1;
    const bottom = this.lineHeight - 2;
    if (this.drawFrame) {
      // Moldura explícita (4 linhas) para preservar o fundo quando a pilha
      // não preenche a linha inteira.
      html.push(
        this.line.lineToHTML(this.x, top, this.x + this.w - 1, top, FRAME,),
      );
      html.push(
        this.line.lineToHTML(
          this.x,
          bottom,
          this.x + this.w - 1,
          bottom,
          FRAME,
        ),
      );
      html.push(this.line.lineToHTML(this.x, top, this.x, bottom, FRAME,),);
      html.push(
        this.line.lineToHTML(
          this.x + this.w - 1,
          top,
          this.x + this.w - 1,
          bottom,
          FRAME,
        ),
      );
    } else {
      html.push(
        this.line.rectToHTML(this.x, top, this.w, bottom, FRAME,),
      );
    }

    let yPos = 2;
    // Barras ligeiramente mais estreitas, empilhadas de baixo para cima.
    for (let i = levels.length - 1; i >= 0; i--) {
      const level = levels[i]!;
      if (level <= 0) continue;
      const category = this.categories[i];
      if (category) {
        html.push(
          this.line.rectToHTML(
            this.x + 1,
            Math.trunc(yPos,),
            this.w - 2,
            Math.trunc(yPos + level,) - Math.trunc(yPos,),
            category,
          ),
        );
      }
      yPos += level;
    }

    return html;
  }
}

/** Classe CSS da moldura da pilha. */
const FRAME = "loadstackframe";
