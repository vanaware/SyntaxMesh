/**
 * Fase 24 (24.2.22–24.2.28) — fachada `execute` e envelope JSON.
 *
 * O contrato (adendo v2.1 §3) é de **dados puros**: o request traz o conteúdo
 * dos arquivos inline, o `include` é resolvido por *lookup* em memória e o
 * envelope devolve `ok`/`exitCode` (matriz do plano §5.3), eco das opções (só
 * caminhos), mensagens estruturadas e **apenas** as seções pedidas.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import { execute, } from "../../src/execution/execute.ts";
import { OPTION_SPECS, } from "../../src/execution/sections.ts";
import type {
  ExecutionRequest,
  ExecutionResult,
} from "../../src/execution/types.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios.
import "../../src/reports/mod.ts";

const MASTER = [
  'project prj "Test" "1.0" 2026-01-01 - 2026-12-31',
  "",
  'include "common.tji"',
  "",
  'task t1 "Alpha" {',
  "  start 2026-01-05",
  "  duration 3d",
  "}",
  "",
  'taskreport first "Tarefas" stdout {',
  "  formats csv",
  "}",
  "",
  'taskreport second "Recursos" {',
  "  formats csv, html",
  "}",
  "",
].join("\n",);

const COMMON = [
  'account acct "Acc"',
  "",
].join("\n",);

/** Request com o fechamento completo (`include` incluso). */
function request(
  overrides: Partial<ExecutionRequest> = {},
): ExecutionRequest {
  return {
    files: [
      { path: "proj.tjp", content: MASTER, },
      { path: "common.tji", content: COMMON, },
    ],
    ...overrides,
  };
}

/** Executa limpando o singleton de mensagens (isolamento entre testes). */
async function run(input: ExecutionRequest,): Promise<ExecutionResult> {
  MessageHandlerInstance.instance.reset();
  return await execute(input,);
}

describe("execute — eco de options (24.2.24)", () => {
  it("aplica defaults e ecoa só os caminhos dos arquivos", async () => {
    const result = await run(request({ outputDir: "out", },),);

    assertEquals(result.exitCode, 0,);
    assertEquals(result.ok, true,);
    assertEquals(result.options.entry, "proj.tjp",);
    assertEquals(result.options.files, ["proj.tjp", "common.tji",],);
    assertEquals(result.options.outputDir, "out",);
    assertEquals(result.options.checkSyntax, false,);
    assertEquals(result.options.noReports, false,);
    assertEquals(result.options.reportsIsRegex, false,);
    assertEquals(result.options.freeze, null,);
  });

  it("não devolve o conteúdo dos arquivos no envelope", async () => {
    const result = await run(request(),);
    const json = JSON.stringify(result,);
    assert(
      !json.includes("duration 3d",),
      "conteúdo do master vazou no envelope",
    );
    assert(!json.includes("account acct",), "conteúdo do include vazou",);
  });

  it("entry explícito sobrevive ao eco", async () => {
    const result = await run(
      request({ entry: "./common.tji", checkSyntax: true, },),
    );
    assertEquals(result.options.entry, "./common.tji",);
  });
});

