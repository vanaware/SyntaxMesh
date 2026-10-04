import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { ScenarioData } from "../../src/model/scenario-data.ts";

describe("ScenarioData.preloadAttributes", () => {
  let project: MockProject;
  let scenarioData: ScenarioData;

  beforeEach(() => {
    project = new MockProject(1);
    scenarioData = new ScenarioData(project, 0, new Map());
  });

  it("pré-carrega atributo conhecido sem erro", () => {
    scenarioData.preloadAttributes(["name"]);
    // Sem erro = sucesso
  });

  it("rejeita atributo desconhecido", () => {
    assertThrows(
      () => scenarioData.preloadAttributes(["nonexistent"]),
      Error,
      "Unknown attribute 'nonexistent'",
    );
  });

  it("lista vazia é no-op", () => {
    scenarioData.preloadAttributes([]);
    // Sem erro = sucesso
  });

  it("pré-carrega múltiplos atributos", () => {
    scenarioData.preloadAttributes(["name", "id"]);
    // Sem erro = sucesso
  });

  it("pré-carrega atributos do PropertySet (id, name, seqno)", () => {
    scenarioData.preloadAttributes(["id", "name", "seqno"]);
    // Sem erro = sucesso
  });
});
