/**
 * Material nos relatórios de sheet — 18.17.4/18.17.5/18.17.8/18.17.10.
 *
 * O Ruby não tem `material` em folhas: sender, relatórios e resumo ganham o
 * material como **extensão** SyntaxMesh (Fase 10 Complemento §2.5/§6.3), então
 * a fonte de verdade são estes testes BDD — não há oracle `tj3`.
 *
 * O que fica provado aqui:
 *  - o template do `timeSheetReport` lista um esqueleto `material <id> {
 *    work/unitprice }` por material alocado à tarefa, e os dois lados do
 *    round-trip usam o mesmo formato (18.17.4/18.17.10);
 *  - `unitprice` só é reemitido quando a alocação declara um preço (18.17.10);
 *  - o `TimeSheetSummary` agrega os status de material (18.17.5);
 *  - o `StatusSheetReport` mostra as alocações e os `effortdone`/`effortleft`
 *    do cenário de tracking por tarefa (18.17.8);
 *  - `TaskJuggler.checkTimeSheet` aplica a folha ao cenário: quantidade vira
 *    `MaterialBooking` e `effortdone`/`effortleft` ficam no material.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.17
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { StatusSheetReport, } from "../../src/reports/status-sheet-report.ts";
import { TimeSheetReport, } from "../../src/reports/time-sheet-report.ts";
import {
  type MaterialStatusTally,
  materialTallyText,
  TimeSheetSummary,
} from "../../src/sheets/time-sheet-summary.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { fakeOpfs, } from "../helpers/fake-opfs.ts";
import { parseProject, } from "../parser/parse-helper.ts";

/**
 * Projeto com dois materiais na tarefa: `steel` com preço próprio na alocação
 * (9.5 sobre o 12.0 do material) e `paint` sem preço — os dois casos de
 * `unitprice` do 18.17.10. A tarefa tem `responsible` e uma entrada de journal
 * no período para o status sheet enxergá-la.
 */
const REPORT_PROJECT =
  `project prj "Sheet Material Report" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  timeformat "%Y-%m-%d"
  now 2026-01-01
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}

resource dev "Developer" {
  email "dev@example.com"
}

material steel "Steel" {
  unit "kg"
  unitprice 12.0
}

material paint "Paint" {
  unit "l"
}

task build "Build" {
  effort 10d
  allocate dev
  responsible dev
  material steel 100 unitprice 9.5
  material paint 5
  journalentry 2026-01-10 "Avanço" {
    summary "Estrutura no lugar"
  }
}

timesheetreport tpl "TimeSheetTemplate" {
  period 2026-01-05 - 2026-01-23
  sorttasks id.up
}

statussheetreport st "StatusSheetTemplate" {
  period 2026-01-05 - 2026-02-02
}
`;

/** Folha completa (tempo + material) do `dev` em janeiro. */
const MATERIAL_SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
    status green "Estrutura pronta"
    material steel {
      work 20
      remaining 80
      unitprice 13
    }
  }
}
`;

/** Parseia a fonte e devolve o projeto (falha o teste se o parse quebrar). */
function parseTjp(text: string,): Project {
  const outcome = parseProject(text,);
  assert(outcome.threw === null, String(outcome.threw,),);
  return outcome.result as Project;
}

/** Projeto da fixture, já agendado (os relatórios leem o plano). */
function buildReportProject(): Project {
  const project = parseTjp(REPORT_PROJECT,);
  assert(project.schedule(), "schedule() devolveu false",);
  return project;
}

/** Instancia um gerador de conteúdo sobre o relatório `id` e o gera. */
function generate<T extends TimeSheetReport | StatusSheetReport,>(
  project: Project,
  id: string,
  factory: (report: Report,) => T,
): T {
  const report = project.reports.get(id,) as Report;
  assert(report !== null, `relatório ${id} ausente`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const re = factory(report,);
  re.generateIntermediateFormat();
  return re;
}

/** Trecho do template a partir da linha pedida (até o fecho do bloco). */
function blockAfter(text: string, start: string,): string {
  const idx = text.indexOf(start,);
  if (idx < 0) return "";
  const rest = text.slice(idx,);
  const end = rest.indexOf("    # }",);
  return end < 0 ? rest : rest.slice(0, end,);
}

/** `TimeSheetSummary` com o `applySheet` exposto para o teste do agregado. */
class TestSummary extends TimeSheetSummary {
  runTally(sheet: string,): MaterialStatusTally {
    const parsed = this.applySheet(sheet,) as TimeSheet;
    return this.tallyMaterials(parsed,);
  }
}

describe("18.17.4/18.17.10 — material no template do time sheet", () => {
  it("lista um esqueleto material por alocação da tarefa", () => {
    const project = buildReportProject();
    const tpl = generate(project, "tpl", (r,) => new TimeSheetReport(r,),)
      .to_tjp();

    assertStringIncludes(tpl, "    # Material: Steel\n",);
    assertStringIncludes(tpl, "    # material steel {\n",);
    assertStringIncludes(tpl, "    #   work 100.0\n",);
    assertStringIncludes(tpl, "    #   unitprice 9.5\n",);
    assertStringIncludes(tpl, "    # Material: Paint\n",);
    assertStringIncludes(tpl, "    # material paint {\n",);
  });

  it("não reemite unitprice quando a alocação não declara preço", () => {
    const project = buildReportProject();
    const tpl = generate(project, "tpl", (r,) => new TimeSheetReport(r,),)
      .to_tjp();

    const paint = blockAfter(tpl, "    # material paint {",);
    assert(paint !== "", "bloco do paint ausente",);
    assertStringIncludes(paint, "    #   work 5.0\n",);
    assertEquals(paint.includes("unitprice",), false,);
  });

  it("o bloco emitido é aceito de volta pelo parser do sheet", () => {
    const project = buildReportProject();
    const parser = new ProjectFileParser();
    parser.project = project;
    // O esqueleto do sender, preenchido pelo executor (mesma indentação).
    parser.open(
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
    status green "Estrutura pronta"
    material steel {
      work 100.0
      unitprice 9.5
    }
  }
}
`,
      false,
      true,
    );
    const sheet = parser.parse("timeSheetFile",) as TimeSheet;
    assert(sheet !== null, "sheet não parseou",);

    const record = sheet.materialRecords[0]!;
    assertEquals(record.material?.id, "steel",);
    assertEquals(record.ownerTask?.id, "build",);
    assertEquals(record.work, 100,);
    assertEquals(record.unitPrice, 9.5,);
  });
});

