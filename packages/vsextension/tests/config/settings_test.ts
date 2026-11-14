/**
 * Unit tests of the pure settings reader (22.2.3). BDD + `@std/assert`,
 * no `vscode` runtime — a structural mock stands in for the configuration.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  DEFAULT_SETTINGS,
  readSettings,
  type WorkspaceConfigLike,
} from "../../src/config/settings.ts";

/** Mock configuration backed by a plain record of set values. */
function mockConfig(values: Record<string, unknown>,): WorkspaceConfigLike {
  return {
    get<T,>(section: string, defaultValue: T,): T {
      return section in values ? (values[section] as T) : defaultValue;
    },
  };
}

describe("readSettings", () => {
  it("returns the defaults when nothing is configured", () => {
    assertEquals(readSettings(mockConfig({},),), DEFAULT_SETTINGS,);
  });

  it("reads configured overrides", () => {
    const settings = readSettings(
      mockConfig({ "trace.server": "verbose", "maxNumberOfProblems": 50, },),
    );
    assertEquals(settings.traceServer, "verbose",);
    assertEquals(settings.maxNumberOfProblems, 50,);
  });

  it("narrows the trace level, falling back to off when unknown", () => {
    assertEquals(
      readSettings(mockConfig({ "trace.server": "loud", },),).traceServer,
      "off",
    );
    assertEquals(
      readSettings(mockConfig({ "trace.server": "messages", },),).traceServer,
      "messages",
    );
  });

  it("clamps the problem cap to 1..1000 and defaults non-finite values", () => {
    assertEquals(
      readSettings(mockConfig({ "maxNumberOfProblems": 0, },),)
        .maxNumberOfProblems,
      1,
    );
    assertEquals(
      readSettings(mockConfig({ "maxNumberOfProblems": 5000, },),)
        .maxNumberOfProblems,
      1000,
    );
    assertEquals(
      readSettings(mockConfig({ "maxNumberOfProblems": NaN, },),)
        .maxNumberOfProblems,
      100,
    );
  });

  it("defaults the locale to auto and narrows unknown values", () => {
    assertEquals(readSettings(mockConfig({},),).locale, "auto",);
    assertEquals(
      readSettings(mockConfig({ "locale": "klingon", },),).locale,
      "auto",
    );
  });

  it("reads the locale override (en/pt-BR/es)", () => {
    assertEquals(readSettings(mockConfig({ "locale": "en", },),).locale, "en",);
    assertEquals(
      readSettings(mockConfig({ "locale": "pt-BR", },),).locale,
      "pt-BR",
    );
    assertEquals(readSettings(mockConfig({ "locale": "es", },),).locale, "es",);
  });

  it("reads report.defaultFormat with an html fallback", () => {
    assertEquals(
      readSettings(mockConfig({},),).reportDefaultFormat,
      "html",
    );
    assertEquals(
      readSettings(mockConfig({ "report.defaultFormat": "csv", },),)
        .reportDefaultFormat,
      "csv",
    );
    assertEquals(
      readSettings(mockConfig({ "report.defaultFormat": "  ", },),)
        .reportDefaultFormat,
      "html",
    );
  });
});