describe("execute — seção reports e exit codes (24.2.23/24.2.24)", () => {
  it("gera todos os relatórios e sai 0", async () => {
    const result = await run(request(),);

    assertEquals(result.exitCode, 0,);
    const reports = result.results.reports;
    assert(reports !== undefined,);
    assertEquals(reports!.reports.map((r,) => r.name), [
      "Tarefas",
      "Recursos",
    ],);
    assertEquals(reports!.reports[0]!.stdout, true,);
    assertEquals(reports!.reports[0]!.formats[0]!.format, "csv",);
    // `outputDir` só aparece quando pedido.
    assert(!("outputDir" in reports!),);
  });

  it("outputDir do request entra na seção reports", async () => {
    const result = await run(request({ outputDir: "out", },),);
    assertEquals(result.results.reports!.outputDir, "out",);
  });

  it("--report filtra a seção", async () => {
    const result = await run(request({ report: "second", },),);
    assertEquals(
      result.results.reports!.reports.map((r,) => r.name),
      ["Recursos",],
    );
    assertEquals(result.exitCode, 0,);
  });

  it("--check-syntax não agenda e devolve valid", async () => {
    const result = await run(
      request({ checkSyntax: true, },),
    );
    assertEquals(result.results.check, { valid: true, },);
    assert(result.results.reports === undefined,);
    assertEquals(result.exitCode, 0,);
  });

  it("parse quebrado ⇒ check.valid false e exit 1", async () => {
    const result = await run({
      files: [{ path: "bad.tjp", content: "project p", },],
      checkSyntax: true,
    },);
    assertEquals(result.results.check, { valid: false, },);
    assertEquals(result.exitCode, 1,);
    assert(result.messages.length > 0,);
  });

  it("include ausente no request ⇒ erro bad_include e exit 1", async () => {
    const result = await run({
      files: [{ path: "proj.tjp", content: MASTER, },],
    },);
    assertEquals(result.exitCode, 1,);
    assert(
      result.messages.some((m,) => m.id === "bad_include"),
      JSON.stringify(result.messages,),
    );
  });

  it("sem arquivos ⇒ tj3_tjp_file_missing e exit 1", async () => {
    const result = await run({ files: [], },);
    assertEquals(result.exitCode, 1,);
    assertEquals(result.ok, false,);
    const message = result.messages.find((m,) =>
      m.id === "tj3_tjp_file_missing"
    );
    assert(message !== undefined,);
    assert(message!.text.includes(".tjp",),);
  });

  it("--abort-on-warnings transforma warning em erro", async () => {
    // Projeto sem relatórios: `checkReports` emite `no_report_defined`.
    const result = await run({
      files: [{
        path: "warn.tjp",
        content: [
          'project prj "Test" "1.0" 2026-01-01 - 2026-12-31',
          'task t1 "Alpha" { effort 1d }',
        ].join("\n",),
      },],
      abortOnWarnings: true,
    },);
    assertEquals(result.exitCode, 1,);
    assert(result.messages.length > 0,);
  });
});

describe("execute — seções sob demanda (24.2.25)", () => {
  it("só a seção pedida aparece em results", async () => {
    const check = await run(request({ checkSyntax: true, },),);
    assertEquals(Object.keys(check.results,), ["check",],);

    const none = await run(request({ noReports: true, },),);
    assertEquals(Object.keys(none.results,), [],);
    assertEquals(none.exitCode, 0,);
  });

  it("--list-reports devolve nome e tipo na ordem de declaração", async () => {
    const result = await run(request({ listReports: ".", },),);
    assertEquals(result.exitCode, 0,);
    assertEquals(result.results.listReports, [
      { name: "Tarefas", type: "taskreport", },
      { name: "Recursos", type: "taskreport", },
    ],);
  });

  it("--list-reports com regex filtra", async () => {
    const result = await run(request({ listReports: "^second$", },),);
    assertEquals(result.results.listReports!.length, 1,);
    assertEquals(result.results.listReports![0]!.name, "Recursos",);
  });

  it("help devolve a especificação das opções sem abrir projeto", async () => {
    const result = await run({ help: true, },);
    assertEquals(result.exitCode, 0,);
    assertEquals(
      result.results.help!.length,
      OPTION_SPECS.length,
    );
    const names = result.results.help!.map((spec,) => spec.name);
    assert(names.includes("report",),);
    assert(names.includes("check-syntax",),);
    // São cópias: mutar a seção não afeta a fonte.
    result.results.help!.pop();
    assertEquals(OPTION_SPECS.length, names.length,);
  });

  it("version devolve name/version do AppConfig", async () => {
    const result = await run({ version: true, },);
    assertEquals(result.exitCode, 0,);
    assertEquals(result.results.version!.name, "SyntaxMesh",);
    assertEquals(typeof result.results.version!.version, "string",);
  });

  it("--version/--help saem antes do projeto (mesmo com arquivos)", async () => {
    // Ruby `Tj3AppBase#on_tail`: imprime e sai. Antes disso o pipeline rodava
    // inteiro quando havia arquivo na linha de comando.
    const version = await run(request({ version: true, },),);
    assertEquals(version.exitCode, 0,);
    assertEquals(version.results.reports, undefined,);
    assertEquals(version.messages.length, 0,);

    const help = await run(request({ help: true, },),);
    assertEquals(help.exitCode, 0,);
    assertEquals(help.results.reports, undefined,);
  });
});

