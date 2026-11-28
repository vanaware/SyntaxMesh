/**
 * Allowlisted console dispatcher regressions (22.12.15). A recording executor
 * proves exact canonical command IDs and argument order without an editor host.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
} from "@vanaware/syntaxmesh";
import type {
  ArtifactResult,
  CommandResult,
} from "../../src/commands/contracts.ts";
import type { FreezeCommandResult, } from "../../src/commands/freeze-output.ts";
import type { ManCommandResult, } from "../../src/commands/manual.ts";
import type { ReportExportResult, } from "../../src/commands/service.ts";
import type { SheetCommandResult, } from "../../src/commands/sheets.ts";
import type { Tj3RunResult, } from "../../src/commands/run.ts";
import type { ProjectModel, ProjectSummary, } from "../../src/daemon/types.ts";
import {
  type ConsoleCommandExecutor,
  type ConsoleDispatchResult,
  dispatchConsoleRequest,
} from "../../src/console/commands.ts";
import {
  type ConsoleRequest,
  parseConsoleLine,
} from "../../src/console/parser.ts";

const PROJECT = "file:///workspace/master.smx";
const SHEET = "file:///workspace/time.tji";
const REPORT = "overview";

interface RecordedCall {
  id: string;
  args: unknown[];
}

type Responder = (id: string, args: unknown[],) => unknown | Promise<unknown>;

/** Wraps one successful value in the canonical command contract. */
function ok<T,>(value: T,): CommandResult<T> {
  return { ok: true, value, messages: [], };
}

/** Records every command call and returns a scripted plain-data response. */
function recordingExecutor(responder: Responder = () => ok(null,),): {
  executor: ConsoleCommandExecutor;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const executor: ConsoleCommandExecutor = {
    async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
      calls.push({ id, args, },);
      return await responder(id, args,) as T;
    },
  };
  return { executor, calls, };
}

/** Parses one line and fails the test on a usage error. */
function request(line: string,): ConsoleRequest {
  const parsed = parseConsoleLine(line,);
  assert(parsed.ok, parsed.ok ? undefined : parsed.error,);
  return parsed.value;
}

/** Returns output text and asserts the dispatch was not a local control action. */
function output(result: ConsoleDispatchResult,): string {
  assert(result.kind === "output", `expected output, got ${result.kind}`,);
  return result.text;
}

/** Complete options echo for deterministic execution fixtures. */
function options(request: ExecutionRequest = {},): ExecutionOptionsEcho {
  return {
    entry: request.entry ?? "master.smx",
    files: request.files?.map((file,) => file.path) ?? ["master.smx",],
    configContent: request.configContent ?? null,
    checkSyntax: request.checkSyntax ?? false,
    listReports: request.listReports ?? null,
    listReportsIsRegex: request.listReportsIsRegex ?? true,
    report: request.report ?? null,
    reportsIsRegex: request.reportsIsRegex ?? false,
    dynamicAttributes: request.dynamicAttributes ?? null,
    outputDir: request.outputDir ?? null,
    noReports: request.noReports ?? false,
    forceReports: request.forceReports ?? false,
    abortOnWarnings: request.abortOnWarnings ?? false,
    warnTsDeltas: request.warnTsDeltas ?? false,
    addTrace: request.addTrace ?? false,
    freeze: request.freeze ?? null,
    help: request.help ?? false,
    version: request.version ?? false,
    man: request.man ?? null,
    app: request.app ?? null,
    appOptions: request.appOptions == null ? null : {
      ...request.appOptions,
      files: request.appOptions.files?.map((file,) => file.path),
    },
  };
}

/** Builds one complete execution envelope around the requested sections. */
function execution(
  request: ExecutionRequest = {},
  results: ExecutionResults = {},
  messages: ExecutionMessage[] = [],
): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: options(request,),
    messages,
    results,
  };
}

/** Minimal cached project model for mutation-command fixtures. */
function projectModel(uri = PROJECT,): ProjectModel {
  return {
    uri,
    entry: uri.slice(uri.lastIndexOf("/",) + 1,),
    files: [],
    envelope: null,
    status: "ok",
    addedAt: 1,
    reloadedAt: 1,
  };
}

