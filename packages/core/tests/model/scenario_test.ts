import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";
import { Scenario, } from "../../src/model/scenario.ts";

describe("Scenario", () => {
  let project: MockProject;
  let propertySet: PropertySet;

  beforeEach(() => {
    project = new MockProject(2);
    propertySet = new PropertySet(project, false);
  },);

  it("cria cenário com id e nome", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.id, "plan");
    assertEquals(scenario.name, "Plan");
    assertEquals(scenario.level, 1);
  });

  it("cenario herda de PropertyTreeNode", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.project, project);
    assertEquals(scenario.parents()[0], undefined);
  });

  it("cenario all() inclui self", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.all().length, 1);
    assertEquals(scenario.all()[0], scenario);
  });

  it("cenario allLeaves(includeSelf=true) inclui self se folha", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.allLeaves(true).length, 1);
    assertEquals(scenario.allLeaves(true)[0], scenario);
  });

  it("cenario allLeaves(includeSelf=false) exclui self", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.allLeaves(false).length, 0);
  });
});