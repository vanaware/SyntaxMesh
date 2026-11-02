import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { Task, } from "../../src/model/task.ts";
import { MaterialScenario, } from "../../src/model/material-scenario.ts";
import { ChargeSetCollection, } from "../../src/finance/charge-set-collection.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";

describe("Material", () => {
  it("cria material com todos os campos", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    assertEquals(material.unit, "kg",);
    assertEquals(material.unitPrice, 25.0,);
    assert(material.chargeset instanceof ChargeSetCollection,);
  });

  it("quantidade derivada sem alocações é 0", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    assertEquals(material.allocatedQuantity(0,), 0,);
    assertEquals(material.allocatedCost(0,), 0,);
  });

  it("quantidade derivada soma as alocações das tarefas (14C.11.10)", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    const task = new Task(project, "t", "T", null,);
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(material, 100, "distributed",),],
      0,
    );
    assertEquals(material.allocatedQuantity(0,), 100,);
    assertEquals(material.allocatedCost(0,), 2500,);
  });

  it("custo derivado usa o preço da alocação quando declarado", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    const task = new Task(project, "t", "T", null,);
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(material, 100, "distributed", undefined, 30,),],
      0,
    );
    assertEquals(material.allocatedCost(0,), 3000,);
  });
});

describe("Material: entidade de árvore registrada (Fase 10 Complemento C1)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
  },);

  it("material auto-registra no projeto e é achado por ID", () => {
    const steel = new Material(project, "Steel", "kg", 25.0,);
    assertEquals(project.materials.get("Steel",), steel,);
    assertEquals(project.task("Steel",), null,);
    assertEquals(steel.propertySet, project.materials,);
  });

  it("propertySet de materials conhece note/unit/effortdone/effortleft", () => {
    assert(project.materials.knownAttribute("note",),);
    assert(project.materials.knownAttribute("unit",),);
    assert(project.materials.knownAttribute("effortdone",),);
    assert(project.materials.knownAttribute("effortleft",),);
  });

  it("note é RichText não cenário; effortdone/effortleft são cenário-specific", () => {
    const noteDef = project.materials.attributeDefinition("note",);
    assert(noteDef, "note deve existir",);
    assertEquals(noteDef!.type, AttributeType.RichText,);
    assertEquals(noteDef!.isScenarioAttribute, false,);
    const doneDef = project.materials.attributeDefinition("effortdone",);
    assert(doneDef, "effortdone deve existir",);
    assertEquals(doneDef!.type, AttributeType.Float,);
    assertEquals(doneDef!.isScenarioAttribute, true,);
    assertEquals(doneDef!.inheritedFromParent, true,);
  });

  it("note round-trip via set/get (não cenário)", () => {
    const steel = new Material(project, "Steel", "kg", 25.0,);
    steel.set("note", "aço estrutural",);
    assertEquals(steel.get("note",), "aço estrutural",);
  });

  it("MaterialScenario pré-carrega effortdone/effortleft (ADR 016)", () => {
    const steel = new Material(project, "Steel", "kg", 25.0,);
    const scenario = steel.scenarioData(0,);
    assert(scenario instanceof MaterialScenario,);
    assertEquals(scenario.a("effortleft",), 0,);
    assertEquals(scenario.a("effortdone",), 0,);
  });

  it("effortdone/effortleft via setForScenario/getForScenario", () => {
    const steel = new Material(project, "Steel", "kg", 25.0,);
    steel.setForScenario("effortleft", 100, 0,);
    assertEquals(steel.getForScenario("effortleft", 0,), 100,);
  });
});