describe("18.17.5 — resumo agrega status de material", () => {
  it("conta registros, status e níveis de alerta", () => {
    const project = buildReportProject();
    const summary = new TestSummary();
    summary.setProject(project,);

    const tally = summary.runTally(
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
    status green "Ok"
    material steel {
      work 5
      status yellow "Chegou"
    }
    material paint {
      work 2
      status red "Faltou"
    }
  }
}
`,
    );

    assertEquals(tally.records, 2,);
    assertEquals(tally.withStatus, 2,);
    assertEquals(tally.alerts, { yellow: 1, red: 1, },);
  });

  it("material sem status conta no total mas não nos alertas", () => {
    const project = buildReportProject();
    const summary = new TestSummary();
    summary.setProject(project,);

    const tally = summary.runTally(
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
    material steel {
      work 5
    }
  }
}
`,
    );

    assertEquals(tally, { records: 1, withStatus: 0, alerts: {}, },);
  });

  it("materialTallyText é vazio sem material e descreve os alertas", () => {
    assertEquals(
      materialTallyText({ records: 0, withStatus: 0, alerts: {}, },),
      "",
    );
    assertEquals(
      materialTallyText({ records: 2, withStatus: 1, alerts: { green: 1, }, },),
      "Materials: 2 reported, 1 with status (green: 1)\n",
    );
  });
});

describe("18.17.8 — status sheet lista materiais da tarefa", () => {
  it("emite work/remaining a partir de effortdone/effortleft do tracking", async () => {
    const project = buildReportProject();
    // A folha válida é aplicada ao cenário de tracking pelo checkTimeSheet.
    const tj = new TaskJuggler();
    tj.project = project;
    tj.setFileStore(
      fakeOpfs({ "sheets/dev.tji": MATERIAL_SHEET, },),
    );
    assertEquals(await tj.checkTimeSheet("sheets/dev.tji",), true,);

    const steel = project.material("steel",)!;
    assertEquals(steel.getForScenario("effortdone", 0,), 20,);
    assertEquals(steel.getForScenario("effortleft", 0,), 80,);

    const tpl = generate(project, "st", (r,) => new StatusSheetReport(r,),)
      .to_tjp();
    assertStringIncludes(tpl, "  task build {\n",);
    assertStringIncludes(tpl, "    # material steel {\n",);
    assertStringIncludes(tpl, "    #   work 20.0\n",);
    assertStringIncludes(tpl, "    #   remaining 80.0\n",);
  });

  it("lista as alocações mesmo sem consumo reportado", () => {
    const project = buildReportProject();
    const tpl = generate(project, "st", (r,) => new StatusSheetReport(r,),)
      .to_tjp();

    assertStringIncludes(tpl, "    # material steel {\n",);
    // Sem `effortdone`/`effortleft` as linhas de quantidade não aparecem.
    const block = blockAfter(tpl, "    # material steel {",);
    assertEquals(block.includes("#   work",), false,);
    assertEquals(block.includes("#   remaining",), false,);
  });

  it("tarefa sem material não ganha bloco", () => {
    const project = parseTjp(
      REPORT_PROJECT.replace("  material paint 5\n", "",).replace(
        "  material steel 100 unitprice 9.5\n",
        "",
      ),
    );
    assert(project.schedule(), "schedule() devolveu false",);
    const tpl = generate(project, "st", (r,) => new StatusSheetReport(r,),)
      .to_tjp();
    assertEquals(tpl.includes("# material ",), false,);
  });
});

describe("18.17.9 — folha aplicada vira MaterialBooking do cenário", () => {
  it("checkTimeSheet anexa o booking à tarefa dona com o preço informado", async () => {
    const project = buildReportProject();
    const tj = new TaskJuggler();
    tj.project = project;
    tj.setFileStore(fakeOpfs({ "sheets/dev.tji": MATERIAL_SHEET, },),);
    assertEquals(await tj.checkTimeSheet("sheets/dev.tji",), true,);

    const build = project.task("build",)!;
    const bookings = (build.getForScenario("materialbookings", 0,) ?? []) as
      | MaterialBooking[]
      | null;
    assert(bookings !== null && bookings.length === 1, "booking ausente",);
    const booking = bookings[0]!;
    assertEquals(booking.quantity, 20,);
    assertEquals(booking.unitPrice, 13,);
    assertEquals(booking.taskId, "build",);
  });
});
