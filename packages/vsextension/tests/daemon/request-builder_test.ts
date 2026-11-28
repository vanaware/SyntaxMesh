/**
 * Unit tests of the pure request builder (22.5.5). BDD + `@std/assert`,
 * no `vscode` runtime — the request is plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { SheetAppName, } from "@vanaware/syntaxmesh";
import {
  buildExecuteRequest,
  type BuildRequestOptions,
} from "../../src/daemon/request-builder.ts";
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

  it("maps every current F24 request field", () => {
    const options: BuildRequestOptions = {
      entry: "custom.smx",
      configContent: "global:\n  abortOnWarnings: true\n",
      configObject: { global: { abortOnWarnings: true, }, },
      listReports: "overview",
      listReportsIsRegex: false,
      report: "task.*",
      reportsIsRegex: true,
      outputDir: "reports",
      dynamicAttributes: "hide resource ~",
      forceReports: true,
      abortOnWarnings: true,
      warnTsDeltas: true,
      addTrace: true,
      checkSyntax: true,
      noReports: true,
      freeze: { date: "2026-05-18", byTask: true, },
      help: true,
      version: true,
      man: {
        format: "html",
        keywords: ["task",],
        color: true,
        ignoreOld: true,
      },
      app: "check-ts",
      appOptions: {
        workingDir: "work",
        dryRun: true,
        config: { global: {}, },
        endDate: "2026-05-18",
        from: "sender@example.com",
        rawMessage: "From: sender@example.com\n",
        sheetContent: "timesheet",
        sheetFile: "sheet.txt",
        files: [{ path: "sheet.txt", content: "timesheet", },],
        dirs: ["2026-05",],
        resources: ["dev",],
        force: true,
        intervalDuration: "1d",
        hideResource: "hidden",
        sheetRecipients: ["dev@example.com",],
        digestRecipients: ["boss@example.com",],
      },
    };

    assertEquals(buildExecuteRequest(closure, options,), {
      files: closure.files,
      ...options,
    },);
  });

  it("preserves explicit false, null and empty request values", () => {
    const options: BuildRequestOptions = {
      configContent: "",
      configObject: null,
      listReports: "",
      listReportsIsRegex: false,
      report: "",
      reportsIsRegex: false,
      outputDir: "",
      dynamicAttributes: "",
      forceReports: false,
      abortOnWarnings: false,
      warnTsDeltas: false,
      addTrace: false,
      checkSyntax: false,
      noReports: false,
      freeze: { date: "", byTask: false, },
      help: false,
      version: false,
      man: { format: "text", keywords: [], color: false, ignoreOld: false, },
      appOptions: {
        workingDir: null,
        dryRun: false,
        config: null,
        endDate: null,
        from: null,
        rawMessage: null,
        sheetContent: "",
        sheetFile: null,
        files: [],
        dirs: [],
        resources: [],
        force: false,
        intervalDuration: null,
        hideResource: null,
        sheetRecipients: [],
        digestRecipients: [],
      },
    };

    assertEquals(buildExecuteRequest(closure, options,), {
      files: closure.files,
      entry: "master.tjp",
      ...options,
    },);
  });

  it("builds project-free requests over an empty closure", () => {
    const cases: BuildRequestOptions[] = [
      { help: true, },
      { version: true, },
      { man: { format: "html", keywords: ["task",], }, },
    ];

    for (const options of cases) {
      assertEquals(
        buildExecuteRequest({ files: [], missing: [], }, options,),
        { files: [], entry: "", ...options, },
      );
    }
  });

  it("maps every sheet app and its options", () => {
    const apps: SheetAppName[] = [
      "ts-send",
      "ts-receive",
      "ts-summary",
      "ss-send",
      "ss-receive",
      "check-ts",
      "check-ss",
    ];
    const appOptions = {
      dryRun: false,
      resources: ["dev",],
      force: false,
    };

    for (const app of apps) {
      assertEquals(buildExecuteRequest(closure, { app, appOptions, },), {
        files: closure.files,
        entry: "master.tjp",
        app,
        appOptions,
      },);
    }
  });

  it("does not copy renderer-only flags into the execution request", () => {
    const options = {
      silent: true,
      noColor: true,
    } as unknown as BuildRequestOptions;

    assertEquals(buildExecuteRequest(closure, options,), {
      files: closure.files,
      entry: "master.tjp",
    },);
  });
});
