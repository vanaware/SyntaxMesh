import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { VERSION } from "../src/version.ts";

describe("VERSION", () => {
  it("version armazena versão", () => {
    assertEquals(VERSION, "0.0.0");
  });
});
