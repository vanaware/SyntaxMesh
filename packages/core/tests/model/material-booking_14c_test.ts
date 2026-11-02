/**
 * 14C.11.3 — `MaterialBooking` (consumo realizado) e o atributo de cenário
 * `materialbookings` da tarefa.
 *
 * O booking é o par factual da `MaterialAllocation`: a alocação descreve o
 * consumo planejado distribuído no tempo, o booking registra o consumo real
 * de um dia com preço unitário próprio. A precedência do preço efetivo é
 * booking → alocação → material (`MaterialBooking#unitPriceFor`).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

describe("14C.11.3 MaterialBooking", () => {
  it("rejeita quantidade negativa e preserva quantidade/data", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2.5,);

    assertThrows(
      () => new MaterialBooking(steel, "t1", -1, D("2026-01-05",),),
      Error,
      "Material booking quantity cannot be negative",
    );

    const booking = new MaterialBooking(
      steel,
      "t1",
      4,
      D("2026-01-05",),
    );
    assertEquals(booking.material, steel,);
    assertEquals(booking.taskId, "t1",);
    assertEquals(booking.quantity, 4,);
    assertEquals(booking.date.toSeconds(), D("2026-01-05",).toSeconds(),);
    assertEquals(booking.unitPrice, undefined,);
    assertEquals(booking.task, null,);
  });

  it("preço efetivo: booking → alocação → material", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2.5,);
    // Alocação sem preço próprio: herda o do material.
    const plain = new MaterialAllocation(steel, 10, "distributed",);
    // Alocação com preço próprio.
    const priced = new MaterialAllocation(
      steel,
      10,
      "distributed",
      undefined,
      4,
    );

    // Só o material define preço (2.5 do construtor).
    const inherited = new MaterialBooking(steel, "t1", 2, D("2026-01-05",),);
    assertEquals(inherited.unitPriceFor(), 2.5,);
    assertEquals(inherited.unitPriceFor(plain,), 2.5,);

    // A alocação preceda o material.
    assertEquals(inherited.unitPriceFor(priced,), 4,);

    // O booking preceda a alocação.
    const own = new MaterialBooking(steel, "t1", 2, D("2026-01-05",), 7,);
    assertEquals(own.unitPriceFor(priced,), 7,);
    assertEquals(own.cost(priced,), 14,);
  });

  it("resolveTask liga a referência futura e entra no atributo da tarefa", () => {
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2,);
    const task = new Task(project, "t1", "T1", null,);
    const booking = new MaterialBooking(steel, "t1", 3, D("2026-01-05",),);
    assertEquals(booking.task, null, "referência futura ainda não resolvida",);

    assertEquals(booking.resolveTask(project,), true,);
    assertEquals(booking.task, task,);
    // Segunda chamada é idempotente.
    assertEquals(booking.resolveTask(project,), true,);

    task.setForScenario("materialbookings", [booking,], 0,);
    const stored = task.getForScenario("materialbookings", 0,) as
      | MaterialBooking[]
      | undefined;
    assert(stored !== undefined, "atributo materialbookings não registrado",);
    assertEquals(stored!.length, 1,);
    assertEquals(stored![0], booking,);
  });
});
