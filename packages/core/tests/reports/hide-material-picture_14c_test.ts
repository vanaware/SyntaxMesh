/**
 * 14C.6.6–6.9 — `hidematerial`/`rollupmaterial`/`hidepicture` nas saídas.
 *
 * Complementa a auditoria de 14C.6.1 provando o efeito **visível** nos
 * relatórios que exibem materiais e imagens:
 *
 * - `materialreport` (lista hierárquica) — ocultação e consolidação;
 * - `rdoreport` (`groupby material`) — bloco do material oculto;
 * - `taskreport` (coluna `materials`) — alocação oculta;
 * - galeria do RDO — entrada cujo dono casa `hidepicture`, sem consumir
 *   `maxpictures`;
 * - exportações TJP e MSPDI — material oculto não é emitido;
 * - `breakdownreport` — material envolvido não gera linha própria, mas o
 *   valor permanece nos totais.
 *
 * Os relatórios vêm de um `.tjp` real (parser) para que as expressões sejam
 * avaliadas pela máquina lógica, como no arquivo do usuário (ADR 027).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.6)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import type { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import { RdoReport, } from "../../src/reports/rdo-report.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";
import { MspXmlRE, } from "../../src/reports/msp-xml-re.ts";
import { BreakdownReport, } from "../../src/reports/breakdown-report.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";

const D = (s: string,) => TjTime.fromString(s,);

const HEADER = `project prj "C6 hide/rollup" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}
`;

/**
 * Cenário base: uma equipe (folha) com diário, dois materiais — `aco` com o
 * sub-material `especial` e `cimento` — e uma tarefa que aloca os dois.
 *
 * As entradas de journal estão todas em 2026-01-06 na ordem de declaração
 * (equipe, aco A, aco B, cimento, especial) para que os testes de galeria
 * possam provar a ordem da união de imagens.
 */
const BODY = `
resource equipe "Equipe" {
  journalentry 2026-01-06 "Equipe mobilizada" {
    summary "Equipe no canteiro"
    picture "img/equipe.png" { caption "Equipe" }
  }
}

material aco "Aço" {
  unit "kg"
  unitprice 10
  material especial "Aço especial" {
    unit "kg"
    unitprice 20
    journalentry 2026-01-06 "Aço especial" {
      summary "Lote especial"
    }
  }
  journalentry 2026-01-06 "Aço A" {
    summary "Lote A"
    picture "img/aco1.png" { caption "Aço 1" }
  }
  journalentry 2026-01-06 "Aço B" {
    summary "Lote B"
    picture "img/aco2.png" { caption "Aço 2" }
  }
}

material cimento "Cimento" {
  unit "sc"
  unitprice 5
  journalentry 2026-01-06 "Cimento" {
    summary "Lote C"
    picture "img/cimento.png" { caption "Cimento" }
  }
}

task t1 "Obra" {
  start 2026-01-05
  end 2026-01-10
  material aco 2
  material cimento 3
}
`;

/** Parseia cabeçalho + corpo + relatórios (falha se houver mensagens). */
function parseTjp(reports: string,): Project {
  const outcome = parseProject(`${HEADER}${BODY}${reports}`,);
  assertEquals(
    outcome.messageIds,
    [],
    `msgs=${outcome.messageIds.join(",",)}: ${
      outcome.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
    }`,
  );
  assert(outcome.result !== false, "parse falhou",);
  return outcome.result as Project;
}

/** Relatório pelo ID (o parser registra todos os blocos do arquivo). */
function reportOf(project: Project, id: string,): Report {
  const report = project.report(id,) as Report | null;
  assert(report !== null, `relatório ${id} não registrado`,);
  return report!;
}

/** Ativa o relatório no projeto e devolve o `ReportContext` corrente. */
function activate(project: Project, report: Report,): ReportContext {
  const context = new ReportContext(project, report,);
  project.reportContexts.push(context,);
  return context;
}

/**
 * IDs das linhas de uma tabela de relatório, ordenados.
 *
 * `Material#id` já carrega o caminho completo (`aco.especial`), como em
 * `project.material(...)`.
 */
