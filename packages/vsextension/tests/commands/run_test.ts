/**
 * Full in-process tj3 adapter regressions (22.12.14). The shared parser and real
 * output policy stay in the test path; only host I/O and daemon operations are
 * injected so argv mapping, renderer separation and artifact behavior are tested
 * without VS Code or an external process.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
  OptionSpec,
} from "@vanaware/syntaxmesh";
import {
  parseArgs,
  type ParseArgsOptions,
} from "@vanaware/syntaxmesh-cli/options";
import {
  type ConfirmedDispatchOptions,
  type ConfirmedOutputHost,
  type ConfirmedWriteOptions,
  OutputHost,
  type Tj3HostIo,
} from "../../src/cli/output-host.ts";
import { loadConfig, } from "../../src/commands/config.ts";
import type { CommandResult, } from "../../src/commands/contracts.ts";
import {
  executeMan,
  type ManCommandOptions,
} from "../../src/commands/manual.ts";
import {
  executeSheetApp,
  type SheetCommandOptions,
  type SheetCommandPort,
  type SheetEmailAppName,
} from "../../src/commands/sheets.ts";
import {
  runTj3,
  type Tj3RunContext,
  type Tj3RunPort,
} from "../../src/commands/run.ts";
import type { BuildRequestOptions, } from "../../src/daemon/request-builder.ts";
import type { ProjectModel, } from "../../src/daemon/types.ts";

const ROOT = "file:///workspace/";
const PROJECT = "file:///workspace/master.smx";
const NESTED_ROOT = "file:///workspace/nested/";
const NESTED_PROJECT = "file:///workspace/nested/master.smx";
const HELP: OptionSpec[] = [{
  name: "help",
  short: "h",
  type: "boolean",
  argument: null,
  description: "Show help.",
},];

/** Resolves a relative path under a directory URI. */
function under(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

/** Complete options echo for one fake execution envelope. */
function optionsEcho(request: ExecutionRequest,): ExecutionOptionsEcho {
  return {
    entry: request.entry ?? "",
    files: request.files?.map((file,) => file.path) ?? [],
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
    appOptions: request.appOptions === undefined ? null : {
      ...request.appOptions,
      files: request.appOptions.files?.map((file,) => file.path),
    },
  };
}

/** Builds one complete envelope around the requested result sections. */
function envelope(
  request: ExecutionRequest = {},
  results: ExecutionResults = {},
  messages: ExecutionMessage[] = [],
  ok = true,
): ExecutionResult {
  return {
    ok,
    exitCode: ok ? 0 : 1,
    options: optionsEcho(request,),
    messages,
    results,
  };
}

/** Default project-free responses used by the semantic service doubles. */
function defaultExecution(request: ExecutionRequest,): ExecutionResult {
  if (request.help === true) return envelope(request, { help: HELP, },);
  if (request.version === true) {
    return envelope(request, {
      version: { name: "SyntaxMesh", version: "0.0.2", },
    },);
  }
  if (request.man !== undefined) {
    return envelope(request, {
      man: {
        format: request.man.format,
        keywords: request.man.keywords ?? [],
        content: request.man.format === "html" ? "" : "manual text\n",
        files: request.man.format === "html"
          ? [{ name: "index.html", contents: "<html>manual</html>", },]
          : [],
      },
    },);
  }
  return envelope(request,);
}

/** Minimal cached project model returned by add/refresh doubles. */
function projectModel(uri: string,): ProjectModel {
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

interface FakeOutputOptions {
  existing?: string[];
  confirm?: boolean;
}

/** Real output host with in-memory I/O and dispatch/write counters. */
function fakeOutput(options: FakeOutputOptions = {},) {
  const writes: Array<{ path: string; content: string }> = [];
  const confirmations: string[][] = [];
  const stored = new Map<string, string>();
  for (const path of options.existing ?? []) stored.set(path, "old",);
  const io: Tj3HostIo = {
    resolve(path: string, root?: string,): string {
      if (path === "") return root ?? ROOT;
      if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path,)) {
        return new URL(path,).toString();
      }
      return under(root ?? ROOT, path,);
    },
    print(_text: string,): void {},
    write(path: string, content: string,): Promise<void> {
      writes.push({ path, content, },);
      stored.set(path, content,);
      return Promise.resolve();
    },
    mkpath(_dir: string,): Promise<void> {
      return Promise.resolve();
    },
    copy(_from: string, _to: string,): Promise<void> {
      return Promise.resolve();
    },
    listDir(_path: string,): Promise<string[]> {
      return Promise.resolve([],);
    },
    isDir(_path: string,): Promise<boolean> {
      return Promise.resolve(false,);
    },
    exists(path: string,): Promise<boolean> {
      return Promise.resolve(stored.has(path,),);
    },
  };
  const output = new OutputHost(io, {
    cwd: ROOT,
    confirmOverwrite: (paths,) => {
      confirmations.push([...paths,],);
      return Promise.resolve(options.confirm ?? true,);
    },
  },);
  const dispatches: ConfirmedDispatchOptions[] = [];
  let writeBatches = 0;
  const counted: ConfirmedOutputHost = {
    resolve: (path, root,) => output.resolve(path, root,),
    dispatch: (result, policy,) => {
      dispatches.push(policy ?? {},);
      return output.dispatch(result, policy,);
    },
    writeAll: (
      files,
      approvedRoot,
      writeOptions?: ConfirmedWriteOptions,
    ) => {
      writeBatches++;
      return output.writeAll(files, approvedRoot, writeOptions,);
    },
  };
  return {
    output: counted,
    writes,
    confirmations,
    stored,
    dispatches,
    get writeBatches() {
      return writeBatches;
    },
  };
}

