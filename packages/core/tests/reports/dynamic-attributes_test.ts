/**
 * Testes do pipeline `dynamicAttributes` (Fase 18.19).
 *
 * O Ruby (`Project#generateReport`, l.778-812) faz: backup dos atributos →
 * `parseReportAttributes` com o snippet recebido (o `-A` do `tj3`) → marca o
 * relatório como `interactive` → gera → restaura o backup. Estes testes fixam
 * cada etapa.
 *
 * **Fidelidade do `restoreAttributes`.** O backup do Ruby é *raso*
 * (`@attributes.clone`): o mapa de atributos volta ao estado anterior — um
 * atributo criado só pelo snippet (p. ex. `interactive`) desaparece — mas os
 * **valores** gravados nos atributos que já existiam (as colunas, p. ex.) não
 * voltam. Verificado com o `tj3` 3.8.4: depois de
 * `generateReport('dyn', false, nil, 'columns id, name')` o relatório continua
 * com as colunas `id, name`. O port mantém esse comportamento.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb:generateReport
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.19)
 */
import { assert, assertEquals, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import type { Task, } from "../../src/model/task.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
// Efeito colateral: registra as fábricas de conteúdo (`taskreport`).
import "../../src/reports/mod.ts";

/** Projeto mínimo: duas tarefas com esforço e um recurso. */
const TJP = `project prj "Dyn" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-02-01
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}
resource dev "Developer" {
}
task a "Alpha" {
  effort 5d
  allocate dev
}
task b "Beta" {
  effort 3d
  allocate dev
}
taskreport dyn "dyn.tjp" {
  formats html
  columns id
  period 2026-01-01 - 2026-12-31
}
`;

/** Parse sem `schedule()`: `AttributeBase.mode` fica em 0 (`provided`). */
function parse(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  return parser.parse("project",) as Project;
}

/** Projeto agendado — é o estado em que os relatórios são gerados. */
function makeProject(): Project {
  const project = parse();
  project.schedule();
  return project;
}

/** O `taskreport` do fixture. */
function reportOf(project: Project,): Report {
  return project.report("dyn",) as Report;
}

/** Ids das colunas do relatório, na ordem em que serão renderizadas. */
function columnIds(report: Report,): string[] {
  const columns = (report.get("columns",) ?? []) as Array<{ id: string }>;
  return columns.map((column,) => column.id);
}

/** Rótulos do cabeçalho da tabela HTML gerada. */
function headers(report: Report,): string[] {
  const html = String(report.output,);
  return [
    ...html.matchAll(/font-weight:bold; ">([^<]*)<\/td>/gu,),
  ].map((match,) => match[1]!.trim());
}

describe("backupAttributes / restoreAttributes (18.19.1)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("restaura o mapa de atributos do relatório", () => {
    const report = reportOf(parse(),);
    assertEquals(report.provided("interactive",), false,);
    assertEquals(report.provided("columns",), true,);

    const backup = report.backupAttributes();
    report.set("interactive", true,);
    assertEquals(report.provided("interactive",), true,);

    report.restoreAttributes(backup,);
    // O atributo criado depois do backup não volta...
    assertEquals(report.provided("interactive",), false,);
    // ...e os que já existiam continuam lá.
    assertEquals(report.provided("columns",), true,);
    assertEquals(columnIds(report,), ["id",],);
  });

  it("copia os mapas de cenário (snapshot, não alias)", () => {
    const task = parse().tasks.get("a",) as Task;
    const [, scenarioBackup,] = task.backupAttributes();
    const before = task.scenarioAttributes[0]!;

    // Sem a cópia, `restoreAttributes` (que limpa o mapa vivo) devolveria um
    // mapa vazio — o backup perderia o estado junto com o original.
    assert(scenarioBackup[0] !== before,);
    assertEquals(
      [...scenarioBackup[0]!.keys(),],
      [...before.keys(),],
    );

    task.restoreAttributes(task.backupAttributes(),);
    assertEquals(
      [...task.scenarioAttributes[0]!.keys(),],
      [...scenarioBackup[0]!.keys(),],
    );
  });
});

