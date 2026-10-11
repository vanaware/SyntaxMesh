import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { MockProject, } from "../model/mock-project.ts";
import { Account, } from "../../src/model/account.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { TjArgumentError, } from "../../src/attributes/errors.ts";

describe("ChargeSet", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(1,);
  },);

  describe("constructor", () => {
    it("cria um ChargeSet vazio", () => {
      const chargeSet = new ChargeSet();
      assertEquals(chargeSet.master, null,);
      assertEquals(chargeSet.share(new Account(project, "a1", "Account 1", null,)), null,);
    });
  });

  describe("addAccount", () => {
    let account1: Account;
    let account2: Account;
    let account3: Account;

    beforeEach(() => {
      account1 = new Account(project, "a1", "Account 1", null,);
      account2 = new Account(project, "a2", "Account 2", null,);
      account3 = new Account(project, "a3", "Account 3", null,);
    }, );

    it("aceita conta leaf válida com share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      assertEquals(chargeSet.master, account1,);
      assertEquals(chargeSet.share(account1), 0.5,);
    });

    it("aceita conta leaf válida sem share (null)", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, null,);
      assertEquals(chargeSet.share(account1), null,);
    });

    it("rejeita conta group (não leaf)", () => {
      const chargeSet = new ChargeSet();
      const group = new Account(project, "group", "Group", account1,);
      new Account(project, "grandchild", "Grandchild", group,);
      assertThrows(() => chargeSet.addAccount(group, 0.5,), TjArgumentError,);
    });

    it("rejeita conta já existente", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      assertThrows(() => chargeSet.addAccount(account1, 0.3,), TjArgumentError,);
    });

    it("define master como root da primeira conta", () => {
      const chargeSet = new ChargeSet();
      const child = new Account(project, "child", "Child", account1,);
      chargeSet.addAccount(child, 0.5,);
      assertEquals(chargeSet.master, account1,);
    });

    it("rejeita conta de root diferente", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      const project2 = new MockProject(1,);
      const account4 = new Account(project2, "b1", "Account B", null,);
      assertThrows(() => chargeSet.addAccount(account4, 0.5,), TjArgumentError,);
    });

    it("rejeita conta group (container)", () => {
      const chargeSet = new ChargeSet();
      const group = new Account(project, "group", "Group", account1,);
      new Account(project, "grandchild", "Grandchild", group,);
      assertThrows(() => chargeSet.addAccount(group, 0.5,), TjArgumentError,);
    });

    it("rejeita share < 0", () => {
      const chargeSet = new ChargeSet();
      assertThrows(() => chargeSet.addAccount(account1, -0.1,), TjArgumentError,);
    });

    it("rejeita share > 1", () => {
      const chargeSet = new ChargeSet();
      assertThrows(() => chargeSet.addAccount(account1, 1.1,), TjArgumentError,);
    });

    it("aceita share == 0", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.0,);
      assertEquals(chargeSet.share(account1), 0.0,);
    });

    it("aceita share == 1", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 1.0,);
      assertEquals(chargeSet.share(account1), 1.0,);
    });
  });

  describe("each", () => {
    let account1: Account;
    let account2: Account;
    let account3: Account;
    let account4: Account;

    beforeEach(() => {
      account1 = new Account(project, "a1", "Account 1", null,);
      account2 = new Account(project, "a2", "Account 2", account1,);
      account3 = new Account(project, "a3", "Account 3", account1,);
      account4 = new Account(project, "a4", "Account 4", account1,);
    }, );

    it("itera sobre todas as contas", () => {
      const chargeSet = new ChargeSet();
      const accounts: Account[] = [];
      const shares: (number | null)[] = [];
      chargeSet.addAccount(account2, 0.5,);
      chargeSet.addAccount(account3, null,);
      chargeSet.addAccount(account4, 0.3,);
      chargeSet.each((acc, share) => {
        accounts.push(acc,);
        shares.push(share,);
      },);
      assertEquals(accounts.length, 3,);
      assertEquals(shares.length, 3,);
    });
  });

  describe("complete", () => {
    let account1: Account;
    let account2: Account;
    let account3: Account;
    let account4: Account;
    let account5: Account;

    beforeEach(() => {
      account1 = new Account(project, "a1", "Account 1", null,);
      account2 = new Account(project, "a2", "Account 2", account1,);
      account3 = new Account(project, "a3", "Account 3", account1,);
      account4 = new Account(project, "a4", "Account 4", account1,);
      account5 = new Account(project, "a5", "Account 5", account1,);
    }, );

    it("não faz nada se já completo (100% definido)", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.5,);
      chargeSet.addAccount(account3, 0.5,);
      chargeSet.complete();
      assertEquals(chargeSet.share(account2), 0.5,);
      assertEquals(chargeSet.share(account3), 0.5,);
    });

    it("distribui remainder entre contas sem share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.3,);
      chargeSet.addAccount(account3, null,);
      chargeSet.addAccount(account4, null,);
      chargeSet.complete();
      assertEquals(chargeSet.share(account2), 0.3,);
      assertEquals(chargeSet.share(account3), 0.35,);
      assertEquals(chargeSet.share(account4), 0.35,);
    });

    it("rejeita total > 100%", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.6,);
      chargeSet.addAccount(account3, 0.5,);
      assertThrows(() => chargeSet.complete(), TjArgumentError,);
    });

    it("rejeita total == 100% mas contas sem share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 1.0,);
      chargeSet.addAccount(account3, null,);
      assertThrows(() => chargeSet.complete(), TjArgumentError,);
    });

    it("rejeita total < 100% mas sem contas sem share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.5,);
      chargeSet.addAccount(account3, 0.3,);
      assertThrows(() => chargeSet.complete(), TjArgumentError,);
    });

    it("distribui remainder para 3 contas sem share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.1,);
      chargeSet.addAccount(account3, null,);
      chargeSet.addAccount(account4, null,);
      chargeSet.addAccount(account5, null,);
      chargeSet.complete();
      assertEquals(chargeSet.share(account2), 0.1,);
      assertEquals(chargeSet.share(account3), 0.3,);
      assertEquals(chargeSet.share(account4), 0.3,);
      assertEquals(chargeSet.share(account5), 0.3,);
    });

    it("distribui remainder para 1 conta sem share", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account2, 0.0,);
      chargeSet.addAccount(account3, null,);
      chargeSet.complete();
      assertEquals(chargeSet.share(account2), 0.0,);
      assertEquals(chargeSet.share(account3), 1.0,);
    });
  });

  describe("share", () => {
    let account1: Account;
    let account2: Account;

    beforeEach(() => {
      account1 = new Account(project, "a1", "Account 1", null,);
      account2 = new Account(project, "a2", "Account 2", null,);
    }, );

    it("retorna share para conta existente", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.7,);
      assertEquals(chargeSet.share(account1), 0.7,);
    });

    it("retorna null para conta não existente", () => {
      const chargeSet = new ChargeSet();
      assertEquals(chargeSet.share(account1), null,);
    });
  });

  describe("to_s", () => {
    let root: Account;
    let account1: Account;
    let account2: Account;

    beforeEach(() => {
      root = new Account(project, "a1", "Account 1", null,);
      account1 = new Account(project, "a2", "Account 2", root,);
      account2 = new Account(project, "a3", "Account 3", root,);
    }, );

    it("retorna string vazia para conjunto vazio", () => {
      const chargeSet = new ChargeSet();
      assertEquals(chargeSet.to_s(), "()",);
    });

    it("retorna string com uma conta", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      assertEquals(chargeSet.to_s(), "(a1.a2 50%)",);
    });

    it("retorna string com múltiplas contas", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      chargeSet.addAccount(account2, 0.3,);
      assertEquals(chargeSet.to_s(), "(a1.a2 50%, a1.a3 30%)",);
    });

    it("retorna string com share null (após complete)", () => {
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account1, 0.5,);
      chargeSet.addAccount(account2, null,);
      chargeSet.complete();
      assertEquals(chargeSet.to_s(), "(a1.a2 50%, a1.a3 50%)",);
    });
  });
});