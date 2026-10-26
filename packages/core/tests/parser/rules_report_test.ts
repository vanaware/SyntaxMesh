/**
 * Testes do bloco 3 de TjpSyntaxRules — reports (subfase 10.13).
 *
 * Cobre os cabeçalhos e defaults dos tipos de relatório
 * (`taskReport`/`resourceReport`/`accountReport`/`textReport`/
 * `traceReport`/`export`/`iCalReport`/`nikuReport`/`tagfile`/
 * `statusSheetReport`/`timeSheetReport`), os atributos comuns
 * (`columns`, `formats`, `journalattributes`, `sorttasks`), as listas
 * all-or-nothing e os erros de ordenação / duplicidade.
 *
 * O corpo do projeto NÃO é envolvido por chaves; apenas os corpos dos
 * relatórios usam `{ }` (regra `propertiesBody` é a lista de topo).
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.13
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se houve qualquer mensagem). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, [],);
  return out.result as Project;
}

/** Pega o Project permitindo apenas os IDs de aviso informados. */
function projectTolerating(
  out: ReturnType<typeof parseProject>,
  ids: string[],
): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, ids,);
  return out.result as Project;
}

/** IDs das colunas de um relatório. */
function colIds(r: Report,): string[] {
  return ((r.get("columns",) as Array<{ id: string }> | null) ?? []).map((c,) =>
    c.id
  );
}

// ---------------------------------------------------------------------------
// 10.13.1 — cabeçalhos + defaults por tipo de relatório
// ---------------------------------------------------------------------------
describe("rule_taskReport header defaults (10.13.1)", () => {
  it("cria Report tipo taskreport com colunas e ordenação padrão", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'taskreport r "R" {\n}\n',),
    );
    const r = p.report("r",);
    assert(r,);
    assertEquals(r!.typeSpec, "taskreport",);
    assertEquals(r!.name, "R",);
    assertEquals(colIds(r!,), [
      "bsi",
      "name",
      "start",
      "end",
      "effort",
      "chart",
    ],);
    assertEquals(r!.get("sortTasks",), [
      ["tree", true, -1,],
      ["start", true, 0,],
      ["seqno", true, -1,],
    ],);
    assertEquals(
      r!.get("hideTask",) === null,
      false,
      "hideTask default definido",
    );
    assertEquals(r!.get("loadUnit",), "days",);
    assertEquals(r!.get("height",), 480,);
    assertEquals(r!.get("width",), 640,);
  });
});

describe("demais cabeçalhos de relatório (10.13.1)", () => {
  it("resourceReport: hideTask=1, colunas no,name", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'resourcereport rr "RR" {\n}\n',),
    );
    const r = p.report("rr",)!;
    assertEquals(r.typeSpec, "resourcereport",);
    assertEquals(colIds(r,), ["no", "name",],);
  });

  it("accountReport: sortTasks seqno, colunas bsi,name,monthly", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'accountreport ar "AR" {\n}\n',),
    );
    const r = p.report("ar",)!;
    assertEquals(r.typeSpec, "accountreport",);
    assertEquals(r.get("sortTasks",), [["seqno", true, -1,],],);
    assertEquals(colIds(r,), ["bsi", "name", "monthly",],);
  });

  it("textReport: sem colunas", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'textreport tr "TR" {\n}\n',),
    );
    const r = p.report("tr",)!;
    assertEquals(r.typeSpec, "textreport",);
    assertEquals(colIds(r,), [],);
  });

  it("traceReport: coluna end por padrão", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'tracereport tc "TC" {\n}\n',),
    );
    const r = p.report("tc",)!;
    assertEquals(r.typeSpec, "tracereport",);
    assertEquals(colIds(r,), ["end",],);
  });

  it("export: formats ['tjp'] por padrão", () => {
    const p = project(parseProject(PROJECT_HEADER + 'export e "E" {\n}\n',),);
    assertEquals(p.report("e",)!.get("formats",), ["tjp",],);
  });

  it("iCalReport: formats ['iCal'] por padrão", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'icalreport i "I" {\n}\n',),
    );
    assertEquals(p.report("i",)!.get("formats",), ["iCal",],);
  });

  it("tagfile: formats ['ctags'] por padrão", () => {
    const p = project(parseProject(PROJECT_HEADER + 'tagfile t "T" {\n}\n',),);
    assertEquals(p.report("t",)!.get("formats",), ["ctags",],);
  });

  it("reports aninhados compõem fullId pontuado", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport p "P" {\ntaskreport c "C" {\n}\n}\n',
      ),
    );
    assert(p.report("p.c",), "filho registrado como p.c",);
    assertEquals(p.report("p.c",)!.parent, p.report("p",),);
  });
});