interface HarnessOptions {
  root?: string;
  files?: Record<string, string>;
  existingProjects?: string[];
  confirm?: boolean;
  existingOutput?: string[];
  executeProject?: (
    uri: string,
    options: BuildRequestOptions,
  ) => Promise<CommandResult<ExecutionResult>>;
  executeRequest?: (request: ExecutionRequest,) => Promise<ExecutionResult>;
}

/** Records adapter boundaries while retaining real parsing and output policy. */
function harness(options: HarnessOptions = {},) {
  const root = options.root ?? ROOT;
  const files = new Map(Object.entries(options.files ?? {},),);
  const projects = new Set(options.existingProjects ?? [],);
  const parseCalls: string[][] = [];
  const resolveCalls: string[] = [];
  const reads: string[] = [];
  const additions: string[] = [];
  const refreshes: string[] = [];
  const executions: Array<{ uri: string; options: BuildRequestOptions }> = [];
  const requests: ExecutionRequest[] = [];
  const manuals: Array<{
    format?: string;
    keywords?: string[];
    color?: boolean;
    targetUri?: string;
  }> = [];
  const sheets: Array<{
    app: SheetEmailAppName;
    projectUri: string | undefined;
    options: SheetCommandOptions;
    stdin?: string;
  }> = [];
  const output = fakeOutput({
    existing: options.existingOutput,
    confirm: options.confirm,
  },);

  const read = (uri: string,): Promise<string> => {
    reads.push(uri,);
    const content = files.get(uri,);
    return content === undefined
      ? Promise.reject(new Error(`cannot read ${uri}`,),)
      : Promise.resolve(content,);
  };
  const executeRequest = (
    request: ExecutionRequest,
  ): Promise<ExecutionResult> => {
    requests.push(request,);
    return options.executeRequest?.(request,) ??
      Promise.resolve(defaultExecution(request,),);
  };
  const executeProject = (
    uri: string,
    request: BuildRequestOptions,
  ): Promise<CommandResult<ExecutionResult>> => {
    executions.push({ uri, options: request, },);
    return options.executeProject?.(uri, request,) ?? Promise.resolve({
      ok: true,
      value: envelope({},),
      messages: [],
    },);
  };
  const sheetPort: SheetCommandPort = {
    resolveProject: (explicit,) =>
      explicit === undefined
        ? {
          ok: false,
          error: "no project master selected",
          messages: [],
        }
        : { ok: true, value: explicit, messages: [], },
    executeProject: async (uri, request,) => {
      const result = await executeProject(uri, request,);
      if (!result.ok) throw new Error(result.error,);
      return result.value;
    },
    read,
    listDir: () => Promise.resolve([],),
    isDir: () => Promise.resolve(false,),
    output: output.output,
  };
  const port: Tj3RunPort = {
    parseArgs: (argv: readonly string[], options?: ParseArgsOptions,) => {
      parseCalls.push([...argv,],);
      return parseArgs(argv, options,);
    },
    resolveActiveProject: () => Promise.resolve(undefined,),
    resolve: (path: string,) => {
      resolveCalls.push(path,);
      if (path === "") return root;
      if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path,)) {
        return new URL(path,).toString();
      }
      return under(root, path,);
    },
    read,
    loadConfig: (uri: string,) => loadConfig(uri, read,),
    hasProject: (uri: string,) => projects.has(uri,),
    addProject: (uri: string,) => {
      additions.push(uri,);
      projects.add(uri,);
      return Promise.resolve({
        ok: true,
        value: projectModel(uri,),
        messages: [],
      },);
    },
    refreshProject: (uri: string,) => {
      refreshes.push(uri,);
      return Promise.resolve({
        ok: true,
        value: projectModel(uri,),
        messages: [],
      },);
    },
    executeProject,
    executeRequest,
    executeMan: (
      manualOptions: ManCommandOptions,
      policy?: ConfirmedWriteOptions,
    ) => {
      manuals.push(manualOptions,);
      return executeMan(manualOptions, {
        execute: executeRequest,
        output: output.output,
      }, policy,);
    },
    executeSheetApp: (
      app: SheetEmailAppName,
      projectUri: string | undefined,
      sheetOptions: SheetCommandOptions,
      stdin?: string,
      policy?: ConfirmedWriteOptions,
    ) => {
      sheets.push({ app, projectUri, options: sheetOptions, stdin, },);
      return executeSheetApp(
        app,
        projectUri,
        sheetOptions,
        sheetPort,
        stdin,
        policy,
      );
    },
    output: output.output,
  };
  return {
    port,
    parseCalls,
    resolveCalls,
    reads,
    additions,
    refreshes,
    executions,
    requests,
    manuals,
    sheets,
    projects,
    output,
  };
}

