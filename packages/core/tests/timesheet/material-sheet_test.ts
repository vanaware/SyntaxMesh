/**
 * Material em time/status sheets — 18.17.1/2/3/6/9/10.
 *
 * O TaskJuggler Ruby não tem `material` em sheets (o bloco é extensão
 * SyntaxMesh da Fase 10 Complemento §2.5/§6.3), então a fonte de verdade são
 * estes testes BDD — não há oracle `tj3`.
 *
 * O que fica provado aqui:
 *  - `TimeSheetRecord` aceita `Material` como alvo e trata `work`/`remaining`
 *    como **quantidades** (não slots/percentual);
 *  - quantidade de material não entra no total que a folha compara com os
 *    slots do período, nem no `warnOnDelta`;
 *  - `status` de material vira `JournalEntry` com `property = Material`,
 *    incluindo `picture`/`format`;
 *  - o bloco `material <id> { … }` é parseável no `.tji` e o registro carrega
 *    a tarefa dona;
 *  - o registro gera um `MaterialBooking` (com ou sem `unitprice`).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.17
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §2.5, §6.3
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { Material, } from "../../src/model/material.ts";
import { type MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import { messageIdsOf, } from "./fixture.ts";
import { parseProject, } from "../parser/parse-helper.ts";

/** Fixture com material alocado por uma tarefa de esforço (10d). */
const MATERIAL_PROJECT =
  `project prj "Sheet Material Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  timeformat "%Y-%m-%d"
  now 2026-01-01
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}

resource dev "Developer"

material steel "Steel" {
  unit "kg"
  unitprice 12.0
}

task build "Build" {
  effort 10d
  allocate dev
  material steel 100 unitprice 9.5
}
`;

interface MaterialFixture {
  project: Project;
  dev: Resource;
  build: Task;
  steel: Material;
}

/** Sobe a fixture (parse + schedule, porque `check` lê os slots do período). */
function buildMaterialFixture(): MaterialFixture {
  const out = parseProject(MATERIAL_PROJECT,);
  assert(out.threw === null, `parse lançou: ${out.threw?.message}`,);
  const project = out.result as Project;
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assert(project.schedule(), "schedule() devolveu false",);

  const steel = project.material("steel",);
  assert(steel !== null, "material steel ausente",);

  return {
    project,
    dev: project.resource("dev",) as Resource,
    build: project.task("build",) as Task,
    steel,
  };
}

/** Intervalo de 28 dias a partir de `date` (4 semanas, 20 dias úteis). */
function interval(date = "2026-01-01",): TimeInterval {
  const start = TjTime.fromString(date,);
  return new TimeInterval(start, start.addSeconds(28 * 24 * 60 * 60,),);
}

/** Sheet de `dev` com o `steel` como alvo de um registro. */
function materialSheet(f: MaterialFixture,): TimeSheet {
  return new TimeSheet(f.dev, interval(), 0,);
}

/** Parse de um `.tji` de time sheet no projeto já carregado. */
function parseTimeSheet(project: Project, content: string,): TimeSheet | null {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  const parser = new ProjectFileParser();
  parser.project = project;
  parser.open(content, false, true,);
  const result = parser.parse("timeSheetFile",);
  parser.close();
  return (result ?? null) as TimeSheet | null;
}

