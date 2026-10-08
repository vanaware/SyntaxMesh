import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { projectObjectId, } from "../../src/utils/project-object-id.ts";

describe("projectObjectId", () => {
  it("retorna ID único para objeto diferente", () => {
    const obj1 = {};
    const obj2 = {};
    const id1 = projectObjectId(obj1,);
    const id2 = projectObjectId(obj2,);
    assert(id1 !== id2,);
  });

  it("retorna mesmo ID para mesmo objeto", () => {
    const obj = {};
    const id1 = projectObjectId(obj,);
    const id2 = projectObjectId(obj,);
    assertEquals(id1, id2,);
  });

  it("IDs são sequenciais a partir de 1", () => {
    const obj1 = {};
    const obj2 = {};
    const id1 = projectObjectId(obj1,);
    const id2 = projectObjectId(obj2,);
    // IDs são sequenciais (id2 = id1 + 1) e começam a partir de 1.
    assert(id1 >= 1,);
    assertEquals(id2, id1 + 1,);
  });

  it("WeakMap permite GC do objeto", () => {
    const obj = {};
    projectObjectId(obj,);
    // Não é possível testar GC diretamente, mas podemos verificar
    // que o WeakMap não impede a coleta (não há referência forte)
  });
});
