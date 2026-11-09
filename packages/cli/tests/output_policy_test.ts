/**
 * Testes da política de saída (24.5) — adendo §4.
 *
 * A E/S é um sistema de arquivos em memória (`fakeIo`), então nenhum teste
 * toca disco: a política só decide **onde** cada conteúdo vai e **com que
 * nome**, exatamente a responsabilidade que o core recusa (adendo §3.5).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §4
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.5)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type {
  ExecutionResult,
  ReportJsonEntry,
  ReportsJson,
} from "@vanaware/syntaxmesh";
import {
  delimiterFor,
  dispatchReports,
  dispatchSections,
  extensionOf,
  fileNameFor,
  type OutputPolicyIo,
  sanitizeFileName,
} from "../src/output-policy.ts";

/** Entrada de relatório com formato único. */
function entry(
  name: string,
  formats: string[],
  options: { stdout?: boolean; errors?: string[]; selfcontained?: boolean } =
    {},
): ReportJsonEntry {
  return {
    name,
    stdout: options.stdout ?? false,
    selfcontained: options.selfcontained ?? false,
    formats: formats.map((format,) => ({
      format,
      content: `<${format} ${name}>`,
    })),
    errors: options.errors ?? [],
  };
}

/** Seção `reports` montada a partir das entradas. */
function section(
  reports: ReportJsonEntry[],
  outputDir?: string,
): ReportsJson {
  const json: ReportsJson = {
    ok: reports.every((item,) => item.errors.length === 0),
    reports,
  };
  if (outputDir !== undefined) json.outputDir = outputDir;
  return json;
}

/** Sistema de arquivos em memória: arquivos gravados + árvore de assets. */
function fakeIo(tree: Record<string, string[]> = {},) {
  const printed: string[] = [];
  const files = new Map<string, string>();
  const dirs: string[] = [];
  const copies: string[] = [];
  const io: OutputPolicyIo = {
    print: (text: string,) => printed.push(text,),
    write: (path: string, content: string,) => {
      files.set(path, content,);
      return Promise.resolve();
    },
    mkpath: (dir: string,) => {
      dirs.push(dir,);
      return Promise.resolve();
    },
    copy: (from: string, to: string,) => {
      copies.push(`${from}>${to}`,);
      return Promise.resolve();
    },
    listDir: (path: string,) => Promise.resolve(tree[path] ?? [],),
    isDir: (path: string,) => Promise.resolve((tree[path] ?? []).length > 0,),
    exists: (path: string,) => Promise.resolve(tree[path] !== undefined,),
  };
  return { io, printed, files, dirs, copies, };
}

describe("extensionOf (24.5.4)", () => {
  it("espelha a tabela de sufixos do core", () => {
    assertEquals(extensionOf("csv",), "csv",);
    assertEquals(extensionOf("html",), "html",);
    assertEquals(extensionOf("markdown",), "md",);
    assertEquals(extensionOf("iCal",), "ics",);
    assertEquals(extensionOf("mspxml",), "xml",);
    assertEquals(extensionOf("niku",), "xml",);
    assertEquals(extensionOf("json",), "json",);
    assertEquals(extensionOf("tjp",), "tjp",);
  });

  it("ctags não tem sufixo; formato desconhecido usa o próprio id", () => {
    assertEquals(extensionOf("ctags",), "",);
    assertEquals(extensionOf("xls",), "xls",);
  });
});

describe("sanitizeFileName (24.5.4)", () => {
  it("substitui caracteres inválidos por `_`", () => {
    assertEquals(
      sanitizeFileName('a\\b?c%d*e:f|g"h<i>j',),
      "a_b_c_d_e_f_g_h_i_j",
    );
  });

  it("remove separadores nas pontas e preserva espaços internos", () => {
    assertEquals(sanitizeFileName("  Plano 2026  ",), "Plano 2026",);
    assertEquals(sanitizeFileName("../../etc/passwd",), "passwd",);
  });

  it("nome vazio cai no rótulo `report`", () => {
    assertEquals(sanitizeFileName("",), "report",);
    assertEquals(sanitizeFileName(".",), "report",);
  });
});