describe("18.17.1 — material como alvo do registro", () => {
  it("work de material é quantidade crua, não percentual nem slot", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);

    record.work = 10;
    assertEquals(record.work, 10,);
    record.work = 10.5;
    assertEquals(record.work, 10.5,);
    // Nenhum `percentToSlots` foi disparado.
    assertEquals(sheet.percentageUsed, false,);
    assertEquals(record.taskId, "steel",);
  });

  it("check do registro aceita material só com work (sem remaining/end/status)", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.work = 10;

    // Só o total da folha (`ts_work_too_low`) é esperado: o registro de
    // material não exige `remaining`, `end` nem `status`.
    assertEquals(messageIdsOf(() => record.check()), [],);
    assertEquals(messageIdsOf(() => sheet.check()), ["ts_work_too_low",],);
  });

  it("check de material sem work dispara ts_no_work", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    new TimeSheetRecord(sheet, f.steel,);

    const ids = messageIdsOf(() => sheet.check());
    assert(ids.includes("ts_no_work",), `veio: ${ids.join(", ",)}`,);
  });

  it("applyToScenario leva work→effortdone e remaining→effortleft", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.work = 42.5;
    record.remaining = 7.5;

    record.applyToScenario();

    assertEquals(f.steel.getForScenario("effortdone", 0,), 42.5,);
    assertEquals(f.steel.getForScenario("effortleft", 0,), 7.5,);
  });

  it("applyToScenario ignora registro de tarefa", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.build,);
    record.work = 8;

    record.applyToScenario();
    assertEquals(f.steel.getForScenario("effortdone", 0,), 0,);
  });
});

describe("18.17.2 — material fora dos totais da folha", () => {
  it("quantidade de material não entra no total do período", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const taskRecord = new TimeSheetRecord(sheet, f.build,);
    taskRecord.work = sheet.daysToSlots(20,);
    taskRecord.remaining = 0;
    const status = new JournalEntry(
      f.project.journal,
      sheet.interval.end,
      "Normal",
      f.build,
    );
    taskRecord.status = status;
    const materialRecord = new TimeSheetRecord(sheet, f.steel,);
    materialRecord.work = 10;

    const ids = messageIdsOf(() => sheet.check());
    assertEquals(ids, [],);
  });

  it("sem registro de tempo o total é 0 (material é ignorado)", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.work = 10;

    const ids = messageIdsOf(() => sheet.check());
    assert(ids.includes("ts_work_too_low",), `veio: ${ids.join(", ",)}`,);
  });

  it("warnOnDelta ignora registro de material", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.work = 10;
    record.ownerTask = f.build;

    const ids = messageIdsOf(() => sheet.warnOnDelta());
    assertEquals(ids, [],);
  });
});