describe("execute — seção man (24.9.1–24.9.3)", () => {
  // `freeze` e os apps de sheet saíram da âncora em 24.9/24.10 (prova em
  // `freeze_sheets_24_test.ts`); `man` deixou de ser âncora em 24.9.1–3, com o
  // `doc-core` da Fase 22 como fonte.
  it("text devolve a documentação da keyword sem abrir projeto", async () => {
    const man = await run({ man: { format: "text", keywords: ["task",], }, },);
    assertEquals(man.exitCode, 0,);
    assertEquals(man.results.man!.format, "text",);
    assert(man.results.man!.content.includes("Keyword:",),);
    assertEquals(man.results.man!.keywords, ["task",],);
    assertEquals(man.results.man!.files, [],);
  });

  it("text sem keyword lista todas as keywords documentadas", async () => {
    const man = await run({ man: { format: "text", }, },);
    assertEquals(man.exitCode, 0,);
    const lines = man.results.man!.content.trimEnd().split("\n",);
    assert(lines.length > 100,);
    assert(lines.includes("task",),);
    assertEquals(man.results.man!.keywords, [],);
  });

  it("keyword desconhecida vira erro de saída e exit 1", async () => {
    const man = await run({
      man: { format: "text", keywords: ["nosuchkeyword",], },
    },);
    assertEquals(man.exitCode, 1,);
    assert(man.messages.some((m,) => m.id === "man_no_matches"),);
  });

  it("html devolve os arquivos do manual e não depende do .smx", async () => {
    const man = await run({ man: { format: "html", }, },);
    assertEquals(man.exitCode, 0,);
    assertEquals(man.results.man!.format, "html",);
    assertEquals(man.results.man!.content, "",);
    const names = man.results.man!.files.map((f,) => f.name);
    assert(names.includes("index.html",),);
    assert(names.includes("css/tjmanual.css",),);
    assert(!man.messages.some((m,) => m.id === "tj3_tjp_file_missing"),);
  });
});

describe("execute — dynamicAttributes por dentro (24.2.27)", () => {
  it("aplica o pipeline antes de renderizar", async () => {
    // `second` declara csv, html; o snippet força só csv.
    const result = await run(request({
      report: "second",
      dynamicAttributes: "formats csv",
    },),);

    assertEquals(result.exitCode, 0,);
    const entry = result.results.reports!.reports[0]!;
    assertEquals(entry.name, "Recursos",);
    assertEquals(entry.formats.map((f,) => f.format), ["csv",],);

    // Sem o snippet, o relatório volta ao declarado (backup/restore 18.19).
    const plain = await run(request({ report: "second", },),);
    assertEquals(
      plain.results.reports!.reports[0]!.formats.map((f,) => f.format),
      ["csv", "html",],
    );
  });
});

describe("execute — transportabilidade e isolamento (24.2.28)", () => {
  it("request e envelope são structured-cloneáveis", async () => {
    const input = request({ report: "first", },);
    const cloned = structuredClone(input,);
    const result = await run(cloned,);

    const envelopeClone = structuredClone(result,);
    assertEquals(envelopeClone.exitCode, 0,);

    const json = JSON.parse(JSON.stringify(result,),) as ExecutionResult;
    assertEquals(json.options.entry, "proj.tjp",);
    assertEquals(json.exitCode, 0,);

    const clonedRequest = JSON.parse(
      JSON.stringify(input,),
    ) as ExecutionRequest;
    assertEquals(clonedRequest.files!.length, 2,);
  });

  it("duas chamadas concorrentes não vazam mensagens", async () => {
    const good = run(request(),);
    const bad = run({
      files: [{ path: "bad.tjp", content: "project p", },],
    },);
    const [okResult, badResult,] = await Promise.all([good, bad,],);

    assertEquals(okResult.exitCode, 0,);
    assertEquals(badResult.exitCode, 1,);
    assert(
      !okResult.messages.some((m,) => m.severity === "error"),
      JSON.stringify(okResult.messages,),
    );
    assert(badResult.messages.length > 0,);
  });

  it("a fachada TaskJuggler.execute delega o mesmo contrato", async () => {
    MessageHandlerInstance.instance.reset();
    const tj = new TaskJuggler();
    const result = await tj.execute(request({ checkSyntax: true, },),);
    assertEquals(result.results.check, { valid: true, },);
    assertEquals(tj.project, null, "a fachada chamadora não é usada",);
  });
});
