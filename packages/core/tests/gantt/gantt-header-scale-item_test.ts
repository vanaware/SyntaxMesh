/**
 * Testes de GanttHeaderScaleItem (Fase 15.8).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttHeaderScaleItem.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.8)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  GanttHeaderScaleItem,
} from "../../src/gantt/gantt-header-scale-item.ts";
import { XMLText, } from "../../src/xml/xml-element.ts";

describe("GanttHeaderScaleItem", () => {
  describe("constructor", () => {
    it("expõe label e width como leitores públicos", () => {
      const item = new GanttHeaderScaleItem("Jan 2027", 10, 0, 30, 19,);
      assertEquals(item.label, "Jan 2027",);
      assertEquals(item.width, 30,);
    });

    it("aceita rótulo vazio e medidas negativas como o Ruby", () => {
      // O Ruby não valida nada: apenas guarda os valores nos ivars.
      const item = new GanttHeaderScaleItem("", -3, -1, -8, 0,);
      assertEquals(item.label, "",);
      assertEquals(item.width, -8,);
      assertEquals(item.to_html().attrs.style?.includes("left:-3px;",), true,);
    });
  });

  describe("to_html", () => {
    it("gera div.tabhead com posicionamento absoluto", () => {
      const html = new GanttHeaderScaleItem("Jan 2027", 10, 0, 30, 19,)
        .to_html();
      assertEquals(html.tag, "div",);
      assertEquals(html.attrs.class, "tabhead",);
      // Os espaços finais fazem parte da string do Ruby.
      assertEquals(
        html.attrs.style,
        "font-weight:bold; position:absolute; " +
          "left:10px; top:0px; width:30px; height:19px; ",
      );
    });

    it("aninha a div de padding com o rótulo", () => {
      const html = new GanttHeaderScaleItem("Jan 2027", 10, 0, 30, 19,)
        .to_html();
      assertEquals(html.children.length, 1,);
      const inner = html.children[0];
      if (inner === null || inner === undefined || typeof inner === "string") {
        throw new Error("esperava um elemento filho",);
      }
      assertEquals(inner.tag, "div",);
      assertEquals(inner.attrs.style, "padding:3px; ",);
      // O rótulo vira um nó XMLText (XMLElement real, ex-SimpleXMLElement).
      const txt = inner.children[0];
      assertEquals(txt instanceof XMLText, true,);
      assertEquals((txt as XMLText).to_s(), "Jan 2027",);
    });

    it("serializa atributos em ordem alfabética (class antes de style)", () => {
      const html = new GanttHeaderScaleItem("Jan 2027", 10, 0, 30, 19,)
        .to_html();
      assertEquals(
        html.toHTML(),
        '<div class="tabhead" style="font-weight:bold; position:absolute; ' +
          'left:10px; top:0px; width:30px; height:19px; ">' +
          '<div style="padding:3px; ">Jan 2027</div></div>',
      );
    });

    it("escapa o rótulo como texto", () => {
      const html = new GanttHeaderScaleItem("Q1 & <b>", 0, 0, 1, 1,).to_html();
      assertEquals(
        html.toHTML().endsWith(">Q1 &amp; &lt;b&gt;</div></div>",),
        true,
      );
    });
  });
});
