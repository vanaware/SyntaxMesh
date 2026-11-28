/**
 * Unit tests of the pure daemon core (22.5.6). BDD + `@std/assert`, no
 * `vscode`/core runtime — a fake `execute` and an injected clock stand in for
 * the host, so the orchestration is exercised as plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
} from "@std/assert";
import type {
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import { DaemonCore, type ExecuteFn, } from "../../src/daemon/daemon-core.ts";
import type { InputClosure, } from "../../src/daemon/include-closure.ts";
import type { BuildRequestOptions, } from "../../src/daemon/request-builder.ts";
import type { ProjectIntent, } from "../../src/daemon/types.ts";

/** Minimal options echo shared by the fake envelopes. */
const echo: ExecutionOptionsEcho = {
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
};

/** Successful load envelope listing the given reports. */
function okEnvelope(reports: ListReportsEntry[],): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: echo,
    messages: [],
    results: { listReports: reports, },
  };
}

/** Failed envelope (parse/schedule error). */
function errorEnvelope(): ExecutionResult {
  return {
    ok: false,
    exitCode: 1,
    options: echo,
    messages: [{
      severity: "error",
      id: "boom",
      text: "boom",
      file: null,
      line: null,
    },],
    results: {},
  };
}

/** Successful generation envelope rendering one HTML report. */
function reportsEnvelope(name: string,): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: echo,
    messages: [],
    results: {
      reports: {
        ok: true,
        reports: [{
          name,
          stdout: false,
          selfcontained: false,
          formats: [{ format: "html", content: "<html></html>", },],
          errors: [],
        },],
      },
    },
  };
}

/** A single-file closure. */
const closure: InputClosure = {
  files: [{ path: "master.tjp", content: "", },],
  missing: [],
};

/** Fake `execute`: lists reports on load, renders on generate; records calls. */
function fakeExecute(): { execute: ExecuteFn; requests: ExecutionRequest[] } {
  const requests: ExecutionRequest[] = [];
  const execute: ExecuteFn = (request,) => {
    requests.push(request,);
    if (request.report !== undefined) {
      return Promise.resolve(reportsEnvelope(request.report,),);
    }
    return Promise.resolve(
      okEnvelope([{ name: "overview", type: "taskreport", },],),
    );
  };
  return { execute, requests, };
}

