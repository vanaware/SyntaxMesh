/**
 * Unit tests of the pure trust gate (22.7.5). BDD + `@std/assert`,
 * no `vscode` runtime — the gate is a pair of functions over a boolean.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { assertTrusted, canRun, UNTRUSTED_MESSAGE, } from "../src/trust.ts";

describe("trust gate", () => {
  it("allows commands in a trusted workspace", () => {
    assertEquals(canRun(true,), true,);
    assertTrusted(true,); // does not throw
  });

  it("blocks commands in an untrusted workspace", () => {
    assertEquals(canRun(false,), false,);
    assertThrows(() => assertTrusted(false,), Error, UNTRUSTED_MESSAGE,);
  });
});