describe("fileNameFor (24.5.4)", () => {
  it("usa `{name}.{ext}`", () => {
    assertEquals(fileNameFor("Tarefas", "csv",), "Tarefas.csv",);
    assertEquals(fileNameFor("Tarefas", "markdown",), "Tarefas.md",);
  });

  it("formato sem sufixo mantém o nome puro", () => {
    assertEquals(fileNameFor("Tarefas", "ctags",), "Tarefas",);
  });
});

describe("delimiterFor (24.5.3)", () => {
  it("usa o formato exato do adendo", () => {
    assertEquals(delimiterFor("Tarefas", "csv",), "--- Tarefas [csv] ---",);
  });
});

describe("dispatchReports — ramo terminal (24.5.3)", () => {
  it("imprime todos os formatos na ordem, com delimitador", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry("Tarefas", ["csv", "html",], { stdout: true, },),],),
      { io: fake.io, },
    );
    assertEquals(fake.printed, [
      "--- Tarefas [csv] ---",
      "<csv Tarefas>",
      "--- Tarefas [html] ---",
      "<html Tarefas>",
    ],);
    assertEquals(outcome.printed, 1,);
    assertEquals(outcome.written, [],);
    assertEquals(fake.files.size, 0,);
  });

  it("nome `.` imprime mesmo sem o modificador `stdout`", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(section([entry(".", ["csv",],),],), {
      io: fake.io,
    },);
    assertEquals(fake.printed, ["--- . [csv] ---", "<csv .>",],);
    assertEquals(outcome.written, [],);
  });

  it("não acrescenta linha em branco quando o conteúdo já termina em `\\n`", async () => {
    const fake = fakeIo();
    const withNewline: ReportsJson = {
      ok: true,
      reports: [{
        name: "R",
        stdout: true,
        selfcontained: false,
        formats: [{ format: "csv", content: "a;b\n", },],
        errors: [],
      },],
    };
    await dispatchReports(withNewline, { io: fake.io, },);
    assertEquals(fake.printed, ["--- R [csv] ---", "a;b",],);
  });
});

describe("dispatchReports — ramo arquivo (24.5.4)", () => {
  it("grava `{name}.{ext}` sob o outputDir ecoado", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry("Tarefas", ["csv", "html",],),], "out",),
      { io: fake.io, },
    );
    assertEquals(outcome.written, ["out/Tarefas.csv", "out/Tarefas.html",],);
    assertEquals(fake.files.get("out/Tarefas.csv",), "<csv Tarefas>",);
    assertEquals(fake.dirs, ["out",],);
    assertEquals(fake.printed, [],);
    assertEquals(outcome.printed, 0,);
  });

  it("sanitiza o nome e cria o diretório aninhado", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry('R: "1"', ["markdown",],),], "build/reports",),
      { io: fake.io, },
    );
    assertEquals(outcome.written, ["build/reports/R_ _1_.md",],);
    assertEquals(fake.dirs, ["build/reports",],);
  });

  it("sem outputDir grava no diretório corrente", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(section([entry("R", ["csv",],),],), {
      io: fake.io,
    },);
    assertEquals(outcome.written, ["R.csv",],);
    assertEquals(fake.dirs, [],);
  });

  it("sobrescreve o arquivo existente", async () => {
    const fake = fakeIo();
    fake.files.set("R.csv", "velho",);
    await dispatchReports(section([entry("R", ["csv",],),],), {
      io: fake.io,
    },);
    assertEquals(fake.files.get("R.csv",), "<csv R>",);
  });
});

describe("dispatchReports — relatórios mistos (24.5.6)", () => {
  it("uma execução produz terminal e arquivos", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([
        entry("Tarefas", ["csv",], { stdout: true, },),
        entry("Recursos", ["csv", "html",],),
      ], "out",),
      { io: fake.io, },
    );
    assertEquals(fake.printed, ["--- Tarefas [csv] ---", "<csv Tarefas>",],);
    assertEquals(outcome.written, [
      "out/Recursos.csv",
      "out/Recursos.html",
    ],);
    assertEquals(outcome.printed, 1,);
    assertEquals(outcome.aborted, false,);
  });
});

