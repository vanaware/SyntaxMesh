/**
 * 17.9.1 — `BasicShapes` (Circle, Ellipse, Line, Rect, PolyLine).
 *
 * Saídas copiadas do oráculo Ruby (`.tmp/shapes_ruby_check.rb`, 2026-11-04).
 *
 * @see packages/core/src/painter/basic-shapes.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import {
  Circle,
  Ellipse,
  Line,
  PolyLine,
  Rect,
} from "../../src/painter/basic-shapes.ts";
import { Points, } from "../../src/painter/points.ts";

describe("Circle (17.9.1.2)", () => {
  it("só fill, sem coordenadas", () => {
    assertEquals(
      new Circle({ fill: "red", },).to_svg().to_s(),
      '<circle fill="red"></circle>',
    );
  });

  it("todos os atributos saem ordenados (regra do XMLElement)", () => {
    assertEquals(
      new Circle({
        cx: 1,
        cy: 2,
        r: 3,
        fill: "red",
        fill_opacity: 0.5,
        stroke: "blue",
        stroke_opacity: 1,
        stroke_width: 2,
      },)
        .to_svg()
        .to_s(),
      '<circle cx="1" cy="2" fill="red" fill-opacity="0.5" r="3" ' +
        'stroke="blue" stroke-opacity="1" stroke-width="2"></circle>',
    );
  });

  it("rejeita font_family (não está em FillAndStrokeAttrs)", () => {
    assertThrows(
      () => new Circle({ font_family: "Arial", },),
      TjArgumentError,
      "Unsupported attribute font_family",
    );
  });
});

describe("Ellipse (17.9.1.3)", () => {
  it("centro e raios", () => {
    assertEquals(
      new Ellipse({ cx: 1, cy: 2, rx: 3, ry: 4, },).to_svg().to_s(),
      '<ellipse cx="1" cy="2" rx="3" ry="4"></ellipse>',
    );
  });

  it("aceita fill e stroke", () => {
    assertEquals(
      new Ellipse({ cx: 0, fill: "red", stroke: "blue", },).to_svg().to_s(),
      '<ellipse cx="0" fill="red" stroke="blue"></ellipse>',
    );
  });

  rejeita("Ellipse", () => new Ellipse({ x: 1, },),);
});

describe("Line (17.9.1.4)", () => {
  it("usa só StrokeAttrs", () => {
    assertEquals(
      new Line({ x1: 0, y1: 0, x2: 10, y2: 10, stroke_width: 2, },)
        .to_svg()
        .to_s(),
      '<line stroke-width="2" x1="0" x2="10" y1="0" y2="10"></line>',
    );
  });

  it("rejeita fill (linha não tem preenchimento)", () => {
    assertThrows(
      () => new Line({ x1: 0, fill: "red", },),
      TjArgumentError,
      "Unsupported attribute fill",
    );
  });

  it("aceita stroke_opacity", () => {
    assertEquals(
      new Line({ x1: 1, x2: 2, stroke_opacity: 0.5, },).to_svg().to_s(),
      '<line stroke-opacity="0.5" x1="1" x2="2"></line>',
    );
  });
});

describe("Rect (17.9.1.5)", () => {
  it("x, y, width, height, rx, ry", () => {
    assertEquals(
      new Rect({ x: 1, y: 2, width: 3, height: 4, rx: 5, ry: 6, },)
        .to_svg()
        .to_s(),
      '<rect height="4" rx="5" ry="6" width="3" x="1" y="2"></rect>',
    );
  });

  it("aceita fill e stroke", () => {
    assertEquals(
      new Rect({ x: 0, fill: "red", },).to_svg().to_s(),
      '<rect fill="red" x="0"></rect>',
    );
  });

  rejeita("Rect", () => new Rect({ bogus: 1, },),);
});

describe("PolyLine (17.9.1.6)", () => {
  it("serializa um objeto Points (com espaço final)", () => {
    assertEquals(
      new PolyLine({ points: new Points([[1, 2,], [3, 4,],],), },)
        .to_svg()
        .to_s(),
      '<polyline points="1,2 3,4 "></polyline>',
    );
  });

  it("aceita fill e stroke", () => {
    assertEquals(
      new PolyLine({ fill: "red", points: new Points([],), },).to_svg().to_s(),
      '<polyline fill="red" points=""></polyline>',
    );
  });

  rejeita("PolyLine", () => new PolyLine({ x: 1, },),);
});

/** Helper: cada forma rejeita uma chave fora da sua lista. */
function rejeita(
  nome: string,
  build: () => { to_svg(): { to_s(): string } },
): void {
  it(`${nome} rejeita atributo desconhecido`, () => {
    assertThrows(build, TjArgumentError, "Unsupported attribute",);
  });
}
