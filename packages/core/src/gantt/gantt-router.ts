/**
 * GanttRouter (Fase 15.3) — roteia as linhas de dependência do Gantt.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/GanttRouter.rb`.
 *
 * O chart é uma área retangular `width` × `height`. Cada elemento gráfico
 * registra "don't-cross-zones" (`addZone`) que bloqueiam linhas horizontais,
 * verticais ou ambas. `route()` devolve um caminho ortogonal (nunca diagonal)
 * de `[x, y]` pontos, começando no início e terminando no fim.
 *
 * ## Comportamentos estranhos do Ruby (cheat sheet §12)
 *
 * - **Categoria A** — `Math.asin(PI/2 - sinus)` no ramo `adjLeg < 0` sai do
 *   domínio de `asin` e levanta `Math::DomainError` no Ruby. Corrigido com
 *   clamp do argumento: idêntico a todos os casos em que o Ruby funciona.
 * - **Categoria A** — os `raise "Routing failed" unless ySeg|x1|x2` são
 *   inalcançáveis: `placeLine` sempre devolve um inteiro.
 * - **Categoria B** — no ramo horizontal de `addLineTo` o Ruby testa
 *   `x1 >= @height` (provável typo de `y1 >= @height`), o que descarta zonas
 *   legítimas. Replicado sob `compat.keepRubyBugs`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.3)
 */
import { compat, } from "../compat.ts";
import type { XMLElementLike, } from "../richtext/xml-like.ts";
import { CollisionDetector, type LineSegment, } from "./collision-detector.ts";

/** Distância mínima entre o ponto inicial e a primeira curva. */
export const MinStartGap = 5;
/** Distância mínima entre a última curva e a ponta da seta. */
export const MinEndGap = 10;

/** Ponto do caminho roteado. */
export type RoutePoint = [number, number,];

/** Tupla `[startX, startY, endX, endY, id?]` aceita por `routeLines`. */
export type FromToPoint = [number, number, number, number, number?,];

/** Rota em processamento (equivalente ao Hash do Ruby). */
interface RouteDef {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly id?: number;
  distance: number;
  angle: number;
}

/**
 * Contrato mínimo consumido pelos elementos do Gantt. Em Ruby eles recebem o
 * `GanttRouter` e chamam apenas `addZone`.
 */
export interface ZoneRouter {
  addZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void;
}

/** Roteador de linhas de dependência sobre uma área `width` × `height`. */
export class GanttRouter implements ZoneRouter {
  private readonly width: number;
  private readonly height: number;
  private readonly detector: CollisionDetector;

  constructor(width: number, height: number,) {
    this.width = Math.trunc(width,);
    this.height = Math.trunc(height,);
    this.detector = new CollisionDetector(this.width, this.height,);
  }

  /** Registra uma área que as linhas não podem cruzar (Ruby `addZone`). */
  addZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void {
    this.detector.addBlockedZone(x, y, w, h, horiz, vert,);
  }

  /**
   * Roteia um lote de setas. A ordem é determinística: ângulo decrescente em
   * buckets de 5 graus e, dentro do bucket, distância decrescente (Ruby
   * `routeLines`).
   */
  routeLines(fromToPoints: readonly FromToPoint[],): RoutePoint[][] {
    const routes: RouteDef[] = fromToPoints.map((t,) => ({
      startX: t[0],
      startY: t[1],
      endX: t[2],
      endY: t[3],
      id: t[4],
      distance: 0,
      angle: 0,
    }));

    for (const r of routes) {
      const adjLeg = (r.endX - MinEndGap) - (r.startX + MinStartGap);
      const oppLeg = Math.abs(r.startY - r.endY,);
      r.distance = Math.sqrt(adjLeg ** 2 + oppLeg ** 2,);
      // Seno do ângulo entre a vertical pelo fim da tarefa e a reta
      // início→fim; convertido para graus (0–90).
      const sinus = Math.abs(oppLeg,) / r.distance;
      if (adjLeg < 0) {
        // RUBY-COMPAT-FIX: o Ruby usa asin(PI/2 - sinus), cujo argumento sai
        // de [-1, 1] e levanta Math::DomainError. O clamp mantém o mesmo
        // resultado em todos os casos em que o Ruby não quebra.
        const arg = Math.min(1, Math.max(-1, Math.PI / 2 - sinus,),);
        r.angle = (Math.PI / 2 + Math.asin(arg,)) / (Math.PI / (2 * 90));
      } else {
        r.angle = Math.asin(sinus,) / (Math.PI / (2 * 90));
      }
    }

    routes.sort((r1, r2,) => {
      // Ruby: -(r1 <=> r2) → ordem decrescente nos dois critérios.
      if (Math.trunc(r1.angle / 5,) === Math.trunc(r2.angle / 5,)) {
        return r2.distance - r1.distance;
      }
      return r2.angle - r1.angle;
    },);

    return routes.map((r,) => this.route(r.startX, r.startY, r.endX, r.endY,));
  }

