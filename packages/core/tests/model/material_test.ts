import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Material, } from "../../src/model/material.ts";
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
    assertEquals(material.totalQuantity, undefined,);
  });

  it("material sem totalQuantity opcional", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    assertEquals(material.totalQuantity, undefined,);
  });

  it("material com totalQuantity", () => {
    const project = createTestProject();
    const material = new Material(
      project,
      "Steel",
      "kg",
      25.0,
      undefined,
      500,
    );
    assertEquals(material.totalQuantity, 500,);
  });

  it("totalCost sem quantity", () => {
    const project = createTestProject();
    const material = new Material(project, "Steel", "kg", 25.0,);
    assertEquals(material.totalCost(), 0,);
  });

  it("totalCost com quantity", () => {
    const project = createTestProject();
    const material = new Material(
      project,
      "Steel",
      "kg",
      25.0,
      undefined,
      500,
    );
    assertEquals(material.totalCost(), 12500,);
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
