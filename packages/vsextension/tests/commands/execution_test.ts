/**
 * Semantic execution service tests (22.12.5). A port double isolates the daemon
 * while assertions exercise request mapping, config/sheet hydration and results.
 */
import { describe, it, } from "@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
} from "@std/assert";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionResult,
} from "@vanaware/syntaxmesh";
import type {
  ExecutionCommandOptions,
  ExecutionCommandPort,
} from "../../src/commands/contracts.ts";
import type { BuildRequestOptions, } from "../../src/daemon/request-builder.ts";
import { ProjectService, } from "../../src/commands/service.ts";

const warning: ExecutionMessage = {
  severity: "warning",
  id: "execution-warning",
  text: "execution warning",
  file: "master.smx",
  line: 3,
};

const echo: ExecutionOptionsEcho = {
  entry: "master.smx",
  files: ["master.smx",],
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
};

function envelope(): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: echo,
    messages: [warning,],
    results: {
      reports: {
        ok: true,
        reports: [{
          name: "overview",
          stdout: false,
          selfcontained: true,
          formats: [{ format: "html", content: "<p>overview</p>", },],
          errors: [],
        },],
      },
    },
  };
}

function fakePort(
  executeProject: ExecutionCommandPort["executeProject"] = () =>
    Promise.resolve(envelope(),),
): ExecutionCommandPort {
  return {
    addProject: () => Promise.reject(new Error("unused",),),
    refreshProject: () => Promise.reject(new Error("unused",),),
    removeProject: () => Promise.resolve(false,),
    listProjects: () => [],
    setActiveProject: () => undefined,
    activeProject: () => undefined,
    listReports: () => [],
    executeProject,
  };
}

