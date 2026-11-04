/**
 * 16.4/16.5 — `Leave`, `LeaveList`, `LeaveAllowance` e `LeaveAllowanceList`
 * (Ruby `LeaveList.rb`, arquivo completo).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.4, 16.5)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import {
  isLeaveType,
  Leave,
  LeaveAllowance,
  LeaveAllowanceList,
  LeaveList,
  LeaveTypes,
} from "../../src/model/leave.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,) => TjTime.fromString(s,);
const iv = (a: string, b: string,) => new TimeInterval(D(a,), D(b,),);

describe("Leave (16.4.1)", () => {
  it("guarda tipo, intervalo e motivo", () => {
    const interval = iv("2026-12-24", "2026-12-26",);
    const leave = new Leave("holiday", interval, "Natal",);
    assertEquals(leave.type, "holiday",);
    assertEquals(leave.interval, interval,);
    assertEquals(leave.reason, "Natal",);
  });

  it("reason é opcional (default null)", () => {
    const leave = new Leave("annual", iv("2026-07-01", "2026-07-15",),);
    assertEquals(leave.reason, null,);
  });

  it("Leave.Types reproduz a tabela do Ruby", () => {
    assertEquals(Leave.Types, LeaveTypes,);
    assertEquals(LeaveTypes, {
      project: 1,
      annual: 2,
      special: 3,
      sick: 4,
      unpaid: 5,
      holiday: 6,
      unemployed: 7,
    },);
  });

  it("typeIdx devolve o índice de cada tipo (ordem = prioridade)", () => {
    const cases: Array<[string, number,]> = [
      ["project", 1,],
      ["annual", 2,],
      ["special", 3,],
      ["sick", 4,],
      ["unpaid", 5,],
      ["holiday", 6,],
      ["unemployed", 7,],
    ];
    for (const [type, idx,] of cases) {
      const leave = new Leave(type, iv("2026-01-01", "2026-01-02",),);
      assertEquals(leave.typeIdx(), idx, type,);
    }
  });

  it("rejeita tipo desconhecido com a mensagem do Ruby", () => {
    assertThrows(
      () => new Leave("vacation", iv("2026-01-01", "2026-01-02",),),
      Error,
      "Unsupported leave type vacation",
    );
  });

  it("rejeita chaves herdadas de Object (não é `in`)", () => {
    assertThrows(
      () => new Leave("constructor", iv("2026-01-01", "2026-01-02",),),
      Error,
      "Unsupported leave type constructor",
    );
    assert(!isLeaveType("toString",),);
  });

  it("to_s com motivo", () => {
    const leave = new Leave(
      "holiday",
      iv("2026-12-24", "2026-12-26",),
      "Natal",
    );
    assertEquals(
      leave.to_s(),
      'holiday "Natal" 2026-12-24-00:00-+0000 - 2026-12-26-00:00-+0000',
    );
  });

  it("to_s sem motivo mantém os dois espaços do Ruby", () => {
    const leave = new Leave("annual", iv("2026-07-01", "2026-07-02",),);
    assert(leave.to_s().startsWith("annual  ",), leave.to_s(),);
  });

  it("toString delega para to_s (join/interpolação)", () => {
    const leave = new Leave("sick", iv("2026-03-01", "2026-03-02",),);
    assertEquals(String(leave,), leave.to_s(),);
    assertEquals(`${leave}`, leave.to_s(),);
  });
});

describe("LeaveList (16.4.2)", () => {
  it("é uma lista de Leave (push + Array)", () => {
    const list = new LeaveList();
    assert(Array.isArray(list,),);
    assert(list instanceof LeaveList,);
    list.push(new Leave("annual", iv("2026-07-01", "2026-07-02",),),);
    assertEquals(list.length, 1,);
    assertEquals(list[0]!.typeIdx(), 2,);
  });

  it("join usa o to_s de cada Leave", () => {
    const list = new LeaveList();
    list.push(new Leave("holiday", iv("2026-12-24", "2026-12-25",), "Natal",),);
    assert(list.join(",",).startsWith('holiday "Natal" ',), list.join(",",),);
  });
});

describe("LeaveAllowance (16.4.3)", () => {
  it("guarda tipo, data e slots", () => {
    const a = new LeaveAllowance("annual", D("2026-01-01",), 10,);
    assertEquals(a.type, "annual",);
    assertEquals(a.slots, 10,);
    assertEquals(a.date.compareTo(D("2026-01-01",),), 0,);
  });

  it("aceita slots negativos (expiração)", () => {
    const a = new LeaveAllowance("annual", D("2026-01-01",), -4,);
    assertEquals(a.slots, -4,);
  });

  it("rejeita tipo desconhecido", () => {
    assertThrows(
      () => new LeaveAllowance("vacation", D("2026-01-01",), 10,),
      Error,
      "Unsupported leave type vacation",
    );
  });

  it("to_s imprime tipo, data e slots", () => {
    const a = new LeaveAllowance("annual", D("2026-01-01",), 10,);
    assertEquals(a.to_s(), "annual 2026-01-01-00:00-+0000 10",);
  });
});

describe("LeaveAllowanceList (16.4.3)", () => {
  it("balance soma os slots do tipo", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("annual", D("2026-01-01",), 10,),);
    assertEquals(
      list.balance("annual", D("2025-12-31",), D("2026-12-31",),),
      10,
    );
  });

  it("balance filtra por tipo", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("annual", D("2026-01-01",), 10,),);
    list.push(new LeaveAllowance("sick", D("2026-01-02",), 3,),);
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2026-02-01",),),
      10,
    );
    assertEquals(
      list.balance("sick", D("2026-01-01",), D("2026-02-01",),),
      3,
    );
  });

  it("balance usa [start, end) — end é exclusivo", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("annual", D("2026-01-01",), 10,),);
    list.push(new LeaveAllowance("annual", D("2026-02-01",), 5,),);
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2026-02-01",),),
      10,
    );
    assertEquals(
      list.balance("annual", D("2026-02-01",), D("2026-03-01",),),
      5,
    );
    // start é inclusivo.
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2026-03-01",),),
      15,
    );
  });

  it("slots negativos subtraem do saldo", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("annual", D("2026-01-01",), 10,),);
    list.push(new LeaveAllowance("annual", D("2026-06-01",), -4,),);
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2027-01-01",),),
      6,
    );
  });

  it("soma múltiplas provisões do mesmo tipo", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("special", D("2026-01-01",), 2,),);
    list.push(new LeaveAllowance("special", D("2026-02-01",), 3,),);
    list.push(new LeaveAllowance("special", D("2026-03-01",), 5,),);
    assertEquals(
      list.balance("special", D("2026-01-01",), D("2026-12-31",),),
      10,
    );
  });

  it("lista vazia e janela sem provisões devolvem 0", () => {
    const list = new LeaveAllowanceList();
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2027-01-01",),),
      0,
    );
    list.push(new LeaveAllowance("annual", D("2027-05-01",), 10,),);
    assertEquals(
      list.balance("annual", D("2026-01-01",), D("2027-01-01",),),
      0,
    );
  });

  it("balance rejeita tipo desconhecido", () => {
    const list = new LeaveAllowanceList();
    assertThrows(
      () => list.balance("vacation", D("2026-01-01",), D("2027-01-01",),),
      Error,
      "Unsupported leave type vacation",
    );
  });

  it("to_tjp emite uma provisão por linha", () => {
    const list = new LeaveAllowanceList();
    list.push(new LeaveAllowance("annual", D("2026-01-01",), 10,),);
    list.push(new LeaveAllowance("sick", D("2026-02-01",), -2,),);
    assertEquals(
      list.to_tjp(),
      "annual 2026-01-01-00:00-+0000 10,\n" +
        "sick 2026-02-01-00:00-+0000 -2",
    );
  });

  it("to_tjp vazio é string vazia", () => {
    assertEquals(new LeaveAllowanceList().to_tjp(), "",);
  });
});
