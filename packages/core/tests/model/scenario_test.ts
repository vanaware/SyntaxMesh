import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";
import { Scenario, } from "../../src/model/scenario.ts";

describe("Scenario", () => {
  let project: Project;
  let propertySet: PropertySet;

  beforeEach(() => {
    project = createTestProject(2,);
    propertySet = new PropertySet(project, false,);
  },);

  it("cria cenário com id e nome", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.id, "plan",);
    assertEquals(scenario.name, "Plan",);
    assertEquals(scenario.level, 0,);
  });

  it("cenario herda de PropertyTreeNode", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.project, project,);
    assertEquals(scenario.parents()[0], undefined,);
  });

  it("cenario all() inclui self", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    assertEquals(scenario.all().length, 1,);
    assertEquals(scenario.all()[0], scenario,);
  });

  it("cenario allLeaves(withoutSelf=false) inclui self se folha", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    // Ruby: allLeaves() default = withoutSelf=false → leaf returns [self]
    assertEquals(scenario.allLeaves(false,).length, 1,);
    assertEquals(scenario.allLeaves(false,)[0], scenario,);
  });

  it("cenario allLeaves(withoutSelf=true) exclui self", () => {
    const scenario = new Scenario(project, "plan", "Plan", null,);
    // Ruby: allLeaves(true) = withoutSelf → leaf excludes self
    assertEquals(scenario.allLeaves(true,).length, 0,);
  });
});
