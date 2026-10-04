import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Account } from "../../src/model/account.ts";
import { AccountScenario } from "../../src/model/account-scenario.ts";

describe("Account", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2);
  });

  it("cria conta com id e nome", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    assertEquals(account.id, "acc1");
    assertEquals(account.name, "Account 1");
    assertEquals(account.level, 0);
  });

  it("conta herda de PropertyTreeNode", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    assertEquals(account.project, project);
    assertEquals(account.parents()[0], undefined);
  });

  it("conta all() inclui self", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    assertEquals(account.all().length, 1);
    assertEquals(account.all()[0], account);
  });

  it("conta allLeaves(withoutSelf=false) inclui self se folha", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    assertEquals(account.allLeaves(false).length, 1);
    assertEquals(account.allLeaves(false)[0], account);
  });

  it("conta allLeaves(withoutSelf=true) exclui self", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    assertEquals(account.allLeaves(true).length, 0);
  });

  it("cria cenário para conta", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    const scenario = account.scenarioData(0);
    assert(scenario instanceof AccountScenario);
    assert(scenario.a("credits") !== undefined);
  });

  it("cenario pré-carrega atributos", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    const scenario = account.scenarioData(0);
    assert(scenario.a("credits") !== undefined);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    const attr = account.getScenarioAttribute(0, "credits");
    assert(attr !== undefined);
    assertEquals(attr.id, "credits");
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    try {
      account.getScenarioAttribute(0, "id");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("setForScenario define valor", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    account.setForScenario("credits", 100, 0);
    assertEquals(account.getForScenario("credits", 0), 100);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const account = new Account(project, "acc1", "Account 1", null);
    try {
      account.setForScenario("id", "newid", 0);
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("conta com pai herda nível", () => {
    const parent = new Account(project, "parent", "Parent", null);
    const child = new Account(project, "child", "Child", parent);
    assertEquals(child.level, 1);
  });

  it("conta com pai herda fullId", () => {
    const parent = new Account(project, "parent", "Parent", null);
    const child = new Account(project, "child", "Child", parent);
    assertEquals(child.fullId, "parent.child");
  });

  it("conta com id hierárquico resolve pai do PropertySet", () => {
    const account = new Account(project, "parent.child", "Child", null);
    assertEquals(account.fullId, "parent.child");
    assertEquals(account.subId, "child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Account(project, "parent", "Parent", null);
    const account = new Account(project, "parent.child", "Child", null);
    assertEquals(account.parent, existing);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true);
    const existing = new Account(project2, "parent", "Parent", null);
    const account = new Account(project2, "parent.child", "Child", null);
    assertEquals(account.fullId, "parent.child");
    assertEquals(account.subId, "parent.child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true);
    const existing = new Account(project2, "parent", "Parent", null);
    const account = new Account(project2, "parent.child.grandchild", "Grandchild", null);
    assertEquals(account.fullId, "parent.child.grandchild");
    assertEquals(account.subId, "parent.child.grandchild");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false);
    const account = new Account(project2, "nonexistent.child", "Child", null);
    assertEquals(account.fullId, "nonexistent.child");
    assertEquals(account.subId, "child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true);
    const account = new Account(project2, "nonexistent.child", "Child", null);
    assertEquals(account.fullId, "nonexistent.child");
    assertEquals(account.subId, "nonexistent.child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false);
    const existing = new Account(project2, "child", "Child", null);
    const account = new Account(project2, "nonexistent.child", "Child", null);
    assertEquals(account.fullId, "nonexistent.child");
    assertEquals(account.subId, "child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true);
    const existing = new Account(project2, "child", "Child", null);
    const account = new Account(project2, "nonexistent.child", "Child", null);
    assertEquals(account.fullId, "nonexistent.child");
    assertEquals(account.subId, "nonexistent.child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false);
    const parent = new Account(project2, "parent", "Parent", null);
    const existing = new Account(project2, "parent.child", "Child", null);
    const account = new Account(project2, "parent.child", "Child", null);
    assertEquals(account.fullId, "parent.child");
    assertEquals(account.subId, "child");
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true);
    const parent = new Account(project2, "parent", "Parent", null);
    const existing = new Account(project2, "parent.child", "Child", null);
    const account = new Account(project2, "parent.child", "Child", null);
    assertEquals(account.fullId, "parent.child");
    assertEquals(account.subId, "parent.child");
  });
});
