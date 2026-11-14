/**
 * Unit tests of the pure cache persistence (22.5.7). BDD + `@std/assert`,
 * no `vscode` runtime — the payload is a plain JSON string.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  CACHE_VERSION,
  deserializeCache,
  serializeCache,
} from "../../src/daemon/persistence.ts";
import type { ProjectModel, } from "../../src/daemon/types.ts";

/** A cached project with a load envelope (nested data must survive). */
const model: ProjectModel = {
  uri: "file:///a.tjp",
  entry: "master.tjp",
  files: [{ path: "master.tjp", content: `include "a.tji"`, },],
  envelope: {
    ok: true,
    exitCode: 0,
    options: {
      entry: "master.tjp",
      files: ["master.tjp",],
      configContent: null,
      checkSyntax: false,
      listReports: "",
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
    results: { listReports: [{ name: "overview", type: "taskreport", },], },
  },
  status: "ok",
  addedAt: 100,
  reloadedAt: 200,
};

describe("cache persistence", () => {
  it("round-trips models including the nested envelope", () => {
    const json = serializeCache([model,],);
    assertEquals(deserializeCache(json,), [model,],);
  });

  it("discards payloads with a mismatched version or invalid JSON", () => {
    const stale = JSON.stringify({
      version: CACHE_VERSION + 1,
      projects: [model,],
    },);
    assertEquals(deserializeCache(stale,), [],);
    assertEquals(deserializeCache("not json",), [],);
    assertEquals(deserializeCache("null",), [],);
    assertEquals(
      deserializeCache(JSON.stringify({ version: CACHE_VERSION, },),),
      [],
    );
  });

  it("round-trips an empty cache", () => {
    assertEquals(deserializeCache(serializeCache([],),), [],);
  });
});