function rowIds(re: { getTable(): unknown },): string[] {
  const table = re.getTable() as
    | { getLines(): Array<{ property: unknown }> }
    | null;
  return (table?.getLines() ?? []).map((line,) =>
    (line.property as PropertyTreeNode).id
  ).sort();
}

/** Texto plano de uma célula. */
function textOf(line: ReportTableLine, index: number,): string {
  const cell = line.cells[index] as unknown as { text?: unknown } | null;
  const text = cell?.text;
  if (text === null || text === undefined) return "";
  if (typeof text === "string") return text;
  const rti = text as { to_s?: () => string };
  return typeof rti.to_s === "function" ? rti.to_s() : String(text,);
}

/**
 * Expressão lógica verdadeira para as propriedades cujos IDs estão na lista.
 *
 * Usada nos relatórios montados por código (export/breakdown), onde não há
 * fonte `.tjp` para o parser produzir a expressão real.
 */
function matchingIds(ids: string[],): LogicalExpression {
  const selected = new Set(ids,);
  const operation = {
    eval: (expression: LogicalExpression,) => {
      const property = expression.query?.property as
        | { id?: string }
        | null
        | undefined;
      return property?.id !== undefined && selected.has(property.id,);
    },
  } as unknown as LogicalOperation;
  return new LogicalExpression(operation,);
}

describe("14C.6.6 hidematerial nas listas", () => {
  it("materialreport omite o material casado sem esconder o pai", () => {
    const project = parseTjp(
      'materialreport mr0 "Todos" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns no, name\n}\n" +
        'materialreport mr1 "Filtrado" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns no, name\n  hidematerial ischildof(aco)\n}\n",
    );

    activate(project, reportOf(project, "mr0",),);
    const all = new MaterialListRE(reportOf(project, "mr0",),);
    all.generateIntermediateFormat();
    assertEquals(rowIds(all,), ["aco", "aco.especial", "cimento",],);

    activate(project, reportOf(project, "mr1",),);
    const filtered = new MaterialListRE(reportOf(project, "mr1",),);
    filtered.generateIntermediateFormat();
    assertEquals(
      rowIds(filtered,),
      ["aco", "cimento",],
      "o sub-material casado sai; o material pai permanece",
    );
  });

  it("rdoreport groupby material descarta o bloco do material oculto", () => {
    const project = parseTjp(
      'rdoreport rdo0 "Todos" {\n  period 2026-01-01 - 2026-03-31\n' +
        "  groupby material\n}\n" +
        'rdoreport rdo1 "Folhas ocultas" {\n  period 2026-01-01 - 2026-03-31\n' +
        "  groupby material\n  hidematerial isleaf()\n}\n",
    );

    activate(project, reportOf(project, "rdo0",),);
    const all = new RdoReport(reportOf(project, "rdo0",),);
    all.generateIntermediateFormat();
    assertEquals(all.getGroups().map((g,) => g.id), [
      "aco",
      "aco.especial",
      "cimento",
    ],);

    activate(project, reportOf(project, "rdo1",),);
    const filtered = new RdoReport(reportOf(project, "rdo1",),);
    filtered.generateIntermediateFormat();
    assertEquals(
      filtered.getGroups().map((g,) => g.id),
      ["aco",],
      "cimento e o sub-material (folhas) não geram bloco",
    );
  });

  it("taskreport omite a alocação oculta na coluna materials", () => {
    const project = parseTjp(
      'taskreport tr0 "Todos" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name, materials\n}\n" +
        'taskreport tr1 "Folhas ocultas" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name, materials\n  hidematerial isleaf()\n}\n",
    );

    activate(project, reportOf(project, "tr0",),);
    const all = new TaskListRE(reportOf(project, "tr0",),);
    all.generateIntermediateFormat();
    const allLine = all.getTable()!.getLines().find((line,) =>
      (line.property as PropertyTreeNode).id === "t1"
    )!;
    assertEquals(textOf(allLine, 1,), "aco (2), cimento (3)",);

    activate(project, reportOf(project, "tr1",),);
    const filtered = new TaskListRE(reportOf(project, "tr1",),);
    filtered.generateIntermediateFormat();
    const line = filtered.getTable()!.getLines().find((l,) =>
      (l.property as PropertyTreeNode).id === "t1"
    )!;
    assertEquals(textOf(line, 1,), "aco (2)",);
  });
});

