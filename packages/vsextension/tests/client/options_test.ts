/**
 * Unit tests of the pure client options (22.4.2). BDD + `@std/assert`,
 * no `vscode`/library runtime — the options are plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { DEFAULT_SETTINGS, } from "../../src/config/settings.ts";
import {
  buildClientOptions,
  CLIENT_ID,
  DOCUMENT_SELECTOR,
  FILE_WATCHER_GLOB,
  SERVER_ID,
} from "../../src/client/options.ts";

describe("buildClientOptions", () => {
  it("restricts the document selector to the syntaxmesh language", () => {
    assertEquals(DOCUMENT_SELECTOR, [{ language: "syntaxmesh", },],);
    assertEquals(
      buildClientOptions(DEFAULT_SETTINGS,).documentSelector,
      DOCUMENT_SELECTOR,
    );
  });

  it("watches the smx/tjp/tji files for reanalysis", () => {
    assertEquals(FILE_WATCHER_GLOB, "**/*.{smx,tjp,tji}",);
    assertEquals(
      buildClientOptions(DEFAULT_SETTINGS,).synchronize.fileEvents,
      FILE_WATCHER_GLOB,
    );
  });

  it("carries the trace level and problem cap from the settings", () => {
    const options = buildClientOptions(
      { traceServer: "verbose", maxNumberOfProblems: 42, },
    );
    assertEquals(options.trace, "verbose",);
    assertEquals(options.initializationOptions, { maxNumberOfProblems: 42, },);
  });

  it("exposes the client/server ids and the full options shape", () => {
    assertEquals(CLIENT_ID, "syntaxmesh",);
    assertEquals(SERVER_ID, "SyntaxMesh Language Server",);
    const options = buildClientOptions(DEFAULT_SETTINGS,);
    assertEquals(Object.keys(options,).sort(), [
      "documentSelector",
      "initializationOptions",
      "synchronize",
      "trace",
    ],);
    assertEquals(options.trace, "off",);
  });
});
