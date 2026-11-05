/**
 * 17.7.2 — `Points`.
 *
 * O detalhe mais traiçoeiro é o ESPAÇO FINAL de `to_s`: o Ruby concatena
 * `"#{x},#{y} "` para cada ponto. Verificado no oráculo em 2026-11-04.
 *
 * @see packages/core/src/painter/points.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { type Point, Points, } from "../../src/painter/points.ts";

describe("Points (17.7.2)", () => {
  it("constrói a partir de uma lista de pares", () => {
    const pts: Point[] = [[1, 2,], [3, 4,], [5, 6,],];
    assertEquals(new Points(pts,).to_s(), "1,2 3,4 5,6 ",);
  });

  it("lista vazia serializa vazio", () => {
    assertEquals(new Points([],).to_s(), "",);
  });

  it("aceita um único ponto (e mantém o espaço final)", () => {
    assertEquals(new Points([[0, 0,],],).to_s(), "0,0 ",);
  });

  it("rejeita ponto com 3 coordenadas", () => {
    const bad = [[1, 2, 3,],] as unknown as Point[];
    assertThrows(
      () => new Points(bad,),
      TjArgumentError,
      "Points must be an Array with 2 coordinates",
    );
  });

  it("rejeita lista achatada (elemento não é Array)", () => {
    const bad = [1, 2,] as unknown as Point[];
    assertThrows(
      () => new Points(bad,),
      TjArgumentError,
      "Points must be an Array with 2 coordinates",
    );
  });

  it("rejeita ponto vazio", () => {
    const bad = [[],] as unknown as Point[];
    assertThrows(() => new Points(bad,), TjArgumentError,);
  });

  it("valida TODOS os pontos antes de armazenar (o Ruby levanta no 1º)", () => {
    const bad = [[1, 2,], [3, 4, 5,],] as unknown as Point[];
    assertThrows(() => new Points(bad,), TjArgumentError,);
  });

  it("coordenadas fracionárias usam String(number) (Ruby 1.5 → '1.5')", () => {
    assertEquals(new Points([[1.5, 2.25,],],).to_s(), "1.5,2.25 ",);
  });

  it("nil/undefined serializa vazio, como `nil.to_s` no Ruby", () => {
    const loose = [[null, undefined,],] as unknown as Point[];
    assertEquals(new Points(loose,).to_s(), ", ",);
  });
});
