/**
 * Testes de GanttContainer (Fase 15.6).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttContainer.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.6)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { GanttRouter, } from "../../src/gantt/gantt-router.ts";
import { GanttContainer, } from "../../src/gantt/gantt-container.ts";

/** `lineHeight` 19 → 9 (divisão inteira do Ruby). */
const LH = 19;

describe("GanttContainer", () => {
  it("expõe SIZE = 5", () => {
    assertEquals(GanttContainer.SIZE, 5,);
  });

  describe("pontos das linhas de dependência", () => {
    const c = new GanttContainer(LH, 10, 40, 100,);

    it("início sai de start sem offset", () => {
      assertEquals(c.startDepLineStart(), [10, 109,],);
    });

    it("início chega em start - SIZE", () => {
      assertEquals(c.startDepLineEnd(), [5, 109,],);
    });

    it("fim sai de end + SIZE", () => {
      assertEquals(c.endDepLineStart(), [45, 109,],);
    });

    it("fim chega em end sem offset", () => {
      assertEquals(c.endDepLineEnd(), [40, 109,],);
    });
  });

  describe("addBlockedZones", () => {
    it("marca as duas bordas verticais de 15px", () => {
      const router = new GanttRouter(200, 200,);
      new GanttContainer(LH, 10, 40, 100,).addBlockedZones(router,);
      const html = router.to_html();
      // Colunas: x=0..17 (seta + borda esquerda) e x=33..47 (borda direita).
      assertEquals(html.length, 33,);
      // x=0 recebe só o bloqueio da seta (y 102..116).
      assertEquals(
        html[0]!.attrs.style,
        "left:0px; top:102px; width:1px; height:15px;",
      );
      // x=3 é a primeira coluna da borda esquerda (y 100..118).
      assertEquals(
        html[3]!.attrs.style,
        "left:3px; top:100px; width:1px; height:19px;",
      );
      assertEquals(
        html[18]!.attrs.style,
        "left:33px; top:100px; width:1px; height:19px;",
      );
    });
  });

  describe("to_html", () => {
    it("desenha frame, barra e os dois jags", () => {
      const html = new GanttContainer(LH, 10, 40, 100,).to_html();
      assertEquals(html.length, 4,);
      assertEquals(
        html[0]!.attrs.style,
        "left:5px; top:0px; width:41px; height:19px;",
      );
      assertEquals(html[1]!.attrs.class, "containerbar",);
      assertEquals(
        html[1]!.attrs.style,
        "left:5px; top:4px; width:41px; height:5px;",
      );
      assertEquals(html[2]!.attrs.class, "tj_gantt_jag",);
      assertEquals(html[2]!.attrs.style, "left:5px; top:9px;",);
      // Jag direito em xStart + width = 10 + 31 = 41 → left 36.
      assertEquals(html[3]!.attrs.style, "left:36px; top:9px;",);
    });

    it("trunca start/end fracionários como to_i", () => {
      const html = new GanttContainer(LH, 10.9, 40.2, 100,).to_html();
      assertEquals(
        html[0]!.attrs.style,
        "left:5px; top:0px; width:41px; height:19px;",
      );
    });
  });
});
