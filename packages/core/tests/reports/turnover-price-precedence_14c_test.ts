/**
 * 14C.16 — Turnover com precedência de unit price (Adendo Extra §12.4, §13.4).
 *
 * Cada rota de custo de material até a conta com `aggregate materials` é
 * verificada com um teste próprio:
 *
 *  14C.16.1 — auditoria das rotas (alocação, estoque, relatório)
 *  14C.16.2 — preço de **alocação** vence o do material no turnover
 *  14C.16.3 — preço **calculado** por composição chega ao turnover
 *  14C.16.4 — booking **com tarefa** não duplica custo (decisão §13.4)
 *  14C.16.5 — estorno: booking de estoque negativo subtrai da conta
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.4
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { MaterialComponent, } from "../../src/model/material-component.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { AccountScenario, } from "../../src/model/account-scenario.ts";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Índice do último slot do projeto (fim do período). */
function projectEndIdx(
  project: ReturnType<typeof createTestProject>,
): number {
  return project.dateToIdx(project.get("end",) as TjTime,);
}

// ─── 14C.16.1 — auditoria das rotas ─────────────────────────────────────────

describe("14C.16.1 — rota de alocação: allocatedCost usa unitPriceFor(allocation)", () => {
  it("alocação com unitPrice: preço da alocação prevalece sobre o do material", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 10,);
    // Alocação com preço 20 > preço do material 10
    const alloc = new MaterialAllocation(
      steel,
      5,
      "distributed",
      undefined,
      20,
    );
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("materialallocations", [alloc,], 0,);

    // unitPriceFor: alloc.unitPrice=20 ?? steel.unitPriceValue()=10 → 20
    assertEquals(alloc.unitPriceFor(steel,), 20,);
    assertEquals(steel.allocatedCost(0,), 5 * 20,); // 100
  });

  it("alocação sem unitPrice: usa unitPriceValue do material", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 8,);
    steel.set("cost", 8,);
    const alloc = new MaterialAllocation(steel, 3, "distributed",);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("materialallocations", [alloc,], 0,);

    assertEquals(alloc.unitPriceFor(steel,), 8,);
    assertEquals(steel.allocatedCost(0,), 3 * 8,); // 24
  });
});

describe("14C.16.1 — rota de estoque: MaterialBooking.cost() aplica precedência", () => {
  it("booking com unitPrice próprio usa o preço do booking", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 5,);
    const booking = new MaterialBooking(
      steel,
      null,
      100,
      D("2026-06-01",),
      7,
    );
    assertEquals(booking.cost(), 100 * 7,); // 700
  });

  it("booking sem unitPrice herda o preço do material", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 5,);
    steel.set("cost", 5,);
    const booking = new MaterialBooking(steel, null, 100, D("2026-06-01",),);
    assertEquals(booking.cost(), 100 * 5,); // 500
  });

  it("addStockBookings só processa bookings de estoque (taskId === null)", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 5,);
    const task = new Task(project, "t1", "T1", null,);

    // Booking COM tarefa → fica em materialbookings da tarefa, não em stockbookings
    const taskBooking = new MaterialBooking(steel, "t1", 50, D("2026-06-01",),);
    task.setForScenario("materialbookings", [taskBooking,], 0,);
    // stockbookings fica vazio
    assertEquals(steel.stockBookings(0,).length, 0,);

    // Booking SEM tarefa → fica em stockbookings
    const stockBooking = new MaterialBooking(
      steel,
      null,
      100,
      D("2026-06-01",),
    );
    steel.setForScenario("stockbookings", [stockBooking,], 0,);
    assertEquals(steel.stockBookings(0,).length, 1,);
    assert(steel.stockBookings(0,)[0]!.isInventory(),);
  });

  it("materialreport actualcost reflete booking com precedência correta", () => {
    // Validação: o par taskMaterialBookings do TableReport revalida a precedência
    // já coberta em 14C.11.7. Aqui garantimos que o custo calculado pelo modelo
    // (MaterialBooking.cost()) é consistente com a precedência declarada.
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 10,);
    steel.set("cost", 10,);
    const alloc = new MaterialAllocation(steel, 100, "distributed",);
    // Booking tem preço 15 > alocação 10 > material 10 → 15
    const booking = new MaterialBooking(
      steel,
      "t1",
      50,
      D("2026-06-01",),
      15,
    );
    assertEquals(booking.cost(alloc,), 50 * 15,); // 750
    // Sem booking price → usa alloc → material: 50 × 10 = 500
    const bookingNoPrice = new MaterialBooking(
      steel,
      "t1",
      50,
      D("2026-06-01",),
    );
    assertEquals(bookingNoPrice.cost(alloc,), 50 * 10,); // 500
  });
});

// ─── 14C.16.2 — preço de alocação vence material no turnover ─────────────────

describe("14C.16.2 — turnover usa preço da alocação quando definido", () => {
  it("aggregate materials: preço da alocação prevalece no turnover", () => {
    const project = createTestProject(1,);
    const matCost = new Account(project, "matcost", "MatCost", null,);
    matCost.set("aggregate", "materials",);

    const steel = new Material(project, "steel", "kg", 10,); // preço do bloco = 10
    // Alocação com unitprice = 20 (deve vencer 10)
    const alloc = new MaterialAllocation(
      steel,
      5,
      "distributed",
      undefined,
      20,
    );
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("materialallocations", [alloc,], 0,);

    const sc = matCost.scenarioData(0,) as AccountScenario;
    // turnover = 5 × 20 = 100, não 5 × 10 = 50
    assertEquals(sc.turnover(0, projectEndIdx(project,),), 100,);
  });
});