describe("cabeçalhos de sheets (10.13.1)", () => {
  it("statusSheetReport sem cenário de tracking avisa ss_no_tracking_scenario", () => {
    const p = projectTolerating(
      parseProject(PROJECT_HEADER + 'statussheetreport ss "SS" {\n}\n',),
      ["ss_no_tracking_scenario",],
    );
    const r = p.report("ss",)!;
    assertEquals(r.get("formats",), ["tjp",],);
    assertEquals(r.get("sortTasks",), [["id", true, -1,],],);
  });

  it("timeSheetReport sem cenário de tracking avisa ts_no_tracking_scenario", () => {
    const p = projectTolerating(
      parseProject(PROJECT_HEADER + 'timesheetreport ts "TS" {\n}\n',),
      ["ts_no_tracking_scenario",],
    );
    assertEquals(p.report("ts",)!.get("loadUnit",), "hours",);
  });
});

// ---------------------------------------------------------------------------
// 10.13.2 — atributos comuns, colunas, ordenação e erros
// ---------------------------------------------------------------------------
describe("rule_reportAttributes: columns + formats (10.13.2)", () => {
  it("lista explícita de colunas substitui o padrão", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\ncolumns name, effort, chart\n}\n',
      ),
    );
    assertEquals(colIds(p.report("r",)!,), ["name", "effort", "chart",],);
  });

  it("columnDef com bloco title define o título da coluna", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\ncolumns name { title "N" }\n}\n',
      ),
    );
    const cols = p.report("r",)!.get("columns",) as Array<
      { id: string; title: string }
    >;
    assertEquals(cols.length, 1,);
    assertEquals(cols[0]!.id, "name",);
    assertEquals(cols[0]!.title, "N",);
  });

  it("formats aceita lista separada por vírgulas", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\nformats html, csv\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("formats",), ["html", "csv",],);
  });

  it("journalattributes aceita lista e as formas all/nothing", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'taskreport r "R" {\njournalattributes alert, date\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("journalAttributes",), [
      "alert",
      "date",
    ],);
  });

  it("journalattributes '-' esvazia a lista", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'taskreport r "R" {\njournalattributes -\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("journalAttributes",), [],);
  });

  it("height/width abaixo do mínimo registram avisos", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "R" {\nheight 100\nwidth 200\n}\n',
    );
    assert(out.messageIds.includes("min_report_height",),);
    assert(out.messageIds.includes("min_report_width",),);
  });
});

describe("rule_sortCriteria + erros (10.13.2)", () => {
  it("sorttasks produz lista de tuplas [attr, dir, scenario]", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'taskreport r "R" {\nsorttasks tree, start.up, effort.down\n}\n',
      ),
    );
    assertEquals(p.report("r",)!.get("sortTasks",), [
      ["tree", true, -1,],
      ["start", true, 0,],
      ["effort", false, 0,],
    ],);
  });

  it("critério isolado que não é 'tree' → sorting_crit_exptd2", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "R" {\nsorttasks forest\n}\n',
    );
    assert(out.messageIds.includes("sorting_crit_exptd2",),);
  });

  it("atributo desconhecido → sorting_unknown_attr", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "R" {\nsorttasks foo.up\n}\n',
    );
    assert(out.messageIds.includes("sorting_unknown_attr",),);
  });

  it("direção inválida → sort_direction", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "R" {\nsorttasks start.sideways\n}\n',
    );
    assert(out.messageIds.includes("sort_direction",),);
  });
});

describe("novos relatório: unicidade (10.13.2)", () => {
  it("id duplicado → report_exists", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "R" {\n}\ntaskreport r "S" {\n}\n',
    );
    assert(out.messageIds.includes("report_exists",),);
  });

  it("nome duplicado → report_redefinition", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r1 "R" {\n}\ntaskreport r2 "R" {\n}\n',
    );
    assert(out.messageIds.includes("report_redefinition",),);
  });
});

describe("rule_export + AoN (10.13.2)", () => {
  it("export aceita listas all-or-nothing para definitions/taskattributes", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'export e "E" {\ndefinitions *\ntaskattributes *\n}\n',
      ),
    );
    assertEquals(p.report("e",)!.get("definitions",), ["*",],);
    assertEquals(p.report("e",)!.get("taskAttributes",), ["*",],);
  });
});
