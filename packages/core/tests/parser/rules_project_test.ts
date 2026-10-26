/**
 * Testes do bloco 1 de TjpSyntaxRules — project (subfase 10.11.2).
 *
 * Cobre `rule_project`, `rule_projectHeader`, `rule_projectBody`,
 * `rule_projectBodyAttributes`, as regras de `include` e o teste agregado
 * de um cabeçalho de projeto completo.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.11.2
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { Project, } from "../../src/model/project.ts";
import { parseProject, } from "./parse-helper.ts";

describe("rule_projectHeader (10.11.2.1)", () => {
  it("cria um Project com id, nome e versão", () => {
    const { result, threw, messageIds, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n}\n',
    );
    assertEquals(threw, null,);
    assert(result instanceof Project, "resultado deve ser um Project",);
    const project = result as Project;
    assertEquals(project.id, "prj",);
    assertEquals(project.name, "Test",);
    assertEquals(project.version, "1.0",);
    assertEquals(messageIds, [],);
  });

  it("deriva o id do nome quando o ID opcional é omitido", () => {
    const { result, } = parseProject(
      'project "My Project" "2.0" 2026-01-01 - 2026-12-31 {\n}\n',
    );
    assert(result instanceof Project,);
    assertEquals((result as Project).id, "my_project",);
  });

  it("registra start e end do intervalo no projeto", () => {
    const { result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n}\n',
    );
    const project = result as Project;
    assert(project.get("start",), "start definido",);
    assert(project.get("end",), "end definido",);
  });

  it("default de dailyworkinghours é 8 quando não especificado", () => {
    const { result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n}\n',
    );
    assertEquals((result as Project).get("dailyworkinghours",), 8,);
  });
});

describe("rule_projectBodyAttributes (10.11.2.2)", () => {
  it("dailyworkinghours define o número de horas por dia", () => {
    const { result, messageIds, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        "  dailyworkinghours 7.5\n}\n",
    );
    assertEquals((result as Project).get("dailyworkinghours",), 7.5,);
    assertEquals(messageIds, [],);
  });

  it("timingresolution converte minutos em segundos", () => {
    const { result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        "  timingresolution 30min\n}\n",
    );
    assertEquals((result as Project).get("scheduleGranularity",), 1800,);
  });

  it("currency define a moeda do projeto", () => {
    const { result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        '  currency "USD"\n}\n',
    );
    assertEquals((result as Project).get("currency",), "USD",);
  });

  it("múltiplos atributos no corpo são aceitos sem erro", () => {
    const { messageIds, result, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        '  dailyworkinghours 6\n  yearlyworkingdays 250\n  outputdir "out"\n}\n',
    );
    assert(result instanceof Project,);
    assertEquals((result as Project).get("yearlyworkingdays",), 250,);
    assertEquals(messageIds, [],);
  });
});

describe("regras de include (10.11.2.4)", () => {
  it("include de arquivo sem extensão .tji registra bad_include_suffix", () => {
    const { messageIds, } = parseProject(
      'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        '  include "foo.txt"\n}\n',
    );
    assert(
      messageIds.includes("bad_include_suffix",),
      "espera erro de sufixo: " + JSON.stringify(messageIds,),
    );
  });
});

describe("agregado do projeto (10.11.2.8)", () => {
  it("parseia um cabeçalho de projeto completo sem exceção nem erros", () => {
    const { result, threw, messageIds, } = parseProject(
      'project prj "Test Project" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        "  dailyworkinghours 8\n" +
        "  timingresolution 60min\n" +
        '  currency "EUR"\n' +
        '  timeformat "%Y-%m-%d"\n' +
        '  shorttimeformat "%d.%m.%y"\n' +
        "  now 2026-06-01\n" +
        "  weekstartsmonday\n" +
        "}\n",
    );
    assertEquals(threw, null,);
    assert(result instanceof Project,);
    assertEquals(messageIds, [],);
    const project = result as Project;
    assertEquals(project.get("dailyworkinghours",), 8,);
    assertEquals(project.get("now",) ? true : false, true, "now definido",);
  });
});
