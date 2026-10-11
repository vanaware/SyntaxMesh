import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { ResourceScenario, } from "../../src/model/resource-scenario.ts";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("ResourceScenario", () => {
  let project: MockProject;
  let resource: Resource;
  let resourceScenario: ResourceScenario;
  let account: Account;
  let task: Task;

  beforeEach(() => {
    project = new MockProject(1,);
    // Granularidade diária para que os índices correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01",));
    project.set("end", TjTime.fromString("2026-12-31",));
    project.set("scheduleGranularity", 86400,);
    resource = new Resource(project, "r1", "Resource 1", null,);
    resourceScenario = resource.scenarioData(0,);
    account = new Account(project, "acc1", "Account 1", null,);
    task = new Task(project, "t1", "Task 1", null,);
  },);

  describe("turnover — sem chargeset", () => {
    it("retorna 0.0 para recurso sem chargeset", () => {
      assertEquals(resourceScenario.turnover(0, 365, account, null, false,), 0.0,);
    });

    it("retorna 0.0 para recurso container sem chargeset", () => {
      const childResource = new Resource(project, "r2", "Child Resource", resource,);
      assertEquals(resourceScenario.turnover(0, 365, account, null, true,), 0.0,);
    });
  });

  describe("turnover — com chargeset", () => {
    it("soma custo do recurso * share para conta", () => {
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 0.5,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      // 365 dias * 100/h * 24h = 876000
      // 876000 * 0.5 = 438000
      assertEquals(resourceScenario.turnover(0, 365, account, null, false,), 438000.0,);
    });

    it("exclui conta com share 0", () => {
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 0.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      assertEquals(resourceScenario.turnover(0, 365, account, null, false,), 0.0,);
    });

    it("inclui conta filha do account", () => {
      const childAccount = new Account(project, "acc2", "Child Account", account,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(childAccount, 1.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      // 365 dias * 100/h * 24h = 876000 (conta filha é incluída)
      assertEquals(resourceScenario.turnover(0, 365, account, null, false,), 876000.0,);
    });

    it("soma múltiplas contas com shares", () => {
      const childAccount1 = new Account(project, "acc2", "Child Account 1", account,);
      const childAccount2 = new Account(project, "acc3", "Child Account 2", account,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(childAccount1, 0.3,);
      chargeSet.addAccount(childAccount2, 0.7,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      // (365 * 100 * 24) * (0.3 + 0.7) = 876000
      assertEquals(resourceScenario.turnover(0, 365, account, null, false,), 876000.0,);
    });
  });

  describe("turnover — com task", () => {
    it("delega para task.turnover quando task fornecido", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      task.setForScenario("chargeset", [chargeSet], 0,);
      // 2 dias * 24h * 100/h = 4800 (task tem rate padrão 0)
      assertEquals(resourceScenario.turnover(0, 365, account, task, false,), 0.0,);
    });

    it("delega para task.turnover com resource", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      // 2 dias * 24h * 100/h = 4800 (task usa rate do resource)
      assertEquals(resourceScenario.turnover(0, 365, account, task, false,), 4800.0,);
    });
  });

  describe("turnover — container recursivo", () => {
    it("soma turnover dos filhos container", () => {
      const childResource = new Resource(project, "r2", "Child Resource", resource,);
      childResource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      childResource.setForScenario("chargeset", [chargeSet], 0,);
      // 365 dias * 100/h * 24h = 876000
      assertEquals(resourceScenario.turnover(0, 365, account, null, true,), 876000.0,);
    });

    it("recursão 3 níveis soma tudo", () => {
      const childResource = new Resource(project, "r2", "Child Resource", resource,);
      const grandchildResource = new Resource(project, "r3", "Grandchild Resource", childResource,);
      childResource.setForScenario("rate", 100, 0,);
      grandchildResource.setForScenario("rate", 50, 0,);
      const childChargeSet = new ChargeSet();
      childChargeSet.addAccount(account, 1.0,);
      const grandchildChargeSet = new ChargeSet();
      grandchildChargeSet.addAccount(account, 1.0,);
      childResource.setForScenario("chargeset", [childChargeSet], 0,);
      grandchildResource.setForScenario("chargeset", [grandchildChargeSet], 0,);
      // (365 * 100 * 24) + (365 * 50 * 24) = 1092000
      assertEquals(resourceScenario.turnover(0, 365, account, null, true,), 1092000.0,);
    });
  });
});
