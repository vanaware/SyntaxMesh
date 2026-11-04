/**
 * Golden test de Leave/LeaveList/LeaveAllowanceList (Fase 16.19).
 *
 * Reproduz os casos de `scripts/golden/leaves.rb` (oracle Ruby):
 * `Leave#typeIdx`, `Leave#to_s` (com/sem motivo), ordem da `LeaveList`,
 * `LeaveAllowanceList#balance` (janela `[start, end)`, provisões negativas e
 * tipos misturados) e os erros de tipo inválido.
 *
 * O fuso é fixado em UTC (como no oracle) porque `TjTime#to_s` embute o
 * offset e `Leave#to_s` interpola o intervalo.
 *
 * @see scripts/golden/leaves.rb
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
 */
import { afterAll, beforeAll, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import {
  Leave,
  LeaveAllowance,
  LeaveAllowanceList,
  LeaveList,
  type LeaveTypeLike,
} from "../../src/model/leave.ts";

interface LeaveSpec {
  type: string;
  start: string;
  end: string;
  reason?: string | null;
}
interface AllowanceSpec {
  type: string;
  date: string;
  slots: number;
}
interface GoldenCase {
  description: string;
  method: "typeIdx" | "to_s" | "order" | "balance";
  input: {
    type?: string;
    start?: string;
    end?: string;
    reason?: string | null;
    leaves?: LeaveSpec[];
    allowances?: AllowanceSpec[];
  };
  expected: unknown;
  error: string | null;
}

function interval(spec: LeaveSpec,): TimeInterval {
  return new TimeInterval(
    TjTime.fromString(spec.start,),
    TjTime.fromString(spec.end,),
  );
}

function buildList(specs: LeaveSpec[],): LeaveList {
  const list = new LeaveList();
  for (const spec of specs) {
    list.push(
      new Leave(
        spec.type as LeaveTypeLike,
        interval(spec,),
        spec.reason ?? null,
      ),
    );
  }
  return list;
}

function buildAllowances(specs: AllowanceSpec[],): LeaveAllowanceList {
  const list = new LeaveAllowanceList();
  for (const spec of specs) {
    list.push(
      new LeaveAllowance(
        spec.type as LeaveTypeLike,
        TjTime.fromString(spec.date,),
        spec.slots,
      ),
    );
  }
  return list;
}

/** Executa o caso e devolve o valor, ou lança (para os casos de erro). */
function run(c: GoldenCase,): unknown {
  const input = c.input;
  switch (c.method) {
    case "typeIdx":
      return new Leave(
        input.type as LeaveTypeLike,
        interval(
          { ...input, start: "2026-01-01", end: "2026-01-02", } as LeaveSpec,
        ),
      ).typeIdx();
    case "to_s":
      return new Leave(
        input.type as LeaveTypeLike,
        interval(input as LeaveSpec,),
        input.reason ?? null,
      ).to_s();
    case "order":
      // `LeaveList extends Array`: `map` devolveria outra `LeaveList`
      // (species), então o array é materializado com `Array.from`.
      return Array.from(buildList(input.leaves ?? [],), (l,) => l.typeIdx(),);
    case "balance": {
      const allowances = buildAllowances(input.allowances ?? [],);
      return allowances.balance(
        input.type as LeaveTypeLike,
        TjTime.fromString(input.start!,),
        TjTime.fromString(input.end!,),
      );
    }
  }
}

function loadCases(): GoldenCase[] {
  const path = new URL("./leaves.golden.json", import.meta.url,);
  const parsed = JSON.parse(Deno.readTextFileSync(path,),) as {
    cases: GoldenCase[];
  };
  return parsed.cases;
}

describe("leaves golden (16.19)", () => {
  const previousZone = TjTime.getTimeZone();
  beforeAll(() => {
    TjTime.setTimeZone("UTC",);
  },);
  afterAll(() => {
    TjTime.setTimeZone(previousZone,);
  },);

  const cases = loadCases();

  it("tem pelo menos 15 casos", () => {
    assertEquals(cases.length >= 15, true,);
  });

  it("cobre typeIdx, to_s, order e balance", () => {
    const covered = new Set(cases.map((c,) => c.method),);
    for (const method of ["typeIdx", "to_s", "order", "balance",] as const) {
      assertEquals(covered.has(method,), true, `método ausente: ${method}`,);
    }
  });

  for (const c of cases) {
    it(c.description, () => {
      if (c.error !== null) {
        const err = assertThrows(() => run(c,), Error,);
        assertEquals(err.message, c.error,);
      } else {
        assertEquals(run(c,), c.expected,);
      }
    },);
  }
});
