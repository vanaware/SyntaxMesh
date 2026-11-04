/**
 * CollisionDetector (Fase 15.2) — zonas bloqueadas para o roteamento do Gantt.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/CollisionDetector.rb`.
 *
 * As zonas são armazenadas como array de segmentos por linha: bloqueios
 * horizontais em `hLines[y]`, verticais em `vLines[x]`. Cada segmento é
 * `[start, end]` e as duas pontas são parte do segmento. Segmentos sobrepostos
 * ou diretamente adjacentes são mesclados na inserção, o que mantém as listas
 * ordenadas e curtas para a busca binária de `collision()`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.2)
 */
import { lineToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../richtext/xml-like.ts";

/** Segmento bloqueado `[start, end]` (inclusivo nas duas pontas). */
export type LineSegment = [number, number,];

/** Detector de colisão por linha horizontal (`y`) e vertical (`x`). */
export class CollisionDetector {
  private readonly width: number;
  private readonly height: number;
  /** Bloqueios horizontais por `y`: `hLines[y] = [[start, end], …]`. */
  private readonly hLines: LineSegment[][];
  /** Bloqueios verticais por `x`: `vLines[x] = [[start, end], …]`. */
  private readonly vLines: LineSegment[][];

  constructor(width: number, height: number,) {
    this.width = width;
    this.height = height;
    this.hLines = Array.from({ length: height, }, () => [] as LineSegment[],);
    this.vLines = Array.from({ length: width, }, () => [] as LineSegment[],);
  }

  /**
   * Registra uma área como "don't-cross-zone". `horiz` bloqueia linhas
   * horizontais; `vert`, verticais (Ruby `addBlockedZone`).
   */
  addBlockedZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void {
    // Recorta o retângulo à área controlada pelo router.
    const cx = this.clip(Math.trunc(x,), this.width - 1,);
    const cy = this.clip(Math.trunc(y,), this.height - 1,);
    const cw = this.clip(Math.trunc(w,), this.width - cx,);
    const ch = this.clip(Math.trunc(h,), this.height - cy,);

    // Zonas vazias podem ser ignoradas.
    if (cw === 0 || ch === 0) return;

    if (horiz) {
      for (let i = cy; i <= cy + ch - 1; i++) {
        this.addSegment(this.hLines[i]!, [cx, cx + cw - 1,],);
      }
    }
    if (vert) {
      for (let i = cx; i <= cx + cw - 1; i++) {
        this.addSegment(this.vLines[i]!, [cy, cy + ch - 1,],);
      }
    }
  }

  /**
   * Indica se há bloqueio na linha `pos` para o `segment` dado. Usa busca
   * binária (Ruby `collision?`): as listas ficam ordenadas por `start`.
   */
  collision(
    pos: number,
    segment: LineSegment,
    horizontal: boolean,
  ): boolean {
    const lines = horizontal ? this.hLines : this.vLines;
    // Fora da área do router não há bloqueio (o Ruby estouraria; aqui é
    // tratado como vazio para manter o router robusto em charts degenerados).
    const line = lines[pos] ?? [];
    let l = 0;
    let u = line.length - 1;
    while (l <= u) {
      const p = l + Math.trunc((u - l) / 2,);
      const candidate = line[p]!;
      if (this.overlaps(candidate, segment,)) return true;
      if (segment[0] > candidate[1]) {
        l = p + 1;
      } else {
        u = p - 1;
      }
    }
    return false;
  }

  /**
   * Serializa os bloqueios **verticais** como linhas brancas (debug). O Ruby
   * tem um `if true` com o ramo horizontal desabilitado; mantemos apenas o
   * ramo ativo.
   */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    this.vLines.forEach((line, x,) => {
      for (const segment of line) {
        html.push(lineToHTML(x, segment[0], x, segment[1], "white",),);
      }
    },);
    return html;
  }

  /** Limita `v` ao intervalo `[0, max]` (Ruby `clip`). */
  private clip(v: number, max: number,): number {
    if (v < 0) return 0;
    if (v > max) return max;
    return v;
  }

  /**
   * Insere `newSegment` na `line`, mesclando com segmentos sobrepostos ou
   * adjacentes (Ruby `addSegment`).
   */
  private addSegment(line: LineSegment[], newSegment: LineSegment,): void {
    let i = 0;
    while (i < line.length) {
      const segment = line[i]!;
      if (this.mergeable(newSegment, segment,)) {
        // Mescla o segmento existente no novo e recomeça na mesma posição.
        this.merge(newSegment, segment,);
        line.splice(i, 1,);
        continue;
      } else if (segment[0] > newSegment[1]) {
        // Lista em ordem crescente: insere antes do maior.
        line.splice(i, 0, newSegment,);
        return;
      }
      i++;
    }
    line.push(newSegment,);
  }

  /** `true` se `s1` e `s2` se sobrepõem (pontas inclusas). */
  private overlaps(s1: LineSegment, s2: LineSegment,): boolean {
    return (s1[0] <= s2[0] && s2[0] <= s1[1]) ||
      (s2[0] <= s1[0] && s1[0] <= s2[1]);
  }

  /** `true` se `s1` e `s2` se sobrepõem ou são diretamente adjacentes. */
  private mergeable(s1: LineSegment, s2: LineSegment,): boolean {
    return this.overlaps(s1, s2,) ||
      (s1[1] + 1 === s2[0]) ||
      (s2[1] + 1 === s1[0]);
  }

  /** Estende `dst` para cobrir também `seg` (Ruby `merge`). */
  private merge(dst: LineSegment, seg: LineSegment,): void {
    if (seg[0] < dst[0]) dst[0] = seg[0];
    if (seg[1] > dst[1]) dst[1] = seg[1];
  }
}