describe("DaemonCore", () => {
  it("adds a project, projects status and caches the model", async () => {
    const { execute, requests, } = fakeExecute();
    const daemon = new DaemonCore(execute, () => 100,);
    const model = await daemon.addProject("file:///a.tjp", closure,);
    assertEquals(model.status, "ok",);
    assertEquals(model.entry, "master.tjp",);
    assertEquals(model.addedAt, 100,);
    assertEquals(model.reloadedAt, 100,);
    assertEquals(model.lastExecution, {
      intent: "inventory",
      startedAt: 100,
      finishedAt: 100,
      errorCount: 0,
    },);
    assertEquals(daemon.cache.has("file:///a.tjp",), true,);
    assertEquals(requests[0]?.listReports, "",);

    const failing = new DaemonCore(() => Promise.resolve(errorEnvelope(),));
    const bad = await failing.addProject("file:///b.tjp", closure,);
    assertEquals(bad.status, "error",);
    assertEquals(bad.lastExecution?.intent, "inventory",);
    assertEquals(bad.lastExecution?.errorCount, 1,);
  });

  it("reloads preserving addedAt and stamping reloadedAt", async () => {
    const { execute, } = fakeExecute();
    let now = 100;
    const daemon = new DaemonCore(execute, () => now,);
    await daemon.addProject("file:///a.tjp", closure,);
    now = 200;
    const reloaded = await daemon.reloadProject("file:///a.tjp", closure,);
    assertEquals(reloaded.addedAt, 100,);
    assertEquals(reloaded.reloadedAt, 200,);
    assertEquals(reloaded.lastExecution, {
      intent: "inventory",
      startedAt: 200,
      finishedAt: 200,
      errorCount: 0,
    },);
    assertEquals(daemon.cache.size, 1,);
  });

  it("removes a project and reports whether it existed", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    await daemon.addProject("file:///a.tjp", closure,);
    assertEquals(daemon.removeProject("file:///a.tjp",), true,);
    assertEquals(daemon.cache.size, 0,);
    assertEquals(daemon.removeProject("file:///a.tjp",), false,);
  });

  it("lists projects as summaries sorted by URI", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    await daemon.addProject("file:///c.tjp", closure,);
    await daemon.addProject("file:///a.tjp", closure,);
    const summaries = daemon.listProjects();
    assertEquals(summaries.map((s,) => s.uri), [
      "file:///a.tjp",
      "file:///c.tjp",
    ],);
    assertEquals(summaries[0]?.reportCount, 1,);
    assertEquals(summaries.map((s,) => s.active), [false, true,],);
    assertEquals(summaries.map((s,) => s.lastIntent), [
      "inventory",
      "inventory",
    ],);
  });

  it("selects and reads the active project explicitly", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    await daemon.addProject("file:///a.tjp", closure,);
    await daemon.addProject("file:///b.tjp", closure,);
    const selected = daemon.setActiveProject("file:///b.tjp",);
    assertEquals(selected?.uri, "file:///b.tjp",);
    assertEquals(daemon.activeProject()?.uri, "file:///b.tjp",);
    assertEquals(daemon.setActiveProject("file:///missing.tjp",), undefined,);
    assertEquals(daemon.activeProject()?.uri, "file:///b.tjp",);
    assertEquals(daemon.removeProject("file:///b.tjp",), true,);
    assertEquals(daemon.activeProject()?.uri, "file:///a.tjp",);
  });

  it("restores a persisted selection and deterministic fallback", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    const a = await daemon.addProject("file:///a.tjp", closure,);
    const b = await daemon.addProject("file:///b.tjp", closure,);

    daemon.restore([b, a,], a.uri,);
    assertEquals(daemon.activeProject()?.uri, a.uri,);
    assertEquals(daemon.cache.size, 2,);

    daemon.restore([b, a,], null,);
    assertEquals(daemon.activeProject()?.uri, a.uri,);
    daemon.restore([b, a,], "file:///missing.tjp",);
    assertEquals(daemon.activeProject()?.uri, a.uri,);

    daemon.restore([], null,);
    assertEquals(daemon.activeProject(), undefined,);
    assertEquals(daemon.cache.active(), null,);
  });

  it("lists the reports of the last load envelope", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    await daemon.addProject("file:///a.tjp", closure,);
    assertEquals(daemon.listReports("file:///a.tjp",).map((r,) => r.name), [
      "overview",
    ],);
    assertEquals(daemon.listReports("file:///unknown.tjp",), [],);
  });

  it("generates a report without clobbering the cached listing", async () => {
    const { execute, requests, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    await daemon.addProject("file:///a.tjp", closure,);
    const result = await daemon.generateReport(
      "file:///a.tjp",
      "overview",
      "out",
    );
    assertEquals(result.results.reports?.reports[0]?.name, "overview",);
    assertEquals(requests[1]?.report, "overview",);
    assertEquals(requests[1]?.reportsIsRegex, false,);
    assertEquals(requests[1]?.outputDir, "out",);
    // The load envelope (and its listing) survives generation.
    assertEquals(daemon.listReports("file:///a.tjp",).map((r,) => r.name), [
      "overview",
    ],);
    assertEquals(daemon.activeProject()?.lastExecution?.intent, "report",);
    await assertRejects(
      () => daemon.generateReport("file:///nope.tjp", "overview",),
      Error,
      "project not loaded",
    );
  });

  it("executes over the cached closure without replacing its inventory", async () => {
    const requests: ExecutionRequest[] = [];
    let now = 100;
    const execute: ExecuteFn = (request,) => {
      requests.push(request,);
      now += 100;
      return Promise.resolve(
        request.listReports !== undefined
          ? okEnvelope([{ name: "overview", type: "taskreport", },],)
          : { ...okEnvelope([],), results: {}, },
      );
    };
    const daemon = new DaemonCore(execute, () => now,);
    const uri = "file:///a.tjp";
    const model = await daemon.addProject(uri, closure,);
    now = 500;

    const result = await daemon.executeProject(uri, {
      entry: "ignored.tjp",
      configContent: "global: {}",
      configObject: null,
      noReports: true,
    },);

    assertEquals(requests[1], {
      files: closure.files,
      entry: "master.tjp",
      configContent: "global: {}",
      configObject: null,
      noReports: true,
    },);
    assertEquals(result.results, {},);
    const cached = daemon.cache.get(uri,);
    assert(cached !== undefined,);
    assertStrictEquals(cached.envelope, model.envelope,);
    assertStrictEquals(cached.files, model.files,);
    assertEquals(cached.status, "ok",);
    assertEquals(cached.lastExecution, {
      intent: "scheduleOnly",
      startedAt: 500,
      finishedAt: 600,
      errorCount: 0,
    },);
    assertEquals(daemon.listReports(uri,).map((r,) => r.name), ["overview",],);
  });

  it("updates status and error count while preserving the inventory envelope", async () => {
    let outcome = okEnvelope([{ name: "overview", type: "taskreport", },],);
    const daemon = new DaemonCore(
      () => Promise.resolve(outcome,),
      () => 100,
    );
    const uri = "file:///a.tjp";
    const model = await daemon.addProject(uri, closure,);
    outcome = errorEnvelope();

    const result = await daemon.executeProject(uri, { checkSyntax: true, },);

    assertEquals(result.ok, false,);
    const cached = daemon.cache.get(uri,);
    assert(cached !== undefined,);
    assertStrictEquals(cached.envelope, model.envelope,);
    assertEquals(cached.status, "error",);
    assertEquals(cached.lastExecution, {
      intent: "checkSyntax",
      startedAt: 100,
      finishedAt: 100,
      errorCount: 1,
    },);
  });

  it("derives deterministic execution intents in precedence order", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);
    const uri = "file:///a.tjp";
    await daemon.addProject(uri, closure,);
    const cases: Array<{
      options: BuildRequestOptions;
      intent: ProjectIntent;
    }> = [
      {
        options: {
          checkSyntax: true,
          noReports: true,
          freeze: {},
          app: "ts-send",
          report: "overview",
        },
        intent: "checkSyntax",
      },
      {
        options: {
          noReports: true,
          freeze: {},
          app: "ts-send",
          report: "overview",
        },
        intent: "scheduleOnly",
      },
      {
        options: { freeze: {}, app: "ts-send", report: "overview", },
        intent: "freeze",
      },
      {
        options: { app: "check-ts", report: "overview", },
        intent: "checkTimeSheet",
      },
      {
        options: { app: "check-ss", report: "overview", },
        intent: "checkStatusSheet",
      },
      { options: { app: "ts-send", report: "overview", }, intent: "sheet", },
      { options: { report: "overview", }, intent: "report", },
      { options: { man: { format: "text", }, }, intent: "man", },
      { options: {}, intent: "compile", },
    ];

    for (const testCase of cases) {
      await daemon.executeProject(uri, testCase.options,);
      assertEquals(
        daemon.activeProject()?.lastExecution?.intent,
        testCase.intent,
        testCase.intent,
      );
    }
  });

  it("rejects execution for a project that is not loaded", async () => {
    const { execute, } = fakeExecute();
    const daemon = new DaemonCore(execute,);

    await assertRejects(
      () => daemon.executeProject("file:///missing.tjp", {},),
      Error,
      "project not loaded",
    );
  });
});
