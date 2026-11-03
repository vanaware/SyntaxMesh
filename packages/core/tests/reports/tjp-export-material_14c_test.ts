/**
 * Testes do `export`/TjpExportRE com materiais (Fase 14 Complemento 14C.1.13).
 *
 * Cobre a extensão SyntaxMesh ao TjpExportRE: `definitions materials` emite
 * `material <id> "<nome>" { unit/unitprice/flags/note }` e
 * `taskattributes materialallocations` emite `material <id> <qtd>
 * [modificador] [unitprice <preço>]` e `taskattributes materialbookings`
 * emite `booking material <id> quantity <q> [unitprice <p>] on <data>` dentro
 * do bloco da tarefa (14C.11.8). O round-trip parse → export → parse preserva
 * os dados; sem materiais a saída não muda.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.13)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import type { Material, } from "../../src/model/material.ts";
import type { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import type { MaterialBooking, } from "../../src/model/material-booking.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";

const SOURCE = PROJECT_HEADER +
  "flags critical\n" +
  'material steel "steel" {\n' +
  '  unit "kg"\n' +
  "  unitprice 2.5\n" +
  "  flags critical\n" +
  "}\n" +
  'task t1 "T1" {\n' +
  "  start 2026-01-05\n" +
  "  end 2026-01-09\n" +
  "  material steel 200 onstart unitprice 3.5\n" +
  "}\n";

/** Monta um relatório de export pronto para uso. */
function exportReport(
  project: Project,
  definitions: string[],
  taskAttributes: string[],
): Report {
  const report = new Report(project, "tj", "export.tji", null,);
  report.set("start", TjTime.fromString("2026-01-01",),);
  report.set("end", TjTime.fromString("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("sortResources", [],);
  report.set("sortTasks", [],);
  report.set("definitions", definitions,);
  report.set("resourceAttributes", [],);
  report.set("taskAttributes", taskAttributes,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

describe("TjpExportRE com materiais (14C.1.13)", () => {
  it("exporta material e materialallocations e faz round-trip", () => {
    const parsed = parseProject(SOURCE,);
    assertEquals(
      parsed.threw,
      null,
      `messages=${parsed.messageIds.join(",",)}`,
    );
    const project = parsed.result as Project;

    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [
        "materialallocations",
      ],),
    ).to_tjp();

    // Declaração do material com os atributos canônicos.
    assert(tjp.includes('material steel "steel" {',), `declaração:\n${tjp}`,);
    assert(tjp.includes('unit "kg"',), `unit:\n${tjp}`,);
    assert(tjp.includes("unitprice 2.5",), `unitprice:\n${tjp}`,);
    // Alocação dentro do bloco da tarefa (modificador e preço próprios).
    assert(
      tjp.includes("material steel 200 onstart unitprice 3.5",),
      `alocação:\n${tjp}`,
    );

    // Round-trip: parse do export preserva material e flags. As tarefas ficam
    // de fora porque `DateAttribute#to_tjp` emite `date <valor>` (fiel ao
    // Ruby) — `start`/`end` nunca foram round-trip-áveis pelo TjpExportRE.
    const roundTrip = new TjpExportRE(
      exportReport(project, ["flags", "materials",], [],),
    ).to_tjp();
    const again = parseProject(PROJECT_HEADER + roundTrip,);
    assertEquals(
      again.messageIds,
      [],
      `round-trip falhou: ${again.messageIds.join(",",)}`,
    );
    const reparsed = again.result as Project;
    const steel = reparsed.material("steel",) as Material;
    assert(steel, "material steel re-importado",);
    assertEquals(steel.get("unit",), "kg",);
    assertEquals(steel.get("cost",), 2.5,);
    assertEquals(steel.getForScenario("flags", 0,), ["critical",],);

    const task = reparsed.task("t1",);
    assertEquals(task, null,);

    // A linha da alocação exportada, quando relida pelo parser, reconstrói o
    // `MaterialAllocation` com o modificador original.
    const allocationLine = tjp.split("\n",).find((line,) =>
      line.trim().startsWith("material steel 200",)
    );
    assert(allocationLine, `linha de alocação ausente:\n${tjp}`,);
    const allocParsed = parseProject(
      PROJECT_HEADER + roundTrip + 'task t1 "T1" {\n  ' +
        allocationLine!.trim() + "\n}\n",
    );
    assertEquals(
      allocParsed.messageIds,
      [],
      `alocação re-lida: ${allocParsed.messageIds.join(",",)}`,
    );
    const allocTask = (allocParsed.result as Project).task("t1",)!;
    const allocations = allocTask.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocations.length, 1,);
    const allocation = allocations[0]!;
    assertEquals(allocation.material.id, "steel",);
    assertEquals(allocation.quantity, 200,);
    assertEquals(allocation.modifier, "onstart",);
    assertEquals(allocation.unitPrice, 3.5,);
  });

  it("14C.11.8 exporta o booking de material e faz round-trip", () => {
    const parsed = parseProject(
      PROJECT_HEADER +
        'material steel "steel" {\n  unit "kg"\n  unitprice 2.5\n}\n' +
        'task t1 "T1" {\n  start 2026-01-05\n  end 2026-01-09\n' +
        "  material steel 200 onstart unitprice 3.5\n" +
        "  booking material steel quantity 40 unitprice 4.25 on 2026-02-10\n" +
        "}\n",
    );
    assertEquals(
      parsed.threw,
      null,
      `messages=${parsed.messageIds.join(",",)}`,
    );
    const project = parsed.result as Project;

    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [
        "materialallocations",
        "materialbookings",
      ],),
    ).to_tjp();

    assert(
      tjp.includes(
        "booking material steel quantity 40 unitprice 4.25 on 2026-02-10",
      ),
      `booking:\n${tjp}`,
    );

    // Round-trip: a linha exportada volta como `MaterialBooking` completo.
    const bookingLine = tjp.split("\n",).find((line,) =>
      line.trim().startsWith("booking material steel",)
    );
    assert(bookingLine, `linha de booking ausente:\n${tjp}`,);
    const again = parseProject(
      PROJECT_HEADER +
        'material steel "steel" {\n  unit "kg"\n  unitprice 2.5\n}\n' +
        'task t1 "T1" {\n  ' + bookingLine!.trim() + "\n}\n",
    );
    assertEquals(
      again.messageIds,
      [],
      `booking re-lido: ${again.messageIds.join(",",)}`,
    );
    const bookings = (again.result as Project).task("t1",)!.getForScenario(
      "materialbookings",
      0,
    ) as MaterialBooking[];
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.material.id, "steel",);
    assertEquals(bookings[0]!.quantity, 40,);
    assertEquals(bookings[0]!.unitPrice, 4.25,);
    assertEquals(
      String(bookings[0]!.date,),
      "2026-02-10",
    );
  });

  it("sem materiais a saída permanece sem menções a material", () => {
    const parsed = parseProject(
      PROJECT_HEADER + 'task t1 "T1" {\n  start 2026-01-05\n  duration 2d\n}\n',
    );
    assertEquals(
      parsed.threw,
      null,
      `messages=${parsed.messageIds.join(",",)}`,
    );
    const project = parsed.result as Project;
    assertEquals(project.materials.toArray().length, 0,);

    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [
        "materialallocations",
      ],),
    ).to_tjp();

    assert(tjp.includes('task t1 "T1" {',), `tarefa exportada:\n${tjp}`,);
    assert(!tjp.includes("material ",), `saída inesperada:\n${tjp}`,);
  });
});

