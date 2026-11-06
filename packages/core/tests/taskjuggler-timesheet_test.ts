/**
 * `TaskJuggler.checkTimeSheet` / `checkStatusSheet` — 18.12.
 *
 * O Ruby chamava `tj3client check-ts` por subprocesso e imprimia o journal
 * compilado. Aqui o `.tji` chega por um `FileStore` injetado (ADR 037), a
 * validação roda in-process e o texto vai para `lastSheetReport`.
 *
 * O projeto da fixture (`timesheet/fixture.ts`) já é agendado de verdade — o
 * `TimeSheet#check` compara o total reportado com os slots realmente
 * trabalháveis do período, então não dá para usar um esqueleto qualquer.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.12
 */
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { JournalEntry, } from "../src/model/journal.ts";
import type { Project, } from "../src/model/project.ts";
import { MessageHandlerInstance, } from "../src/message-handler.ts";
import { TaskJuggler, } from "../src/taskjuggler.ts";
import { TjTime, } from "../src/time/tj-time.ts";
import { TimeSheet, } from "../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../src/timesheet/time-sheet-record.ts";
import { fakeOpfs, } from "./helpers/fake-opfs.ts";
import { parseProject, } from "./parser/parse-helper.ts";
import { buildFixture, intervalOf, } from "./timesheet/fixture.ts";

/** Nome do arquivo `.tji` usado nos testes. */
const SHEET_FILE = "sheets/dev.tji";

/**
 * Folha válida para o recurso `dev` na janela de 28 dias a partir de
 * 2026-01-01: 20 dias úteis (`work`) = os 160 slots que o `TimeSheet#check`
 * espera, `remaining` obrigatório porque `effortTask` tem esforço, e status
 * porque se trabalhou mais de um dia.
 */
const GOOD_SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    work 20d
    remaining 0d
    status green "Progresso normal"
  }
}
`;

/** Mesma folha, mas com total muito abaixo do período trabalhável. */
const LOW_WORK_SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    work 4d
    remaining 0d
    status green "Progresso normal"
  }
}
`;

/** Status sheet válido para `dev` na mesma janela. */
const GOOD_STATUS_SHEET = `statussheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    status green "Tudo certo"
  }
}
`;

/** Projeto mínimo sem `trackingscenario` — pré-requisito das duas checagens. */
const NO_TRACKING = `project prj "No Tracking" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}

resource dev "Developer"
task t1 "T"
`;

/** Projeto carregado sem `trackingscenario` definido. */
function projectWithoutTracking(): Project {
  const out = parseProject(NO_TRACKING,);
  assert(out.threw === null, `parse lançou: ${out.threw?.message}`,);
  return out.result as Project;
}

/** `TaskJuggler` apontando para `project`, com um store de um arquivo só. */
function makeTj(project: Project, content: string | null,): TaskJuggler {
  const tj = new TaskJuggler();
  tj.project = project;
  if (content !== null) {
    tj.setFileStore(fakeOpfs({ [SHEET_FILE]: content, },),);
  }
  return tj;
}

/** Zera o handler e devolve os IDs emitidos por `fn`. */
async function messageIdsOf(fn: () => Promise<void>,): Promise<string[]> {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  await fn();
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}

