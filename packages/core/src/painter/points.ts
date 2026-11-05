/**
 * 17.7.2 — `Points`: lista de coordenadas para SVG (`Painter/Points.rb`).
 *
 * Porta `TaskJuggler::Painter::Points`: guarda pares `[x, y]` depois de
 * validar cada elemento e serializa no formato `points` do SVG.
 *
 * Particularidades (oráculo Ruby, 2026-11-04):
 * - **O `to_s` termina com espaço**: cada ponto é concatenado como
 *   `"#{x},#{y} "`, então `[[1,2],[3,4]]` vira `"1,2 3,4 "` (com o espaço
 *   final). O plano sugeria `"x,y x,y"` sem espaço; o Ruby manda.
 * - Lista vazia → string vazia.
 * - A validação aceita qualquer `Array` de 2 elementos (não verifica se são
 *   numéricos): `[[nil, nil]]` passa e serializa `", "` (`nil.to_s`). Aqui o
 *   `null`/`undefined` também serializa vazio, com `?? ""`.
 * - Ruby guarda a referência recebida (`@points = arr`), sem copiar — o port
 *   faz o mesmo para não mudar o comportamento de apelões que mutam a lista.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Points.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.2)
 */

import { TjArgumentError, } from "../model/errors.ts";

/** Par `[x, y]` (números no port; o Ruby só exige um Array de 2 elementos). */
export type Point = [number, number,];

export class Points {
  private readonly points: Point[];

  /** Ruby `initialize(arr)` — rejeita qualquer elemento que não seja par. */
  constructor(arr: Point[],) {
    for (const point of arr) {
      if (!Array.isArray(point,) || point.length !== 2) {
        throw new TjArgumentError(
          "Points must be an Array with 2 coordinates",
        );
      }
    }
    this.points = arr;
  }

  /** `"x,y x,y "` — SVG `points`, com espaço depois de cada par (como Ruby). */
  to_s(): string {
    let str = "";
    for (const point of this.points) {
      const [x, y,] = point;
      str += `${x ?? ""},${y ?? ""} `;
    }
    return str;
  }
}