/** One project summary fixture. */
function projectSummary(): ProjectSummary {
  return {
    uri: PROJECT,
    entry: "master.smx",
    status: "ok",
    reportCount: 1,
    addedAt: 1,
    reloadedAt: 1,
    active: true,
    lastIntent: "compile",
  };
}

/** One sheet result fixture with printable text and artifacts. */
function sheetResult(): SheetCommandResult {
  return {
    execution: execution({ app: "ts-send", }, {
      sheet: { app: "ts-send", exitCode: 0, summaryText: "summary\n", },
    },),
    artifacts: [{
      uri: "file:///workspace/TimeSheets/dev.tji",
      fileName: "TimeSheets/dev.tji",
      kind: "sheet",
    },],
    stdout: "summary\n",
    stderr: "",
  };
}

/** One run result fixture with captured output and artifacts. */
function runResult(): Tj3RunResult {
  return {
    execution: execution(),
    artifacts: [{
      uri: "file:///workspace/overview.csv",
      fileName: "overview.csv",
      kind: "report",
    },],
    stdout: "run output\n",
    stderr: "run warning\n",
  };
}

/** Asserts a successful output result with exact text. */
function assertOutput(
  result: ConsoleDispatchResult,
  text: string,
): void {
  assertEquals(result, { kind: "output", ok: true, text, },);
}

