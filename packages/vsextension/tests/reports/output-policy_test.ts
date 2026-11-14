/**
 * Unit tests of the pure report output policy (22.6.1). BDD + `@std/assert`,
 * no `vscode` runtime — the policy is plain data transformation.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  destinationFor,
  extensionOf,
  reportFileName,
  sanitizeFileName,
} from "../../src/reports/output-policy.ts";

describe("output policy", () => {
  it("routes HTML to the Webview and every other format to save", () => {
    assertEquals(destinationFor("html",), "webview",);
    assertEquals(destinationFor("csv",), "save",);
    assertEquals(destinationFor("mspxml",), "save",);
    assertEquals(destinationFor("markdown",), "save",);
    assertEquals(destinationFor("text",), "save",);
  });

  it("sanitises names: drops path components and invalid characters", () => {
    assertEquals(sanitizeFileName("../evil/report",), "report",);
    assertEquals(sanitizeFileName("a:b*c?d",), "a_b_c_d",);
    assertEquals(sanitizeFileName("  spaced  ",), "spaced",);
  });

  it("maps format extensions like the CLI (markdown→md, iCal→ics)", () => {
    assertEquals(extensionOf("markdown",), "md",);
    assertEquals(extensionOf("iCal",), "ics",);
    assertEquals(extensionOf("mspxml",), "xml",);
    assertEquals(extensionOf("csv",), "csv",);
    assertEquals(extensionOf("ctags",), "",);
    assertEquals(extensionOf("unknown",), "unknown",);
  });

  it("composes the file name with the format extension", () => {
    assertEquals(reportFileName("overview", "html",), "overview.html",);
    assertEquals(reportFileName("overview", "markdown",), "overview.md",);
    assertEquals(reportFileName("tags", "ctags",), "tags",);
  });

  it("falls back to 'report' for an empty name", () => {
    assertEquals(sanitizeFileName("",), "report",);
    assertEquals(sanitizeFileName("///",), "report",);
    assertEquals(reportFileName("", "csv",), "report.csv",);
  });
});
