import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";

describe("MaterialAllocation", () => {
  const project = createTestProject();
  const steel = new Material(project, "Steel", "kg", 25.0,);

  it("onstart", () => {
    const alloc = new MaterialAllocation(steel, 500, "onstart",);
    assertEquals(alloc.quantity, 500,);
    assertEquals(alloc.modifier, "onstart",);
  });

  it("onend", () => {
    const alloc = new MaterialAllocation(steel, 500, "onend",);
    assertEquals(alloc.modifier, "onend",);
  });

  it("perhour", () => {
    const alloc = new MaterialAllocation(steel, 10, "perhour",);
    assertEquals(alloc.modifier, "perhour",);
  });

  it("perday", () => {
    const alloc = new MaterialAllocation(steel, 100, "perday",);
    assertEquals(alloc.modifier, "perday",);
  });

  it("perweek", () => {
    const alloc = new MaterialAllocation(steel, 500, "perweek",);
    assertEquals(alloc.modifier, "perweek",);
  });

  it("permonth", () => {
    const alloc = new MaterialAllocation(steel, 1000, "permonth",);
    assertEquals(alloc.modifier, "permonth",);
  });

  it("distributed", () => {
    const alloc = new MaterialAllocation(steel, 1000, "distributed",);
    assertEquals(alloc.modifier, "distributed",);
  });

  it("distribution { ... }", () => {
    const alloc = new MaterialAllocation(steel, 1000, "distribution", [
      0.3,
      0.5,
      0.2,
    ],);
    assertEquals(alloc.distribution, [0.3, 0.5, 0.2,],);
  });

  it("rejeita quantity negativo", () => {
    assertThrows(() => new MaterialAllocation(steel, -100, "onstart",), Error,);
  });

  it("rejeita distribution que não soma 1.0", () => {
    assertThrows(
      () => new MaterialAllocation(steel, 1000, "distribution", [0.3, 0.5,],),
      Error,
    );
  });
});

/**
 * 14C.11.1 — preço unitário próprio da alocação. Sem `unitPrice` a alocação
 * delega ao material; com ele, o da alocação vence.
 */
describe("MaterialAllocation unitPrice (14C.11.1)", () => {
  const project = createTestProject();
  const steel = new Material(project, "steel", "kg", 25.0,);

  it("sem preço próprio: unitPrice indefinido e herda o do material", () => {
    const alloc = new MaterialAllocation(steel, 500, "onstart",);
    assertEquals(alloc.unitPrice, undefined,);
    assertEquals(alloc.unitPriceFor(), 25,);
  });

  it("com preço próprio: unitPriceFor devolve o da alocação", () => {
    const alloc = new MaterialAllocation(steel, 500, "onstart", undefined, 30,);
    assertEquals(alloc.unitPrice, 30,);
    assertEquals(alloc.unitPriceFor(), 30,);
  });

  it("unitPriceFor(material) aceita um material alternativo", () => {
    const other = new Material(project, "concrete", "m3", 9,);
    const plain = new MaterialAllocation(steel, 10, "distributed",);
    assertEquals(plain.unitPriceFor(other,), 9,);
    // O preço próprio sempre vence, mesmo com material alternativo.
    const priced = new MaterialAllocation(
      steel,
      10,
      "distributed",
      undefined,
      12,
    );
    assertEquals(priced.unitPriceFor(other,), 12,);
  });
});