// ---------------------------------------------------------------------------
// 18.12.1–18.12.4 — checkTimeSheet
// ---------------------------------------------------------------------------
describe("TaskJuggler.checkTimeSheet (18.12.1–18.12.4)", () => {
  it("sem projeto lança antes de tocar no store", async () => {
    const tj = new TaskJuggler();
    await assertRejects(
      () => tj.checkTimeSheet(SHEET_FILE,),
      Error,
      "Project not set",
    );
  });

  it("sem FileStore registra critical e devolve false", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, null,);
    const ok = await tj.checkTimeSheet(SHEET_FILE,);
    assertEquals(ok, false,);
    assert(
      MessageHandlerInstance.instance.messages.some((m,) =>
        m.id === "check_time_sheet"
      ),
      "deveria registrar a mensagem do id check_time_sheet",
    );
  });

  it("arquivo ausente no store registra critical e devolve false", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, GOOD_SHEET,);
    const ok = await tj.checkTimeSheet("sheets/inexistente.tji",);
    assertEquals(ok, false,);
    assertStringIncludes(
      String(
        MessageHandlerInstance.instance.messages.at(-1,)?.message ?? "",
      ),
      "Cannot read sheets/inexistente.tji",
    );
  });

  it("sem trackingscenario registra critical e devolve false (Ruby l.300-303)", async () => {
    const project = projectWithoutTracking();
    const tj = makeTj(project, GOOD_SHEET,);
    const ids = await messageIdsOf(async () => {
      assertEquals(await tj.checkTimeSheet(SHEET_FILE,), false,);
    },);
    assert(ids.includes("check_time_sheet",),);
    assertStringIncludes(
      String(MessageHandlerInstance.instance.messages.at(-1,)?.message ?? "",),
      "No trackingscenario defined",
    );
  });

  it("descarta folhas e journal antigos antes de reaplicar (Ruby l.305-307)", async () => {
    const f = buildFixture();
    // Estado de uma execução anterior: uma folha e uma entrada de journal.
    const stale = new TimeSheet(f.dev, intervalOf("2026-01-01", 28,), 0,);
    new TimeSheetRecord(stale, f.durationTask,);
    f.project.timeSheets.push(stale,);
    f.project.journal.addEntry(
      new JournalEntry(
        f.project.journal,
        TjTime.fromString("2026-01-15",),
        "Entrada antiga",
        f.effortTask,
      ),
    );
    assertEquals(f.project.timeSheets.length, 1,);
    assertEquals(f.project.journal.entries.length, 1,);

    const tj = makeTj(f.project, GOOD_SHEET,);
    assertEquals(await tj.checkTimeSheet(SHEET_FILE,), true,);

    // Só a folha recém-parseada permanece, e o journal só tem o status dela.
    assertEquals(f.project.timeSheets.length, 1,);
    const sheet = f.project.timeSheets[0];
    assert(sheet !== undefined,);
    assertEquals(sheet.resource, f.dev,);
    assertEquals(sheet.records.length, 1,);
    assertEquals(
      f.project.journal.entries.map((e,) => e.headline),
      ["Progresso normal",],
    );
  });

  it("folha válida devolve true e publica o journal em lastSheetReport", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, GOOD_SHEET,);
    assertEquals(await tj.checkTimeSheet(SHEET_FILE,), true,);
    assertEquals(f.project.timeSheets.length, 1,);
    const report = tj.lastSheetReport;
    assert(report !== null, "lastSheetReport deveria ser preenchido",);
    assertStringIncludes(report, "Progresso normal",);
    // O `.tji` validado entra em `project.inputFiles` (Ruby l.110).
    assertEquals(f.project.inputFiles.includes(SHEET_FILE,), true,);
  });

  it("total reportado abaixo do período devolve false (ts_work_too_low)", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, LOW_WORK_SHEET,);
    const ids = await messageIdsOf(async () => {
      assertEquals(await tj.checkTimeSheet(SHEET_FILE,), false,);
    },);
    assert(ids.includes("ts_work_too_low",), `ids: ${ids.join(", ",)}`,);
    assertEquals(tj.lastSheetReport, null,);
  });

  it("sintaxe inválida devolve false sem publicar relatório", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, "timesheet dev {",);
    assertEquals(await tj.checkTimeSheet(SHEET_FILE,), false,);
    assertEquals(tj.lastSheetReport, null,);
  });
});

// ---------------------------------------------------------------------------
// 18.12.5–18.12.6 — checkStatusSheet
// ---------------------------------------------------------------------------
describe("TaskJuggler.checkStatusSheet (18.12.5–18.12.6)", () => {
  it("sem projeto lança", async () => {
    const tj = new TaskJuggler();
    await assertRejects(
      () => tj.checkStatusSheet(SHEET_FILE,),
      Error,
      "Project not set",
    );
  });

  it("sem trackingscenario devolve false com o critical do Ruby", async () => {
    const project = projectWithoutTracking();
    const tj = makeTj(project, GOOD_STATUS_SHEET,);
    const ids = await messageIdsOf(async () => {
      assertEquals(await tj.checkStatusSheet(SHEET_FILE,), false,);
    },);
    assert(ids.includes("check_status_sheet",),);
  });

  it("status sheet válido devolve true e publica o dashboard", async () => {
    const f = buildFixture();
    // `query_dashboard` varre as tarefas cujo `responsible` inclui o recurso.
    f.effortTask.setForScenario("responsible", [f.dev,], 0,);
    const tj = makeTj(f.project, GOOD_STATUS_SHEET,);
    assertEquals(await tj.checkStatusSheet(SHEET_FILE,), true,);
    const report = tj.lastSheetReport;
    assert(report !== null, "lastSheetReport deveria ser preenchido",);
    // O dashboard lista a tarefa do recurso, com o alerta do status.
    assertStringIncludes(report, "effortTask",);
  });

  it("não descarta o journal existente (diferença em relação ao time sheet)", async () => {
    const f = buildFixture();
    f.project.journal.addEntry(
      new JournalEntry(
        f.project.journal,
        TjTime.fromString("2026-01-15",),
        "Entrada preservada",
        f.effortTask,
      ),
    );
    const tj = makeTj(f.project, GOOD_STATUS_SHEET,);
    assertEquals(await tj.checkStatusSheet(SHEET_FILE,), true,);
    assert(
      f.project.journal.entries.some((e,) =>
        e.headline === "Entrada preservada"
      ),
      "o journal anterior deveria sobreviver ao status sheet",
    );
  });

  it("sintaxe inválida devolve false", async () => {
    const f = buildFixture();
    const tj = makeTj(f.project, "statussheet dev {",);
    assertEquals(await tj.checkStatusSheet(SHEET_FILE,), false,);
    assertEquals(tj.lastSheetReport, null,);
  });
});
