/**
 * 14C.11.2 / 14C.11.4 / 14C.11.5 — gramática de `unitprice` na alocação e de
 * `booking` (consumo realizado) nas duas formas:
 *
 *  - corpo da tarefa: `booking material <id> quantity <q> [unitprice <p>] on <data>`
 *  - corpo do material: `booking <task-id-ou-nome> quantity <q> [unitprice <p>] on <data>`
 *
 * O `booking` do material pode referenciar uma tarefa declarada depois
 * (referência futura): o parser enfileira em `Project.pendingBookings` e o fim
 * da regra `project` resolve via `Project#flushPendingBookings()`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

const MATERIAL = 'material ac "Aço" {\nunit "kg"\nunitprice 5\n}\n';

function bookingsOf(
  parser: ReturnType<typeof parseProject>["parser"],
  taskId: string,
): MaterialBooking[] {
  return (parser.project!.task(taskId,)!.getForScenario(
    "materialbookings",
    0,
  ) ?? []) as MaterialBooking[];
}

describe("14C.11.2 unitprice na alocação de tarefa", () => {
  it("com modificador e preço: grava ambos", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL +
        'task t "T" {\nmaterial ac 100 perday unitprice 3.5\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const allocs = parser.project!.task("t",)!.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocs.length, 1,);
    assertEquals(allocs[0]!.quantity, 100,);
    assertEquals(allocs[0]!.modifier, "perday",);
    assertEquals(allocs[0]!.unitPrice, 3.5,);
  });

  it("sem preço: unitPrice fica indefinido (herda o do material)", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL + 'task t "T" {\nmaterial ac 100 perday\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const allocs = parser.project!.task("t",)!.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocs[0]!.unitPrice, undefined,);
    assertEquals(allocs[0]!.unitPriceFor(), 5,);
  });

  it("alias `use` aceita o preço e o modificador é opcional", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL + 'task t "T" {\nuse ac 50 unitprice 6\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const allocs = parser.project!.task("t",)!.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocs[0]!.modifier, "distributed",);
    assertEquals(allocs[0]!.unitPrice, 6,);
  });
});

describe("14C.11.4 booking de material no corpo da tarefa", () => {
  it("grava MaterialBooking com quantidade, preço e data", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL +
        'task t "T" {\nbooking material ac quantity 40 unitprice 4.25 on 2026-02-10\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const bookings = bookingsOf(parser, "t",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.material, parser.project!.material("ac",),);
    assertEquals(bookings[0]!.quantity, 40,);
    assertEquals(bookings[0]!.unitPrice, 4.25,);
    assertEquals(bookings[0]!.task, parser.project!.task("t",),);
    assertEquals(bookings[0]!.cost(), 40 * 4.25,);
  });

  it("sem `unitprice` herda o preço do material", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL +
        'task t "T" {\nbooking material ac quantity 10 on 2026-02-11\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const bookings = bookingsOf(parser, "t",);
    assertEquals(bookings[0]!.unitPrice, undefined,);
    assertEquals(bookings[0]!.unitPriceFor(), 5,);
    assertEquals(bookings[0]!.cost(), 50,);
  });

  it("não interfere no booking de recurso nem nas alocações", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + MATERIAL +
        'resource dev "Dev" {\n}\n' +
        'task t "T" {\nmaterial ac 100 perday\n' +
        "booking material ac quantity 5 on 2026-02-12\n}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assertEquals(bookingsOf(parser, "t",).length, 1,);
    const allocs = parser.project!.task("t",)!.getForScenario(
      "materialallocations",
      0,
    ) as MaterialAllocation[];
    assertEquals(allocs.length, 1,);
  });
});

describe("14C.11.5 booking no corpo do material (com referência futura)", () => {
  it("resolves a tarefa declarada depois via pendingBookings", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'material ac "Aço" {\nunit "kg"\nunitprice 5\n' +
        "booking t1 quantity 20 unitprice 3 on 2026-03-01\n}\n" +
        'task t1 "Depois" {\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assertEquals(parser.project!.pendingBookings.length, 0, "fila drenada",);
    const bookings = bookingsOf(parser, "t1",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.taskId, "t1",);
    assertEquals(bookings[0]!.task, parser.project!.task("t1",),);
    assertEquals(bookings[0]!.unitPrice, 3,);
    assertEquals(bookings[0]!.cost(), 60,);
  });

  it("aceita o nome da tarefa entre aspas e tarefa já declarada", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'task t1 "Escavação" {\n}\n' +
        'material ac "Aço" {\nunitprice 2\n' +
        'booking "Escavação" quantity 7 on 2026-03-02\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const bookings = bookingsOf(parser, "t1",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.quantity, 7,);
    assertEquals(bookings[0]!.unitPriceFor(), 2,);
  });
});