describe("18.17.3/18.17.10 — parser do bloco material no sheet", () => {
  const SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
    material steel {
      work 5.5
      remaining 2
      unitprice 12.5
      status green "Aço recebido" {
        summary "Lote 1 no canteiro"
      }
    }
  }
}
`;

  it("parseia work/remaining/unitprice e prende a tarefa dona", () => {
    const f = buildMaterialFixture();
    const sheet = parseTimeSheet(f.project, SHEET,);
    assert(sheet !== null, "sheet não parseou",);
    // Um registro para a tarefa (que também reporta tempo) e um para o
    // material aninhado.
    assertEquals(sheet.records.length, 2,);
    assertEquals(sheet.records[0]!.task, f.build,);

    const record = sheet.materialRecords[0]!;
    assertEquals(record.material, f.steel,);
    assertEquals(record.ownerTask, f.build,);
    assertEquals(record.work, 5.5,);
    assertEquals(record.remaining, 2,);
    assertEquals(record.unitPrice, 12.5,);
    assertEquals(record.taskId, "steel",);
  });

  it("material no topo da folha não tem tarefa dona", () => {
    const f = buildMaterialFixture();
    const sheet = parseTimeSheet(
      f.project,
      `timesheet dev 2026-01-01 - 2026-01-29 {
  material steel {
    work 3
  }
}
`,
    );
    assert(sheet !== null, "sheet não parseou",);
    assertEquals(sheet.records.length, 1,);
    const record = sheet.materialRecords[0]!;
    assertEquals(record.material, f.steel,);
    assertEquals(record.ownerTask, null,);
    assertEquals(record.work, 3,);
  });

  it("status do material vira JournalEntry com property = Material", () => {
    const f = buildMaterialFixture();
    const sheet = parseTimeSheet(f.project, SHEET,);
    const record = sheet!.materialRecords[0]!;
    assert(record.status !== null, "status ausente",);
    assertEquals(record.status.property, f.steel,);
    assertEquals(record.status.headline, "Aço recebido",);
  });

  it("material desconhecido dispara ts_unknown_material", () => {
    const f = buildMaterialFixture();
    parseTimeSheet(
      f.project,
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    material inexistente {
      work 1
    }
  }
}
`,
    );
    const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
    assert(ids.includes("ts_unknown_material",), `veio: ${ids.join(", ",)}`,);
  });

  it("status com picture e format chega ao JournalEntry (18.17.6)", () => {
    const f = buildMaterialFixture();
    const sheet = parseTimeSheet(
      f.project,
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    material steel {
      work 1
      status green "Entrega" {
        picture "img/steel.png" {
          caption "Lote 1"
        }
        format richtext
      }
    }
  }
}
`,
    );
    const record = sheet!.materialRecords[0]!;
    const status = record.status as JournalEntry;
    assertEquals(status.pictures.length, 1,);
    assertEquals(status.pictures[0]!.caption, "Lote 1",);
    assertEquals(status.format, "richtext",);
  });

  it("folha sem material continua com um record de tarefa", () => {
    const f = buildMaterialFixture();
    const sheet = parseTimeSheet(
      f.project,
      `timesheet dev 2026-01-01 - 2026-01-29 {
  task build {
    work 20d
    remaining 0d
  }
}
`,
    );
    const record = sheet!.records[0]!;
    assertEquals(record.task, f.build,);
    assertEquals(record.material, null,);
    assertEquals(record.ownerTask, null,);
  });
});

describe("18.17.9 — registro de material vira MaterialBooking", () => {
  /** Registro de material já montado sobre a folha de `dev`. */
  function setup(f: MaterialFixture,): {
    sheet: TimeSheet;
    record: TimeSheetRecord;
  } {
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.ownerTask = f.build;
    record.work = 30;
    return { sheet, record, };
  }

  it("com unitprice: booking usa o preço informado e a tarefa dona", () => {
    const f = buildMaterialFixture();
    const { sheet, record, } = setup(f,);
    record.unitPrice = 12.5;

    const booking = record.applyMaterialBooking();
    assert(booking !== null, "booking não criado",);
    assertEquals(booking.quantity, 30,);
    assertEquals(booking.unitPrice, 12.5,);
    assertEquals(booking.taskId, "build",);
    assertEquals(booking.date.toSeconds(), sheet.interval.end.toSeconds(),);

    const stored = f.build.getForScenario("materialbookings", 0,) as
      | MaterialBooking[]
      | null;
    assertEquals(stored?.length, 1,);
    assertEquals(stored?.[0], booking,);
  });

  it("sem unitprice: booking herda alocação → material", () => {
    const f = buildMaterialFixture();
    const { record, } = setup(f,);

    const booking = record.applyMaterialBooking();
    assert(booking !== null, "booking não criado",);
    assertEquals(booking.unitPrice, undefined,);

    const allocations = (f.build.getForScenario("materialallocations", 0,) ??
      []) as MaterialAllocation[];
    const allocation = allocations[0]!;
    // Precedência booking → alocação (9.5) → material (12.0).
    assertEquals(booking.unitPriceFor(allocation,), 9.5,);
    assertEquals(booking.unitPriceFor(null,), 12.0,);
  });

  it("sem tarefa dona o booking vira movimento de estoque", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.steel,);
    record.work = 4;

    const booking = record.applyMaterialBooking();
    assert(booking !== null, "booking não criado",);
    assertEquals(booking.isInventory(), true,);
    const stock = f.steel.getForScenario("stockbookings", 0,) as
      | MaterialBooking[]
      | null;
    assertEquals(stock?.length, 1,);
  });

  it("registro de tarefa não gera booking de material", () => {
    const f = buildMaterialFixture();
    const sheet = materialSheet(f,);
    const record = new TimeSheetRecord(sheet, f.build,);
    record.work = 8;
    assertEquals(record.applyMaterialBooking(), null,);
  });
});
