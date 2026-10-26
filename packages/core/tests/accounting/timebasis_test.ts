/**
 * Testes do Bloco C2 (Fase 10 Complemento): `timebasis` no modelo e a
 * regra de resolução §2.4 de fase-10-complemento2.md.
 *
 * A distribuição temporal (#6a, C2.6+) ganha testes próprios em
 * distribution_test.ts quando `accounting/distribution.ts` for criado.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C2)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import {
  normalizeTimebasis,
  resolveTimebasis,
  type Timebasis,
} from "../../src/accounting/distribution.ts";

describe("timebasis: normalização de aliases (C2.1, complemento2 §2.2)", () => {
  it("normaliza aliases para valores canônicos", () => {
    assertEquals(normalizeTimebasis("duration",), "duration",);
    assertEquals(normalizeTimebasis("calendar",), "duration",);
    assertEquals(normalizeTimebasis("length",), "length",);
    assertEquals(normalizeTimebasis("working",), "length",);
  });

  it("null/undefined e valores inválidos retornam null", () => {
    assertEquals(normalizeTimebasis(null,), null,);
    assertEquals(normalizeTimebasis(undefined,), null,);
    assertEquals(normalizeTimebasis("bogus",), null,);
  });
});

describe("timebasis: atributo em Task (C2.1)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("tasks conhece timebasis como Symbol scenario-specific", () => {
    assert(project.tasks.knownAttribute("timebasis",),);
    const def = project.tasks.attributeDefinition("timebasis",);
    assert(def, "timebasis deve existir",);
    assertEquals(def!.type, AttributeType.Symbol,);
    assertEquals(def!.isScenarioAttribute, true,);
    assertEquals(def!.inheritedFromParent, false,);
    assertEquals(def!.inheritedFromProject, false,);
    assertEquals(def!.defaultValue, null,);
  });
});

describe("timebasis: default do projeto (C2.2)", () => {
  it("projeto tem timebasis default 'duration'", () => {
    const project = createTestProject(1,);
    assertEquals(project.get("timebasis",), "duration",);
    project.set("timebasis", "length",);
    assertEquals(project.get("timebasis",), "length",);
  });
});

describe("timebasis: rejeição em milestone (C2.3)", () => {
  it("validateTimebasis lança em milestone com timebasis explícito", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Milestone", null,);
    task.setForScenario("milestone", true, 0,);
    assertThrows(
      () => task.validateTimebasis("length",),
      Error,
      "timebasis_not_supported",
    );
  });

  it("validateTimebasis aceita em tarefa comum", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Task", null,);
    task.validateTimebasis("length",);
  });
});

describe("timebasis: resolveTimebasis — 5 regras (C2.4, complemento2 §2.4)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "Task 1", null,);
  },);

  it("ramo 1: length > 0 implica LENGTH mesmo com timebasis explícito", () => {
    task.setForScenario("length", 86400, 0,);
    task.setForScenario("timebasis", "duration", 0,);
    assertEquals(resolveTimebasis(task, 0, project,), "length" as Timebasis,);
  });

  it("ramo 2: duration > 0 implica DURATION", () => {
    task.setForScenario("duration", 86400, 0,);
    assertEquals(
      resolveTimebasis(task, 0, project,),
      "duration" as Timebasis,
    );
  });

  it("ramo 3: sem length/duration usa timebasis explícito da tarefa", () => {
    task.setForScenario("timebasis", "length", 0,);
    assertEquals(resolveTimebasis(task, 0, project,), "length" as Timebasis,);
  });

  it("ramo 4: sem explícito herda timebasis do projeto", () => {
    project.set("timebasis", "length",);
    assertEquals(resolveTimebasis(task, 0, project,), "length" as Timebasis,);
  });

  it("ramo 5: sem nada no projeto cai no default duration", () => {
    project.set("timebasis", null,);
    assertEquals(
      resolveTimebasis(task, 0, project,),
      "duration" as Timebasis,
    );
  });
});

describe("timebasis: resolvedTimebasis no TaskScenario (C2.5)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "Task 1", null,);
  },);

  it("prepareScheduling armazena resolvedTimebasis no cenário", () => {
    const scenario = task.scenarioData(0,);
    task.setForScenario("timebasis", "length", 0,);
    scenario.prepareScheduling();
    assertEquals(scenario.resolvedTimebasis, "length" as Timebasis,);
  });

  it("length > 0 implica resolvedTimebasis length pós-schedule", () => {
    const scenario = task.scenarioData(0,);
    task.setForScenario("length", 86400, 0,);
    scenario.prepareScheduling();
    assertEquals(scenario.resolvedTimebasis, "length" as Timebasis,);
    // prepareScheduling não altera agendamento por timebasis: durationType
    // segue a lógica existente (lengthTask), imune ao atributo novo.
    assertEquals(scenario.durationType(), "lengthTask",);
  });
});
