/**
 * Testes de `Query` sobre `Material` (Fase 14 Complemento 14C.1.20).
 *
 * Materiais passam a ser resolvidos por `Query.resolvePropertyId` com
 * `propertyType: "Material"`, reutilizando o pipeline `process`/`to_s` dos
 * atributos canônicos (`unit`, `cost`, `note`). O keyword
 * `unitprice` dos relatórios é um alias de `cost` e vive na camada de
 * relatórios (`TableReport.materialAttributeColumns`), não no atributo.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.20)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Material, } from "../../src/model/material.ts";
import { Query, } from "../../src/query/query.ts";

describe("Query sobre Material (14C.1.20)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("note", "Aço CA-50",);
  },);

  it("resolve o material por id e lê os atributos canônicos", () => {
    const q = new Query({
      project,
      propertyType: "Material",
      propertyId: "steel",
      attributeId: "unit",
    },);
    assert(q.process(), "process falhou",);
    assertEquals(q.property, project.material("steel",),);
    assertEquals(q.to_s(), "kg",);

    const cost = new Query({
      project,
      propertyType: "Material",
      propertyId: "steel",
      attributeId: "cost",
    },);
    assert(cost.process(),);
    assertEquals(cost.to_num(), 2.5,);

    const note = new Query({
      project,
      propertyType: "Material",
      propertyId: "steel",
      attributeId: "note",
    },);
    assert(note.process(),);
    // RichText: o valor chega cru pelo `to_rti` (o `to_s` exige RTI formatado).
    assert(String(note.to_rti(),).includes("Aço CA-50",),);
  });

  it("material inexistente falha com mensagem clara", () => {
    const q = new Query({
      project,
      propertyType: "Material",
      propertyId: "nope",
      attributeId: "unit",
    },);
    assertEquals(q.process(), false,);
    assert(
      (q.errorMessage ?? "").includes("Unknown property",),
      `mensagem: ${q.errorMessage}`,
    );
  });
});
