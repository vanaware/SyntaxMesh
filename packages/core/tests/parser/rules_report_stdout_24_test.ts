/**
 * Fase 24 (24.2.8–24.2.13) — modificador `stdout` na DSL.
 *
 * Extensão SyntaxMesh sem equivalente Ruby: `stdout` é um **booleano de
 * intenção** declarado após o nome do relatório e antes das chaves
 * (`taskreport "T" stdout { ... }`). O core nunca imprime nada; apenas
 * registra `stdout = true` no relatório (adendo F24 §2.2).
 *
 * Cobre também a unicidade de nome de relatório com `file:line` (24.2.13) e a
 * compatibilidade dos arquivos sem `stdout` (24.2.12).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §2 e §5.2
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import { Log, } from "../../src/log.ts";
import { ProjectFileScanner, } from "../../src/lexer/project-file-scanner.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
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

/** Relatório com o nome informado (falha se ausente). */
function report(p: Project, name: string,): Report {
  const r = p.reportByName(name,);
  assert(r !== null, `relatório ${name} não encontrado`,);
  return r!;
}

/** Recorte de um relatório dentro de `PROJECT_HEADER`. */
function withReport(body: string,): Project {
  return project(parseProject(PROJECT_HEADER + body,),);
}

/**
 * Igual a `withReport`, mas tolera os avisos dos sheets sem cenário de
 * tracking (`ss_no_tracking_scenario`/`ts_no_tracking_scenario`).
 */
function withReportRaw(body: string,): Project {
  const out = parseProject(PROJECT_HEADER + body,);
  assert(out.threw === null, "parse não deveria lançar",);
  assert(out.result !== null && out.result !== false,);
  return out.result as Project;
}

// ---------------------------------------------------------------------------
// 24.2.8 — keyword `stdout` (i18n invariante + token)
// ---------------------------------------------------------------------------
describe("keyword stdout (24.2.8)", () => {
  it("resolver é invariante nos três idiomas", () => {
    for (const lang of ["en", "pt-BR", "es",]) {
      assertEquals(globalRegistry.resolve("stdout", lang,), "stdout",);
    }
  });

  it("lexer emite ID `stdout` nos três idiomas", () => {
    for (const lang of ["en", "pt-BR", "es",]) {
      const scanner = new ProjectFileScanner(
        "taskreport r stdout {",
        Log,
        lang,
      );
      scanner.open(true,);
      const tokens: Array<[string, unknown,]> = [];
      for (;;) {
        const t = scanner.nextToken();
        if (t[0] === "eof" || t[0] === "endOfText") break;
        tokens.push([t[0], t[1],],);
      }
      assert(
        tokens.some(([type, text,],) => type === "ID" && text === "stdout"),
        `${lang}: ${JSON.stringify(tokens,)}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 24.2.10 — flag aceita em todos os tipos de relatório
// ---------------------------------------------------------------------------
describe("stdout em todos os cabeçalhos (24.2.10)", () => {
  const cases: Array<[string, string,]> = [
    ["taskreport", 'taskreport r "T" stdout {\n}\n',],
    ["mdtaskreport", 'mdtaskreport r "T" stdout {\n}\n',],
    ["resourcereport", 'resourcereport r "T" stdout {\n}\n',],
    ["mdresourcereport", 'mdresourcereport r "T" stdout {\n}\n',],
    ["materialreport", 'materialreport r "T" stdout {\n}\n',],
    ["mdmaterialreport", 'mdmaterialreport r "T" stdout {\n}\n',],
    ["accountreport", 'accountreport r "T" stdout {\n}\n',],
    ["mdaccountreport", 'mdaccountreport r "T" stdout {\n}\n',],
    ["textreport", 'textreport r "T" stdout {\n}\n',],
    ["tracereport", 'tracereport r "T" stdout {\n}\n',],
    ["breakdownreport", 'breakdownreport r "T" stdout {\n}\n',],
    ["rdoreport", 'rdoreport r "T" stdout {\n  end 2026-06-30\n}\n',],
    ["export", 'export r "T" stdout {\n}\n',],
  ];

  for (const [type, body,] of cases) {
    it(`${type} aceita stdout e grava a intenção`, () => {
      const r = report(withReport(body,), "T",);
      assertEquals(r.get("stdout",), true,);
      // Os aliases `md*` compartilham o mesmo `typeSpec` base (só a saída
      // markdown muda), como no parser.
      assertEquals(r.typeSpec, type.replace(/^md/, "",),);
    });
  }

  it("iCal/niku/timeSheet/statusSheet aceitam stdout", () => {
    const p = withReportRaw(
      'icalreport "ICal" stdout {\n}\n' +
        'nikureport "Niku" stdout {\n}\n' +
        'statussheetreport ss "SS" stdout {\n}\n' +
        'timesheetreport ts "TS" stdout {\n}\n',
    );
    assertEquals(report(p, "ICal",).get("stdout",), true,);
    assertEquals(report(p, "Niku",).get("stdout",), true,);
    assertEquals(report(p, "SS",).get("stdout",), true,);
    assertEquals(report(p, "TS",).get("stdout",), true,);
  });
});

// ---------------------------------------------------------------------------
// 24.2.12 — ausência não define a property (compatibilidade)
// ---------------------------------------------------------------------------
describe("stdout ausente (24.2.12)", () => {
  it("não define a property (default lido na renderização)", () => {
    const r = report(
      withReport('taskreport r "T" {\n}\n',),
      "T",
    );
    assertEquals(r.get("stdout",) ?? false, false,);
    // Formato/validação inalterados.
    assertEquals(r.typeSpec, "taskreport",);
  });
});

// ---------------------------------------------------------------------------
// 24.2.11 — posições inválidas ⇒ erro de sintaxe
// ---------------------------------------------------------------------------
describe("stdout em posição inválida (24.2.11)", () => {
  it("stdout depois das chaves ⇒ erro", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "T" {\n}\nstdout\n',
    );
    assert(out.threw !== null || out.messageIds.length > 0,);
  });

  it("stdout dentro do corpo ⇒ erro", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "T" {\n  stdout\n}\n',
    );
    assert(out.threw !== null || out.messageIds.length > 0,);
  });

  it("stdout duplicado ⇒ erro", () => {
    const out = parseProject(
      PROJECT_HEADER + 'taskreport r "T" stdout stdout {\n}\n',
    );
    assert(out.threw !== null || out.messageIds.length > 0,);
  });

  it("stdout não interfere na validação de formatos", () => {
    const r = report(
      withReport(
        'taskreport r "T" stdout {\n  formats html, csv\n}\n',
      ),
      "T",
    );
    const formats = r.get("formats",) as string[] | null;
    assertEquals(formats, ["html", "csv",],);
  });
});

// ---------------------------------------------------------------------------
// 24.2.13 — nome de relatório único, com file:line
// ---------------------------------------------------------------------------
describe("nome de relatório único (24.2.13)", () => {
  it("duplicata registra report_redefinition com file:line", () => {
    const tj = new TaskJuggler();
    const ok = tj.parseContent(
      PROJECT_HEADER + 'taskreport r1 "R" {\n}\ntaskreport r2 "R" {\n}\n',
      "dup.tjp",
    );
    assertEquals(ok, false,);

    const message = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "report_redefinition"
    );
    assert(message !== undefined,);
    assert(message!.sourceFileInfo !== null, "sem file:line",);
    assertEquals(message!.sourceFileInfo!.fileName, "dup.tjp",);
    assertEquals(message!.sourceFileInfo!.lineNo, 4,);
    assert(message!.to_s().includes("dup.tjp:4:",), message!.to_s(),);
  });
});