describe("console dispatcher allowlist", () => {
  it("contains no editor or host-global dependency", () => {
    const source = Deno.readTextFileSync(
      new URL("../../src/console/commands.ts", import.meta.url,),
    );
    assert(
      !source.includes('from "vscode"',),
      "dispatcher imports the editor API",
    );
    assert(!source.includes("node:",), "dispatcher imports a Node API",);
    assert(!source.includes("Deno.",), "dispatcher uses a host global",);
  });

  it("maps every project action to its exact canonical command", async () => {
    const { executor, calls, } = recordingExecutor((id,) => {
      if (id === "syntaxmesh.project.list") return ok([projectSummary(),],);
      if (id === "syntaxmesh.project.remove") return ok(null,);
      return ok(projectModel(),);
    },);
    const requests: ConsoleRequest[] = [
      {
        kind: "project",
        action: "add",
        project: PROJECT,
      },
      {
        kind: "project",
        action: "remove",
        project: PROJECT,
      },
      { kind: "project", action: "list", },
      {
        kind: "project",
        action: "setActive",
        project: PROJECT,
      },
      {
        kind: "project",
        action: "refresh",
        project: PROJECT,
      },
    ];
    for (const item of requests) {
      const result = await dispatchConsoleRequest(item, executor,);
      assert(result.kind === "output" && result.ok,);
    }
    assertEquals(calls, [{
      id: "syntaxmesh.project.add",
      args: [PROJECT,],
    }, {
      id: "syntaxmesh.project.remove",
      args: [PROJECT,],
    }, {
      id: "syntaxmesh.project.list",
      args: [],
    }, {
      id: "syntaxmesh.project.setActive",
      args: [PROJECT,],
    }, {
      id: "syntaxmesh.project.refresh",
      args: [PROJECT,],
    },],);
    assertStringIncludes(
      output(
        await dispatchConsoleRequest(
          { kind: "project", action: "list", },
          executor,
        ),
      ),
      "master.smx [ok]",
    );
  });

  it("maps compile, check, schedule and freeze with exact argument order", async () => {
    const freeze: FreezeCommandResult = {
      execution: execution({ freeze: { date: "2026-11-24", }, }, {
        freeze: { files: [], },
      },),
      artifacts: [],
    };
    const { executor, calls, } = recordingExecutor((id,) =>
      ok(id === "syntaxmesh.freeze" ? freeze : execution(),)
    );
    const executionOptions = { configUri: "file:///workspace/config.yaml", };
    const requests: ConsoleRequest[] = [{
      kind: "execute",
      action: "compile",
      project: PROJECT,
      options: executionOptions,
    }, {
      kind: "execute",
      action: "checkSyntax",
      project: PROJECT,
      options: executionOptions,
    }, {
      kind: "execute",
      action: "scheduleOnly",
      project: PROJECT,
      options: executionOptions,
    }, {
      kind: "execute",
      action: "freeze",
      project: PROJECT,
      freezeDate: "2026-11-24",
      byTask: true,
      options: executionOptions,
    },];
    for (const item of requests) {
      const result = await dispatchConsoleRequest(item, executor,);
      assert(result.kind === "output" && result.ok,);
      assertStringIncludes(output(result,), "Execution: ok",);
    }
    assertEquals(calls, [{
      id: "syntaxmesh.compile",
      args: [PROJECT, executionOptions,],
    }, {
      id: "syntaxmesh.checkSyntax",
      args: [PROJECT, executionOptions,],
    }, {
      id: "syntaxmesh.scheduleOnly",
      args: [PROJECT, executionOptions,],
    }, {
      id: "syntaxmesh.freeze",
      args: [PROJECT, "2026-11-24", true, executionOptions,],
    },],);
  });

  it("maps sheet checks and all five email apps to their real signatures", async () => {
    const { executor, calls, } = recordingExecutor((id,) =>
      ok(id.startsWith("syntaxmesh.sheet.",) ? sheetResult() : execution(),)
    );
    const checkOptions = { configUri: "file:///workspace/config.yaml", };
    const sheetOptions = { dryRun: true, };
    const requests: ConsoleRequest[] = [{
      kind: "sheet",
      action: "checkTimeSheet",
      project: PROJECT,
      sheet: SHEET,
      options: checkOptions,
    }, {
      kind: "sheet",
      action: "checkStatusSheet",
      project: PROJECT,
      sheet: SHEET,
      options: checkOptions,
    }, {
      kind: "sheet",
      action: "timeSend",
      project: PROJECT,
      options: sheetOptions,
    }, {
      kind: "sheet",
      action: "timeReceive",
      project: PROJECT,
      sheet: "file:///workspace/message.eml",
      options: { fromUri: "file:///workspace/message.eml", },
    }, {
      kind: "sheet",
      action: "timeSummary",
      project: PROJECT,
      options: sheetOptions,
    }, {
      kind: "sheet",
      action: "statusSend",
      project: PROJECT,
      options: sheetOptions,
    }, {
      kind: "sheet",
      action: "statusReceive",
      project: PROJECT,
      sheet: "-",
      options: { fromUri: "-", },
    },];
    for (const item of requests) {
      const result = await dispatchConsoleRequest(item, executor,);
      assert(result.kind === "output" && result.ok,);
    }
    assertEquals(calls, [{
      id: "syntaxmesh.checkTimeSheet",
      args: [PROJECT, SHEET, checkOptions,],
    }, {
      id: "syntaxmesh.checkStatusSheet",
      args: [PROJECT, SHEET, checkOptions,],
    }, {
      id: "syntaxmesh.sheet.time.send",
      args: [PROJECT, sheetOptions, undefined,],
    }, {
      id: "syntaxmesh.sheet.time.receive",
      args: [
        PROJECT,
        { fromUri: "file:///workspace/message.eml", },
        undefined,
      ],
    }, {
      id: "syntaxmesh.sheet.time.summary",
      args: [PROJECT, sheetOptions, undefined,],
    }, {
      id: "syntaxmesh.sheet.status.send",
      args: [PROJECT, sheetOptions, undefined,],
    }, {
      id: "syntaxmesh.sheet.status.receive",
      args: [PROJECT, { fromUri: "-", }, undefined,],
    },],);
  });

  it("maps report list, render, open and export with the registered order", async () => {
    const exported: ReportExportResult = {
      execution: execution({ report: REPORT, }, {
        reports: {
          ok: true,
          reports: [{
            name: REPORT,
            stdout: false,
            selfcontained: true,
            formats: [{ format: "csv", content: "a,b\n", },],
            errors: [],
          },],
        },
      },),
      artifact: {
        uri: "file:///workspace/reports/overview.csv",
        fileName: "overview.csv",
        kind: "report",
      },
    };
    const { executor, calls, } = recordingExecutor((id, args,) => {
      if (id === "syntaxmesh.report.list") {
        return ok([{ name: REPORT, type: "taskreport", },],);
      }
      if (id === "syntaxmesh.report.open") return ok(null,);
      if (id === "syntaxmesh.report.export") return ok(exported,);
      return ok(execution({ report: String(args[1] ?? REPORT,), },),);
    },);
    const requests: ConsoleRequest[] = [{
      kind: "report",
      action: "list",
      project: PROJECT,
      pattern: "cost|task",
    }, {
      kind: "report",
      action: "render",
      project: PROJECT,
      report: REPORT,
      reportsIsRegex: false,
      dynamicAttributes: "hide project",
    }, {
      kind: "report",
      action: "open",
      project: PROJECT,
      report: REPORT,
      dynamicAttributes: "hide project",
    }, {
      kind: "report",
      action: "export",
      project: PROJECT,
      report: REPORT,
      format: "csv",
      dynamicAttributes: "hide resource",
      target: "file:///workspace/reports/",
    },];
    for (const item of requests) {
      const result = await dispatchConsoleRequest(item, executor,);
      assert(result.kind === "output" && result.ok,);
    }
    assertEquals(calls, [{
      id: "syntaxmesh.report.list",
      args: [PROJECT, "cost|task",],
    }, {
      id: "syntaxmesh.report.render",
      args: [PROJECT, REPORT, false, "hide project",],
    }, {
      id: "syntaxmesh.report.open",
      args: [PROJECT, REPORT, "hide project",],
    }, {
      id: "syntaxmesh.report.export",
      args: [
        PROJECT,
        REPORT,
        "csv",
        "hide resource",
        "file:///workspace/reports/",
      ],
    },],);
  });

  it("routes run, smx and tj3 only through syntaxmesh.run", async () => {
    const { executor, calls, } = recordingExecutor(() => ok(runResult(),));
    for (
      const line of [
        "run master.smx --no-reports",
        "smx master.smx --no-reports",
        "tj3 master.smx --no-reports",
      ]
    ) {
      const result = await dispatchConsoleRequest(request(line,), executor,);
      assertOutput(
        result,
        [
          "run output",
          "run warning",
          "Artifacts:",
          "  overview.csv (report)",
          "",
        ].join("\n",),
      );
    }
    assertEquals(calls, [{
      id: "syntaxmesh.run",
      args: [["master.smx", "--no-reports",], {},],
    }, {
      id: "syntaxmesh.run",
      args: [["master.smx", "--no-reports",], {},],
    }, {
      id: "syntaxmesh.run",
      args: [["master.smx", "--no-reports",], {},],
    },],);
  });

  it("forwards active-project fallback only for bare sheet commands", async () => {
    const { executor, calls, } = recordingExecutor(() => ok(runResult(),));
    for (
      const line of [
        "ts summary --dry-run",
        "ss send --dry-run",
        "run ts summary --dry-run",
        "smx ts summary --dry-run",
        "tj3 ts summary --dry-run",
      ]
    ) {
      const result = await dispatchConsoleRequest(
        request(line,),
        executor,
        { cwd: "file:///workspace/nested/", },
      );
      assert(result.kind === "output" && result.ok,);
    }
    assertEquals(calls, [{
      id: "syntaxmesh.run",
      args: [["ts", "summary", "--dry-run",], {
        cwd: "file:///workspace/nested/",
        useActiveProject: true,
      },],
    }, {
      id: "syntaxmesh.run",
      args: [["ss", "send", "--dry-run",], {
        cwd: "file:///workspace/nested/",
        useActiveProject: true,
      },],
    }, {
      id: "syntaxmesh.run",
      args: [["ts", "summary", "--dry-run",], {
        cwd: "file:///workspace/nested/",
      },],
    }, {
      id: "syntaxmesh.run",
      args: [["ts", "summary", "--dry-run",], {
        cwd: "file:///workspace/nested/",
      },],
    }, {
      id: "syntaxmesh.run",
      args: [["ts", "summary", "--dry-run",], {
        cwd: "file:///workspace/nested/",
      },],
    },],);
  });

  it("forwards run cwd and receiver stdin without trusting argv as a command id", async () => {
    const { executor, calls, } = recordingExecutor(() => ok(runResult(),));
    const argv = ["syntaxmesh.anything.goes", "--from", "-",];
    await dispatchConsoleRequest(
      {
        kind: "run",
        argv,
        stdin: "Subject: receiver\n\nbody\n",
      },
      executor,
      { cwd: "file:///workspace/nested/", },
    );
    assertEquals(calls, [{
      id: "syntaxmesh.run",
      args: [argv, {
        cwd: "file:///workspace/nested/",
        stdin: "Subject: receiver\n\nbody\n",
      },],
    },],);
  });

  it("maps help and version to metadata commands and formats their data", async () => {
    const { executor, calls, } = recordingExecutor((id,) => {
      if (id === "syntaxmesh.help") {
        return execution({ help: true, }, {
          help: [{
            name: "help",
            short: "h",
            type: "boolean",
            argument: null,
            description: "Show help.",
          },],
        },);
      }
      return execution({ version: true, }, {
        version: { name: "SyntaxMesh", version: "0.0.2", },
      },);
    },);
    const help = output(
      await dispatchConsoleRequest({ kind: "help", }, executor,),
    );
    assertStringIncludes(help, "Usage:",);
    assertStringIncludes(help, "--help",);
    assertOutput(
      await dispatchConsoleRequest({ kind: "version", }, executor,),
      "SyntaxMesh 0.0.2\n",
    );
    assertEquals(calls.map((call,) => call.id), [
      "syntaxmesh.help",
      "syntaxmesh.version",
    ],);
  });

  it("handles clear and exit locally without executing a command", async () => {
    const { executor, calls, } = recordingExecutor();
    assertEquals(
      await dispatchConsoleRequest({ kind: "clear", }, executor,),
      { kind: "clear", },
    );
    assertEquals(
      await dispatchConsoleRequest({ kind: "exit", }, executor,),
      { kind: "exit", },
    );
    assertEquals(calls, [],);
  });
});

