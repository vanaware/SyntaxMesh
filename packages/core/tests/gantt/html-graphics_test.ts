/**
 * Testes de HTMLGraphics (Fase 15.1).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/HTMLGraphics.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.1)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import {
  arrowHeadToHTML,
  diamondToHTML,
  jagToHTML,
  lineToHTML,
  rectToHTML,
} from "../../src/gantt/html-graphics.ts";

describe("HTMLGraphics", () => {
  describe("lineToHTML", () => {
    it("gera linha horizontal com width = xe - xs + 1", () => {
      const div = lineToHTML(10, 20, 50, 20, "foo",);
      assertEquals(div.tag, "div",);
      assertEquals(div.attrs.class, "foo",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:41px; height:1px;",
      );
    });

    it("gera linha vertical com height = ye - ys + 1", () => {
      const div = lineToHTML(10, 20, 10, 60, "foo",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:1px; height:41px;",
      );
    });

    it("troca xs/xe quando a linha horizontal está invertida", () => {
      const div = lineToHTML(50, 20, 10, 20, "foo",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:41px; height:1px;",
      );
    });

    it("troca ys/ye quando a linha vertical está invertida", () => {
      const div = lineToHTML(10, 60, 10, 20, "foo",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:1px; height:41px;",
      );
    });

    it("lança em linha diagonal (Gantt é ortogonal)", () => {
      assertThrows(
        () => lineToHTML(10, 20, 50, 60, "foo",),
        Error,
        "Can't draw diagonal line 10/20 to 50/60!",
      );
    });

    it("linha de comprimento zero vira horizontal de 1px", () => {
      const div = lineToHTML(7, 3, 7, 3, "foo",);
      assertEquals(
        div.attrs.style,
        "left:7px; top:3px; width:1px; height:1px;",
      );
    });

    it("trunca coordenadas fracionárias como to_i", () => {
      const div = lineToHTML(10.9, 20.9, 50.9, 20.9, "foo",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:41px; height:1px;",
      );
    });

    it("aceita coordenadas negativas", () => {
      const div = lineToHTML(-10, -5, 10, -5, "foo",);
      assertEquals(
        div.attrs.style,
        "left:-10px; top:-5px; width:21px; height:1px;",
      );
    });
  });

  describe("rectToHTML", () => {
    it("gera retângulo com left/top/width/height", () => {
      const div = rectToHTML(10.7, 20.2, 30.9, 5.4, "bar",);
      assertEquals(div.attrs.class, "bar",);
      assertEquals(
        div.attrs.style,
        "left:10px; top:20px; width:30px; height:5px;",
      );
    });

    it("gera retângulo com width/height zero", () => {
      const div = rectToHTML(1, 2, 0, 0, "bar",);
      assertEquals(
        div.attrs.style,
        "left:1px; top:2px; width:0px; height:0px;",
      );
    });

    it("serializa com class antes de style (ordem alfabética)", () => {
      const div = rectToHTML(1, 2, 3, 4, "bar",);
      assertEquals(
        div.toHTML(),
        '<div class="bar" style="left:1px; top:2px; width:3px; height:4px;"></div>',
      );
    });
  });

  describe("jagToHTML", () => {
    it("desloca 5px à esquerda", () => {
      const div = jagToHTML(100, 30,);
      assertEquals(div.attrs.class, "tj_gantt_jag",);
      assertEquals(div.attrs.style, "left:95px; top:30px;",);
    });

    it("aceita coordenadas fracionárias", () => {
      const div = jagToHTML(10.9, 2.7,);
      assertEquals(div.attrs.style, "left:5px; top:2px;",);
    });
  });

  describe("diamondToHTML", () => {
    it("gera dois divs (top e bottom)", () => {
      const divs = diamondToHTML(100, 30,);
      assertEquals(divs.length, 2,);
      assertEquals(divs[0]!.attrs.class, "tj_diamond_top",);
      assertEquals(divs[0]!.attrs.style, "left:94px; top:23px;",);
      assertEquals(divs[1]!.attrs.class, "tj_diamond_bottom",);
      assertEquals(divs[1]!.attrs.style, "left:94px; top:30px;",);
    });

    it("bottom fica exatamente 7px abaixo do top", () => {
      const [top, bottom,] = diamondToHTML(50, 0,);
      assert(top!.attrs.style !== bottom!.attrs.style,);
      assertEquals(top!.attrs.style, "left:44px; top:-7px;",);
      assertEquals(bottom!.attrs.style, "left:44px; top:0px;",);
    });
  });

  describe("arrowHeadToHTML", () => {
    it("desloca 5px em x e y", () => {
      const div = arrowHeadToHTML(60, 40,);
      assertEquals(div.attrs.class, "tj_arrow_head",);
      assertEquals(div.attrs.style, "left:55px; top:35px;",);
    });

    it("aceita coordenadas fracionárias", () => {
      const div = arrowHeadToHTML(60.8, 40.2,);
      assertEquals(div.attrs.style, "left:55px; top:35px;",);
    });
  });
});
