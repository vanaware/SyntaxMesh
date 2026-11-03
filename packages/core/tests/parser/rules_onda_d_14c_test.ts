/**
 * Onda D (fase-14-c-onda-d-booking-sintaxe-nomenclatura.md) — gramática.
 *
 * D4: keyword de tipo `booking resource <ref> <intervalo>` (com `effort` como
 * alias de leitura e a forma sem keyword canônica do TJ) e `unitprice`
 * opcional **antes** do modifier na alocação de material (D-g).
 *
 * D3 (D-c/D-d/D-e): cauda temporal `<modifier> <intervalos>` nos bookings de
 * charge (três origens), material e estoque — `on <data>` permanece o ponto
 * legado (`isTemporal() === false`).
 *
 * D2: `aggregate charges` (alias `tasks`) — coberto em rules_account_test.ts e
 * rules_scenario_test.ts; aqui só o booking/allocation.
 *
 * @see docs/syntaxmesh/fases/fase-14-c-onda-d-booking-sintaxe-nomenclatura.md §3
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Booking, } from "../../src/scheduling/booking.ts";
import { Resource, } from "../../src/model/resource.ts";
import type { ChargeBooking, } from "../../src/model/charge-booking.ts";
import type { MaterialBooking, } from "../../src/model/material-booking.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se o parse não produziu um). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assert(out.messageIds.length === 0, JSON.stringify(out.messages,),);
  return out.result as Project;
}

function bookingsOf(p: Project, taskId: string,): Booking[] {
  return p.task(taskId,)!.getForScenario("booking", 0,) as Booking[];
}

function allocationsOf(p: Project, taskId: string,): MaterialAllocation[] {
  return p.task(taskId,)!.getForScenario(
    "materialallocations",
    0,
  ) as MaterialAllocation[];
}

function chargeBookingsOf(p: Project, taskId: string,): ChargeBooking[] {
  return (p.task(taskId,)!.getForScenario("chargebookings", 0,) ??
    []) as ChargeBooking[];
}

function materialBookingsOf(p: Project, taskId: string,): MaterialBooking[] {
  return (p.task(taskId,)!.getForScenario("materialbookings", 0,) ??
    []) as MaterialBooking[];
}

const MATERIAL_AND_RESOURCE = PROJECT_HEADER +
  'resource john "John" {\n}\n' +
  'material ac "Aço" {\nunit "kg"\nunitprice 5\n}\n';

describe("Onda D4: booking resource <ref> (keyword de tipo)", () => {
  it("task: `booking resource <recurso> <intervalo>` cria o booking", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nbooking resource john 2026-01-01 - 2026-01-02\n}\n',
      ),
    );
    const bookings = bookingsOf(p, "t1",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.resource.fullId, "john",);
  });

  it("task: alias de leitura `booking effort …` permanece aceito", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nbooking effort john 2026-01-01 - 2026-01-02\n}\n',
      ),
    );
    assertEquals(bookingsOf(p, "t1",).length, 1,);
  });

  it("task: forma canônica sem keyword `booking <recurso> …`", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nbooking john 2026-01-01 - 2026-01-02\n}\n',
      ),
    );
    assertEquals(bookingsOf(p, "t1",).length, 1,);
  });

  it("resource: `booking resource <tarefa> <intervalo>` no corpo do recurso", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task t1 "T" {\n}\n' +
          'resource john "John" {\nbooking resource t1 2026-01-01 - 2026-01-02\n}\n',
      ),
    );
    const bookings = bookingsOf(p, "t1",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.resource.fullId, "john",);
  });
});

describe("Onda D4 (D-g): unitprice antes do modifier na alocação", () => {
  it("material <id> <q> unitprice <p> <modifier>", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nstart 2026-01-01\nmaterial ac 100 unitprice 4 onend\n}\n',
      ),
    );
    const allocs = allocationsOf(p, "t1",);
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.quantity, 100,);
    assertEquals(allocs[0]!.unitPrice, 4,);
    assertEquals(allocs[0]!.modifier, "onend",);
  });

  it("ordem antiga <modifier> unitprice <p> continua válida", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nstart 2026-01-01\nmaterial ac 100 onend unitprice 4\n}\n',
      ),
    );
    const allocs = allocationsOf(p, "t1",);
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.unitPrice, 4,);
    assertEquals(allocs[0]!.modifier, "onend",);
  });

  it("só unitprice (sem modifier): modifier default distributed", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nstart 2026-01-01\nmaterial ac 100 unitprice 4\n}\n',
      ),
    );
    const allocs = allocationsOf(p, "t1",);
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.unitPrice, 4,);
    assertEquals(allocs[0]!.modifier, "distributed",);
  });

  it("forma `use` também aceita unitprice antes do modifier", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nstart 2026-01-01\nuse ac 50 unitprice 6 perday\n}\n',
      ),
    );
    const allocs = allocationsOf(p, "t1",);
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.unitPrice, 6,);
    assertEquals(allocs[0]!.modifier, "perday",);
  });

  it("sem unitprice nem modifier: preço do material + distributed", () => {
    const p = project(
      parseProject(
        MATERIAL_AND_RESOURCE +
          'task t1 "T" {\nstart 2026-01-01\nmaterial ac 100\n}\n',
      ),
    );
    const allocs = allocationsOf(p, "t1",);
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.unitPrice, undefined,);
    assertEquals(allocs[0]!.modifier, "distributed",);
  });
});

// ------------------------------------------------------------------
// D3 (D-c/D-d/D-e) — cauda temporal `<modifier> <intervalos>`
// ------------------------------------------------------------------

describe("Onda D3: booking charge temporal (D-c)", () => {
  it("task: `value <n> perday <intervalo>` cria tail temporal", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\nbooking charge value 500 perday 2026-01-01 - 2026-01-04\n}\n',
      ),
    );
    const booking = chargeBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.amount, 500,);
    assertEquals(booking.tail.modifier, "perday",);
    assertEquals(booking.tail.intervals.length, 1,);
    assertEquals(booking.isTemporal(), true,);
    assertEquals(String(booking.date,), "2026-01-01",);
  });

  it("task: intervalos múltiplos com vírgula (distributed por default)", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\nbooking charge 1000 2026-01-01 - 2026-01-04, 2026-02-01\n}\n',
      ),
    );
    const booking = chargeBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.tail.modifier, "distributed",);
    assertEquals(booking.tail.intervals.length, 2,);
    assertEquals(booking.isTemporal(), true,);
  });

  it("task: `onstart`/`onend` explícitos sobre intervalo", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\n' +
          'booking charge "A" 100 onend 2026-01-01 - 2026-01-10\n' +
          'booking charge "B" 200 onstart 2026-02-01 - 2026-02-05\n}\n',
      ),
    );
    const [a, b,] = chargeBookingsOf(p, "t1",);
    assertEquals(a!.tail.modifier, "onend",);
    assertEquals(b!.tail.modifier, "onstart",);
    // onstart multi-dia é temporal (não é o ponto legado).
    assertEquals(a!.isTemporal(), true,);
    assertEquals(b!.isTemporal(), true,);
  });

  it("task: forma legado `on <data>` permanece ponto não-temporal", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\nbooking charge 48000 on 2026-02-15\n}\n',
      ),
    );
    const booking = chargeBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.isTemporal(), false,);
    assertEquals(booking.tail.modifier, "onstart",);
    assertEquals(String(booking.date,), "2026-02-15",);
    // Valor cheio quando o ponto cai no período; zero fora.
    assertEquals(
      booking.amountInPeriod(
        TjTime.fromString("2026-02-01",),
        TjTime.fromString("2026-02-28",),
      ),
      48000,
    );
    assertEquals(
      booking.amountInPeriod(
        TjTime.fromString("2026-03-01",),
        TjTime.fromString("2026-03-31",),
      ),
      0,
    );
  });

  it("resource: origem aceita a cauda temporal", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\n}\n' +
          'resource john "John" {\n' +
          "booking charge t1 900 perweek 2026-03-01 - 2026-03-31\n}\n",
      ),
    );
    const booking = chargeBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.amount, 900,);
    assertEquals(booking.tail.modifier, "perweek",);
    assert(booking.owner instanceof Resource, "owner deve ser o recurso",);
  });

  it("material: origem aceita a cauda temporal", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t2 "T2" {\n}\n' +
          'material ac "Aço" {\nunit "kg"\nunitprice 5\n' +
          "booking charge t2 300 onend 2026-04-01 - 2026-04-10\n}\n",
      ),
    );
    const booking = chargeBookingsOf(p, "t2",)[0]!;
    assertEquals(booking.amount, 300,);
    assertEquals(booking.tail.modifier, "onend",);
    assertEquals(booking.isTemporal(), true,);
  });
});

describe("Onda D3: booking material e estoque temporais (D-d/D-e)", () => {
  it("task: `booking material <id> quantity <q> perday <intervalo>`", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'material ac "Aço" {\nunit "kg"\nunitprice 5\n}\n' +
          'task t1 "T" {\nbooking material ac quantity 10 perday ' +
          "2026-01-01 - 2026-01-04\n}\n",
      ),
    );
    const booking = materialBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.quantity, 10,);
    assertEquals(booking.tail.modifier, "perday",);
    assertEquals(booking.isTemporal(), true,);
  });

  it("task: cauda sem modifier ⇒ distributed", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'material ac "Aço" {\nunit "kg"\nunitprice 5\n}\n' +
          'task t1 "T" {\nbooking material ac quantity 10 ' +
          "2026-01-01 - 2026-01-11\n}\n",
      ),
    );
    assertEquals(
      materialBookingsOf(p, "t1",)[0]!.tail.modifier,
      "distributed",
    );
  });

  it("material body: estoque com cauda temporal (estorno negativo ok)", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'account mats "M" {\naggregate materials\n}\n' +
          'material ac "Aço" {\nunit "kg"\nunitprice 5\nchargeset mats 100%\n' +
          "booking quantity -100 perday 2026-01-01 - 2026-01-04\n}\n",
      ),
    );
    const bookings = (p.material("ac",)!.getForScenario(
      "stockbookings",
      0,
    ) ?? []) as MaterialBooking[];
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.quantity, -100,);
    assertEquals(bookings[0]!.isTemporal(), true,);
    assertEquals(bookings[0]!.isInventory(), true,);
  });

  it("material body: consumo por tarefa com `on <data>` legado intacto", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'task t1 "T" {\n}\n' +
          'material ac "Aço" {\nunit "kg"\nunitprice 5\n' +
          "booking t1 quantity 40 unitprice 4.25 on 2026-02-10\n}\n",
      ),
    );
    const booking = materialBookingsOf(p, "t1",)[0]!;
    assertEquals(booking.isTemporal(), false,);
    assertEquals(String(booking.date,), "2026-02-10",);
    assertEquals(booking.unitPrice, 4.25,);
  });
});
