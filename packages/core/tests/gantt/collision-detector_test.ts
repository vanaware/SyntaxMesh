/**
 * Testes de CollisionDetector (Fase 15.2).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/CollisionDetector.rb`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.2)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { CollisionDetector, } from "../../src/gantt/collision-detector.ts";

describe("CollisionDetector", () => {
  describe("constructor", () => {
    it("inicia sem bloqueios", () => {
      const cd = new CollisionDetector(100, 100,);
      assertEquals(cd.collision(20, [15, 35,], true,), false,);
      assertEquals(cd.collision(20, [15, 35,], false,), false,);
      assertEquals(cd.to_html().length, 0,);
    });

    it("usa height para linhas horizontais e width para verticais", () => {
      const cd = new CollisionDetector(10, 5,);
      cd.addBlockedZone(0, 4, 10, 1, true, false,);
      // y=4 é a última linha horizontal válida.
      assertEquals(cd.collision(4, [0, 9,], true,), true,);
      // y=5 está fora da área: tratado como vazio.
      assertEquals(cd.collision(5, [0, 9,], true,), false,);
    });
  });

  describe("addBlockedZone", () => {
    it("bloqueia apenas linhas horizontais com horiz=true", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, true, false,);
      // y entre 20 e 24, x entre 10 e 39.
      assertEquals(cd.collision(20, [15, 35,], true,), true,);
      assertEquals(cd.collision(24, [10, 39,], true,), true,);
      assertEquals(cd.collision(25, [15, 35,], true,), false,);
      assertEquals(cd.collision(20, [15, 35,], false,), false,);
    });

    it("bloqueia apenas colunas verticais com vert=true", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, false, true,);
      // x entre 10 e 39, y entre 20 e 24.
      assertEquals(cd.collision(10, [20, 24,], false,), true,);
      assertEquals(cd.collision(39, [20, 24,], false,), true,);
      assertEquals(cd.collision(40, [20, 24,], false,), false,);
      assertEquals(cd.collision(10, [20, 24,], true,), false,);
    });

    it("bloqueia horizontal e vertical com horiz=vert=true", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, true, true,);
      assertEquals(cd.collision(20, [15, 35,], true,), true,);
      assertEquals(cd.collision(10, [20, 24,], false,), true,);
    });

    it("recorta coordenadas negativas para 0 sem reduzir w/h", () => {
      // Ruby: clip(-5, 99) = 0 e clip(10, 100 - 0) = 10, ou seja, o
      // retângulo vira x=0..9 sem encolher a largura.
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(-5, -5, 10, 10, false, true,);
      assertEquals(cd.collision(0, [0, 9,], false,), true,);
      assertEquals(cd.collision(9, [0, 9,], false,), true,);
      assertEquals(cd.collision(10, [0, 9,], false,), false,);
      assertEquals(cd.collision(0, [10, 20,], false,), false,);
    });

    it("recorta largura/altura que ultrapassam a área", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(95, 95, 20, 20, true, false,);
      assertEquals(cd.collision(99, [95, 99,], true,), true,);
      assertEquals(cd.collision(95, [99, 99,], true,), true,);
    });

    it("ignora zonas com width ou height zero", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 0, 5, true, true,);
      cd.addBlockedZone(10, 20, 5, 0, true, true,);
      assertEquals(cd.collision(20, [10, 14,], true,), false,);
      assertEquals(cd.to_html().length, 0,);
    });
  });

  describe("collision", () => {
    it("detecta sobreposição parcial e total", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, true, false,);
      assertEquals(cd.collision(20, [0, 10,], true,), true,);
      assertEquals(cd.collision(20, [20, 30,], true,), true,);
      assertEquals(cd.collision(20, [0, 39,], true,), true,);
    });

    it("não detecta colisão em segmentos disjuntos", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, true, false,);
      assertEquals(cd.collision(20, [0, 9,], true,), false,);
      assertEquals(cd.collision(20, [40, 60,], true,), false,);
    });

    it("trata as pontas do segmento como parte dele", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 30, 5, false, true,);
      assertEquals(cd.collision(10, [5, 19,], false,), false,);
      assertEquals(cd.collision(10, [5, 20,], false,), true,);
      assertEquals(cd.collision(10, [24, 30,], false,), true,);
      assertEquals(cd.collision(10, [25, 30,], false,), false,);
    });

    it("funciona com múltiplos segmentos na mesma linha (busca binária)", () => {
      const cd = new CollisionDetector(100, 100,);
      // Bloqueios bem separados na linha horizontal y=20:
      // [0,9], [20,29] e [40,49].
      cd.addBlockedZone(0, 20, 10, 1, true, false,);
      cd.addBlockedZone(20, 20, 10, 1, true, false,);
      cd.addBlockedZone(40, 20, 10, 1, true, false,);
      assertEquals(cd.collision(20, [0, 9,], true,), true,);
      assertEquals(cd.collision(20, [10, 19,], true,), false,);
      assertEquals(cd.collision(20, [20, 29,], true,), true,);
      assertEquals(cd.collision(20, [30, 39,], true,), false,);
      assertEquals(cd.collision(20, [40, 49,], true,), true,);
      assertEquals(cd.collision(20, [50, 60,], true,), false,);
    });
  });

  describe("merge de segmentos", () => {
    it("mescla segmentos sobrepostos", () => {
      const cd = new CollisionDetector(100, 100,);
      // Coluna x=10 recebe [20,39] e depois [25,44]; devem virar [20,44].
      cd.addBlockedZone(10, 20, 1, 20, false, true,);
      cd.addBlockedZone(10, 25, 1, 20, false, true,);
      const html = cd.to_html();
      assertEquals(html.length, 1,);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:20px; width:1px; height:25px;",
      );
    });

    it("mescla segmentos diretamente adjacentes", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 1, 5, false, true,);
      cd.addBlockedZone(10, 25, 1, 5, false, true,);
      const html = cd.to_html();
      assertEquals(html.length, 1,);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:20px; width:1px; height:10px;",
      );
    });

    it("insere segmentos em ordem crescente", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 80, 1, 5, false, true,);
      cd.addBlockedZone(10, 20, 1, 5, false, true,);
      const html = cd.to_html();
      assertEquals(html.length, 2,);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:20px; width:1px; height:5px;",
      );
      assertEquals(
        html[1]!.attrs.style,
        "left:10px; top:80px; width:1px; height:5px;",
      );
    });

    it("não mescla segmentos com gap", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 1, 5, false, true,);
      // Gap de 1px: 20-24, próximo começa em 26.
      cd.addBlockedZone(10, 26, 1, 5, false, true,);
      assertEquals(cd.to_html().length, 2,);
    });
  });

  describe("to_html", () => {
    it("serializa bloqueios verticais como linhas brancas", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(10, 20, 1, 5, false, true,);
      cd.addBlockedZone(11, 20, 1, 5, false, true,);
      const html = cd.to_html();
      assertEquals(html.length, 2,);
      assertEquals(html[0]!.attrs.class, "white",);
      assertEquals(
        html[0]!.attrs.style,
        "left:10px; top:20px; width:1px; height:5px;",
      );
      assertEquals(
        html[1]!.attrs.style,
        "left:11px; top:20px; width:1px; height:5px;",
      );
    });

    it("não serializa bloqueios horizontais (ramo inativo do Ruby)", () => {
      const cd = new CollisionDetector(100, 100,);
      cd.addBlockedZone(0, 0, 10, 10, true, false,);
      assertEquals(cd.to_html().length, 0,);
    });
  });
});
