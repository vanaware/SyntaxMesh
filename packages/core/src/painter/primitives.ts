/**
 * 17.9.3 — `Primitives`: mix-in de criação (`Painter/Primitives.rb`).
 *
 * No Ruby é um `module` incluído em `Painter`, `Group` e `Element`. Ele expõe
 * fábricas (`color`, `points`) e construtores de formas (`group`, `circle`,
 * `ellipse`, `line`, `polyline`, `rect`, `text`) que **acrescentam o elemento
 * criado a `@elements`** e o devolvem. Só `Painter` e `Group` têm `@elements`,
 * então são os únicos onde as formas funcionam (`Element` inclui o módulo apenas
 * para enxergar as constantes `StrokeAttrs` etc. — aqui elas são módulos TS).
 *
 * Estratégia de port (evita ciclo `primitives ↔ group`): `Primitives` é uma
 * **classe abstrata** que mantém `elements` e as formas, mas NÃO conhece
 * `Group`. O único método que precisaria de `Group` (`group`) delega a criação
 * a um gancho `protected abstract newGroup(...)`, implementado por `Group` e
 * `Painter`. Assim `primitives.ts` só importa `Group`/`GroupBlock` como **tipo**
 * (apagado em runtime) e não há dependência de valor de volta para `group.ts`.
 *
 * Particularidades do oráculo (2026-11-04, `.tmp/primitives_probe.rb`):
 * - `line`/`rect`/`circle`/… **mutam o hash `attrs` do chamador** (Ruby
 *   `attrs[:x1] = x1`). É Category C replicado: as coordenadas são gravadas no
 *   objeto recebido antes de criar o elemento. `G_MUTATES` confirmou
 *   `{stroke: 'red', x1: 1, y1: 2, x2: 3, y2: 4}` após `g.line(1,2,3,4,attrs)`.
 * - `polyline(points, attrs)` aceita `Point[]` (converte em `Points`) **ou**
 *   um `Points` já pronto; ambos dão `points="1,2 3,4 "`.
 * - `color(*args)` → `new Color(...)`; `points(arr)` → `new Points(arr)`.
 * - `group` sem bloco devolve um `<g>` vazio: `G_GROUP_EMPTY` = `<g><g></g></g>`.
 * - Tipos devolvidos (`G_RET`): Line, Group, Rect, PolyLine, Text, Circle,
 *   Ellipse.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Primitives.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.3)
 */

import { Circle, Ellipse, Line, PolyLine, Rect, } from "./basic-shapes.ts";
import { Color, type ColorArg, } from "./color.ts";
import { type Drawable, } from "./element.ts";
import { type Point, Points, } from "./points.ts";
import { type SVGValues, } from "./svg-support.ts";
import { Text, } from "./text.ts";
import type { Group, GroupBlock, } from "./group.ts";

export abstract class Primitives {
  /** Acumulador dos elementos criados pelas formas (Ruby `@elements`). */
  protected readonly elements: Drawable[] = [];

  /**
   * Fábrica injetada para `group()`: `Group` e `Painter` fornecem sua própria
   * classe de grupo, mantendo `primitives.ts` livre de dependência de valor em
   * `group.ts`.
   */
  protected abstract newGroup(
    attrs: SVGValues,
    block?: GroupBlock,
  ): Group;

  /** Ruby `color(*args)` — `Color.new(*args)`. */
  color(...args: ColorArg[]): Color {
    return new Color(...args,);
  }

  /** Ruby `points(arr)` — `Points.new(arr)`. */
  points(arr: Point[],): Points {
    return new Points(arr,);
  }

  /** Ruby `group(attrs = {}, &block)` — cria, registra e devolve o `Group`. */
  group(attrs: SVGValues = {}, block?: GroupBlock,): Group {
    const g = this.newGroup(attrs, block,);
    this.elements.push(g,);
    return g;
  }

  circle(cx: number, cy: number, r: number, attrs: SVGValues = {},): Circle {
    attrs.cx = cx;
    attrs.cy = cy;
    attrs.r = r;
    const c = new Circle(attrs,);
    this.elements.push(c,);
    return c;
  }

  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    attrs: SVGValues = {},
  ): Ellipse {
    attrs.cx = cx;
    attrs.cy = cy;
    attrs.rx = rx;
    attrs.ry = ry;
    const e = new Ellipse(attrs,);
    this.elements.push(e,);
    return e;
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    attrs: SVGValues = {},
  ): Line {
    attrs.x1 = x1;
    attrs.y1 = y1;
    attrs.x2 = x2;
    attrs.y2 = y2;
    const l = new Line(attrs,);
    this.elements.push(l,);
    return l;
  }

  polyline(
    points: Point[] | Points,
    attrs: SVGValues = {},
  ): PolyLine {
    attrs.points = Array.isArray(points,) ? new Points(points,) : points;
    const l = new PolyLine(attrs,);
    this.elements.push(l,);
    return l;
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    attrs: SVGValues = {},
  ): Rect {
    attrs.x = x;
    attrs.y = y;
    attrs.width = width;
    attrs.height = height;
    const r = new Rect(attrs,);
    this.elements.push(r,);
    return r;
  }

  text(x: number, y: number, str: string, attrs: SVGValues = {},): Text {
    attrs.x = x;
    attrs.y = y;
    const t = new Text(str, attrs,);
    this.elements.push(t,);
    return t;
  }
}