describe("dispatchReports — erros (24.5.5)", () => {
  it("aborta sem saída parcial e reporta cada erro", async () => {
    const fake = fakeIo();
    const errors: string[] = [];
    const outcome = await dispatchReports(
      section([
        entry("Tarefas", ["csv",], { stdout: true, },),
        entry("Quebrado", [], {
          errors: ["Unknown report output format xls.",],
        },),
      ], "out",),
      { io: fake.io, onError: (text: string,) => errors.push(text,), },
    );
    assertEquals(outcome.aborted, true,);
    assertEquals(fake.printed, [],);
    assertEquals(fake.files.size, 0,);
    assertEquals(errors, ["Quebrado: Unknown report output format xls.",],);
  });

  it("`ok: false` sem `errors[]` também aborta", async () => {
    const fake = fakeIo();
    const errors: string[] = [];
    const outcome = await dispatchReports({ ok: false, reports: [], }, {
      io: fake.io,
      onError: (text: string,) => errors.push(text,),
    },);
    assertEquals(outcome.aborted, true,);
    assertEquals(errors.length, 1,);
    assertEquals(errors[0]!.includes("failed",), true,);
  });
});

describe("dispatchReports — assets do HTML (24.5.16)", () => {
  it("copia css/scripts/icons quando há html não-selfcontained", async () => {
    const fake = fakeIo({
      "assets/css": ["tjreport.css",],
      "assets/css/tjreport.css": [],
      "assets/icons": ["task.png",],
      "assets/icons/task.png": [],
    },);
    const outcome = await dispatchReports(
      section([entry("Plano", ["html",],),], "out",),
      { io: fake.io, assets: { root: "assets", }, },
    );
    assertEquals(outcome.assets.sort(), [
      "out/css/tjreport.css",
      "out/icons/task.png",
    ],);
    assertEquals(fake.copies.length, 2,);
  });

  it("html selfcontained não copia assets", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry("Plano", ["html",], { selfcontained: true, },),], "out",),
      { io: fake.io, assets: { root: "assets", }, },
    );
    assertEquals(outcome.assets, [],);
    assertEquals(fake.copies, [],);
  });

  it("sem relatório html não copia nada", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry("Plano", ["csv",],),], "out",),
      { io: fake.io, assets: { root: "assets", }, },
    );
    assertEquals(outcome.assets, [],);
  });

  it("raiz de assets ausente é silenciosa", async () => {
    const fake = fakeIo();
    const outcome = await dispatchReports(
      section([entry("Plano", ["html",],),], "out",),
      { io: fake.io, assets: { root: "nao-existe", }, },
    );
    assertEquals(outcome.assets, [],);
    assertEquals(fake.copies, [],);
  });
});

/** Envelope mínimo com só as seções dadas (24.9/24.10). */
function envelope(
  results: ExecutionResult["results"],
  ok = true,
  options: Partial<ExecutionResult["options"]> = {},
): ExecutionResult {
  return {
    ok,
    exitCode: ok ? 0 : 1,
    options: options as never,
    messages: [],
    results,
  };
}

describe("dispatchSections — freeze (24.9.4/24.9.5)", () => {
  it("grava os dois artefatos no caminho que o core derivou", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        freeze: {
          files: [
            {
              fileName: "out/proj-header.tji",
              contents: "now 2026-05-18-00:00-+0000\n",
            },
            {
              fileName: "out/proj-bookings.tji",
              contents: "supplement resource dev {\n}\n",
            },
          ],
        },
      },),
      { io: fake.io, },
    );
    assertEquals(outcome.written, [
      "out/proj-header.tji",
      "out/proj-bookings.tji",
    ],);
    assertEquals(
      fake.files.get("out/proj-bookings.tji",),
      "supplement resource dev {\n}\n",
    );
    assertEquals(fake.dirs, ["out",],);
  });

  it("artefato vazio é gravado (trunca o freeze anterior)", async () => {
    // Ruby `File.open(…, 'w')`: sem bookings o arquivo sai vazio mesmo. Pular
    // o artefato deixaria em disco o conteúdo do freeze anterior.
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        freeze: { files: [{ fileName: "proj-bookings.tji", contents: "", },], },
      },),
      { io: fake.io, },
    );
    assertEquals(outcome.written, ["proj-bookings.tji",],);
    assertEquals(fake.files.get("proj-bookings.tji",), "",);
  });
});