describe("parseReportAttributes (18.19.2)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("aplica os atributos do snippet ao relatório", () => {
    const report = reportOf(parse(),);
    const parser = new ProjectFileParser();
    parser.project = report.project as Project;

    parser.parseReportAttributes(
      report,
      'columns id, name\n  title "Custom"',
    );

    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals(columnIds(report,), ["id", "name",],);
    assertEquals(report.get("title",), "Custom",);
  });

  it("substitui (e não acumula) o valor das listas", () => {
    const report = reportOf(parse(),);
    const parser = new ProjectFileParser();
    parser.project = report.project as Project;

    parser.parseReportAttributes(report, "columns id, name",);
    parser.parseReportAttributes(report, "columns name",);

    assertEquals(columnIds(report,), ["name",],);
  });

  it("erro de sintaxe vira mensagem, não exceção (18.19.6)", () => {
    const report = reportOf(parse(),);
    const parser = new ProjectFileParser();
    parser.project = report.project as Project;

    // Não lança: o laço do parser segue e o erro fica no MessageHandler.
    parser.parseReportAttributes(report, "columns id, naoExiste",);

    // O Ruby para no primeiro erro (`no_reduce`); o FSM do port recupera e
    // acumula a cascata — o contrato aqui é só "virou mensagem".
    assertEquals(MessageHandlerInstance.instance.errors >= 1, true,);
    assertEquals(
      MessageHandlerInstance.instance.messages.some((message,) =>
        message.type === "error"
      ),
      true,
    );
    // E o relatório não fica corrompido: a coluna inválida é descartada e a
    // lista anterior permanece, como no Ruby (que nem chega a reduzir).
    assertEquals(columnIds(report,), ["id",],);
  });
});

describe("generateReport com dynamicAttributes (18.19.3)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("gera o relatório com as colunas do snippet", () => {
    const project = makeProject();
    const report = reportOf(project,);

    project.generateReport("dyn", false, undefined, "columns id, name",);

    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals(headers(report,), ["Id", "Name",],);
    assertEquals(columnIds(report,), ["id", "name",],);
  });

  it("marca a geração como interativa quando há dynamicAttributes", () => {
    const dynamic = makeProject();
    dynamic.generateReport("dyn", false, undefined, "columns id",);
    // `interactive` troca o destino: o Ruby escreve em `"."`.
    assertEquals(reportOf(dynamic,).outputFileName, ".",);

    const plain = makeProject();
    plain.generateReport("dyn", false,);
    assertEquals(reportOf(plain,).outputFileName, "/dyn.tjp.html",);
    assertEquals(headers(reportOf(plain,),), ["Id",],);
  });

  it("restaura o conjunto de atributos depois de gerar", () => {
    const project = makeProject();
    const report = reportOf(project,);

    project.generateReport("dyn", false, undefined, 'title "Custom"',);
    // Durante a geração o snippet vale (o `<title>` do HTML o mostra).
    assertEquals(
      /<title>([^<]*)<\/title>/u.exec(String(report.output,),)?.[1],
      "Dyn - Custom",
    );
    // Depois, o atributo que só o snippet criou é descartado...
    assertEquals(report.get("title",), null,);
  });

  it("string vazia não faz backup nem parse (só marca interativo)", () => {
    const project = makeProject();
    const report = reportOf(project,);

    project.generateReport("dyn", false, undefined, "",);

    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    assertEquals(columnIds(report,), ["id",],);
    assertEquals(headers(report,), ["Id",],);
    assertEquals(report.outputFileName, ".",);
    // Sem backup/restore (o Ruby só restaura com snippet não vazio), o
    // `interactive` fica marcado no relatório depois da geração.
    assertEquals(report.get("interactive",), true,);
  });
});
