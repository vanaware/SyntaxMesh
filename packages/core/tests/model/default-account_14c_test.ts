/**
 * 14C.9.1 — `Project#defaultAccountFor` (conta default da regra 4).
 *
 * O parser aceita `defaultaccount <id>` (universal) e
 * `defaultaccount material|resource|charge <id>` (por tipo). Os IDs são
 * resolvidos sob demanda porque o bloco `project` precede as declarações de
 * `account`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.2
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Account, } from "../../src/model/account.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

describe("Project#defaultAccountFor (14C.9.1)", () => {
  it("sem defaultaccount retorna null para qualquer tipo", () => {
    const project = createTestProject();
    assertEquals(project.defaultAccountId, null,);
    assertEquals(project.defaultAccountFor(null,), null,);
    assertEquals(project.defaultAccountFor("material",), null,);
    assertEquals(project.defaultAccountFor("task",), null,);
  });

  it("conta universal vale para todos os tipos", () => {
    const project = createTestProject();
    new Account(project, "custos", "Custos", null,);
    project.defaultAccountId = "custos";
    assertEquals(project.defaultAccountFor(null,)?.id, "custos",);
    assertEquals(project.defaultAccountFor("material",)?.id, "custos",);
    assertEquals(project.defaultAccountFor("resource",)?.id, "custos",);
    assertEquals(project.defaultAccountFor("task",)?.id, "custos",);
  });

  it("variante por tipo precede a universal", () => {
    const project = createTestProject();
    new Account(project, "custos", "Custos", null,);
    new Account(project, "materiais", "Materiais", null,);
    project.defaultAccountId = "custos";
    project.defaultAccountIds.set("material", "materiais",);
    assertEquals(project.defaultAccountFor("material",)?.id, "materiais",);
    // Os demais tipos seguem a universal.
    assertEquals(project.defaultAccountFor("resource",)?.id, "custos",);
    assertEquals(project.defaultAccountFor("task",)?.id, "custos",);
    assertEquals(project.defaultAccountFor(null,)?.id, "custos",);
  });

  it("ID desconhecido resolve para null em vez de lançar", () => {
    const project = createTestProject();
    project.defaultAccountId = "naoexiste";
    assertEquals(project.defaultAccountFor("material",), null,);
  });
});
