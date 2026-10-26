import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { AccountScenario, } from "../../src/model/account-scenario.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("Account", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
  },);

  it("cria conta com id e nome", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.id, "acc1",);
    assertEquals(account.name, "Account 1",);
    assertEquals(account.level, 0,);
  });

  it("conta herda de PropertyTreeNode", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.project, project,);
    assertEquals(account.parents()[0], undefined,);
  });

  it("conta all() inclui self", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.all().length, 1,);
    assertEquals(account.all()[0], account,);
  });

  it("conta allLeaves(withoutSelf=false) inclui self se folha", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.allLeaves(false,).length, 1,);
    assertEquals(account.allLeaves(false,)[0], account,);
  });

  it("conta allLeaves(withoutSelf=true) exclui self", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.allLeaves(true,).length, 0,);
  });

  it("cria cenário para conta", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    const scenario = account.scenarioData(0,);
    assert(scenario instanceof AccountScenario,);
    assert(scenario.a("credits",) !== undefined,);
  });

  it("cenario pré-carrega atributos", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    const scenario = account.scenarioData(0,);
    assert(scenario.a("credits",) !== undefined,);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    const attr = account.getScenarioAttribute(0, "credits",);
    assert(attr !== undefined,);
    assertEquals(attr.id, "credits",);
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    try {
      account.getScenarioAttribute(0, "id",);
      assert(false, "Deveria ter lançado",);
    } catch (e) {
      assert(e instanceof Error,);
    }
  });

  it("setForScenario define valor", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setForScenario("credits", 100, 0,);
    assertEquals(account.getForScenario("credits", 0,), 100,);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    try {
      account.setForScenario("id", "newid", 0,);
      assert(false, "Deveria ter lançado",);
    } catch (e) {
      assert(e instanceof Error,);
    }
  });

  it("conta com pai herda nível", () => {
    const parent = new Account(project, "parent", "Parent", null,);
    const child = new Account(project, "child", "Child", parent,);
    assertEquals(child.level, 1,);
  });

  it("conta com pai mantém fullId curto (namespace flat, Ruby)", () => {
    const parent = new Account(project, "parent", "Parent", null,);
    const child = new Account(project, "child", "Child", parent,);
    // Ruby Project.rb: @accounts é flat — IDs curtos valem globalmente.
    assertEquals(child.fullId, "child",);
    assertEquals(project.account("child",), child,);
  });

  it("id pontuado não resolve pai em namespace flat", () => {
    const account = new Account(project, "parent.child", "Child", null,);
    // Flat: o ponto não tem significado — ID literal, sem adoção.
    assertEquals(account.fullId, "parent.child",);
    assertEquals(account.subId, "parent.child",);
    assertEquals(account.parent, null,);
  });

  it("conta com id pontuado não adota conta existente como pai (flat)", () => {
    const existing = new Account(project, "parent", "Parent", null,);
    const account = new Account(project, "parent.child", "Child", null,);
    assertEquals(account.parent, null,);
    assertEquals(account.fullId, "parent.child",);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = createTestProject(1, true,);
    const existing = new Account(project2, "parent", "Parent", null,);
    const account = new Account(project2, "parent.child", "Child", null,);
    assertEquals(account.fullId, "parent.child",);
    assertEquals(account.subId, "parent.child",);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = createTestProject(1, true,);
    const existing = new Account(project2, "parent", "Parent", null,);
    const account = new Account(
      project2,
      "parent.child.grandchild",
      "Grandchild",
      null,
    );
    assertEquals(account.fullId, "parent.child.grandchild",);
    assertEquals(account.subId, "parent.child.grandchild",);
  });

  it("id pontuado com pai inexistente permanece literal (flat)", () => {
    const project2 = createTestProject(1, false,);
    const account = new Account(project2, "nonexistent.child", "Child", null,);
    assertEquals(account.fullId, "nonexistent.child",);
    assertEquals(account.subId, "nonexistent.child",);
  });

  it("id pontuado com filho já existente sobrescreve no mapa (flat)", () => {
    const project2 = createTestProject(1, false,);
    new Account(project2, "nonexistent.child", "Child", null,);
    const account = new Account(project2, "nonexistent.child", "Child", null,);
    assertEquals(account.fullId, "nonexistent.child",);
    assertEquals(account.subId, "nonexistent.child",);
    assertEquals(project2.account("nonexistent.child",), account,);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = createTestProject(1, true,);
    const account = new Account(project2, "nonexistent.child", "Child", null,);
    assertEquals(account.fullId, "nonexistent.child",);
    assertEquals(account.subId, "nonexistent.child",);
  });

  it("redefinição com mesmo id pontuado mantém literal (flat)", () => {
    const project2 = createTestProject(1, false,);
    new Account(project2, "parent", "Parent", null,);
    new Account(project2, "parent.child", "Child", null,);
    const account = new Account(project2, "parent.child", "Child", null,);
    assertEquals(account.fullId, "parent.child",);
    assertEquals(account.subId, "parent.child",);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = createTestProject(1, true,);
    const existing = new Account(project2, "child", "Child", null,);
    const account = new Account(project2, "nonexistent.child", "Child", null,);
    assertEquals(account.fullId, "nonexistent.child",);
    assertEquals(account.subId, "nonexistent.child",);
  });

  it("id pontuado duplicado com pai existente mantém literal (flat)", () => {
    const project2 = createTestProject(1, false,);
    new Account(project2, "parent", "Parent", null,);
    new Account(project2, "parent.child", "Child", null,);
    const account = new Account(project2, "parent.child", "Child", null,);
    assertEquals(account.fullId, "parent.child",);
    assertEquals(account.subId, "parent.child",);
  });

  it("conta com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = createTestProject(1, true,);
    const parent = new Account(project2, "parent", "Parent", null,);
    const existing = new Account(project2, "parent.child", "Child", null,);
    const account = new Account(project2, "parent.child", "Child", null,);
    assertEquals(account.fullId, "parent.child",);
    assertEquals(account.subId, "parent.child",);
  });
});

