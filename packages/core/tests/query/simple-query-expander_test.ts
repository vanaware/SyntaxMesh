/**
 * Testes BDD de `SimpleQueryExpander` (Fase 11.11).
 *
 * @see docs/taskjuggler/lib/taskjuggler/SimpleQueryExpander.rb
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Query, } from "../../src/query/query.ts";
import { SimpleQueryExpander, } from "../../src/query/simple-query-expander.ts";

describe("SimpleQueryExpander (11.11)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
    project.set("name", "Meu Projeto",);
  },);

  it("expande atributo de projeto via <-name->", () => {
    const q = new Query({ project, attributeId: "name", },);
    const exp = new SimpleQueryExpander("Projeto: <-name->", q, null,);
    assertEquals(exp.expand(), "Projeto: Meu Projeto",);
  });

  it("expande <-scenario-> para o id do cenário", () => {
    const q = new Query({ project, scenarioIdx: 0, },);
    const exp = new SimpleQueryExpander("Cenário: <-scenario->", q, null,);
    assertEquals(exp.expand(), "Cenário: plan",);
  });

  it("expande múltiplos placeholders", () => {
    const q = new Query({ project, scenarioIdx: 0, },);
    const exp = new SimpleQueryExpander(
      "<-name-> / <-scenario->",
      q,
      null,
    );
    assertEquals(exp.expand(), "Meu Projeto / plan",);
  });

  it("atributo desconhecido vira string vazia", () => {
    const q = new Query({ project, },);
    const exp = new SimpleQueryExpander("X<-bogus_attr->Y", q, null,);
    assertEquals(exp.expand(), "XY",);
  });

  it("não destrói texto sem placeholder", () => {
    const q = new Query({ project, },);
    const exp = new SimpleQueryExpander("texto puro", q, null,);
    assertEquals(exp.expand(), "texto puro",);
  });
});
