/**
 * Testes de `RTFQuery` (Fase 12.14) — handler real de `[[query:…]]`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFQuery.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { RTFQuery, } from "../../src/richtext/handlers/rtf-query.ts";
import type { RichTextFunctionArgs, } from "../../src/richtext/handlers/function-handler.ts";
import { Query, } from "../../src/query/query.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";

/** Costura de acesso ao `prepareQuery` privado (privado só em tempo de compilação). */
function prepare(
  h: RTFQuery,
  args: RichTextFunctionArgs,
): Query | null {
  return (
    h as unknown as {
      prepareQuery(a: RichTextFunctionArgs,): Query | null;
    }
  ).prepareQuery(args,);
}

function messageIds(): string[] {
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}

describe("RTFQuery (12.14)", () => {
  let project: Project;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    project = createTestProject(1,);
    project.set("name", "Meu Projeto",);
  },);

  describe("estrutura", () => {
    it("function = query, blockFunction = false", () => {
      const h = new RTFQuery(project,);
      assertEquals(h.function, "query",);
      assertEquals(h.blockFunction, false,);
    });

    it("to_tagged sempre retorna null", () => {
      const h = new RTFQuery(project,);
      assertEquals(h.to_tagged({},), null,);
    });
  });

  describe("prepareQuery — validação", () => {
    it("lança quando nenhuma query foi registrada", () => {
      const h = new RTFQuery(project,);
      assertThrows(() => h.to_s({ attribute: "name", },), Error,);
    });

    it("argumento desconhecido registra erro e devolve null", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      assertEquals(prepare(h, { bogus: "x", },), null,);
      assert(messageIds().includes("bad_query_parameter",),);
    });

    it("aceita todos os argumentos válidos sem erro de parâmetro", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, {
        attribute: "name",
        property: "!bc",
        scopeproperty: "!bc",
        family: "task",
        scenario: "plan",
        loadunit: "hours",
        start: "2024-01-01",
        end: "2024-12-31",
        timeformat: "%Y-%m-%d",
        journalmode: "journal",
      },);
      assertEquals(q !== null, true,);
      assertEquals(messageIds().includes("bad_query_parameter",), false,);
    });

    it("property sem '!' e sem family registra missing_family (e falha ao processar)", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      // Ruby também estoura em resolvePropertyId quando o tipo é nil
      // (Query.rb `raise "Unknown property type"`). O erro missing_family é
      // registrado antes do process.
      assertThrows(() => prepare(h, { property: "bc", },), Error,);
      assert(messageIds().includes("missing_family",),);
    });

    it("property com '!' não exige family", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      prepare(h, { property: "!bc", },);
      assertEquals(messageIds().includes("missing_family",), false,);
    });
  });

  describe("prepareQuery — atribuição de campos", () => {
    it("attribute define attributeId; start/end viram TjTime", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, {
        attribute: "name",
        start: "2024-06-01",
        end: "2024-06-30",
      },);
      assertEquals(q!.attributeId, "name",);
      assertEquals(q!.start!.strftime("%Y-%m-%d", "UTC",), "2024-06-01",);
      assertEquals(q!.end!.strftime("%Y-%m-%d", "UTC",), "2024-06-30",);
    });

    it("timeformat é atribuído como string", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { timeformat: "%Y-%m-%d", },);
      assertEquals(q!.timeFormat, "%Y-%m-%d",);
    });

    it("setPropertyType: task -> Task / scope Resource", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { family: "task", },);
      assertEquals(q!.propertyType, "Task",);
      assertEquals(q!.scopePropertyType, "Resource",);
    });

    it("setPropertyType: resource -> Resource / scope Task", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { family: "resource", },);
      assertEquals(q!.propertyType, "Resource",);
      assertEquals(q!.scopePropertyType, "Task",);
    });

    it("setPropertyType: account -> Account (sem scope)", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { family: "account", },);
      assertEquals(q!.propertyType, "Account",);
      assertEquals(q!.scopePropertyType, null,);
    });

    it("family inválida registra rtfq_bad_query_family", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      prepare(h, { family: "bogus", },);
      assert(messageIds().includes("rtfq_bad_query_family",),);
    });

    it("setLoadUnit aceita unidades válidas", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { loadunit: "hours", },);
      assertEquals(q!.loadUnit, "hours",);
    });

    it("setScenarioIdx: cenário válido define índice", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { scenario: "plan", },);
      assertEquals(q!.scenarioIdx, 0,);
    });

    it("setScenarioIdx: cenário desconhecido registra erro e usa 0", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { scenario: "nope", },);
      assert(messageIds().includes("rtfq_bad_scenario",),);
      assertEquals(q!.scenarioIdx, 0,);
    });

    it("setScenarioIdx: sem cenário default 0", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { attribute: "name", },);
      assertEquals(q!.scenarioIdx, 0,);
    });

    it("setJournalMode: valor válido", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { journalmode: "status_up", },);
      assertEquals(q!.journalMode, "status_up",);
    });

    it("setJournalMode: sem arg default journal", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { attribute: "name", },);
      assertEquals(q!.journalMode, "journal",);
    });

    it("setJournalMode: inválido registra erro", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      prepare(h, { journalmode: "bogus", },);
      assert(messageIds().includes("rtfq_bad_journalmode",),);
    });

    it("setJournalAttributes: divide por ', '", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const q = prepare(h, { journalattributes: "date, summary", },);
      assertEquals(q!.journalAttributes, ["date", "summary",],);
    });

    it("setJournalAttributes: inválido registra erro", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      prepare(h, { journalattributes: "bogus", },);
      assert(messageIds().includes("rtfq_bad_journalattr",),);
    });

    it("project é atribuído à query", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({},),);
      const q = prepare(h, { attribute: "name", },);
      assertEquals(q!.project, project,);
    });
  });

  describe("saídas", () => {
    it("to_s executa a query e retorna o valor", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      assertEquals(h.to_s({ attribute: "name", },), "Meu Projeto",);
    });

    it("to_s retorna Query Error quando a query falha", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const out = h.to_s({ attribute: "bogus_attr", },);
      assert(out.startsWith("Query Error:",), out,);
      assert(messageIds().includes("query_error",),);
    });

    it("recreateQuerySyntax aparece na mensagem de erro", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      h.to_s({ attribute: "bogus_attr", },);
      const msg = MessageHandlerInstance.instance.messages.find(
        (m,) => m.id === "query_error",
      )!;
      assert(msg.message.includes("<-query",), msg.message,);
      assert(msg.message.includes('attribute="bogus_attr"',), msg.message,);
    });

    it("to_html retorna span com o texto quando não há RTI", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const el = h.to_html({ attribute: "name", },);
      assert(el !== null,);
      const html = el.toHTML();
      assert(html.includes("Meu Projeto",), html,);
    });

    it("to_html retorna null quando a query é inválida (arg ruim)", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      assertEquals(h.to_html({ bogus: "x", },), null,);
    });

    it("to_html registra query_error em vermelho quando falha", () => {
      const h = new RTFQuery(project,);
      h.setQuery(new Query({ project, },),);
      const el = h.to_html({ attribute: "bogus_attr", },);
      assert(el !== null,);
      const html = el.toHTML();
      assert(html.includes("#FF0000",), html,);
      assert(html.includes("Query Error:",), html,);
    });
  });
});