describe("Account.allowedTypes", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("conta nova aceita todos os tipos por default", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assert(account.canAccept("task",),);
    assert(account.canAccept("resource",),);
    assert(account.canAccept("material",),);
  });

  it("setAllowedTypes restringe para task apenas", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["task",],);
    assert(account.canAccept("task",),);
    assert(!account.canAccept("resource",),);
    assert(!account.canAccept("material",),);
  });

  it("getAllowedTypes retorna conjunto vazio por default", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(account.getAllowedTypes().length, 0,);
  });

  it("getAllowedTypes retorna tipos configurados", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["task", "resource",],);
    const types = account.getAllowedTypes().sort();
    assertEquals(types, ["resource", "task",],);
  });

  it("conta com aggregate tasks rejeita resource", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["task",],);
    assert(!account.canAccept("resource",),);
  });

  it("conta com aggregate resources rejeita task", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["resource",],);
    assert(!account.canAccept("task",),);
  });

  it("conta com aggregate materials rejeita task e resource", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["material",],);
    assert(!account.canAccept("task",),);
    assert(!account.canAccept("resource",),);
    assert(account.canAccept("material",),);
  });

  it("conta sem aggregate (vazio) aceita tudo", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assert(account.canAccept("task",),);
    assert(account.canAccept("resource",),);
    assert(account.canAccept("material",),);
  });

  it("lança erro claro quando aggregate tasks e custo de recurso", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    account.setAllowedTypes(["task",],);
    let erro: unknown = null;
    try {
      account.canAccept("resource",);
      assert(false, "Deveria ter lançado",);
    } catch (e) {
      erro = e;
    }
    assert(erro instanceof Error,);
  });
});

describe("Account: note + diário (extensão Fase 10 Complemento C0)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
  },);

  it("propertySet de account conhece 'note'", () => {
    assert(project.accounts.knownAttribute("note",),);
  });

  it("note é RichText, não scenario-specific e não herda", () => {
    const def = project.accounts.attributeDefinition("note",);
    assert(def, "definição de note deve existir",);
    assertEquals(def!.type, AttributeType.RichText,);
    assertEquals(def!.isScenarioAttribute, false,);
    assertEquals(def!.inheritedFromParent, false,);
    assertEquals(def!.inheritedFromProject, false,);
  });

  it("note round-trip via set/get (não cenário)", () => {
    const account = new Account(project, "acc1", "Costs", null,);
    account.set("note", "conta de custos",);
    assertEquals(account.get("note",), "conta de custos",);
  });

  it("segundo set de note lança AttributeOverwrite", () => {
    const account = new Account(project, "acc1", "Costs", null,);
    account.set("note", "primeira",);
    let lancou = false;
    try {
      account.set("note", "segunda",);
    } catch (_e) {
      lancou = true;
    }
    assert(lancou, "esperava AttributeOverwrite",);
  });

  it("journalentry de account usa o journal global (property = account)", () => {
    const account = new Account(project, "acc1", "Costs", null,);
    const entry = new JournalEntry(
      project.journal,
      TjTime.fromString("2026-10-15",),
      "Orçamento aprovado",
      account,
    );
    assertEquals(project.journal.entriesFor(account,).length, 1,);
    assertEquals(project.journal.entriesFor(account,)[0], entry,);
    // Não é atributo scenario-specific: entradas permanecem globais
    assertEquals(project.journal.entriesFor(null,).length, 0,);
  });
});
