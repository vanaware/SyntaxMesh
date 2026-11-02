/**
 * 14C.15.5–15.7 (revisão 2026-11-02) — gramática de `booking charge`.
 *
 * Formas aceitas (Adendo Extra §12.3, com a decisão da revisão):
 *
 * - corpo da tarefa: `booking charge ["<descrição>"] [value] <montante> on <data>`
 *   — **sem** referência de recurso (o booking de charge não consome esforço;
 *   a outra ponta da relação é a própria tarefa dona do bloco);
 * - corpo do recurso/material: `booking charge <tarefa> ["<descrição>"]
 *   [value] <montante> on <data>` — a referência é a tarefa e pode ser futura
 *   (fila `Project.pendingBookings`, 14C.15.7).
 *
 * O montante entra em `chargebookings` da tarefa, com `description` livre e
 * sinal (negativo = estorno, como `signedNumber` do booking de estoque).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.3
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import type { ChargeBooking, } from "../../src/model/charge-booking.ts";
import { Resource, } from "../../src/model/resource.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

function chargeBookingsOf(
  parser: ReturnType<typeof parseProject>["parser"],
  taskId: string,
): ChargeBooking[] {
  return (parser.project!.task(taskId,)!.getForScenario(
    "chargebookings",
    0,
  ) ?? []) as ChargeBooking[];
}

describe("14C.15.5 booking charge no corpo da tarefa", () => {
  it("forma sem referência nem descrição", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\nbooking charge 48000 on 2026-02-15\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const bookings = chargeBookingsOf(parser, "t",);
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.amount, 48000,);
    assertEquals(bookings[0]!.description, null,);
    assertEquals(bookings[0]!.owner, null,);
    assertEquals(bookings[0]!.task, parser.project!.task("t",),);
  });

  it("keyword `value` opcional continua aceita", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'task t "T" {\nbooking charge value 48000 on 2026-02-15\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assertEquals(chargeBookingsOf(parser, "t",)[0]!.amount, 48000,);
  });

  it("descrição opcional antes do montante", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'task t "T" {\nbooking charge "Licenças" 48000 on 2026-02-15\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const booking = chargeBookingsOf(parser, "t",)[0]!;
    assertEquals(booking.amount, 48000,);
    assertEquals(booking.description, "Licenças",);
  });

  it("descrição + value + estorno negativo", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'task t "T" {\nbooking charge "Estorno" value -1200 on 2026-02-15\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const booking = chargeBookingsOf(parser, "t",)[0]!;
    assertEquals(booking.amount, -1200,);
    assertEquals(booking.description, "Estorno",);
    assertEquals(String(booking.date,), "2026-02-15",);
  });

  it("referência de recurso é rejeitada (revisão 2026-11-02)", () => {
    const { messageIds, result, } = parseProject(
      PROJECT_HEADER +
        'resource eng "E" {\n}\n' +
        'task t "T" {\nbooking charge eng 48000 on 2026-02-15\n}\n',
    );
    assert(
      result === false || messageIds.length > 0,
      "esperava erro para referência de recurso",
    );
  });
});

describe("14C.15.6–15.7 booking charge com descrição (recurso/material)", () => {
  it("recurso: <tarefa> <descrição> <montante>", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task f "Foundation" {\n}\n' +
        'resource r "R" {\nbooking charge f "ajuda de custo" 48000 on ' +
        "2026-02-15\n}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const booking = chargeBookingsOf(parser, "f",)[0]!;
    assertEquals(booking.amount, 48000,);
    assertEquals(booking.description, "ajuda de custo",);
    assert(booking.owner instanceof Resource, "owner deve ser o recurso",);
  });

  it("material: referência futura de tarefa por ID + descrição", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'material m "M" {\nunit "kg"\nbooking charge late2 "frete" 1200 ' +
        "on 2026-02-15\n}\n" +
        'task late2 "Late" {\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assertEquals(parser.project!.pendingBookings.length, 0, "fila drenada",);
    const booking = chargeBookingsOf(parser, "late2",)[0]!;
    assertEquals(booking.amount, 1200,);
    assertEquals(booking.description, "frete",);
    assertEquals(booking.task, parser.project!.task("late2",),);
  });

  it("tarefa desconhecida na referência continua erro", () => {
    const { messageIds, result, } = parseProject(
      PROJECT_HEADER +
        'resource r "R" {\nbooking charge no_such "x" 100 on 2026-02-15\n}\n',
    );
    assert(
      result === false || messageIds.includes("unknown_task",),
      `esperava unknown_task, veio ${messageIds.join(",",)}`,
    );
  });
});