describe("14C.6.7 hidepicture na galeria do RDO", () => {
  it("descarta as imagens da entrada cujo dono casa a expressão", () => {
    const project = parseTjp(
      'rdoreport rdo "RDO" {\n  period 2026-01-01 - 2026-03-31\n' +
        "  groupby material\n  hidepicture isleaf()\n}\n",
    );
    activate(project, reportOf(project, "rdo",),);
    const re = new RdoReport(reportOf(project, "rdo",),);
    re.generateIntermediateFormat();

    const aco = re.getGroups().find((g,) => g.id === "aco")!;
    assertEquals(aco.pictures.map((p,) => p.path), [
      "img/aco1.png",
      "img/aco2.png",
    ],);

    const cimento = re.getGroups().find((g,) => g.id === "cimento")!;
    assertEquals(cimento.pictures, [], "galeria do material folha ocultada",);
    assertEquals(
      cimento.entries[0]!.pictures,
      [],
      "a lista da entrada também fica vazia",
    );
  });

  it("imagens filtradas não consomem os slots de maxpictures", () => {
    // `equipe` (recurso folha) declara a primeira imagem do dia; com
    // `hidepicture isleaf()` ela sai da união e as duas do `aco` cabem.
    const project = parseTjp(
      'rdoreport rdo "RDO" {\n  period 2026-01-01 - 2026-03-31\n' +
        "  groupby date\n  maxpictures 2\n  hidepicture isleaf()\n}\n",
    );
    activate(project, reportOf(project, "rdo",),);
    const re = new RdoReport(reportOf(project, "rdo",),);
    re.generateIntermediateFormat();

    const day = re.getGroups().find((g,) => g.id === "2026-01-06")!;
    assertEquals(day.pictures.map((p,) => p.path), [
      "img/aco1.png",
      "img/aco2.png",
    ],);
    assert(
      !day.pictures.some((p,) => p.path === "img/equipe.png"),
      "imagem do dono oculto não pode ocupar slot",
    );

    // Regressão: sem `hidepicture` a primeira imagem do dia é a da equipe.
    const plain = parseTjp(
      'rdoreport rdo "RDO" {\n  period 2026-01-01 - 2026-03-31\n' +
        "  groupby date\n  maxpictures 2\n}\n",
    );
    activate(plain, reportOf(plain, "rdo",),);
    const plainRe = new RdoReport(reportOf(plain, "rdo",),);
    plainRe.generateIntermediateFormat();
    const plainDay = plainRe.getGroups().find((g,) => g.id === "2026-01-06")!;
    assertEquals(plainDay.pictures.map((p,) => p.path).length, 4,);
  });
});

describe("14C.6.8 material oculto nas exportações", () => {
  it("TJP e MSPDI não emitem o material oculto", () => {
    const project = parseTjp("",);
    const hide = matchingIds(["cimento",],);

    const tjpReport = new Report(project, "tj", "export.tji", null,);
    tjpReport.set("start", D("2026-01-01",),);
    tjpReport.set("end", D("2026-12-31",),);
    tjpReport.set("scenarios", [0,],);
    tjpReport.set("sortResources", [],);
    tjpReport.set("sortTasks", [],);
    tjpReport.set("definitions", ["flags", "materials", "tasks",],);
    tjpReport.set("resourceAttributes", [],);
    tjpReport.set("taskAttributes", ["materialallocations",],);
    tjpReport.set("hideMaterial", hide,);
    activate(project, tjpReport,);
    const tjp = new TjpExportRE(tjpReport,).to_tjp();

    assert(tjp.includes('material aco "Aço" {',), `TJP:\n${tjp}`,);
    assert(tjp.includes("material aco 2",), `alocação visível:\n${tjp}`,);
    assert(!tjp.includes("cimento",), `material oculto no TJP:\n${tjp}`,);

    const mspReport = new Report(project, "msp", "msp.xml", null,);
    mspReport.set("start", D("2026-01-01",),);
    mspReport.set("end", D("2026-12-31",),);
    mspReport.set("scenarios", [0,],);
    mspReport.set("sortResources", [],);
    mspReport.set("sortTasks", [],);
    mspReport.set("hideMaterial", matchingIds(["cimento",],),);
    activate(project, mspReport,);
    const xml = new MspXmlRE(mspReport,).to_mspxml();

    assert(xml.includes("<Name>Aço</Name>",), `MSPDI:\n${xml}`,);
    assert(!xml.includes("cimento",), `recurso oculto no MSPDI:\n${xml}`,);
  });
});