/**
 * Onda D3 — round-trip da cauda temporal (`<modifier> <intervalos>`) nos
 * bookings de material e estoque: parse → export → parse preservam modifier,
 * intervalos e a contabilização por período. O `on <data>` legado segue ponto
 * não-temporal (coberto no teste 14C.11.8 acima).
 */
function materialBookings(
  src: string,
  taskId: string,
): MaterialBooking[] {
  const parsed = parseProject(src,);
  assertEquals(
    parsed.threw,
    null,
    `messages=${parsed.messageIds.join(",",)}`,
  );
  const project = parsed.result as Project;
  const tjp = new TjpExportRE(
    exportReport(project, ["flags", "materials", "tasks",], [
      "materialbookings",
    ],),
  ).to_tjp();
  const lines = tjp
    .split("\n",)
    .filter((l,) => l.trim().startsWith("booking material",))
    .map((l,) => "  " + l.trim());
  const again = parseProject(
    PROJECT_HEADER +
      'material ac "A" {\n  unit "kg"\n  unitprice 5\n}\n' +
      `task ${taskId} "T" {\n${lines.join("\n",)}\n}\n`,
  );
  assertEquals(
    again.messageIds,
    [],
    `round-trip: ${again.messageIds.join(",",)}\n${lines.join("\n",)}`,
  );
  return (again.result as Project).task(taskId,)!.getForScenario(
    "materialbookings",
    0,
  ) as MaterialBooking[];
}

const P_DAY = TjTime.fromString("2026-01-01",);
const P_END = TjTime.fromString("2026-12-31",);

