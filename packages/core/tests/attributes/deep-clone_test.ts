import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { deepClone, } from "../../src/utils/deep-clone.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { RealFormat, } from "../../src/format/real-format.ts";

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

  it("fallback usa structuredClone", () => {
    const obj = { a: 1, b: { c: 2, }, };
    const cloned = deepClone(obj,);
    assertEquals(cloned, obj,);
    assert(cloned !== obj,);
    assert((cloned as { b: unknown }).b !== obj.b,);
  });

  it("referências circulares lançam erro", () => {
    const obj: Record<string, unknown> = { a: 1, };
    obj.self = obj;
    assertThrows(
      () => deepClone(obj,),
      Error,
    );
  });
});