describe("14C.6.9 rollupmaterial (consolidação)", () => {
  it("materialreport remove os descendentes e mantém o material envolvido", () => {
    const project = parseTjp(
      'materialreport mr1 "Rollup" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns no, name\n  rollupmaterial ~isleaf()\n}\n" +
        'materialreport mr2 "Hide" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns no, name\n  hidematerial ~isleaf()\n}\n",
    );

    activate(project, reportOf(project, "mr1",),);
    const rolled = new MaterialListRE(reportOf(project, "mr1",),);
    rolled.generateIntermediateFormat();
    assertEquals(
      rowIds(rolled,),
      ["aco", "cimento",],
      "rollup mantém o pai e remove a subárvore",
    );

    activate(project, reportOf(project, "mr2",),);
    const hidden = new MaterialListRE(reportOf(project, "mr2",),);
    hidden.generateIntermediateFormat();
    assertEquals(
      rowIds(hidden,),
      ["aco.especial", "cimento",],
      "hide remove só o nó casado (lista plana)",
    );
  });

  it("breakdown omite a linha envolvida mas mantém o valor nos totais", () => {
    const project = createTestProject(1,);
    const account = new Account(project, "c1", "Custo", null,);
    const task = new Task(project, "t1", "T1", null,);
    const aco = new Material(project, "aco", "kg", 2,);
    aco.set("unit", "kg",);
    aco.set("cost", 2,);
    const cimento = new Material(project, "cimento", "sc", 5,);
    cimento.set("unit", "sc",);
    cimento.set("cost", 5,);
    task.setForScenario(
      "materialallocations",
      [
        new MaterialAllocation(aco, 40, "distributed",),
        new MaterialAllocation(cimento, 10, "distributed",),
      ],
      0,
    );

    const report = new Report(project, "bd", "bd.html", null,);
    report.typeSpec = ReportType.BreakdownReport;
    report.set("start", D("2026-01-01",),);
    report.set("end", D("2026-12-31",),);
    report.set("scenarios", [0,],);
    report.set("groupby", "task",);
    report.set("columns", [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("materials", "Materials",),
      new TableColumnDefinition("total", "Total",),
    ],);
    report.set("rollupMaterial", matchingIds(["cimento",],),);
    activate(project, report,);

    const re = new BreakdownReport(report,);
    re.generateIntermediateFormat();
    const group = re.getGroups()[0]!;
    assertEquals(group.totals.materials, 130, "40×2 + 10×5 nos totais",);

    // A contribuinte continua na estrutura (flag `rolledUp`), mas não nas
    // saídas: CSV sem a linha, JSON sem o contribuinte.
    const materialIds = group.contributors
      .filter((c,) => c.kind === "material")
      .map((c,) => c.id);
    assertEquals(materialIds, ["aco", "cimento",],);

    const csv = re.to_csv();
    assertEquals(
      csv.length,
      3,
      `CSV sem a linha do material envolvido: ${JSON.stringify(csv,)}`,
    );
    assertEquals(csv[2], ["T1", "material", "40 kg", 80, "",],);

    const json = JSON.parse(re.toJSON(),) as {
      groups: Array<{
        totals: { materials: number };
        contributors: Array<{ id: string }>;
      }>;
    };
    assertEquals(json.groups[0]!.totals.materials, 130,);
    assertEquals(
      json.groups[0]!.contributors.map((c,) => c.id),
      ["aco",],
      "JSON omite o material envolvido",
    );
  });
});
