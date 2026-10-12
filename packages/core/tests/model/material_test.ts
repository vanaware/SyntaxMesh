import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import { Material } from "../../src/model/material.ts";
import { MockProject } from "./mock-project.ts";

describe("Material", () => {
  it("cria material com todos os campos", () => {
    const project = new MockProject();
    const material = new Material(project, "Steel", "kg", 25.0, "Costs.Materials",);
    assertEquals(material.unit, "kg");
    assertEquals(material.unitPrice, 25.0);
    assertEquals(material.chargeset, "Costs.Materials");
    assertEquals(material.totalQuantity, undefined);
  });

  it("material sem totalQuantity opcional", () => {
    const project = new MockProject();
    const material = new Material(project, "Steel", "kg", 25.0, "Costs.Materials",);
    assertEquals(material.totalQuantity, undefined);
  });

  it("material com totalQuantity", () => {
    const project = new MockProject();
    const material = new Material(project, "Steel", "kg", 25.0, "Costs.Materials", 500);
    assertEquals(material.totalQuantity, 500);
  });

  it("totalCost sem quantity", () => {
    const project = new MockProject();
    const material = new Material(project, "Steel", "kg", 25.0, "Costs.Materials",);
    assertEquals(material.totalCost(), 0);
  });

  it("totalCost com quantity", () => {
    const project = new MockProject();
    const material = new Material(project, "Steel", "kg", 25.0, "Costs.Materials", 500);
    assertEquals(material.totalCost(), 12500);
  });
});