describe("syntaxmesh.run adapter (22.12.14)", () => {
  it("parses once and returns project-free help without opening a project", async () => {
    const h = harness();
    const context: Tj3RunContext = { cwd: ROOT, };

    const result = await runTj3(["--help",], context, h.port,);

    assert(result.ok,);
    assertEquals(h.parseCalls, [["--help",],],);
    assertEquals(h.requests, [{ help: true, },],);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [],);
    assertEquals(h.output.dispatches.length, 1,);
    assertEquals(h.output.writeBatches, 0,);
    assertStringIncludes(result.value.stdout, "Usage:",);
    assertStringIncludes(result.value.stdout, "syntaxmesh run",);
    assertEquals(result.value.stdout.endsWith("\n",), true,);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [],);
  });

  it("returns version output without opening a project", async () => {
    const h = harness();
    const result = await runTj3(["--version",], { cwd: ROOT, }, h.port,);

    assert(result.ok,);
    assertEquals(h.parseCalls, [["--version",],],);
    assertEquals(h.requests, [{ version: true, },],);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [],);
    assertEquals(h.output.dispatches.length, 1,);
    assertEquals(result.value.stdout, "SyntaxMesh 0.0.2\n",);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [],);
  });

  it("routes text manuals through the project-free semantic service", async () => {
    const h = harness();
    const result = await runTj3(["man", "task",], { cwd: ROOT, }, h.port,);

    assert(result.ok,);
    assertEquals(h.parseCalls, [["man", "task",],],);
    assertEquals(h.manuals, [{
      format: "text",
      keywords: ["task",],
      color: true,
    },],);
    assertEquals(h.requests, [{
      man: { format: "text", keywords: ["task",], color: true, },
    },],);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [],);
    assertEquals(h.output.dispatches.length, 0,);
    assertEquals(h.output.writeBatches, 0,);
    assertEquals(result.value.stdout, "manual text\n",);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [],);
  });

  it("resolves HTML manual output and dispatches its file map once", async () => {
    const target = under(ROOT, "docs/manual",);
    const index = under(target, "index.html",);
    const h = harness({ existingOutput: [index,], },);
    const result = await runTj3(
      [
        "man",
        "--format",
        "html",
        "--output-dir",
        "docs/manual",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.resolveCalls, [target,],);
    assertEquals(h.manuals, [{
      format: "html",
      color: true,
      targetUri: target,
    },],);
    assertEquals(h.requests, [{
      man: { format: "html", color: true, },
      outputDir: target,
    },],);
    assertEquals(h.output.dispatches.length, 1,);
    assertEquals(h.output.confirmations, [[index,],],);
    assertEquals(h.output.writes, [{
      path: index,
      content: "<html>manual</html>",
    },],);
    assertEquals(result.value.stdout, "",);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [{
      uri: index,
      fileName: "index.html",
      kind: "manual",
    },],);
  });

  it("loads a new master and dispatches one root execution", async () => {
    const h = harness();
    const result = await runTj3(["master.smx",], { cwd: ROOT, }, h.port,);

    assert(result.ok,);
    assertEquals(h.parseCalls, [["master.smx",],],);
    assertEquals(h.resolveCalls, [PROJECT,],);
    assertEquals(h.additions, [PROJECT,],);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [{ uri: PROJECT, options: {}, },],);
    assertEquals(h.output.dispatches.length, 1,);
    assertEquals(result.value.stdout, "",);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [],);
  });

  it("hydrates config and resolves output before root execution", async () => {
    const config = under(ROOT, "config.yaml",);
    const output = under(ROOT, "reports",);
    const h = harness({ files: { [config]: "global:\n  timezone: UTC\n", }, },);
    const result = await runTj3(
      [
        "--config",
        "config.yaml",
        "--output-dir",
        "reports",
        "--check-syntax",
        "master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.resolveCalls, [PROJECT, config, output,],);
    assertEquals(h.reads, [config,],);
    assertEquals(h.executions, [{
      uri: PROJECT,
      options: {
        checkSyntax: true,
        outputDir: output,
        configContent: "global:\n  timezone: UTC\n",
        configObject: { global: { timezone: "UTC", }, },
      },
    },],);
    assertEquals(h.output.dispatches, [{ cwd: ROOT, },],);
  });

  it("rejects non-master roots before loading or executing", async () => {
    const h = harness();
    const result = await runTj3(["fragment.tji",], { cwd: ROOT, }, h.port,);

    assertEquals(result.ok, false,);
    assertEquals(h.resolveCalls, [under(ROOT, "fragment.tji",),],);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [],);
    assertEquals(h.output.dispatches.length, 0,);
  });

  it("applies renderer policy without adding renderer fields to execution", async () => {
    const messages: ExecutionMessage[] = [
      {
        severity: "info",
        id: "progress",
        text: "scheduling",
        file: null,
        line: null,
      },
      {
        severity: "warning",
        id: "careful",
        text: "careful",
        file: "master.smx",
        line: 4,
      },
      {
        severity: "error",
        id: "broken",
        text: "broken",
        file: null,
        line: null,
      },
    ];
    const h = harness({
      executeProject: () =>
        Promise.resolve({
          ok: true,
          value: envelope({}, {}, messages,),
          messages,
        },),
    },);
    const result = await runTj3(
      [
        "--silent",
        "--no-color",
        "master.smx",
      ],
      { cwd: ROOT, renderer: { silent: false, color: true, }, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.executions, [{ uri: PROJECT, options: {}, },],);
    assertEquals(
      result.value.stderr,
      "master.smx:4: Warning: careful\nError: broken\n1 error, 1 warning\n",
    );
    assertEquals(result.value.stderr.includes("\u001b[",), false,);
    assertEquals(result.value.stderr.includes("scheduling",), false,);
  });

  const sheetCases: Array<{
    tokens: string[];
    app: SheetEmailAppName;
    receiver: boolean;
  }> = [
    { tokens: ["ts", "send",], app: "ts-send", receiver: false, },
    { tokens: ["ts", "receive",], app: "ts-receive", receiver: true, },
    { tokens: ["ts", "summary",], app: "ts-summary", receiver: false, },
    { tokens: ["ss", "send",], app: "ss-send", receiver: false, },
    { tokens: ["ss", "receive",], app: "ss-receive", receiver: true, },
  ];

  for (const sheetCase of sheetCases) {
    it(`routes ${sheetCase.app} with its positional master`, async () => {
      const h = harness();
      const argv = sheetCase.receiver
        ? [...sheetCase.tokens, "--from", "-", "master.smx",]
        : [...sheetCase.tokens, "master.smx",];
      const result = await runTj3(
        argv,
        { cwd: ROOT, stdin: "email", },
        h.port,
      );

      assert(result.ok,);
      assertEquals(h.parseCalls, [argv,],);
      assertEquals(h.resolveCalls, [PROJECT,],);
      assertEquals(h.additions, [PROJECT,],);
      assertEquals(h.refreshes, [],);
      assertEquals(h.sheets, [{
        app: sheetCase.app,
        projectUri: PROJECT,
        options: sheetCase.receiver ? { fromUri: "-", } : {},
        stdin: sheetCase.receiver ? "email" : undefined,
      },],);
      assertEquals(h.executions, [{
        uri: PROJECT,
        options: {
          app: sheetCase.app,
          appOptions: sheetCase.receiver ? { rawMessage: "email", } : {},
        },
      },],);
      assertEquals(h.output.dispatches.length, 1,);
    });
  }

  it("resolves a bare sheet command through the active project when allowed", async () => {
    const h = harness({ existingProjects: [PROJECT,], },);
    const activeProjects: string[] = [];
    const port = {
      ...h.port,
      resolveActiveProject: () => {
        activeProjects.push(PROJECT,);
        return Promise.resolve(PROJECT,);
      },
    };
    const context = { cwd: ROOT, useActiveProject: true, };
    const argv = ["ts", "summary", "--dry-run",];

    const result = await runTj3(argv, context, port,);

    assert(result.ok,);
    assertEquals(activeProjects, [PROJECT,],);
    assertEquals(h.parseCalls, [argv,],);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [PROJECT,],);
    assertEquals(h.sheets, [{
      app: "ts-summary",
      projectUri: PROJECT,
      options: { dryRun: true, },
      stdin: undefined,
    },],);
    assertEquals(h.executions, [{
      uri: PROJECT,
      options: {
        app: "ts-summary",
        appOptions: { dryRun: true, },
      },
    },],);
  });

  it("keeps an explicit bare sheet master instead of resolving the active project", async () => {
    const h = harness();
    const activeProjects: string[] = [];
    const port = {
      ...h.port,
      resolveActiveProject: () => {
        activeProjects.push(PROJECT,);
        return Promise.resolve(PROJECT,);
      },
    };
    const context = { cwd: ROOT, useActiveProject: true, };

    const result = await runTj3(
      ["ss", "send", "master.smx", "--dry-run",],
      context,
      port,
    );

    assert(result.ok,);
    assertEquals(activeProjects, [],);
    assertEquals(h.sheets[0]?.projectUri, PROJECT,);
  });

  it("fails a permitted bare sheet command when no active project exists", async () => {
    const h = harness();
    const port = {
      ...h.port,
      resolveActiveProject: () => Promise.resolve(undefined,),
    };
    const context = { cwd: ROOT, useActiveProject: true, };

    const result = await runTj3(
      ["ts", "summary", "--dry-run",],
      context,
      port,
    );

    assertEquals(result.ok, false,);
    if (!result.ok) assertEquals(result.error, "no project master selected",);
    assertEquals(h.refreshes, [],);
    assertEquals(h.executions, [],);
  });

  it("preserves the F24 missing-master rejection without active-project permission", async () => {
    const h = harness();
    const result = await runTj3(
      ["ts", "summary", "--dry-run",],
      { cwd: ROOT, },
      h.port,
    );

    assertEquals(result.ok, false,);
    if (!result.ok) assertEquals(result.error, "No input file given.",);
    assertEquals(h.resolveCalls, [],);
    assertEquals(h.executions, [],);
  });

  for (
    const check of [
      { flag: "--check-time-sheet", app: "check-ts", file: "time.tji", },
      { flag: "--check-status-sheet", app: "check-ss", file: "status.tji", },
    ] as const
  ) {
    it(`hydrates ${check.app} sheet content before execution`, async () => {
      const sheet = under(ROOT, check.file,);
      const content = `${check.app} content\n`;
      const h = harness({ files: { [sheet]: content, }, },);
      const argv = [check.flag, check.file, "master.smx",];
      const result = await runTj3(argv, { cwd: ROOT, }, h.port,);

      assert(result.ok,);
      assertEquals(h.resolveCalls, [PROJECT, sheet,],);
      assertEquals(h.reads, [sheet,],);
      assertEquals(h.sheets, [],);
      assertEquals(h.executions, [{
        uri: PROJECT,
        options: {
          app: check.app,
          appOptions: { sheetContent: content, sheetFile: sheet, },
        },
      },],);
      assertEquals(h.output.dispatches.length, 1,);
    });
  }

  for (
    const argv of [
      ["--bogus",],
      ["--debug",],
      ["ts", "send",],
      ["master.smx", "extra",],
    ]
  ) {
    it(`returns a structured usage error for ${argv.join(" ",)}`, async () => {
      const h = harness();
      const result = await runTj3(argv, { cwd: ROOT, }, h.port,);

      assertEquals(result.ok, false,);
      assertEquals(h.parseCalls, [argv,],);
      assertEquals(h.resolveCalls, [],);
      assertEquals(h.additions, [],);
      assertEquals(h.refreshes, [],);
      assertEquals(h.executions, [],);
      assertEquals(h.output.dispatches.length, 0,);
    });
  }

  for (
    const selection of [
      { flag: "--report", pattern: "overview", regex: false, },
      { flag: "--reports", pattern: "^over", regex: true, },
    ]
  ) {
    it(`preserves ${selection.flag} exact/regex semantics`, async () => {
      const h = harness();
      const result = await runTj3(
        [
          selection.flag,
          selection.pattern,
          "master.smx",
        ],
        { cwd: ROOT, },
        h.port,
      );

      assert(result.ok,);
      assertEquals(h.executions, [{
        uri: PROJECT,
        options: {
          report: selection.pattern,
          ...(selection.regex ? { reportsIsRegex: true, } : {}),
        },
      },],);
    });
  }

  it("resolves and reads receiver message files through the host", async () => {
    const message = under(ROOT, "message.eml",);
    const h = harness({ files: { [message]: "From: dev@example.com\n", }, },);
    const result = await runTj3(
      [
        "ts",
        "receive",
        "--from",
        "message.eml",
        "master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.resolveCalls, [PROJECT, message,],);
    assertEquals(h.reads, [message,],);
    assertEquals(h.sheets, [{
      app: "ts-receive",
      projectUri: PROJECT,
      options: { fromUri: message, },
      stdin: undefined,
    },],);
    assertEquals(
      h.executions[0]?.options.appOptions?.rawMessage,
      "From: dev@example.com\n",
    );
  });

  it("refreshes an existing .tjp master instead of adding it again", async () => {
    const project = under(ROOT, "master.tjp",);
    const h = harness({ existingProjects: [project,], },);
    const result = await runTj3(["master.tjp",], { cwd: ROOT, }, h.port,);

    assert(result.ok,);
    assertEquals(h.additions, [],);
    assertEquals(h.refreshes, [project,],);
    assertEquals(h.executions, [{ uri: project, options: {}, },],);
  });

  it("combines parsed and host manual color policy", async () => {
    const h = harness();
    const result = await runTj3(
      ["--no-color", "man", "task",],
      { cwd: ROOT, renderer: { color: true, }, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.manuals, [{
      format: "text",
      keywords: ["task",],
      color: false,
    },],);
    assertEquals(h.requests, [{
      man: { format: "text", keywords: ["task",], color: false, },
    },],);
  });

  it("passes overwrite confirmation through the per-run output policy", async () => {
    const destination = under(ROOT, "master-header.tji",);
    const confirmations: string[][] = [];
    const h = harness({
      existingOutput: [destination,],
      executeProject: () =>
        Promise.resolve({
          ok: true,
          value: envelope({}, {
            freeze: {
              files: [{ fileName: "master-header.tji", contents: "now\n", },],
            },
          },),
          messages: [],
        },),
    },);
    const result = await runTj3(["--freeze", "master.smx",], {
      cwd: ROOT,
      confirmOverwrite: (paths,) => {
        confirmations.push([...paths,],);
        return Promise.resolve(false,);
      },
    }, h.port,);

    assertEquals(result.ok, false,);
    assertEquals(confirmations, [[destination,],],);
    assertEquals(h.output.writes, [],);
  });

  it("applies per-run overwrite denial to HTML manual output", async () => {
    const target = under(ROOT, "docs/manual",);
    const index = under(target, "index.html",);
    const h = harness({ existingOutput: [index,], },);
    const confirmations: string[][] = [];

    const result = await runTj3(
      ["man", "--format", "html", "--output-dir", "docs/manual",],
      {
        cwd: ROOT,
        confirmOverwrite: (paths,) => {
          confirmations.push([...paths,],);
          return Promise.resolve(false,);
        },
      },
      h.port,
    );

    assertEquals(result.ok, false,);
    assertEquals(confirmations, [[index,],],);
    assertEquals(h.output.confirmations, [],);
    assertEquals(h.output.writes, [],);
  });

  it("applies per-run overwrite denial to sheet output", async () => {
    const sheetPath = "TimeSheets/existing.tji";
    const target = under(ROOT, sheetPath,);
    const h = harness({
      existingOutput: [target,],
      executeProject: () =>
        Promise.resolve({
          ok: true,
          value: envelope({}, {
            sheet: {
              app: "ts-send",
              exitCode: 0,
              files: [{ name: sheetPath, contents: "new", },],
            },
          },),
          messages: [],
        },),
    },);
    const confirmations: string[][] = [];

    const result = await runTj3(["ts", "send", "master.smx",], {
      cwd: ROOT,
      confirmOverwrite: (paths,) => {
        confirmations.push([...paths,],);
        return Promise.resolve(false,);
      },
    }, h.port,);

    assertEquals(result.ok, false,);
    assertEquals(confirmations, [[target,],],);
    assertEquals(h.output.confirmations, [],);
    assertEquals(h.output.writes, [],);
  });

  it("keeps dry-run sheet output printable without writing or redispatching", async () => {
    const messages: ExecutionMessage[] = [
      {
        severity: "info",
        id: "sheet-progress",
        text: "preparing",
        file: null,
        line: null,
      },
      {
        severity: "warning",
        id: "sheet-warning",
        text: "preview only",
        file: null,
        line: null,
      },
    ];
    const execution = envelope({}, {
      sheet: {
        app: "ts-send",
        exitCode: 0,
        summaryText: "Subject: preview\n\nbody\n",
        files: [{ name: "TimeSheets/dev.tji", contents: "sheet\n", },],
        emails: [{
          to: "dev@example.com",
          subject: "preview",
          text: "Subject: preview\n\nbody\n",
        },],
      },
    }, messages,);
    const h = harness({
      executeProject: () =>
        Promise.resolve({
          ok: true,
          value: execution,
          messages,
        },),
    },);
    const result = await runTj3(
      [
        "--silent",
        "--no-color",
        "ts",
        "send",
        "--dryrun",
        "master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.output.dispatches.length, 1,);
    assertEquals(h.output.writes, [],);
    assertEquals(result.value.artifacts, [],);
    assertEquals(result.value.stdout, "Subject: preview\n\nbody\n",);
    assertEquals(
      result.value.stderr,
      "Warning: preview only\n0 errors, 1 warning\n",
    );
    assertEquals(result.value.execution, execution,);
  });

  it("maps sheet flags without duplicating --to recipients", async () => {
    const directory = under(ROOT, "sheets",);
    const config = under(ROOT, "config.yaml",);
    const configContent = "global:\n  timezone: UTC\n";
    const h = harness({ files: { [config]: configContent, }, },);
    const result = await runTj3(
      [
        "ts",
        "summary",
        "--directory",
        "sheets",
        "--config",
        "config.yaml",
        "--enddate",
        "2026-11-24",
        "--resource",
        "dev",
        "--to",
        "ops@example.com",
        "--sheet",
        "dev@example.com",
        "--digest",
        "all@example.com",
        "--force",
        "--dryrun",
        "master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.resolveCalls, [PROJECT, directory, config,],);
    assertEquals(h.reads, [config,],);
    assertEquals(h.sheets, [{
      app: "ts-summary",
      projectUri: PROJECT,
      options: {
        directoryUri: directory,
        endDate: "2026-11-24",
        resources: ["dev",],
        force: true,
        dryRun: true,
        sheetRecipients: ["ops@example.com", "dev@example.com",],
        digestRecipients: ["ops@example.com", "all@example.com",],
        configUri: config,
      },
      stdin: undefined,
    },],);
    assertEquals(h.executions, [{
      uri: PROJECT,
      options: {
        app: "ts-summary",
        configContent,
        appOptions: {
          endDate: "2026-11-24",
          resources: ["dev",],
          force: true,
          dryRun: true,
          sheetRecipients: ["ops@example.com", "dev@example.com",],
          digestRecipients: ["ops@example.com", "all@example.com",],
          config: { global: { timezone: "UTC", }, },
        },
      },
    },],);
  });

  it("resolves config beside a nested master when cwd is omitted", async () => {
    const config = under(NESTED_ROOT, "config.yaml",);
    const h = harness({ files: { [config]: "global:\n  timezone: UTC\n", }, },);
    const result = await runTj3(
      ["--config", "config.yaml", "nested/master.smx",],
      {},
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.additions, [NESTED_PROJECT,],);
    assertEquals(h.reads, [config,],);
    assertEquals(h.executions, [{
      uri: NESTED_PROJECT,
      options: {
        configContent: "global:\n  timezone: UTC\n",
        configObject: { global: { timezone: "UTC", }, },
      },
    },],);
    assertEquals(h.output.dispatches, [{ cwd: NESTED_ROOT, },],);
  });

  it("resolves output and output dispatch beside a nested master", async () => {
    const output = under(NESTED_ROOT, "reports",);
    const h = harness();
    const result = await runTj3(
      ["--output-dir", "reports", "nested/master.smx",],
      {},
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.executions, [{
      uri: NESTED_PROJECT,
      options: { outputDir: output, },
    },],);
    assertEquals(h.output.dispatches, [{ cwd: NESTED_ROOT, },],);
  });

  for (
    const check of [
      { flag: "--check-time-sheet", app: "check-ts", file: "time.tji", },
      { flag: "--check-status-sheet", app: "check-ss", file: "status.tji", },
    ] as const
  ) {
    it(`resolves ${check.app} input beside a nested master`, async () => {
      const sheet = under(NESTED_ROOT, check.file,);
      const content = `${check.app} nested content\n`;
      const h = harness({ files: { [sheet]: content, }, },);
      const result = await runTj3(
        [check.flag, check.file, "nested/master.smx",],
        {},
        h.port,
      );

      assert(result.ok,);
      assertEquals(h.reads, [sheet,],);
      assertEquals(h.executions, [{
        uri: NESTED_PROJECT,
        options: {
          app: check.app,
          appOptions: { sheetContent: content, sheetFile: sheet, },
        },
      },],);
    });
  }

  it("resolves sheet directory and config beside a nested master", async () => {
    const directory = under(NESTED_ROOT, "sheets",);
    const config = under(NESTED_ROOT, "config.yaml",);
    const configContent = "global:\n  timezone: UTC\n";
    const h = harness({ files: { [config]: configContent, }, },);
    const result = await runTj3(
      [
        "ts",
        "summary",
        "--directory",
        "sheets",
        "--config",
        "config.yaml",
        "--dryrun",
        "nested/master.smx",
      ],
      {},
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.reads, [config,],);
    assertEquals(h.sheets, [{
      app: "ts-summary",
      projectUri: NESTED_PROJECT,
      options: {
        directoryUri: directory,
        dryRun: true,
        configUri: config,
      },
      stdin: undefined,
    },],);
  });

  it("resolves a receiver message beside a nested master", async () => {
    const message = under(NESTED_ROOT, "message.eml",);
    const content = "From: dev@example.com\n";
    const h = harness({ files: { [message]: content, }, },);
    const result = await runTj3(
      ["ts", "receive", "--from", "message.eml", "nested/master.smx",],
      {},
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.reads, [message,],);
    assertEquals(h.sheets, [{
      app: "ts-receive",
      projectUri: NESTED_PROJECT,
      options: { fromUri: message, },
      stdin: undefined,
    },],);
    assertEquals(
      h.executions[0]?.options.appOptions?.rawMessage,
      content,
    );
  });

  it("keeps explicit cwd ahead of a nested master for root paths", async () => {
    const config = under(ROOT, "config.yaml",);
    const output = under(ROOT, "reports",);
    const h = harness({ files: { [config]: "global:\n  timezone: UTC\n", }, },);
    const result = await runTj3(
      [
        "--config",
        "config.yaml",
        "--output-dir",
        "reports",
        "nested/master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.reads, [config,],);
    assertEquals(h.executions, [{
      uri: NESTED_PROJECT,
      options: {
        outputDir: output,
        configContent: "global:\n  timezone: UTC\n",
        configObject: { global: { timezone: "UTC", }, },
      },
    },],);
    assertEquals(h.output.dispatches, [{ cwd: ROOT, },],);
  });

  it("keeps explicit cwd ahead of a nested master for sheet paths", async () => {
    const directory = under(ROOT, "sheets",);
    const config = under(ROOT, "config.yaml",);
    const configContent = "global:\n  timezone: UTC\n";
    const h = harness({ files: { [config]: configContent, }, },);
    const result = await runTj3(
      [
        "ts",
        "summary",
        "--directory",
        "sheets",
        "--config",
        "config.yaml",
        "--dryrun",
        "nested/master.smx",
      ],
      { cwd: ROOT, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.reads, [config,],);
    assertEquals(h.sheets, [{
      app: "ts-summary",
      projectUri: NESTED_PROJECT,
      options: {
        directoryUri: directory,
        dryRun: true,
        configUri: config,
      },
      stdin: undefined,
    },],);
  });
});