describe("dispatchSections — man (24.9.1–24.9.3)", () => {
  it("imprime o texto da seção `man` sem linha em branco extra", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        man: {
          format: "text",
          keywords: ["task",],
          content: "Keyword: task\n",
          files: [],
        },
      },),
      { io: fake.io, },
    );
    assertEquals(fake.printed, ["Keyword: task",],);
    assertEquals(outcome.written, [],);
    assertEquals(fake.files.size, 0,);
  });

  it("grava o manual sob o --output-dir ecoado", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope(
        {
          man: {
            format: "html",
            keywords: [],
            content: "",
            files: [
              { name: "index.html", contents: "<html></html>", },
              { name: "css/tjmanual.css", contents: "pre {}", },
            ],
          },
        },
        true,
        { outputDir: "docs/manual", },
      ),
      { io: fake.io, },
    );
    assertEquals(outcome.written, [
      "docs/manual/index.html",
      "docs/manual/css/tjmanual.css",
    ],);
    assertEquals(fake.files.get("docs/manual/index.html",), "<html></html>",);
    // O CSS do manual pede o diretório antes do arquivo.
    assert(fake.dirs.includes("docs/manual/css",),);
  });

  it("sem arquivos (formato text/smx) nada é gravado", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        man: { format: "smx", keywords: [], content: "# x\n", files: [], },
      },),
      { io: fake.io, },
    );
    assertEquals(outcome.written, [],);
    assertEquals(fake.dirs, [],);
  });
});

describe("dispatchSections — sheet (24.10.1–24.10.4)", () => {
  it("imprime o resumo e grava arquivos sob a raiz do app", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        sheet: {
          app: "ts-summary",
          exitCode: 0,
          summaryText: "Subject: summary\n\nbody\n",
          files: [
            {
              name: "TimeSheets/2026-05-18/dev.tji",
              contents: "timesheet dev\n",
            },
          ],
        },
      },),
      { io: fake.io, sheetBaseDir: "work", },
    );
    assertEquals(fake.printed, ["Subject: summary\n\nbody",],);
    assertEquals(outcome.written, [
      "work/TimeSheets/2026-05-18/dev.tji",
    ],);
    assertEquals(outcome.aborted, false,);
  });

  it("cada email vira outbox/NNN-<to>.eml, na ordem de emissão", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        sheet: {
          app: "ts-send",
          exitCode: 0,
          emails: [
            { to: "dev@example.com", subject: "A", text: "to dev\n", },
            { to: "ops@example.com", subject: "B", text: "to ops\n", },
          ],
          emailText: "to dev\n",
        },
      },),
      { io: fake.io, },
    );
    assertEquals(outcome.written, [
      "outbox/001-dev@example.com.eml",
      "outbox/002-ops@example.com.eml",
    ],);
    // Sem resumo/relatório, o corpo do primeiro email é o que se imprime.
    assertEquals(fake.printed, ["to dev",],);
  });

  it("check-ts imprime o relatório compilado", async () => {
    const fake = fakeIo();
    await dispatchSections(
      envelope({
        sheet: {
          app: "check-ts",
          exitCode: 0,
          reportText: "Sheet is valid.\n",
        },
      },),
      { io: fake.io, },
    );
    assertEquals(fake.printed, ["Sheet is valid.",],);
    assertEquals(fake.files.size, 0,);
  });

  it("execução que falhou não entrega email nem grava folha", async () => {
    const fake = fakeIo();
    const outcome = await dispatchSections(
      envelope({
        sheet: {
          app: "ts-receive",
          exitCode: 1,
          files: [{ name: "TimeSheets/x.tji", contents: "x", },],
        },
      }, false,),
      { io: fake.io, },
    );
    assertEquals(outcome.aborted, true,);
    assertEquals(outcome.written, [],);
    assertEquals(fake.printed, [],);
  });
});
