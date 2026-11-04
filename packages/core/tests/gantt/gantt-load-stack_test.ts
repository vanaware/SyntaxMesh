/**
 * Testes de GanttLoadStack (Fase 15.7).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttLoadStack.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.7)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { GanttRouter, } from "../../src/gantt/gantt-router.ts";
import { lineToHTML, rectToHTML, } from "../../src/gantt/html-graphics.ts";
import {
  GanttLoadStack,
  type LoadStackHost,
} from "../../src/gantt/gantt-load-stack.ts";

/** Linha hospedeira mínima (o `GanttLine` real chega em 15.10). */
const host: LoadStackHost = {
  height: 19,
  y: 100,
  lineToHTML,
  rectToHTML,
};

describe("GanttLoadStack", () => {
  describe("constructor", () => {
    it("exige values e categories do mesmo tamanho", () => {
      assertThrows(
        () => new GanttLoadStack(host, 10, 10, [1, 2,], ["busy",],),
        Error,
        "Values and categories must have the same number of entries!",
      );
    });

    it("normaliza largura <= 0 para 1px", () => {
      const stack = new GanttLoadStack(host, 10, 0, [1, 1,], [
        "busy",
        "free",
      ],);
      const html = stack.to_html()!;
      // Moldura retangular de 1px de largura.
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:1px; width:1px; height:17px;",
      );
    });
  });

  describe("to_html", () => {
    it("desenha moldura explícita quando há categoria sem cor", () => {
      const stack = new GanttLoadStack(host, 10, 10, [3, 1,], [
        "busy",
        null,
      ],);
      const html = stack.to_html()!;
      assertEquals(html.length, 5,);
      // Topo, base, esquerda e direita.
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:1px; width:10px; height:1px;",
      );
      assertEquals(
        html[1]!.attrs.style,
        "left:10px; top:17px; width:10px; height:1px;",
      );
      assertEquals(
        html[2]!.attrs.style,
        "left:10px; top:1px; width:1px; height:17px;",
      );
      assertEquals(
        html[3]!.attrs.style,
        "left:19px; top:1px; width:1px; height:17px;",
      );
      // [3, 1] → níveis 11.25 e 3.75; o segundo é sem cor (não desenha).
      assertEquals(html[4]!.attrs.class, "busy",);
      assertEquals(
        html[4]!.attrs.style,
        "left:11px; top:5px; width:8px; height:12px;",
      );
    });

    it("desenha retângulo de fundo quando a moldura está cheia", () => {
      const stack = new GanttLoadStack(host, 10, 10, [3, 1,], [
        "busy",
        "free",
      ],);
      const html = stack.to_html()!;
      assertEquals(html.length, 3,);
      assertEquals(html[0]!.attrs.class, "loadstackframe",);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:1px; width:10px; height:17px;",
      );
      // Desenha de baixo para cima: 'free' primeiro.
      assertEquals(html[1]!.attrs.class, "free",);
      assertEquals(
        html[1]!.attrs.style,
        "left:11px; top:2px; width:8px; height:3px;",
      );
      assertEquals(html[2]!.attrs.class, "busy",);
      assertEquals(
        html[2]!.attrs.style,
        "left:11px; top:5px; width:8px; height:12px;",
      );
    });

    it("devolve null quando a soma dos valores é 0", () => {
      const stack = new GanttLoadStack(host, 10, 10, [0, 0,], [
        "busy",
        "free",
      ],);
      assertEquals(stack.to_html(), null,);
    });

    it("categoria nula com valor 0 não força moldura", () => {
      const stack = new GanttLoadStack(host, 10, 10, [2, 0,], [
        "busy",
        null,
      ],);
      const html = stack.to_html()!;
      assertEquals(html.length, 2,);
      assertEquals(html[0]!.attrs.class, "loadstackframe",);
      assertEquals(
        html[1]!.attrs.style,
        "left:11px; top:2px; width:8px; height:15px;",
      );
    });
  });

  describe("addBlockedZones", () => {
    it("bloqueia a faixa horizontal da pilha", () => {
      const router = new GanttRouter(200, 200,);
      new GanttLoadStack(host, 10, 30, [1, 1,], ["busy", "free",],)
        .addBlockedZones(router,);
      // Zona horizontal y=100..118: o ySeg da rota complexa desvia para 119.
      assertEquals(router.route(10, 100, 20, 130,)[2], [15, 119,],);
    });
  });
});
