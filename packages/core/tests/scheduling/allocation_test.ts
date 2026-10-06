import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertThrows } from "@std/assert";
import { MockProject } from "../model/mock-project.ts";
import { Resource } from "../../src/model/resource.ts";
import { Allocation, SelectionMode } from "../../src/scheduling/allocation.ts";
import { TjArgumentError } from "../../src/attributes/errors.ts";

describe("Allocation", () => {
  let project: MockProject;
  let r1: Resource;
  let r2: Resource;
  let r3: Resource;

  beforeEach(() => {
    project = new MockProject(1);
    r1 = new Resource(project, "r1", "Resource 1", null);
    r2 = new Resource(project, "r2", "Resource 2", null);
    r3 = new Resource(project, "r3", "Resource 3", null);
  });

  describe("SelectionMode enum", () => {
    it("tem 5 valores com os inteiros corretos", () => {
      assertEquals(SelectionMode.Order, 0);
      assertEquals(SelectionMode.MinAllocated, 1);
      assertEquals(SelectionMode.MinLoaded, 2);
      assertEquals(SelectionMode.MaxLoaded, 3);
      assertEquals(SelectionMode.Random, 4);
    });
  });

  describe("constructor", () => {
    it("cria Allocation com candidatos e valores padrão", () => {
      const alloc = new Allocation([r1]);
      assertEquals(alloc.candidates, [r1]);
      assertEquals(alloc.selectionMode, SelectionMode.MinAllocated);
      assertEquals(alloc.atomic, false);
      assertEquals(alloc.persistent, false);
      assertEquals(alloc.mandatory, false);
      assertEquals(alloc.shifts, null);
      assertEquals(alloc.lockedResource, null);
    });

    it("aceita selectionMode e flags customizados", () => {
      const alloc = new Allocation(
        [r1, r2],
        SelectionMode.MaxLoaded,
        true,
        true,
        true,
      );
      assertEquals(alloc.selectionMode, SelectionMode.MaxLoaded);
      assertEquals(alloc.persistent, true);
      assertEquals(alloc.mandatory, true);
      assertEquals(alloc.atomic, true);
    });

    it("rejeita lista de candidatos vazia", () => {
      assertThrows(
        () => new Allocation([]),
        TjArgumentError,
        "Allocation candidates list must contain at least one resource",
      );
    });
  });

  describe("setSelectionMode", () => {
    it("converte 'order' para SelectionMode.Order", () => {
      const alloc = new Allocation([r1]);
      alloc.setSelectionMode("order");
      assertEquals(alloc.selectionMode, SelectionMode.Order);
    });

    it("converte 'minallocated' para SelectionMode.MinAllocated", () => {
      const alloc = new Allocation([r1]);
      alloc.setSelectionMode("minallocated");
      assertEquals(alloc.selectionMode, SelectionMode.MinAllocated);
    });

    it("converte 'minloaded' para SelectionMode.MinLoaded", () => {
      const alloc = new Allocation([r1]);
      alloc.setSelectionMode("minloaded");
      assertEquals(alloc.selectionMode, SelectionMode.MinLoaded);
    });

    it("converte 'maxloaded' para SelectionMode.MaxLoaded", () => {
      const alloc = new Allocation([r1]);
      alloc.setSelectionMode("maxloaded");
      assertEquals(alloc.selectionMode, SelectionMode.MaxLoaded);
    });

    it("converte 'random' para SelectionMode.Random", () => {
      const alloc = new Allocation([r1]);
      alloc.setSelectionMode("random");
      assertEquals(alloc.selectionMode, SelectionMode.Random);
    });

    it("rejeita modo inválido", () => {
      const alloc = new Allocation([r1]);
      assertThrows(
        () => alloc.setSelectionMode("invalido"),
        TjArgumentError,
        "Unknown selection mode invalido",
      );
    });
  });

  describe("addCandidate", () => {
    it("adiciona candidato à lista", () => {
      const alloc = new Allocation([r1]);
      alloc.addCandidate(r2);
      assertEquals(alloc.candidates, [r1, r2]);
    });
  });

  describe("onShift", () => {
    it("retorna true quando shifts é null", () => {
      const alloc = new Allocation([r1]);
      assertEquals(alloc.onShift(0), true);
    });

    it("delega para shifts.onShift quando shifts definido", () => {
      const alloc = new Allocation([r1]);
      const mockShifts = { onShift: (_sbIdx: number) => false };
      (alloc as any).shifts = mockShifts;
      assertEquals(alloc.onShift(0), false);
    });
  });

  describe("candidatesList", () => {
    it("retorna candidatos como estão para Order", () => {
      const alloc = new Allocation([r1, r2, r3], SelectionMode.Order);
      const result = alloc.candidatesList();
      assertEquals(result, [r1, r2, r3]);
    });

    it("retorna candidatos como está quando scenarioIdx não fornecido", () => {
      const alloc = new Allocation([r1, r2], SelectionMode.MinAllocated);
      const result = alloc.candidatesList();
      assertEquals(result, [r1, r2]);
    });

    it("retorna lista aleatória para Random (mesmos elementos)", () => {
      const alloc = new Allocation([r1, r2, r3], SelectionMode.Random);
      const result = alloc.candidatesList();
      // Verificar que todos os elementos estão presentes (ordem aleatória)
      assert(result.length === 3, "expected 3 candidates");
      assert(result.includes(r1), "expected r1 in result");
      assert(result.includes(r2), "expected r2 in result");
      assert(result.includes(r3), "expected r3 in result");
    });

    it("ordena por bookedEffort ascendente para MinLoaded", () => {
      // r1 tem effort=0, r2 tem effort=5, r3 tem effort=2
      r1.setForScenario("effort", 0, 0);
      r2.setForScenario("effort", 5, 0);
      r3.setForScenario("effort", 2, 0);

      const alloc = new Allocation([r1, r2, r3], SelectionMode.MinLoaded);
      const result = alloc.candidatesList(0);
      assert(result.length === 3, "expected 3 candidates");
      assert(result[0] === r1, `expected r1 first, got ${result[0]?.id}`);
      assert(result[1] === r3, `expected r3 second, got ${result[1]?.id}`);
      assert(result[2] === r2, `expected r2 third, got ${result[2]?.id}`);
    });

    it("ordena por bookedEffort descendente para MaxLoaded", () => {
      r1.setForScenario("effort", 0, 0);
      r2.setForScenario("effort", 5, 0);
      r3.setForScenario("effort", 2, 0);

      const alloc = new Allocation([r1, r2, r3], SelectionMode.MaxLoaded);
      const result = alloc.candidatesList(0);
      assert(result.length === 3, "expected 3 candidates");
      assert(result[0] === r2, `expected r2 first, got ${result[0]?.id}`);
      assert(result[1] === r3, `expected r3 second, got ${result[1]?.id}`);
      assert(result[2] === r1, `expected r1 third, got ${result[2]?.id}`);
    });

    it("cacheia resultado para MinAllocated && !persistent", () => {
      const alloc = new Allocation([r1, r2], SelectionMode.MinAllocated, false);
      const result1 = alloc.candidatesList(0);
      const result2 = alloc.candidatesList(0);
      assertEquals(result1, result2);
      assert((alloc as any).staticCandidates !== null);
    });

    it("não cacheia para MinAllocated && persistent", () => {
      const alloc = new Allocation([r1, r2], SelectionMode.MinAllocated, true);
      alloc.candidatesList(0);
      assert((alloc as any).staticCandidates === null);
    });
  });
});
