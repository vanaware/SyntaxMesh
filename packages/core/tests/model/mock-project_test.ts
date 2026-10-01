import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";

describe("MockProject", () => {
  it("cria projeto com 1 cenário por padrão", () => {
    const project = new MockProject();
    assertEquals(project.scenarioCount, 1);
  });

  it("cria projeto com N cenários", () => {
    const project = new MockProject(3);
    assertEquals(project.scenarioCount, 3);
  });

  it("retorna cenário pelo índice", () => {
    const project = new MockProject(2);
    const sc = project.scenario(0);
    assertEquals(sc?.id, "plan");
    assertEquals(sc?.fullId, "plan");
  });

  it("retorna null para índice inválido", () => {
    const project = new MockProject(1);
    assertEquals(project.scenario(5), null);
  });

  it("retorna índice do cenário por id", () => {
    const project = new MockProject(3);
    assertEquals(project.scenarioIdx("plan"), 0);
    assertEquals(project.scenarioIdx("scenario1"), 1);
    assertEquals(project.scenarioIdx("scenario2"), 2);
  });

  it("retorna undefined para id desconhecido", () => {
    const project = new MockProject(1);
    assertEquals(project.scenarioIdx("unknown"), undefined);
  });

  it("get e set armazenam valores", () => {
    const project = new MockProject();
    project.set("key", "value");
    assertEquals(project.get("key"), "value");
  });

  it("get retorna undefined para chave inexistente", () => {
    const project = new MockProject();
    assertEquals(project.get("nonexistent"), undefined);
  });
});
