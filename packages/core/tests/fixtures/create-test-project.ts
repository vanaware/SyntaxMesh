import { Project, } from "../../src/model/project.ts";
import { Scenario, } from "../../src/model/scenario.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

/**
 * Cria um projeto real para testes.
 *
 * @param scenarioCount - número de cenários (padrão 1)
 * @param flatNamespace - se true, PropertySets usam namespace plano
 * @returns Projeto real com todas as entidades registradas
 */
export function createTestProject(
  scenarioCount: number = 1,
  flatNamespace: boolean = false,
): Project {
  const project = new Project("test", "Test Project", "0.0.0-test", flatNamespace,);

  // Configura defaults para start/end/now/scheduleGranularity
  project.set("start", TjTime.fromString("2026-01-01",),);
  project.set("end", TjTime.fromString("2026-12-31",),);
  project.set("now", TjTime.fromString("2026-01-01",),);
  project.set("scheduleGranularity", 3600,);

  // Adiciona cenários extras além do cenário "plan" padrão
  for (let i = 1; i < scenarioCount; i++) {
    const scenario = new Scenario(project, `scenario${i}`, `Scenario ${i}`, null,);
    // O Scenario é automaticamente registrado em project.scenarios via PropertyTreeNode constructor
  }

  return project;
}