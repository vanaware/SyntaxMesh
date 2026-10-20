import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { VERSION } from "../src/version.ts";

describe("VERSION", () => {
  it("existe versão", () => {
    assertEquals(typeof VERSION === "string", true);
    assertEquals(VERSION.length > 0, true);
  });
});
