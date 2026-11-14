/**
 * Unit tests of the pure project cache (22.5.3). BDD + `@std/assert`,
 * no `vscode` runtime — the cache holds plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { ExecutionResult, } from "@vanaware/syntaxmesh";
import { ProjectCache, summarize, } from "../../src/daemon/project-cache.ts";
import type { ProjectModel, } from "../../src/daemon/types.ts";

/** Minimal cached project for the storage tests. */
function model(
  uri: string,
  overrides: Partial<ProjectModel> = {},
): ProjectModel {
  return {
    uri,
    entry: "master.tjp",
    files: [{ path: "master.tjp", content: "", },],
    envelope: null,
    status: "loading",
    addedAt: 0,
    reloadedAt: 0,
    ...overrides,
  };
}

/** A successful envelope listing the given report names. */
function envelopeWithReports(names: string[],): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: {
      entry: "master.tjp",
      files: ["master.tjp",],
      configContent: null,
      checkSyntax: false,
      listReports: null,
      listReportsIsRegex: true,
      report: null,
      reportsIsRegex: false,
      dynamicAttributes: null,
      outputDir: null,
      noReports: false,
      forceReports: false,
      abortOnWarnings: false,
      warnTsDeltas: false,
      addTrace: false,
      freeze: null,
      help: false,
      version: false,
      man: null,
      app: null,
      appOptions: null,
    },
    messages: [],
    results: {
      listReports: names.map((name,) => ({ name, type: "taskreport", })),
    },
  };
}

describe("ProjectCache", () => {
  it("adds and reads a project by URI", () => {
    const cache = new ProjectCache();
    const a = model("file:///a.tjp",);
    cache.set(a,);
    assertEquals(cache.size, 1,);
    assertEquals(cache.has("file:///a.tjp",), true,);
    assertEquals(cache.get("file:///a.tjp",), a,);
    assertEquals(cache.get("file:///missing.tjp",), undefined,);
    assertEquals(cache.has("file:///missing.tjp",), false,);
  });

  it("removes a project and reports whether it existed", () => {
    const cache = new ProjectCache();
    cache.set(model("file:///a.tjp",),);
    assertEquals(cache.remove("file:///a.tjp",), true,);
    assertEquals(cache.size, 0,);
    assertEquals(cache.has("file:///a.tjp",), false,);
    assertEquals(cache.remove("file:///a.tjp",), false,);
  });

  it("lists projects sorted by URI regardless of insertion order", () => {
    const cache = new ProjectCache();
    cache.set(model("file:///c.tjp",),);
    cache.set(model("file:///a.tjp",),);
    cache.set(model("file:///b.tjp",),);
    assertEquals(cache.list().map((m,) => m.uri), [
      "file:///a.tjp",
      "file:///b.tjp",
      "file:///c.tjp",
    ],);
  });

  it("overwrites the model when a URI is re-added", () => {
    const cache = new ProjectCache();
    cache.set(model("file:///a.tjp", { status: "loading", },),);
    cache.set(model("file:///a.tjp", { status: "ok", },),);
    assertEquals(cache.size, 1,);
    assertEquals(cache.get("file:///a.tjp",)?.status, "ok",);
  });

  it("clears every cached project", () => {
    const cache = new ProjectCache();
    cache.set(model("file:///a.tjp",),);
    cache.set(model("file:///b.tjp",),);
    cache.clear();
    assertEquals(cache.size, 0,);
    assertEquals(cache.list(), [],);
  });
});

describe("summarize", () => {
  it("reports zero reports before the first run", () => {
    const summary = summarize(model("file:///a.tjp",),);
    assertEquals(summary.reportCount, 0,);
    assertEquals(summary.status, "loading",);
    assertEquals(summary.uri, "file:///a.tjp",);
  });

  it("counts the reports of the last envelope", () => {
    const summary = summarize(
      model("file:///a.tjp", {
        status: "ok",
        envelope: envelopeWithReports(["overview", "gantt",],),
      },),
    );
    assertEquals(summary.reportCount, 2,);
    assertEquals(summary.status, "ok",);
  });
});