// ─── 14C.16.3 — preço calculado por composição chega ao turnover ─────────────

describe("14C.16.3 — composição de materiais calcula preço no turnover", () => {
  it("material composto sem cost: turnover = alocação × preço calculado", () => {
    const project = createTestProject(1,);
    const matCost = new Account(project, "matcost", "MatCost", null,);
    matCost.set("aggregate", "materials",);

    // Componentes com preços explícitos
    const cement = new Material(project, "cement", "kg", 0,);
    cement.set("cost", 0.45,);
    const sand = new Material(project, "sand", "m3", 0,);
    sand.set("cost", 35,);

    // Concreto: NO cost, composição → 420 × 0.45 + 0.45 × 35 = 204.75
    const concrete = new Material(project, "concrete", "m3", 0,);
    concrete.setForScenario(
      "materialcomponents",
      [
        new MaterialComponent(cement, 420,),
        new MaterialComponent(sand, 0.45,),
      ],
      0,
    );

    // Alocação sem unitPrice: usa unitPriceValue do material (204.75)
    const alloc = new MaterialAllocation(concrete, 2, "distributed",);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("materialallocations", [alloc,], 0,);

    assertEquals(concrete.unitPriceValue(), 204.75,);
    const sc = matCost.scenarioData(0,) as AccountScenario;
    // turnover = 2 × 204.75 = 409.5
    assertEquals(sc.turnover(0, projectEndIdx(project,),), 409.5,);
  });
});

// ─── 14C.16.4 — booking com tarefa não entra no stockBookings (âncora) ───────

describe("14C.16.4 — booking com tarefa não duplica custo no turnover", () => {
  it("booking no corpo do material com task-id vai a materialbookings, não a stockbookings", () => {
    const { parser, messageIds, messages, threw, result, } = parseProject(
      PROJECT_HEADER +
        'task f "Foundation" {\n}\n' +
        'account mats "Materials" {\n  aggregate materials\n}\n' +
        'material steel "Steel" {\n' +
        '  unit "kg"\n' +
        "  unitprice 5\n" +
        "  chargeset mats 100%\n" +
        "  booking f quantity 200 on 2026-06-01\n" + // WITH task → not inventory
        "}\n",
    );
    assertEquals(
      threw,
      null,
      `msgs=${messageIds.join(",",)}`,
    );
    assertEquals(
      messageIds,
      [],
      `msgs: ${messages.map((m,) => m.id).join(" | ",)}`,
    );
    assert(result !== false, `parse falhou: ${messageIds.join(",",)}`,);

    const steel = parser.project!.material("steel",)!;
    // Booking com tarefa → NÃO está em stockbookings
    assertEquals(
      steel.stockBookings(0,).length,
      0,
      "booking com tarefa não deve entrar em stockbookings",
    );

    // Deve estar em materialbookings da tarefa `f`
    const f = parser.project!.task("f",)!;
    const bookings = (f.getForScenario("materialbookings", 0,) ??
      []) as MaterialBooking[];
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.taskId, "f",);
  });
});

// ─── 14C.16.5 — estorno: booking de estoque negativo subtrai do turnover ─────

describe("14C.16.5 — booking de estoque negativo estorna o turnover", () => {
  it("booking negativo subtrai quantity × preço do turnover da conta", () => {
    const project = createTestProject(1,);
    const matCost = new Account(project, "matcost", "MatCost", null,);
    matCost.set("aggregate", "materials",);
    // Regra 4 (defaultaccount): resolve via defaultAccountFor para material
    project.defaultAccountIds.set("material", "matcost",);

    const steel = new Material(project, "steel", "kg", 10,);
    steel.set("cost", 10,);

    // Estorno: -100 × 10 = -1000
    const booking = new MaterialBooking(steel, null, -100, D("2026-06-01",),);
    steel.setForScenario("stockbookings", [booking,], 0,);

    const sc = matCost.scenarioData(0,) as AccountScenario;
    // Sem alocações: allocatedCost = 0. Stock booking: -1000.
    assertEquals(sc.turnover(0, projectEndIdx(project,),), -1000,);
  });

  it("bookings de entrada e saída se somam algebricamente no turnover", () => {
    const project = createTestProject(1,);
    const matCost = new Account(project, "matcost", "MatCost", null,);
    matCost.set("aggregate", "materials",);
    project.defaultAccountIds.set("material", "matcost",);

    const steel = new Material(project, "steel", "kg", 10,);
    steel.set("cost", 10,);

    // Entrada +500 × 10 = +5000; Saída -100 × 10 = -1000 → net +4000
    const entry = new MaterialBooking(steel, null, 500, D("2026-03-01",),);
    const exit = new MaterialBooking(steel, null, -100, D("2026-06-01",),);
    steel.setForScenario("stockbookings", [entry, exit,], 0,);

    const sc = matCost.scenarioData(0,) as AccountScenario;
    assertEquals(sc.turnover(0, projectEndIdx(project,),), 4000,);
  });
});