describe("console dispatcher failures", () => {
  it("renders structured command failures and their messages as errors", async () => {
    const message: ExecutionMessage = {
      severity: "error",
      id: "denied",
      text: "workspace is untrusted",
      file: null,
      line: null,
    };
    const { executor, } = recordingExecutor(() => ({
      ok: false,
      error: "command denied",
      messages: [message,],
    }));
    const result = await dispatchConsoleRequest({
      kind: "execute",
      action: "compile",
      project: PROJECT,
    }, executor,);
    assertEquals(result, {
      kind: "output",
      ok: false,
      text: [
        "Error: command denied",
        "Messages:",
        "  Error: workspace is untrusted",
        "",
      ].join("\n",),
    },);
  });

  it("converts thrown executor failures into output errors", async () => {
    const { executor, } = recordingExecutor(() => {
      throw new Error("executor exploded",);
    },);
    const result = await dispatchConsoleRequest({
      kind: "report",
      action: "list",
      project: PROJECT,
    }, executor,);
    assertEquals(result, {
      kind: "output",
      ok: false,
      text: "Error: executor exploded\n",
    },);
  });

  it("rejects forged request kinds without executing untrusted ids", async () => {
    const { executor, calls, } = recordingExecutor();
    const forged = {
      kind: "syntaxmesh.anything.goes",
    } as unknown as ConsoleRequest;
    const result = await dispatchConsoleRequest(forged, executor,);
    assert(result.kind === "output" && !result.ok,);
    assertStringIncludes(result.text, "unsupported console request",);
    assertEquals(calls, [],);
  });
});