  /**
   * Caminho ortogonal de `(startX, startY)` a `(endX, endY)`. Tenta uma rota
   * direta em 3 pontos; se o corredor não couber ou estiver bloqueado, usa a
   * rota em 6 pontos (Ruby `route`).
   */
  route(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): RoutePoint[] {
    const points: RoutePoint[] = [[startX, startY,],];

    if (endX - startX > MinStartGap + MinEndGap + 2) {
      const xSeg = this.placeLine(
        [startY + (startY < endY ? 1 : -1), endY,],
        false,
        startX + MinStartGap,
        1,
      );
      // Ruby: `if xSeg && xSeg < endX - endGap`. `placeLine` nunca devolve
      // nil e 0 é truthy no Ruby, então resta apenas a comparação.
      if (xSeg < endX - MinEndGap) {
        this.addLineTo(points, xSeg, startY,);
        this.addLineTo(points, xSeg, endY,);
        this.addLineTo(points, endX, endY,);
        return points;
      }
    }

    // Rota complexa: desce/sobe até uma linha livre, anda na horizontal e
    // desce/sobe até o destino.
    const deltaY = startY < endY ? 1 : -1;
    const ySeg = this.placeLine(
      [0, this.width - 1,],
      true,
      startY + 2 * deltaY,
      deltaY,
    );
    // RUBY-COMPAT-DOC: os `raise "Routing failed"` do Ruby são inalcançáveis
    // porque `placeLine` sempre devolve um inteiro.
    const x1 = this.placeLine(
      [startY + deltaY, ySeg,],
      false,
      startX + MinStartGap,
      1,
    );
    const x2 = this.placeLine(
      [ySeg + deltaY, endY,],
      false,
      endX - MinEndGap,
      -1,
    );

    this.addLineTo(points, x1, startY,);
    if (x1 !== x2) {
      this.addLineTo(points, x1, ySeg,);
      this.addLineTo(points, x2, ySeg,);
    }
    this.addLineTo(points, x2, endY,);
    this.addLineTo(points, endX, endY,);

    return points;
  }

  /** Bloqueios verticais serializados como linhas brancas (debug). */
  to_html(): XMLElementLike[] {
    return this.detector.to_html();
  }

  /**
   * Primeira coordenada livre para `segment` na linha/coluna `start`, andando
   * por `delta`. Devolve a borda da área se nada estiver livre (Ruby
   * `placeLine`).
   */
  private placeLine(
    segment: LineSegment,
    horizontal: boolean,
    start: number,
    delta: number,
  ): number {
    if (delta === 0) throw new Error("delta may not be 0",);

    let pos = Math.trunc(start,);
    if (pos < 0) pos = 0;
    const max = (horizontal ? this.height : this.width) - 1;
    if (pos > max) pos = max;

    // Ruby `segment.sort!` — o segmento precisa estar em ordem crescente.
    segment.sort((a, b,) => a - b);

    while (this.detector.collision(pos, segment, horizontal,)) {
      pos += delta;
      if (delta < 0) {
        if (pos < 0) break;
      } else {
        if (pos >= (horizontal ? this.height : this.width)) break;
      }
    }
    return pos;
  }

  /**
   * Anexa um waypoint e marca uma zona de 2px de cada lado do segmento, para
   * evitar linhas paralelas coladas (Ruby `addLineTo`).
   */
  private addLineTo(points: RoutePoint[], x2: number, y2: number,): void {
    if (points.length === 0) {
      throw new Error("Point list may not be empty",);
    }

    const [x1, y1,] = points[points.length - 1]!;
    points.push([x2, y2,],);

    if (x1 === x2) {
      // Linha vertical.
      if (x1 < 0 || x1 >= this.width) return;
      const [x, y, w, h,] = justify(x1 - 2, y1, 5, y2 - y1 + 1,);
      this.addZone(x, y, w, h, false, true,);
    } else {
      // Linha horizontal.
      if (compat.keepRubyBugs) {
        // RUBY-COMPAT: o Ruby testa `x1 >= @height` (typo de `y1 >= @height`),
        // descartando zonas horizontais legítimas e alterando o roteamento.
        if (y1 < 0 || x1 >= this.height) return;
      } else {
        if (y1 < 0 || y1 >= this.height) return;
      }
      const [x, y, w, h,] = justify(x1, y1 - 2, x2 - x1 + 1, 5,);
      this.addZone(x, y, w, h, true, false,);
    }
  }
}

/**
 * Normaliza um retângulo para coordenadas positivas (Ruby `justify`). Note
 * que `x` usa o `w` já positivado.
 */
export function justify(
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number, number, number,] {
  if (w < 0) {
    w = -w;
    x = x - w + 1;
  }
  if (h < 0) {
    h = -h;
    y = y - h + 1;
  }
  return [x, y, w, h,];
}
