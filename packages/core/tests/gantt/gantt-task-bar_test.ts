/**
 * Testes de GanttTaskBar (Fase 15.4).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttTaskBar.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.4)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { GanttRouter, } from "../../src/gantt/gantt-router.ts";
import {
  type GanttBarQuery,
  GanttTaskBar,
} from "../../src/gantt/gantt-task-bar.ts";

/** Query falsa que devolve `complete` fixo e conta os `process()`. */
class FakeQuery implements GanttBarQuery {
  attributeId: string | null = null;
  processed = 0;
  constructor(private readonly value: unknown,) {}
  process(): void {
    this.processed++;
  }
  result(): unknown {
    return this.value;
  }
}

/** `lineHeight` 19 → `19 / 2` = 9 (divisão inteira do Ruby). */
const LH = 19;

describe("GanttTaskBar", () => {
  it("expõe SIZE = 6", () => {
    assertEquals(GanttTaskBar.SIZE, 6,);
  });

  describe("pontos das linhas de dependência", () => {
    const bar = new GanttTaskBar(null, LH, 10, 40, 100,);

    it("início sai de start + 1", () => {
      assertEquals(bar.startDepLineStart(), [11, 109,],);
    });

    it("início chega em start - 1", () => {
      assertEquals(bar.startDepLineEnd(), [9, 109,],);
    });

    it("fim sai de end + 1", () => {
      assertEquals(bar.endDepLineStart(), [41, 109,],);
    });

    it("fim chega em end - 1", () => {
      assertEquals(bar.endDepLineEnd(), [39, 109,],);
    });
  });

  describe("addBlockedZones", () => {
    it("marca as duas bordas verticais e o corredor horizontal", () => {
      const router = new GanttRouter(200, 200,);
      new GanttTaskBar(null, LH, 10, 40, 100,).addBlockedZones(router,);
      const html = router.to_html();
      // Colunas: x=1..12 (seta + borda esquerda) e x=38..42 (borda direita).
      assertEquals(html.length, 17,);
      // x=1 recebe só o bloqueio da seta (y 102..116).
      assertEquals(
        html[0]!.attrs.style,
        "left:1px; top:102px; width:1px; height:15px;",
      );
      // x=8 é a primeira coluna da borda esquerda (y 100..118).
      assertEquals(
        html[7]!.attrs.style,
        "left:8px; top:100px; width:1px; height:19px;",
      );
      assertEquals(
        html[12]!.attrs.style,
        "left:38px; top:100px; width:1px; height:19px;",
      );
    });
  });

  describe("to_html", () => {
    it("desenha frame, moldura, preenchimento e 50% sem query", () => {
      const html = new GanttTaskBar(null, LH, 10, 40, 100,).to_html();
      assertEquals(html.length, 4,);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:0px; width:31px; height:19px;",
      );
      assertEquals(html[1]!.attrs.class, "taskbarframe",);
      assertEquals(
        html[1]!.attrs.style,
        "left:10px; top:3px; width:31px; height:12px;",
      );
      assertEquals(
        html[2]!.attrs.style,
        "left:11px; top:4px; width:29px; height:10px;",
      );
      // 29 * 0.5 = 14.5 → trunc 14.
      assertEquals(
        html[3]!.attrs.style,
        "left:11px; top:6px; width:14px; height:6px;",
      );
    });

    it("usa o atributo complete da query", () => {
      const query = new FakeQuery(75,);
      const html = new GanttTaskBar(query, LH, 10, 40, 100,).to_html();
      assertEquals(query.attributeId, "complete",);
      assertEquals(query.processed, 1,);
      // 29 * 0.75 = 21.75 → trunc 21.
      assertEquals(
        html[3]!.attrs.style,
        "left:11px; top:6px; width:21px; height:6px;",
      );
    });

    it("progresso 0 quando a query não devolve número", () => {
      const html = new GanttTaskBar(new FakeQuery(null,), LH, 10, 40, 100,)
        .to_html();
      assertEquals(
        html[3]!.attrs.style,
        "left:11px; top:6px; width:0px; height:6px;",
      );
    });

    it("trunca start/end fracionários como to_i", () => {
      const html = new GanttTaskBar(null, LH, 10.7, 40.9, 100,).to_html();
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:0px; width:31px; height:19px;",
      );
      // As linhas de dependência não truncam (Ruby soma Float).
      assertEquals(
        new GanttTaskBar(null, LH, 10.7, 40.9, 100,).startDepLineStart(),
        [11.7, 109,],
      );
    });
  });
});