describe("Onda D3: round-trip do booking temporal (export)", () => {
  it("perday preserva modifier e o intervalo de vários dias", () => {
    const bookings = materialBookings(
      PROJECT_HEADER +
        'material ac "A" {\n  unit "kg"\n  unitprice 5\n}\n' +
        'task t1 "T" {\n  booking material ac quantity 10 perday ' +
        "2026-01-01 - 2026-01-04\n}\n",
      "t1",
    );
    assertEquals(bookings.length, 1,);
    const b = bookings[0]!;
    assertEquals(b.quantity, 10,);
    assertEquals(b.tail.modifier, "perday",);
    assertEquals(b.isTemporal(), true,);
    assertEquals(String(b.tail.intervals[0]!.start,), "2026-01-01",);
    assertEquals(String(b.tail.intervals[0]!.end,), "2026-01-04",);
    // 3 dias cobertos × 10 = 30 no período todo.
    assertEquals(b.quantityInPeriod(P_DAY, P_END,), 30,);
  });

  it("distributed preserva múltiplos intervalos (faixa + data despida)", () => {
    const bookings = materialBookings(
      PROJECT_HEADER +
        'material ac "A" {\n  unit "kg"\n  unitprice 5\n}\n' +
        'task t1 "T" {\n  booking material ac quantity 200 distributed ' +
        "2026-02-01 - 2026-02-06, 2026-03-01\n}\n",
      "t1",
    );
    const b = bookings[0]!;
    assertEquals(b.tail.modifier, "distributed",);
    assertEquals(b.tail.intervals.length, 2,);
    assertEquals(String(b.tail.intervals[0]!.end,), "2026-02-06",);
    assertEquals(String(b.tail.intervals[1]!.start,), "2026-03-01",);
    // 5 + 1 = 6 dias cobertos; distributed espalha o valor cheio no período.
    assertEquals(b.quantityInPeriod(P_DAY, P_END,), 200,);
  });

  it("onend preserva o intervalo e concentra o valor no último dia", () => {
    const bookings = materialBookings(
      PROJECT_HEADER +
        'material ac "A" {\n  unit "kg"\n  unitprice 5\n}\n' +
        'task t1 "T" {\n  booking material ac quantity 30 onend ' +
        "2026-04-01 - 2026-04-05\n}\n",
      "t1",
    );
    const b = bookings[0]!;
    assertEquals(b.tail.modifier, "onend",);
    assertEquals(String(b.tail.intervals[0]!.end,), "2026-04-05",);
    // Período que só alcança o último dia coberto (04-04) ⇒ valor integral.
    assertEquals(
      b.quantityInPeriod(
        TjTime.fromString("2026-04-04",),
        TjTime.fromString("2026-04-04",),
      ),
      30,
    );
    // Período antes do fim coberto ⇒ 0.
    assertEquals(
      b.quantityInPeriod(
        TjTime.fromString("2026-04-01",),
        TjTime.fromString("2026-04-03",),
      ),
      0,
    );
  });

  it("estoque temporal faz round-trip pela forma do corpo do material", () => {
    const parsed = parseProject(
      PROJECT_HEADER +
        'account mats "M" {\naggregate materials\n}\n' +
        'material ac "A" {\n  unit "kg"\n  unitprice 5\n  chargeset mats 100%\n' +
        "  booking quantity -100 perday 2026-01-01 - 2026-01-04\n}\n",
    );
    assertEquals(parsed.threw, null, `${parsed.messageIds.join(",",)}`,);
    const project = parsed.result as Project;
    const tjp = new TjpExportRE(
      exportReport(project, ["flags", "materials", "tasks",], [],),
    ).to_tjp();
    const line = tjp
      .split("\n",)
      .find((l,) => l.trim().startsWith("booking quantity",));
    assert(line, `estoque ausente:\n${tjp}`,);
    assert(
      line!.includes("perday 2026-01-01 - 2026-01-04",),
      `cauda temporal:\n${line}`,
    );
    const again = parseProject(
      PROJECT_HEADER +
        'account mats "M" {\naggregate materials\n}\n' +
        'material ac "A" {\n  unit "kg"\n  unitprice 5\n  chargeset mats 100%\n' +
        "  " + line!.trim() + "\n}\n",
    );
    assertEquals(
      again.messageIds,
      [],
      `re-importação: ${again.messageIds.join(",",)}`,
    );
    const stock = (again.result as Project).material("ac",)!.getForScenario(
      "stockbookings",
      0,
    ) as MaterialBooking[];
    assertEquals(stock[0]!.quantity, -100,);
    assertEquals(stock[0]!.tail.modifier, "perday",);
    assertEquals(stock[0]!.isTemporal(), true,);
  });
});
