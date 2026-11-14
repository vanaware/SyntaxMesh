/**
 * Unit tests of the pure status-bar projection (22.7.3). BDD + `@std/assert`,
 * no `vscode` runtime — the state is plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { statusText, } from "../../src/views/status-bar.ts";

describe("status-bar (22.7.3)", () => {
  it("renders the idle state without locale or report count", () => {
    assertEquals(statusText({ status: "idle", },), "SyntaxMesh: idle",);
  });

  it("renders the ok state with locale and last-execution report count", () => {
    assertEquals(
      statusText({ status: "ok", locale: "en", reportCount: 3, },),
      "SyntaxMesh: ok · en · 3 reports",
    );
    assertEquals(
      statusText({ status: "ok", reportCount: 0, },),
      "SyntaxMesh: ok · 0 reports",
    );
  });

  it("renders the error state with locale but no report count", () => {
    assertEquals(
      statusText({ status: "error", locale: "pt-br", reportCount: 3, },),
      "SyntaxMesh: error · pt-br",
    );
  });
});
