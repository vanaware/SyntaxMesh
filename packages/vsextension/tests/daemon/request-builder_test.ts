/**
 * Unit tests of the pure request builder (22.5.5). BDD + `@std/assert`,
 * no `vscode` runtime — the request is plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { buildExecuteRequest, } from "../../src/daemon/request-builder.ts";
import type { InputClosure, } from "../../src/daemon/include-closure.ts";

/** A two-file closure (master first). */
const closure: InputClosure = {
  files: [
    { path: "master.tjp", content: `include "a.tji"`, },
    { path: "a.tji", content: "", },
  ],
  missing: [],
};

describe("buildExecuteRequest", () => {
  it("builds the base request with the closure and derived entry (add)", () => {
    const request = buildExecuteRequest(closure,);
    assertEquals(request.files, closure.files,);
    assertEquals(request.entry, "master.tjp",);
    assertEquals(request.listReports, undefined,);
    assertEquals(request.report, undefined,);
  });

  it("lists every report when listReports is empty (add/reload)", () => {
    const request = buildExecuteRequest(closure, { listReports: "", },);
    assertEquals(request.listReports, "",);
    assertEquals(request.entry, "master.tjp",);
    const literal = buildExecuteRequest(
      closure,
      { listReports: "overview", listReportsIsRegex: false, },
    );
    assertEquals(literal.listReports, "overview",);
    assertEquals(literal.listReportsIsRegex, false,);
  });

  it("targets a single report for generation (generate)", () => {
    const request = buildExecuteRequest(
      closure,
      { report: "overview", reportsIsRegex: false, },
    );
    assertEquals(request.report, "overview",);
    assertEquals(request.reportsIsRegex, false,);
    assertEquals(request.files, closure.files,);
  });

  it("carries the output directory and an explicit entry", () => {
    const request = buildExecuteRequest(
      closure,
      { report: "overview", outputDir: "reports", entry: "custom.tjp", },
    );
    assertEquals(request.outputDir, "reports",);
    assertEquals(request.entry, "custom.tjp",);
  });
});
