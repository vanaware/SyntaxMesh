/**
 * Golden TS-only do elemento `template` (Fase 23, 23.7.2).
 *
 * Arquivo único `template.golden.json` com cinco seções, uma por fixture de
 * `tests/fixtures/templates/`: expansão básica, matriz de tipos de argumento,
 * composição, macro dentro do corpo e erros do §5.
 *
 * Regenerar: `deno task golden:generate:template`.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  buildTemplateGolden,
  loadTemplateFixture,
} from "./template-expansion-snapshot.ts";
import { parseProject, } from "../parser/parse-helper.ts";

const goldenUrl = new URL("./template.golden.json", import.meta.url,);

describe("23.7.2 template — golden TS-only consolidado", () => {
  it("snapshot salvo é idêntico ao re-gerado", async () => {
    const expected = await Deno.readTextFile(goldenUrl,);
    const actual = JSON.stringify(buildTemplateGolden(), null, 2,) + "\n";
    assertEquals(actual, expected,);
  });

  it("expansão básica: duas tasks e os recursos das macros", () => {
    const snap = buildTemplateGolden().expansion;
    assertEquals(snap.messages, [],);
    assertEquals(
      snap.tasks.map((t,) => [t.id, t.name,]),
      [["t1", "Design",], ["t2", "Implementação",],],
    );
    assertEquals(
      snap.resources.map((r,) => r.id),
      ["tux1", "tux2", "tux3",],
    );
  });

  it("matriz de argumentos: tipagem visível no texto renderizado", () => {
    const snap = buildTemplateGolden().args;
    assertEquals(snap.messages, [],);
    assertEquals(
      snap.resources.map((r,) => [r.id, r.name,]),
      [[
        "r1",
        "str=string;num=number;bool=boolean;ref=!t1;refType=string;" +
        "list=2;list1=c;obj=v;arith=7",
      ],],
    );
  });

  it("composição: expandTemplate/expandTemplateList/project.name", () => {
    const snap = buildTemplateGolden().compose;
    assertEquals(snap.messages, [],);
    assertEquals(
      snap.tasks.map((t,) => [t.id, t.name,]),
      [["c1", "Composta",], ["d1", "Desenvolvimento",],],
    );
    assertEquals(
      snap.resources.map((r,) => [r.id, r.name,]),
      [
        ["tux1", "Tux 1",],
        ["tux2", "Tux 2",],
        ["alice", "Alice",],
        // `bob` recebe `project.name` do contexto global (§4.7).
        ["bob", "Template Compose",],
      ],
    );
    assertEquals(
      snap.tasks.find((t,) => t.id === "d1")!.allocate,
      ["tux1", "tux2",],
    );
  });

  it("macro dentro do corpo: Fase 1 antes do render", () => {
    const snap = buildTemplateGolden().macros;
    assertEquals(snap.messages, [],);
    assertEquals(
      snap.tasks.map((t,) => [t.id, t.effort, t.allocate,]),
      [["t1", 24, ["tux1", "tux2",],],],
    );
    assertEquals(
      snap.resources.map((r,) => r.id),
      ["tux1", "tux2", "carol",],
    );
  });

  it("fixture de erro: o §5 sai pelo MessageHandler com a linha da chamada", () => {
    const snap = buildTemplateGolden().errors;
    assertEquals(snap.messages, [
      "template_missing_param:template 'CARD': parâmetro 'esforco' não fornecido",
    ],);
  });
});

// ---------------------------------------------------------------------------
// 23.2.10 — snapshot estrutural do registro (namespace unificado, ADR 033).
//
// Sem oracle no TaskJuggler Ruby: o registro é comparado com o corpo **cru**
// (o `{{ }}` não é interpretado no registro) e com a convivência macro/template
// no mesmo namespace.
// ---------------------------------------------------------------------------
describe("23.2.10 template registry: basic", () => {
  it("carrega sem mensagens de erro", () => {
    const out = parseProject(loadTemplateFixture("basic",),);
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
    );
  });

  it("registra os três templates com params e corpo cru", () => {
    const out = parseProject(loadTemplateFixture("basic",),);
    const table = out.parser.scannerRef!.macroTable;
    const registered = table.templates().map((t,) => ({
      name: t.name,
      params: t.params,
      body: t.body,
    }));
    assertEquals(registered, [
      {
        name: "CARD",
        params: ["id", "nome", "esforco",],
        body: ' task {{ id }} "{{ nome }}" { effort {{ esforco }} } ',
      },
      {
        name: "HEADER",
        params: [],
        // Corpo cru: o `{{ }}` não é interpretado no registro (23.2.6).
        body: "\n    # Projeto: {{ project.name }}\n  ",
      },
      { name: "FOOTER", params: [], body: " # fim do projeto ", },
    ],);
  });

  it("preserva a macro vizinha no namespace unificado", () => {
    const out = parseProject(loadTemplateFixture("basic",),);
    const table = out.parser.scannerRef!.macroTable;
    assertEquals(table.kindOf("ALLOCATE_TEAM",), "macro",);
    assertEquals(table.kindOf("CARD",), "template",);
    assertEquals(table.lookup("NAO_EXISTE",), null,);
    assertEquals(
      table.templates().map((t,) => t.name),
      ["CARD", "HEADER", "FOOTER",],
    );
  });
});
