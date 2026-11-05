/**
 * 17.10 — `Painter`.
 *
 * Saídas copiadas do oráculo Ruby (`.tmp/painter_ruby_check.rb`, 2026-11-04).
 *
 * @see packages/core/src/painter/painter.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import { Group, } from "../../src/painter/group.ts";
import { Line, Rect, } from "../../src/painter/basic-shapes.ts";
import { Painter, } from "../../src/painter/painter.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";

describe("Painter — to_svg vazio (17.10.5)", () => {
  it("sem filhos: <svg> só com width/height (height primeiro)", () => {
    assertEquals(
      new Painter(100, 50,).to_svg().to_s(),
      '<svg height="50px" width="100px"></svg>',
    );
  });

  it("to_svg devolve um XMLElement de tag svg", () => {
    const svg = new Painter(6, 4,).to_svg();
    assert(svg instanceof XMLElement,);
    assertEquals(svg.name, "svg",);
    assertEquals(svg.children.length, 0,);
  });
});

describe("Painter — com elementos (17.10.6)", () => {
  it("um line filho, sem quebra de linha", () => {
    const p = new Painter(100, 50, (painter,) => {
      painter.line(0, 0, 10, 10, { stroke_width: 1, },);
    },);
    assertEquals(
      p.to_svg().to_s(),
      '<svg height="50px" width="100px">' +
        '<line stroke-width="1" x1="0" x2="10" y1="0" y2="10"></line></svg>',
    );
  });

  it("dois filhos ganham quebra e indent de 1 espaço", () => {
    const p = new Painter(6, 4, (painter,) => {
      painter.rect(1, 2, 3, 4,);
      painter.text(5, 6, "x",);
    },);
    assertEquals(
      p.to_svg().to_s(),
      '<svg height="4px" width="6px">\n' +
        ' <rect height="4" width="3" x="1" y="2"></rect>\n' +
        ' <text x="5" y="6">x</text>\n</svg>',
    );
  });
});

describe("Painter — grupos (bloco com arg, 17.10.3)", () => {
  it("group com atributo e um line filho", () => {
    const p = new Painter(6, 4, (painter,) => {
      painter.group({ fill: "red", }, (g,) => {
        g.line(1, 2, 3, 4,);
      },);
    },);
    assertEquals(
      p.to_svg().to_s(),
      '<svg height="4px" width="6px"><g fill="red">' +
        '<line x1="1" x2="3" y1="2" y2="4"></line></g></svg>',
    );
  });

  it("group aninhado dentro de group", () => {
    const p = new Painter(6, 4, (painter,) => {
      painter.group({ fill: "red", }, (g,) => {
        g.group({ stroke: "blue", }, (inner,) => {
          inner.circle(1, 2, 3,);
        },);
      },);
    },);
    assertEquals(
      p.to_svg().to_s(),
      '<svg height="4px" width="6px"><g fill="red"><g stroke="blue">' +
        '<circle cx="1" cy="2" r="3"></circle></g></g></svg>',
    );
  });
});

describe("Painter — bloco e primitivas (17.10.3–17.10.8)", () => {
  it("sem bloco não há filhos", () => {
    assertEquals(new Painter(6, 4,).to_svg().children.length, 0,);
  });

  it("bloco recebe o Painter e pode ser chamado depois via primitivas", () => {
    const p = new Painter(6, 4,);
    assert(p.line(0, 0, 1, 1,) instanceof Line,);
    assert(p.rect(0, 0, 1, 1,) instanceof Rect,);
    assert(p.group() instanceof Group,);
    assertEquals(p.to_svg().children.length, 3,);
  });

  it("width fração sai como String(number) (divergência do Float Ruby)", () => {
    // Ruby daria "100.5px"; 50.0 daria "50.0px" mas aqui é "50px" (documentado).
    assertEquals(
      new Painter(100.5, 50,).to_svg().to_s(),
      '<svg height="50px" width="100.5px"></svg>',
    );
  });
});
