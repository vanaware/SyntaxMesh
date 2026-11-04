import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { deepClone, } from "../../src/utils/deep-clone.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { RealFormat, } from "../../src/format/real-format.ts";
import { Leave, LeaveAllowance, LeaveList, } from "../../src/model/leave.ts";
import {
  AlertLevelDefinition,
  DEFAULT_ALERT_LEVELS,
} from "../../src/model/alert-levels.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

describe("deepClone", () => {
  it("clona primitivos", () => {
    assertEquals(deepClone(42,), 42,);
    assertEquals(deepClone("hello",), "hello",);
    assertEquals(deepClone(true,), true,);
    assertEquals(deepClone(null,), null,);
    assertEquals(deepClone(undefined,), undefined,);
  });

  it("TjTime e RealFormat retornam mesma referência", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(deepClone(t,), t,);

    const rf = new RealFormat(["-", "", ",", ".", 2,],);
    assertEquals(deepClone(rf,), rf,);
  });

  it("objeto com método deepClone() chama o método", () => {
    const obj = {
      value: 42,
      deepClone(): unknown {
        return { value: this.value * 2, };
      },
    };
    const cloned = deepClone(obj,);
    assertEquals(cloned.value, 84,);
  });

  it("objeto com método deep_clone() chama o método", () => {
    const obj = {
      value: 42,
      deep_clone(): unknown {
        return { value: this.value * 2, };
      },
    };
    const cloned = deepClone(obj,);
    assertEquals(cloned.value, 84,);
  });

  it("Array clona recursivamente", () => {
    const arr = [1, "two", [3, 4,],];
    const cloned = deepClone(arr,);
    assertEquals(cloned, arr,);
    assert(cloned !== arr,);
    assert(cloned[2] !== arr[2],);
  });

  it("Map clona com valores clonados", () => {
    const map = new Map([["a", [1, 2,],], ["b", [3, 4,],],],);
    const cloned = deepClone(map,);
    assertEquals(cloned.get("a",), [1, 2,],);
    assertEquals(cloned.get("b",), [3, 4,],);
    assert(cloned !== map,);
  });

  it("Set clona", () => {
    const set = new Set([1, 2, 3,],);
    const cloned = deepClone(set,);
    assertEquals(cloned, set,);
    assert(cloned !== set,);
  });

  it("fallback genérico clona recursivamente", () => {
    const obj = { a: 1, b: { c: 2, }, };
    const cloned = deepClone(obj,);
    assertEquals(cloned, obj,);
    assert(cloned !== obj,);
    assert((cloned as { b: unknown }).b !== obj.b,);
  });

  it("referências circulares preservam estrutura (Ruby @clonedObject)", () => {
    const obj: Record<string, unknown> = { a: 1, };
    obj.self = obj;
    const cloned = deepClone(obj,) as Record<string, unknown>;
    assertEquals(cloned.a, 1,);
    assert(cloned !== obj,);
    // O ciclo se reconstrói dentro da cópia, não aponta para o original.
    assertEquals(cloned.self, cloned,);
  });

  it("instância de classe: cópia preserva protótipo e métodos", () => {
    class Ponto {
      x = 1;
      y = 2;
      tags: string[] = ["a",];
      soma(): number {
        return this.x + this.y;
      }
    }
    const p = new Ponto();
    const cloned = deepClone(p,);
    assert(cloned instanceof Ponto,);
    assertEquals(cloned.soma(), 3,);
    assert(cloned !== p,);
    assert(cloned.tags !== p.tags,);
    cloned.x = 10;
    assertEquals(p.x, 1,);
  });

  it("classe com deepClone() próprio devolve referência (PTN-like)", () => {
    class No {
      id = "n1";
      deepClone(): this {
        return this;
      }
    }
    const n = new No();
    assertEquals(deepClone(n,), n,);
  });

  it("objeto contendo função a mantém por referência (sem DOMException)", () => {
    const fn = () => 42;
    const holder = { callback: fn, nested: { fn, }, };
    const cloned = deepClone(holder,);
    assertEquals(cloned.callback, fn,);
    assertEquals(cloned.nested.fn, fn,);
  });
});

describe("deepClone — tipos da Fase 16 (16.13)", () => {
  const D = (s: string,) => TjTime.fromString(s,);
  const interval = () => new TimeInterval(D("2026-01-01",), D("2026-01-31",),);

  it("Leave imutável devolve a mesma referência (16.13.1)", () => {
    const leave = new Leave("annual", interval(), "férias",);
    assertEquals(deepClone(leave,), leave,);
    assert(deepClone(leave,) === leave,);
  });

  it("LeaveAllowance imutável devolve a mesma referência (16.13.1)", () => {
    const al = new LeaveAllowance("annual", D("2026-01-01",), 8,);
    assertEquals(deepClone(al,), al,);
    assert(deepClone(al,) === al,);
  });

  it("LeaveList é copiada como LeaveList compartilhando os Leaves", () => {
    const leave = new Leave("sick", interval(),);
    const list = new LeaveList();
    list.push(leave,);
    const cloned = deepClone(list,);
    assert(cloned instanceof LeaveList,);
    assert(cloned !== list,);
    assertEquals(cloned.length, 1,);
    assert(cloned[0] === leave,);
  });

  it("AlertLevelDefinition imutável devolve a mesma referência (16.13.2)", () => {
    const level = DEFAULT_ALERT_LEVELS[0] as AlertLevelDefinition;
    assertEquals(deepClone(level,), level,);
    assert(deepClone(level,) === level,);
  });

  it("JournalEntry devolve a mesma referência (16.13.3)", () => {
    const project = createTestProject(1,);
    const entry = new JournalEntry(
      project.journal,
      D("2026-02-01",),
      "marco",
      null,
    );
    assertEquals(deepClone(entry,), entry,);
    assert(deepClone(entry,) === entry,);
  });

  it("não duplica entradas no journal ao clonar (16.13.3)", () => {
    const project = createTestProject(1,);
    const entry = new JournalEntry(
      project.journal,
      D("2026-02-01",),
      "marco",
      null,
    );
    deepClone(entry,);
    assertEquals(project.journal.entryList.length(), 1,);
  });
});
