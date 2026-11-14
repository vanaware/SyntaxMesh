/**
 * Unit tests of the pure report selector (22.6.2). BDD + `@std/assert`,
 * no `vscode` runtime — the items are plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { ReportJsonEntry, } from "@vanaware/syntaxmesh";
import {
  chooseFormat,
  quickPickItems,
} from "../../src/reports/report-selector.ts";

/** A generated report entry producing the given formats. */
function report(formats: string[],): ReportJsonEntry {
  return {
    name: "overview",
    stdout: false,
    selfcontained: false,
    formats: formats.map((format,) => ({ format, content: "", })),
    errors: [],
  };
}

describe("report selector", () => {
  it("projects the listing into quick-pick items", () => {
    const items = quickPickItems([
      { name: "overview", type: "taskreport", },
      { name: "gantt", type: "taskreport", },
    ],);
    assertEquals(items, [
      { label: "overview", description: "taskreport", report: "overview", },
      { label: "gantt", description: "taskreport", report: "gantt", },
    ],);
  });

  it("prefers the default format when the report produced it", () => {
    assertEquals(chooseFormat(report(["html", "csv",],), "html",), "html",);
    assertEquals(chooseFormat(report(["html", "csv",],), "csv",), "csv",);
  });

  it("falls back to the only produced format when the default is absent", () => {
    assertEquals(chooseFormat(report(["markdown",],), "html",), "markdown",);
    assertEquals(chooseFormat(report([],), "html",), "html",);
  });
});
