import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { ScenarioData, } from "../../src/model/scenario-data.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

describe("ScenarioData.preloadAttributes", () => {
  let project: Project;
  let scenarioData: ScenarioData;

  beforeEach(() => {
    project = createTestProject(1,);
    scenarioData = new ScenarioData(project, 0, new Map(),);
  },);

  it("pré-carrega atributo conhecido sem erro", () => {
    scenarioData.preloadAttributes(["name",],);
    // Sem erro = sucesso
  });

  it("rejeita atributo desconhecido", () => {
    assertThrows(
      () => scenarioData.preloadAttributes(["nonexistent",],),
      Error,
      "Unknown attribute 'nonexistent'",
    );
  });

  it("lista vazia é no-op", () => {
    scenarioData.preloadAttributes([],);
    // Sem erro = sucesso
  });

  it("pré-carrega múltiplos atributos", () => {
    scenarioData.preloadAttributes(["name", "id",],);
    // Sem erro = sucesso
  });

  it("pré-carrega atributos do PropertySet (id, name, seqno)", () => {
    scenarioData.preloadAttributes(["id", "name", "seqno",],);
    // Sem erro = sucesso
  });
});

describe("ScenarioData → MessageHandler (Fase 9 / G1.4 root)", () => {
  let project: Project;
  let scenarioData: ScenarioData;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    project = createTestProject(1,);
    scenarioData = new ScenarioData(project, 0, new Map(),);
  },);

  it("error() roteia para o MessageHandler (não mais console)", () => {
    scenarioData.error("probe_error", "boom",);
    const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
    assertEquals(ids.includes("probe_error",), true,);
    assertEquals(MessageHandlerInstance.instance.errors, 1,);
  });

  it("warning() roteia para o MessageHandler", () => {
    scenarioData.warning("probe_warn", "cuidado",);
    const msgs = MessageHandlerInstance.instance.messages;
    const msg = msgs.find((m,) => m.id === "probe_warn");
    assertEquals(msg?.type, "warning",);
  });

  it("info() roteia para o MessageHandler sem contar erro", () => {
    scenarioData.info("probe_info", "nota",);
    const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
    assertEquals(ids.includes("probe_info",), true,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
  });

  it("error() anexa a propriedade portadora como data", () => {
    scenarioData.error("probe_data", "x",);
    const msg = MessageHandlerInstance.instance.messages.find(
      (m,) => m.id === "probe_data",
    );
    // 5º argumento (data) recebe a própria propriedade quando `property` é
    // omitido — espelha ScenarioData.rb (property || @property).
    assertEquals(msg?.data, project,);
  });
});