describe("ProjectService execution commands", () => {
  it("forwards general F24 options through the shared project service", async () => {
    let requestedUri: string | undefined;
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((uri, options,) => {
      requestedUri = uri;
      requested = options;
      return Promise.resolve(envelope(),);
    },),);
    const options: BuildRequestOptions = {
      report: "^over",
      reportsIsRegex: true,
      configContent: "global:\n  timezone: UTC\n",
      configObject: { global: { timezone: "UTC", }, },
      noReports: false,
    };

    const result = await service.executeProject("file:///master.smx", options,);

    assertEquals(requestedUri, "file:///master.smx",);
    assertEquals(requested, options,);
    assert(result.ok,);
    assertEquals(result.messages, [warning,],);
  });

  it("compiles all reports by default and returns their in-memory data", async () => {
    const outcome = envelope();
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((_uri, options,) => {
      requested = options;
      return Promise.resolve(outcome,);
    },),);

    const result = await service.compile("file:///master.smx",);

    assertEquals(requested, {},);
    assert(result.ok,);
    assertStrictEquals(result.value, outcome,);
    assertEquals(result.messages, [warning,],);
    assertEquals(
      result.value.results.reports?.reports.map((report,) => report.name),
      ["overview",],
    );
  });

  it("checks syntax without enabling scheduling or reports", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((_uri, options,) => {
      requested = options;
      return Promise.resolve(envelope(),);
    },),);

    await service.checkSyntax("file:///master.smx",);

    assertEquals(requested, { checkSyntax: true, },);
  });

  it("schedules without rendering reports", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((_uri, options,) => {
      requested = options;
      return Promise.resolve(envelope(),);
    },),);

    await service.scheduleOnly("file:///master.smx",);

    assertEquals(requested, { noReports: true, },);
  });

  it("maps freeze arguments and preserves explicit false", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((_uri, options,) => {
      requested = options;
      return Promise.resolve(envelope(),);
    },),);

    await service.freeze(
      "file:///master.smx",
      "2026-11-24",
      false,
      { forceReports: true, },
    );

    assertEquals(requested, {
      freeze: { date: "2026-11-24", byTask: false, },
      forceReports: true,
    },);
  });

  it("hydrates YAML config before executing the project", async () => {
    const configContent = "global:\n  timezone: UTC\n";
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(
      fakePort((_uri, options,) => {
        requested = options;
        return Promise.resolve(envelope(),);
      },),
      (uri,) => {
        assertEquals(uri, "file:///config.yaml",);
        return Promise.resolve(configContent,);
      },
    );

    await service.compile("file:///master.smx", {
      configUri: "file:///config.yaml",
      report: "overview",
    },);

    assertEquals(requested, {
      configContent,
      configObject: { global: { timezone: "UTC", }, },
      report: "overview",
    },);
  });

  it("forwards report and boolean options exactly", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort((_uri, options,) => {
      requested = options;
      return Promise.resolve(envelope(),);
    },),);
    const options: ExecutionCommandOptions = {
      outputDir: "reports",
      report: "overview",
      reportsIsRegex: true,
      dynamicAttributes: "",
      forceReports: false,
      abortOnWarnings: true,
      warnTsDeltas: false,
      addTrace: true,
    };

    await service.compile("file:///master.smx", options,);

    assertEquals(requested, {
      outputDir: "reports",
      report: "overview",
      reportsIsRegex: true,
      dynamicAttributes: "",
      forceReports: false,
      abortOnWarnings: true,
      warnTsDeltas: false,
      addTrace: true,
    },);
  });

  for (const method of ["checkTimeSheet", "checkStatusSheet",] as const) {
    it(`${method} sends inline sheet content and its file name`, async () => {
      const sheetContent = "resource r 2026-11-24 {}\n";
      let requested: BuildRequestOptions | undefined;
      const service = new ProjectService(
        fakePort((_uri, options,) => {
          requested = options;
          return Promise.resolve(envelope(),);
        },),
        (uri,) => {
          assertEquals(uri, "file:///sheet.tji",);
          return Promise.resolve(sheetContent,);
        },
      );

      await service[method]("file:///master.smx", "file:///sheet.tji",);

      assertEquals(requested, {
        app: method === "checkTimeSheet" ? "check-ts" : "check-ss",
        appOptions: {
          sheetContent,
          sheetFile: "file:///sheet.tji",
        },
      },);
    });
  }

  it("rejects a missing sheet URI without executing", async () => {
    let executed = false;
    const service = new ProjectService(fakePort(() => {
      executed = true;
      return Promise.resolve(envelope(),);
    },),);

    const result = await service.checkTimeSheet("file:///master.smx",);

    assertEquals(executed, false,);
    assert(!result.ok,);
    assertEquals(result.messages, [],);
  });

  it("returns an unreadable sheet as a structured failure", async () => {
    let executed = false;
    const service = new ProjectService(
      fakePort(() => {
        executed = true;
        return Promise.resolve(envelope(),);
      },),
      () => Promise.reject(new Error("sheet read failed",),),
    );

    const result = await service.checkStatusSheet(
      "file:///master.smx",
      "file:///missing.tji",
    );

    assertEquals(executed, false,);
    assertEquals(result, {
      ok: false,
      error: "sheet read failed",
      messages: [],
    },);
  });

  it("rejects invalid config before executing", async () => {
    let executed = false;
    const service = new ProjectService(
      fakePort(() => {
        executed = true;
        return Promise.resolve(envelope(),);
      },),
      () => Promise.resolve("global: [\n",),
    );

    const result = await service.compile("file:///master.smx", {
      configUri: "file:///broken.yaml",
    },);

    assertEquals(executed, false,);
    assert(!result.ok,);
    assertStringIncludes(result.error, "invalid YAML",);
  });

  it("rejects an invalid master before reading config or executing", async () => {
    let read = false;
    let executed = false;
    const service = new ProjectService(
      fakePort(() => {
        executed = true;
        return Promise.resolve(envelope(),);
      },),
      () => {
        read = true;
        return Promise.resolve("{}\n",);
      },
    );

    const result = await service.compile("file:///fragment.tji", {
      configUri: "file:///config.yaml",
    },);

    assertEquals(read, false,);
    assertEquals(executed, false,);
    assert(!result.ok,);
  });

  it("turns execution exceptions into structured failures", async () => {
    const service = new ProjectService(
      fakePort(() => Promise.reject(new Error("execution failed",),)),
    );

    const result = await service.compile("file:///master.smx",);

    assertEquals(result, {
      ok: false,
      error: "execution failed",
      messages: [],
    },);
  });
});
