/**
 * Testes de GanttRouter (Fase 15.3).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/GanttRouter.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.3)
 */
import { afterEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { compat, } from "../../src/compat.ts";
import {
  GanttRouter,
  justify,
  MinEndGap,
  MinStartGap,
} from "../../src/gantt/gantt-router.ts";

/** Acesso aos membros privados para testar `placeLine` isoladamente. */
function priv(router: GanttRouter,) {
  return router as unknown as {
    placeLine(
      segment: [number, number,],
      horizontal: boolean,
      start: number,
      delta: number,
    ): number;
  };
}

describe("GanttRouter", () => {
  describe("constructor", () => {
    it("expõe as constantes do Ruby", () => {
      assertEquals(MinStartGap, 5,);
      assertEquals(MinEndGap, 10,);
    });

    it("trunca width/height com to_i", () => {
      // 10.9 × 5.9 → 10 × 5: x=9 é a última coluna válida.
      const r = new GanttRouter(10.9, 5.9,);
      r.addZone(9, 0, 5, 5, false, true,);
      const html = r.to_html();
      assertEquals(html.length, 1,);
      assertEquals(
        html[0]!.attrs.style,
        "left:9px; top:0px; width:1px; height:5px;",
      );
    });

    it("inicia sem zonas", () => {
      assertEquals(new GanttRouter(50, 50,).to_html().length, 0,);
    });
  });

  describe("addZone", () => {
    it("delega para CollisionDetector", () => {
      const r = new GanttRouter(100, 100,);
      r.addZone(10, 20, 30, 5, false, true,);
      const html = r.to_html();
      assertEquals(html.length, 30,);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:20px; width:1px; height:5px;",
      );
      assertEquals(html[0]!.attrs.class, "white",);
    });
  });

  describe("route", () => {
    it("usa rota direta quando o corredor cabe", () => {
      const r = new GanttRouter(200, 200,);
      assertEquals(r.route(10, 10, 100, 30,), [
        [10, 10,],
        [15, 10,],
        [15, 30,],
        [100, 30,],
      ],);
    });

    it("duplica o ponto 1 quando startY === endY (Ruby)", () => {
      const r = new GanttRouter(200, 200,);
      assertEquals(r.route(10, 10, 100, 10,), [
        [10, 10,],
        [15, 10,],
        [15, 10,],
        [100, 10,],
      ],);
    });

    it("usa rota complexa quando a distância horizontal é curta", () => {
      const r = new GanttRouter(200, 200,);
      assertEquals(r.route(10, 10, 20, 40,), [
        [10, 10,],
        [15, 10,],
        [15, 12,],
        [10, 12,],
        [10, 40,],
        [20, 40,],
      ],);
    });

    it("sobe (deltaY = -1) quando endY < startY", () => {
      const r = new GanttRouter(100, 100,);
      // Bloqueia y=8 para forçar ySeg=7 subindo.
      r.addZone(0, 8, 100, 1, true, false,);
      assertEquals(r.route(10, 10, 20, 5,), [
        [10, 10,],
        [15, 10,],
        [15, 7,],
        [10, 7,],
        [10, 5,],
        [20, 5,],
      ],);
    });

    it("desvia de zona vertical no corredor", () => {
      const r = new GanttRouter(200, 200,);
      r.addZone(15, 11, 1, 30, false, true,);
      assertEquals(r.route(10, 10, 100, 40,), [
        [10, 10,],
        [16, 10,],
        [16, 40,],
        [100, 40,],
      ],);
    });

    it("desvia de zona horizontal no ySeg", () => {
      const r = new GanttRouter(100, 100,);
      r.addZone(0, 12, 100, 1, true, false,);
      assertEquals(r.route(10, 10, 20, 40,), [
        [10, 10,],
        [15, 10,],
        [15, 13,],
        [10, 13,],
        [10, 40,],
        [20, 40,],
      ],);
    });

    it("propaga ySeg negativo quando o Ruby esgota a área (quirk)", () => {
      const r = new GanttRouter(100, 100,);
      for (let y = 0; y < 10; y++) r.addZone(0, y, 100, 1, true, false,);
      // Ruby quebra o laço com pos < 0 e devolve -1.
      assertEquals(r.route(10, 10, 20, 5,)[2], [15, -1,],);
    });

    it("clampa placeLine na borda direita da área", () => {
      const r = new GanttRouter(20, 20,);
      assertEquals(r.route(18, 5, 100, 5,), [
        [18, 5,],
        [19, 5,],
        [19, 5,],
        [100, 5,],
      ],);
    });

    it("justify normaliza h negativo no segmento vertical", () => {
      const r = new GanttRouter(200, 200,);
      assertEquals(r.route(10, 100, 100, 20,), [
        [10, 100,],
        [15, 100,],
        [15, 20,],
        [100, 20,],
      ],);
      const html = r.to_html();
      // Zona vertical x=13..17, y=22..100 (h = 20-100+1 → justify).
      assertEquals(html.length, 5,);
      assertEquals(
        html[0]!.attrs.style,
        "left:13px; top:22px; width:1px; height:79px;",
      );
    });
  });

  describe("placeLine", () => {
    it("lança em delta = 0", () => {
      const r = new GanttRouter(100, 100,);
      assertThrows(
        () => priv(r,).placeLine([0, 1,], false, 0, 0,),
        Error,
        "delta may not be 0",
      );
    });

    it("clampa start negativo e start acima de max", () => {
      const r = new GanttRouter(10, 10,);
      assertEquals(priv(r,).placeLine([0, 0,], false, -5, 1,), 0,);
      assertEquals(priv(r,).placeLine([0, 0,], false, 99, 1,), 9,);
    });

    it("ordena o segmento antes de testar colisão", () => {
      const r = new GanttRouter(100, 100,);
      r.addZone(10, 20, 1, 10, false, true,);
      // [30, 20] desordenado cobre y=20..30 e colide.
      assertEquals(priv(r,).placeLine([30, 20,], false, 10, 1,), 11,);
    });
  });

  describe("justify", () => {
    it("normaliza largura negativa", () => {
      assertEquals(justify(10, 20, -4, 5,), [7, 20, 4, 5,],);
    });

    it("normaliza altura negativa", () => {
      assertEquals(justify(10, 20, 5, -4,), [10, 17, 5, 4,],);
    });

    it("não altera retângulo já positivo", () => {
      assertEquals(justify(10, 20, 5, 5,), [10, 20, 5, 5,],);
    });
  });

  describe("routeLines", () => {
    it("retorna vazio sem setas", () => {
      assertEquals(new GanttRouter(100, 100,).routeLines([],), [],);
    });

    it("com uma seta equivale a route()", () => {
      const r = new GanttRouter(200, 200,);
      assertEquals(r.routeLines([[10, 10, 100, 30,],],), [
        [[10, 10,], [15, 10,], [15, 30,], [100, 30,],],
      ],);
    });

    it("roteia por ângulo decrescente (não pela ordem de entrada)", () => {
      const r = new GanttRouter(200, 200,);
      const paths = r.routeLines([
        [10, 10, 100, 10,], // ângulo 0°, distância 85
        [10, 10, 100, 50,], // ângulo ~25°, distância ~94
      ],);
      // A seta de maior ângulo é roteada primeiro e cria a zona vertical
      // x=13..17, que empurra a segunda seta para x=18.
      assertEquals(paths[0], [[10, 10,], [15, 10,], [15, 50,], [100, 50,],],);
      assertEquals(paths[1], [[10, 10,], [18, 10,], [18, 10,], [100, 10,],],);
    });

    it("roteia 5 setas mantendo início, fim e ortogonalidade", () => {
      const r = new GanttRouter(400, 300,);
      const paths = r.routeLines([
        [10, 10, 200, 10,],
        [10, 20, 200, 40,],
        [10, 30, 200, 80,],
        [10, 40, 200, 120,],
        [10, 50, 200, 160,],
      ],);
      assertEquals(paths.length, 5,);
      assertEquals(
        paths.map((p,) => p[0]!.join(",",)).sort(),
        ["10,10", "10,20", "10,30", "10,40", "10,50",],
      );
      assertEquals(
        paths.map((p,) => p[p.length - 1]!.join(",",)).sort(),
        ["200,10", "200,120", "200,160", "200,40", "200,80",],
      );
      for (const p of paths) {
        for (let i = 1; i < p.length; i++) {
          const [x0, y0,] = p[i - 1]!;
          const [x1, y1,] = p[i]!;
          assert(x0 === x1 || y0 === y1, `segmento diagonal: ${p.join(" ",)}`,);
        }
      }
    });
  });

  describe("addLineTo — bug Categoria B do ramo horizontal", () => {
    afterEach(() => {
      compat.keepRubyBugs = true;
    },);

    it("com keepRubyBugs=true descarta a zona (x1 >= @height)", () => {
      compat.keepRubyBugs = true;
      const r = new GanttRouter(200, 50,);
      // x1=60 >= height=50 → o Ruby não marca a zona horizontal.
      r.route(60, 10, 150, 10,);
      // ySeg permanece 12 porque a zona foi descartada.
      assertEquals(r.route(10, 10, 20, 30,)[2], [15, 12,],);
    });

    it("com keepRubyBugs=false mantém a zona e desvia para y=13", () => {
      compat.keepRubyBugs = false;
      const r = new GanttRouter(200, 50,);
      r.route(60, 10, 150, 10,);
      assertEquals(r.route(10, 10, 20, 30,)[2], [15, 13,],);
    });
  });
});
