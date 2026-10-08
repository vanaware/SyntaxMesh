import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { DataCache, } from "../../src/scheduling/data-cache.ts";

describe("DataCache", () => {
  let cache: DataCache;

  beforeEach(() => {
    cache = DataCache.instance;
    cache.reset();
  },);

  it("constructor inicializa cache vazio", () => {
    assertEquals(cache.entryCount, 0,);
    assertEquals(cache.hitCount, 0,);
    assertEquals(cache.missCount, 0,);
    assertEquals(cache.collisionCount, 0,);
  });

  it("cached computa valor se não presente", () => {
    const result = cache.cached(["key1",], () => "value1",);
    assertEquals(result, "value1",);
    assertEquals(cache.entryCount, 1,);
    assertEquals(cache.missCount, 1,);
  });

  it("cached retorna valor armazenado se presente", () => {
    cache.cached(["key1",], () => "value1",);
    const result = cache.cached(["key1",], () => "value2",);
    assertEquals(result, "value1",);
    assertEquals(cache.hitCount, 1,);
    assertEquals(cache.missCount, 1,);
  });

  it("cached computa valor para args complexos", () => {
    const args = ["key", 123, { nested: "object", }, [1, 2, 3,],];
    const result = cache.cached(args, () => "complexValue",);
    assertEquals(result, "complexValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached respeita limite de tamanho (highWaterMark)", () => {
    cache.resize(10,);
    for (let i = 0; i < 25; i++) {
      cache.cached([i,], () => `value${i}`,);
    }
    // Eviction keeps size bounded at highWaterMark.
    assert(cache.entryCount <= 10,);
    assert(cache.entryCount > 0,);
  });

  it("toString retorna estatísticas", () => {
    cache.cached(["key1",], () => "value1",);
    cache.cached(["key1",], () => "value1",);
    const stats = cache.toString();
    assert(stats.includes("Entries: 1",),);
    assert(stats.includes("Stores: 1",),);
    assert(stats.includes("Hits: 1",),);
    assert(stats.includes("Misses: 1",),);
  });

  it("entryCount retorna número de entradas", () => {
    assertEquals(cache.entryCount, 0,);
    cache.cached(["key1",], () => "value1",);
    assertEquals(cache.entryCount, 1,);
    cache.cached(["key2",], () => "value2",);
    assertEquals(cache.entryCount, 2,);
  });

  it("hitCount retorna número de hits", () => {
    assertEquals(cache.hitCount, 0,);
    cache.cached(["key1",], () => "value1",);
    cache.cached(["key1",], () => "value2",);
    assertEquals(cache.hitCount, 1,);
  });

  it("missCount retorna número de misses", () => {
    assertEquals(cache.missCount, 0,);
    cache.cached(["key1",], () => "value1",);
    cache.cached(["key2",], () => "value2",);
    assertEquals(cache.missCount, 2,);
  });

  it("collisionCount retorna número de colisões", () => {
    assertEquals(cache.collisionCount, 0,);
    cache.cached(["key1",], () => "value1",);
    cache.cached(["key2",], () => "value2",);
    assertEquals(cache.collisionCount, 0,);
  });

  it("cached computa valor para null e undefined", () => {
    const result1 = cache.cached(["keyNull",], () => null,);
    const result2 = cache.cached(["keyUndefined",], () => undefined,);
    assertEquals(result1, null,);
    assertEquals(result2, undefined,);
    assertEquals(cache.entryCount, 2,);
  });

  it("cached computa valor para função que retorna undefined", () => {
    const result = cache.cached(["key1",], () => undefined,);
    assertEquals(result, undefined,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para função que retorna null", () => {
    const result = cache.cached(["key1",], () => null,);
    assertEquals(result, null,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para função que retorna objeto", () => {
    const obj = { foo: "bar", num: 42, };
    const result = cache.cached(["key1",], () => obj,);
    assertEquals(result, obj,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para função que retorna array", () => {
    const arr = [1, 2, 3,];
    const result = cache.cached(["key1",], () => arr,);
    assertEquals(result, arr,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valores diferentes para args diferentes", () => {
    const result1 = cache.cached(["key1",], () => "value1",);
    const result2 = cache.cached(["key2",], () => "value2",);
    assertEquals(result1, "value1",);
    assertEquals(result2, "value2",);
    assertEquals(cache.entryCount, 2,);
  });

  it("cached respeita limite de tamanho com acesso frequente", () => {
    cache.resize(50,);
    for (let i = 0; i < 100; i++) {
      cache.cached([i,], () => `value${i}`,);
      if (i % 10 === 0) {
        cache.cached([i,], () => `value${i}`,);
      }
    }
    // Eviction keeps size bounded at highWaterMark.
    assert(cache.entryCount <= 50,);
    assert(cache.entryCount > 0,);
  });

  it("cached computa valor para args com tipos mistos", () => {
    const result1 = cache.cached(
      ["string", 123, true, null, undefined,],
      () => "mixed",
    );
    assertEquals(result1, "mixed",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com objetos aninhados", () => {
    const nested = { a: { b: { c: "deep", }, }, };
    const result = cache.cached(["nested",], () => nested,);
    assertEquals(result, nested,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com arrays aninhados", () => {
    const nested = [[1, 2,], [3, 4,],];
    const result = cache.cached(["nested",], () => nested,);
    assertEquals(result, nested,);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com datas", () => {
    const date = new Date("2026-01-01T09:00:00Z",);
    const result = cache.cached([date,], () => "dateValue",);
    assertEquals(result, "dateValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com regex", () => {
    const regex = /test/g;
    const result = cache.cached([regex,], () => "regexValue",);
    assertEquals(result, "regexValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com bigint", () => {
    const big = BigInt(123456789,);
    const result = cache.cached([big,], () => "bigintValue",);
    assertEquals(result, "bigintValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com set", () => {
    const set = new Set([1, 2, 3,],);
    const result = cache.cached([set,], () => "setValue",);
    assertEquals(result, "setValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com map", () => {
    const map = new Map([["a", 1,], ["b", 2,],],);
    const result = cache.cached([map,], () => "mapValue",);
    assertEquals(result, "mapValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com promise", () => {
    const promise = Promise.resolve("promiseValue",);
    const result = cache.cached([promise,], () => "promiseValue",);
    assertEquals(result, "promiseValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com regex complexo", () => {
    const regex = /test\d+/g;
    const result = cache.cached([regex,], () => "regexComplexValue",);
    assertEquals(result, "regexComplexValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com função anônima", () => {
    const fn = function () {
      return "anonymous";
    };
    const result = cache.cached([fn,], () => "anonymousValue",);
    assertEquals(result, "anonymousValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com arrow function", () => {
    const fn = () => "arrow";
    const result = cache.cached([fn,], () => "arrowValue",);
    assertEquals(result, "arrowValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com classe", () => {
    class TestClass {
      constructor(public value: string,) {}
    }
    const result = cache.cached(
      [TestClass,],
      () => new TestClass("classValue",),
    );
    assertEquals(result.value, "classValue",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com null e undefined juntos", () => {
    const result1 = cache.cached([null, undefined,], () => "nullUndefined",);
    assertEquals(result1, "nullUndefined",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com boolean e number juntos", () => {
    const result1 = cache.cached(
      [true, false, 0, 1, -1, 3.14,],
      () => "booleanNumber",
    );
    assertEquals(result1, "booleanNumber",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com string e number juntos", () => {
    const result1 = cache.cached(
      ["hello", 123, "world", 456,],
      () => "stringNumber",
    );
    assertEquals(result1, "stringNumber",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com array e object juntos", () => {
    const result1 = cache.cached([[1, 2,], { a: "b", },], () => "arrayObject",);
    assertEquals(result1, "arrayObject",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com função e símbolo juntos", () => {
    const sym = Symbol("test",);
    const fn = () => "function";
    const result1 = cache.cached([sym, fn,], () => "functionSymbol",);
    assertEquals(result1, "functionSymbol",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com regex e date juntos", () => {
    const date = new Date("2026-01-01T09:00:00Z",);
    const regex = /test/g;
    const result1 = cache.cached([date, regex,], () => "dateRegex",);
    assertEquals(result1, "dateRegex",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com bigint e set juntos", () => {
    const big = BigInt(123456789,);
    const set = new Set([1, 2, 3,],);
    const result1 = cache.cached([big, set,], () => "bigintSet",);
    assertEquals(result1, "bigintSet",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com map e promise juntos", () => {
    const map = new Map([["a", 1,],],);
    const promise = Promise.resolve("promise",);
    const result1 = cache.cached([map, promise,], () => "mapPromise",);
    assertEquals(result1, "mapPromise",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com regex e function juntos", () => {
    const regex = /test/g;
    const fn = () => "function";
    const result1 = cache.cached([regex, fn,], () => "regexFunction",);
    assertEquals(result1, "regexFunction",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com date e array juntos", () => {
    const date = new Date("2026-01-01T09:00:00Z",);
    const arr = [1, 2, 3,];
    const result1 = cache.cached([date, arr,], () => "dateArray",);
    assertEquals(result1, "dateArray",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com set e map juntos", () => {
    const set = new Set([1, 2, 3,],);
    const map = new Map([["a", 1,],],);
    const result1 = cache.cached([set, map,], () => "setMap",);
    assertEquals(result1, "setMap",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com bigint e regex juntos", () => {
    const big = BigInt(123456789,);
    const regex = /test/g;
    const result1 = cache.cached([big, regex,], () => "bigintRegex",);
    assertEquals(result1, "bigintRegex",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com promise e function juntos", () => {
    const promise = Promise.resolve("promise",);
    const fn = () => "function";
    const result1 = cache.cached([promise, fn,], () => "promiseFunction",);
    assertEquals(result1, "promiseFunction",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com class e object juntos", () => {
    class TestClass {
      constructor(public value: string,) {}
    }
    const obj = { foo: "bar", };
    const result1 = cache.cached([TestClass, obj,], () => "classObject",);
    assertEquals(result1, "classObject",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com symbol e bigint juntos", () => {
    const sym = Symbol("test",);
    const big = BigInt(123456789,);
    const result1 = cache.cached([sym, big,], () => "symbolBigint",);
    assertEquals(result1, "symbolBigint",);
    assertEquals(cache.entryCount, 1,);
  });

  it("cached computa valor para args com arrow function e function juntos", () => {
    const arrowFn = () => "arrow";
    const regularFn = function () {
      return "regular";
    };
    const result1 = cache.cached([arrowFn, regularFn,], () => "arrowRegular",);
    assertEquals(result1, "arrowRegular",);
    assertEquals(cache.entryCount, 1,);
  });
});
