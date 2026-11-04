/**
 * Testes de GanttMilestone (Fase 15.5).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttMilestone.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.5)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { GanttRouter, } from "../../src/gantt/gantt-router.ts";
import { GanttMilestone, } from "../../src/gantt/gantt-milestone.ts";

/** `lineHeight` 19 → 9 (divisão inteira do Ruby). */
const LH = 19;

describe("GanttMilestone", () => {
  it("expõe SIZE = 6", () => {
    assertEquals(GanttMilestone.SIZE, 6,);
  });

  describe("pontos das linhas de dependência", () => {
    const m = new GanttMilestone(LH, 30, 100,);

    it("entrada do início fica à esquerda do losango", () => {
      assertEquals(m.startDepLineEnd(), [24, 109,],);
    });

    it("saídas usam a ponta direita", () => {
      assertEquals(m.startDepLineStart(), [36, 109,],);
      assertEquals(m.endDepLineStart(), [36, 109,],);
    });

    it("fim também usa a ponta direita (fiel ao Ruby)", () => {
      assertEquals(m.endDepLineEnd(), [36, 109,],);
    });
  });

  describe("addBlockedZones", () => {
    it("marca o losango e a ponta da seta", () => {
      const router = new GanttRouter(200, 200,);
      new GanttMilestone(LH, 30, 100,).addBlockedZones(router,);
      // União de x=15..24 (seta) com x=22..38 (losango) = 24 colunas.
      const html = router.to_html();
      assertEquals(html.length, 24,);
      assertEquals(
        html[0]!.attrs.style,
        "left:15px; top:102px; width:1px; height:15px;",
      );
    });
  });

  describe("to_html", () => {
    it("desenha a moldura e os dois divs do losango", () => {
      const html = new GanttMilestone(LH, 30, 100,).to_html();
      assertEquals(html.length, 3,);
      assertEquals(
        html[0]!.attrs.style,
        "left:21px; top:0px; width:19px; height:19px;",
      );
      assertEquals(html[1]!.attrs.class, "tj_diamond_top",);
      assertEquals(html[1]!.attrs.style, "left:24px; top:2px;",);
      assertEquals(html[2]!.attrs.class, "tj_diamond_bottom",);
      assertEquals(html[2]!.attrs.style, "left:24px; top:9px;",);
    });
  });
});
