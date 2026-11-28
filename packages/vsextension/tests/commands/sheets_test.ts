/**
 * Sheet-app command regressions (22.12.13). The pure service resolves a project,
 * hydrates the four sheet trees and receiver input, then dispatches real F24 output
 * through the shared confirmed host without SMTP.
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
  ExecutionResults,
  SheetAppName,
} from "@vanaware/syntaxmesh";
import { OutputHost, type Tj3HostIo, } from "../../src/cli/output-host.ts";
import {
  type CommandResult,
  PUBLIC_COMMAND_IDS,
} from "../../src/commands/contracts.ts";
import type { BuildRequestOptions, } from "../../src/daemon/request-builder.ts";
import {
  executeSheetApp,
  type SheetCommandOptions,
  type SheetCommandPort,
  type SheetEmailAppName,
} from "../../src/commands/sheets.ts";

const ROOT = "file:///workspace/";
const PROJECT = "file:///workspace/master.smx";
const SHEET_ROOT = "file:///workspace/sheets/";
const APPS: SheetEmailAppName[] = [
  "ts-send",
  "ts-receive",
  "ts-summary",
  "ss-send",
  "ss-receive",
];

type SheetSection = NonNullable<ExecutionResults["sheet"]>;

/** Resolves a relative path under a directory URI. */
function under(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

/** Complete options echo for a project-backed sheet envelope. */
function sheetOptions(app: SheetAppName,): ExecutionOptionsEcho {
  return {
    entry: "master.smx",
    files: ["master.smx",],
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
    app,
    appOptions: null,
  };
}

/** Builds one complete sheet section with literal defaults. */
function section(
  app: SheetEmailAppName,
  overrides: Partial<SheetSection> = {},
): SheetSection {
  return { app, exitCode: 0, ...overrides, };
}

/** Builds a complete execution envelope around one sheet section. */
function envelope(
  sheet: SheetSection,
  messages: ExecutionMessage[] = [],
  ok = true,
): ExecutionResult {
  return {
    ok,
    exitCode: ok ? 0 : 1,
    options: sheetOptions(sheet.app,),
    messages,
    results: { sheet, },
  };
}

interface FakeOutputOptions {
  existing?: string[];
  confirm?: boolean;
}

/** In-memory output host exercising real preflight, naming and classification. */
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
      throw new Error("sheet output must not copy report assets",);
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
  return { output, writes, confirmations, stored, };
}

interface HarnessOptions {
  project?: CommandResult<string>;
  execution?: ExecutionResult;
  files?: Record<string, string>;
  directories?: Record<string, string[]>;
  existing?: string[];
  confirm?: boolean;
  executeError?: Error;
}

/** Records the pure service boundary while retaining real collection and output. */
function harness(options: HarnessOptions = {},) {
  const files = new Map(Object.entries(options.files ?? {},),);
  const directories = new Map(Object.entries(options.directories ?? {},),);
  const resolutions: Array<string | undefined> = [];
  const executions: Array<{ uri: string; options: BuildRequestOptions }> = [];
  const reads: string[] = [];
  const listings: string[] = [];
  const directoryChecks: string[] = [];
  const output = fakeOutput({
    existing: options.existing,
    confirm: options.confirm,
  },);
  const execution = options.execution ?? envelope(section("ts-send",),);

  const port: SheetCommandPort = {
    resolveProject: (explicit,) => {
      resolutions.push(explicit,);
      return options.project ?? { ok: true, value: PROJECT, messages: [], };
    },
    executeProject: (uri, request,) => {
      executions.push({ uri, options: request, },);
      if (options.executeError !== undefined) {
        return Promise.reject(options.executeError,);
      }
      return Promise.resolve(execution,);
    },
    read: (uri,) => {
      reads.push(uri,);
      const content = files.get(uri,);
      if (content === undefined) {
        return Promise.reject(new Error(`cannot read ${uri}`,),);
      }
      return Promise.resolve(content,);
    },
    listDir: (uri,) => {
      listings.push(uri,);
      const names = directories.get(uri,);
      if (names === undefined) {
        return Promise.reject(new Error(`cannot list ${uri}`,),);
      }
      return Promise.resolve([...names,],);
    },
    isDir: (uri,) => {
      directoryChecks.push(uri,);
      return Promise.resolve(directories.has(uri,),);
    },
    output: output.output,
  };
  return {
    port,
    resolutions,
    executions,
    reads,
    listings,
    directoryChecks,
    writes: output.writes,
    confirmations: output.confirmations,
    stored: output.stored,
  };
}

describe("sheet app mapping (22.12.13)", () => {
  for (const app of APPS) {
    it(`maps ${app} to the core request without an empty file seed`, async () => {
      const h = harness({ execution: envelope(section(app,),), },);
      const receiver = app === "ts-receive" || app === "ss-receive";
      const rawMessage = "Subject: mapping\n\nbody\n";

      const result = await executeSheetApp(
        app,
        PROJECT,
        {},
        h.port,
        receiver ? rawMessage : undefined,
      );

      assert(result.ok,);
      assertEquals(h.resolutions, [PROJECT,],);
      assertEquals(h.executions, [{
        uri: PROJECT,
        options: {
          app,
          appOptions: receiver ? { rawMessage, } : {},
        },
      },],);
      assertEquals(h.writes, [],);
    });
  }

  it("forwards sender options and preserves explicit false values", async () => {
    const h = harness();
    const options: SheetCommandOptions = {
      endDate: "2026-11-30",
      resources: ["alice", "bob",],
      force: false,
      dryRun: false,
    };

    const result = await executeSheetApp("ts-send", PROJECT, options, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.options, {
      app: "ts-send",
      appOptions: {
        endDate: "2026-11-30",
        resources: ["alice", "bob",],
        force: false,
        dryRun: false,
      },
    },);
  });

  it("forwards status-sheet options without turning the directory into workingDir", async () => {
    const h = harness();

    const result = await executeSheetApp("ss-send", PROJECT, {
      directoryUri: SHEET_ROOT,
      hideResource: "isClosed()",
      intervalDuration: "1w",
      force: true,
    }, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.options, {
      app: "ss-send",
      appOptions: {
        hideResource: "isClosed()",
        intervalDuration: "1w",
        force: true,
      },
    },);
    assertEquals(h.listings[0], under(SHEET_ROOT, "TimeSheetTemplates",),);
  });

  it("hydrates raw and parsed YAML into the email-app config contract", async () => {
    const configUri = "file:///workspace/sheets.yml";
    const configContent =
      "global:\n  timezone: UTC\ntimesheets:\n  sender: dev@example.com\n";
    const h = harness({ files: { [configUri]: configContent, }, },);

    const result = await executeSheetApp(
      "ts-send",
      PROJECT,
      { configUri, },
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.reads, [configUri,],);
    assertEquals(h.executions[0]?.options, {
      app: "ts-send",
      configContent,
      appOptions: {
        config: {
          global: { timezone: "UTC", },
          timesheets: { sender: "dev@example.com", },
        },
      },
    },);
    assert(!("configObject" in h.executions[0]!.options),);
  });

  it("appends to recipients to both lists without mutating caller arrays", async () => {
    const h = harness();
    const options: SheetCommandOptions = {
      to: ["everyone@example.com",],
      sheetRecipients: ["sheets@example.com",],
      digestRecipients: ["digest@example.com",],
    };

    const result = await executeSheetApp(
      "ts-summary",
      PROJECT,
      options,
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.executions[0]?.options.appOptions, {
      sheetRecipients: ["sheets@example.com", "everyone@example.com",],
      digestRecipients: ["digest@example.com", "everyone@example.com",],
    },);
    assertEquals(options.sheetRecipients, ["sheets@example.com",],);
    assertEquals(options.digestRecipients, ["digest@example.com",],);
  });

  it("keeps sheet and digest recipient options independent", async () => {
    const h = harness();

    const result = await executeSheetApp("ts-summary", PROJECT, {
      sheetRecipients: ["sheets@example.com",],
      digestRecipients: ["digest@example.com",],
    }, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.options.appOptions, {
      sheetRecipients: ["sheets@example.com",],
      digestRecipients: ["digest@example.com",],
    },);
  });

  it("collects all four sheet trees recursively in discovery order", async () => {
    const timeRoot = under(SHEET_ROOT, "TimeSheets",);
    const statusRoot = under(SHEET_ROOT, "StatusSheets",);
    const h = harness({
      directories: {
        [under(SHEET_ROOT, "TimeSheetTemplates",)]: ["weekly.tji",],
        [timeRoot]: ["alice",],
        [under(timeRoot, "alice",)]: ["2026-11-23.tji",],
        [under(SHEET_ROOT, "StatusSheetTemplates",)]: ["status.tji",],
        [statusRoot]: ["bob",],
        [under(statusRoot, "bob",)]: ["2026-11-23.tji",],
      },
      files: {
        [under(SHEET_ROOT, "TimeSheetTemplates/weekly.tji",)]: "time template",
        [under(timeRoot, "alice/2026-11-23.tji",)]: "time sheet",
        [under(SHEET_ROOT, "StatusSheetTemplates/status.tji",)]:
          "status template",
        [under(statusRoot, "bob/2026-11-23.tji",)]: "status sheet",
      },
    },);

    const result = await executeSheetApp("ts-send", PROJECT, {
      directoryUri: SHEET_ROOT,
    }, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.options.appOptions, {
      files: [
        { path: "TimeSheetTemplates/weekly.tji", content: "time template", },
        { path: "TimeSheets/alice/2026-11-23.tji", content: "time sheet", },
        {
          path: "StatusSheetTemplates/status.tji",
          content: "status template",
        },
        { path: "StatusSheets/bob/2026-11-23.tji", content: "status sheet", },
      ],
    },);
  });

  it("defaults the sheet root to the resolved master parent", async () => {
    const resolved = "file:///workspace/project/master.smx";
    const root = "file:///workspace/project/";
    const h = harness({
      project: { ok: true, value: resolved, messages: [], },
      directories: {
        [under(root, "TimeSheetTemplates",)]: ["weekly.tji",],
      },
      files: { [under(root, "TimeSheetTemplates/weekly.tji",)]: "template", },
    },);

    const result = await executeSheetApp("ts-send", undefined, {}, h.port,);

    assert(result.ok,);
    assertEquals(h.resolutions, [undefined,],);
    assertEquals(h.executions[0]?.uri, resolved,);
    assertEquals(h.executions[0]?.options.appOptions, {
      files: [{ path: "TimeSheetTemplates/weekly.tji", content: "template", },],
    },);
  });

  it("uses the URI returned by project resolution for execution", async () => {
    const resolved = "file:///resolved/master.smx";
    const h = harness({
      project: { ok: true, value: resolved, messages: [], },
    },);

    const result = await executeSheetApp(
      "ss-send",
      "file:///requested/master.smx",
      {},
      h.port,
    );

    assert(result.ok,);
    assertEquals(h.executions[0]?.uri, resolved,);
  });

  it("awaits asynchronous project resolution supplied by the activation host", async () => {
    const active = "file:///active/master.smx";
    const h = harness();
    h.port.resolveProject = (explicit?: string,) => {
      assertEquals(explicit, undefined,);
      return Promise.resolve({
        ok: true as const,
        value: active,
        messages: [],
      },);
    };

    const result = await executeSheetApp("ts-send", undefined, {}, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.uri, active,);
  });

  it("stops before reading or executing when project resolution fails", async () => {
    const h = harness({
      project: {
        ok: false,
        error: "multiple projects loaded; select a project explicitly",
        messages: [],
      },
    },);

    const result = await executeSheetApp("ts-send", undefined, {}, h.port,);

    assertEquals(result, {
      ok: false,
      error: "multiple projects loaded; select a project explicitly",
      messages: [],
    },);
    assertEquals(h.executions, [],);
    assertEquals(h.reads, [],);
    assertEquals(h.listings, [],);
  });

  it("rejects invalid YAML before executing the app", async () => {
    const configUri = "file:///workspace/bad.yml";
    const h = harness({ files: { [configUri]: "global: [\n", }, },);

    const result = await executeSheetApp(
      "ts-send",
      PROJECT,
      { configUri, },
      h.port,
    );

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assertStringIncludes(result.error, "invalid YAML",);
    assertEquals(h.executions, [],);
  });

  it("turns an unreadable config into a structured failure", async () => {
    const h = harness();

    const result = await executeSheetApp("ts-send", PROJECT, {
      configUri: "file:///workspace/missing.yml",
    }, h.port,);

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assertStringIncludes(result.error, "cannot read",);
    assertEquals(h.executions, [],);
  });
});

describe("sheet receiver input (22.12.13)", () => {
  for (const app of ["ts-receive", "ss-receive",] as const) {
    it(`${app} reads the selected message file as raw data`, async () => {
      const fromUri = "file:///workspace/message.eml";
      const rawMessage = "From: dev@example.com\nSubject: sheet\n\nbody\n";
      const h = harness({ files: { [fromUri]: rawMessage, }, },);

      const result = await executeSheetApp(app, PROJECT, { fromUri, }, h.port,);

      assert(result.ok,);
      assertEquals(h.reads, [fromUri,],);
      assertEquals(h.executions[0]?.options.appOptions, { rawMessage, },);
    });

    it(`${app} consumes injected stdin for fromUri '-'`, async () => {
      const h = harness();
      const rawMessage = "Subject: stdin\n\nbody\n";

      const result = await executeSheetApp(
        app,
        PROJECT,
        { fromUri: "-", },
        h.port,
        rawMessage,
      );

      assert(result.ok,);
      assertEquals(h.reads, [],);
      assertEquals(h.executions[0]?.options.appOptions, { rawMessage, },);
    });

    it(`${app} requires a message before execution`, async () => {
      const h = harness();

      const result = await executeSheetApp(app, PROJECT, {}, h.port,);

      assertEquals(result.ok, false,);
      if (result.ok) return;
      assertStringIncludes(result.error, "message",);
      assertEquals(h.executions, [],);
      assertEquals(h.writes, [],);
    });
  }

  it("uses injected stdin when a receiver has no fromUri", async () => {
    const h = harness();
    const rawMessage = "Subject: console\n\nbody\n";

    const result = await executeSheetApp(
      "ts-receive",
      PROJECT,
      {},
      h.port,
      rawMessage,
    );

    assert(result.ok,);
    assertEquals(h.executions[0]?.options.appOptions, { rawMessage, },);
  });

  it("reports missing stdin for fromUri '-' without reading a host stream", async () => {
    const h = harness();

    const result = await executeSheetApp(
      "ss-receive",
      PROJECT,
      { fromUri: "-", },
      h.port,
    );

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assertStringIncludes(result.error, "stdin",);
    assertEquals(h.reads, [],);
    assertEquals(h.executions, [],);
  });

  it("rejects fromUri on sender and summary apps", async () => {
    const h = harness();

    const result = await executeSheetApp("ts-send", PROJECT, {
      fromUri: "file:///workspace/message.eml",
    }, h.port,);

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assertStringIncludes(result.error, "receiver",);
    assertEquals(h.reads, [],);
    assertEquals(h.executions, [],);
  });

  it("turns an unreadable receiver message into a structured failure", async () => {
    const h = harness();

    const result = await executeSheetApp("ts-receive", PROJECT, {
      fromUri: "file:///workspace/missing.eml",
    }, h.port,);

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assertStringIncludes(result.error, "cannot read",);
    assertEquals(h.executions, [],);
  });
});

describe("sheet output dispatch (22.12.13)", () => {
  it("writes sheet deltas and outbox messages with classified artifacts", async () => {
    const sheetPath = "TimeSheets/alice/2026-11-23.tji";
    const emailText = "To: dev@example.com\nSubject: sheet\n\nbody\n";
    const execution = envelope(section("ts-send", {
      reportText: "sheet report\n",
      files: [{ name: sheetPath, contents: "new sheet", },],
      emails: [{ to: "dev@example.com", subject: "sheet", text: emailText, },],
    },),);
    const h = harness({ execution, },);

    const result = await executeSheetApp("ts-send", PROJECT, {
      directoryUri: SHEET_ROOT,
    }, h.port,);

    assert(result.ok,);
    const sheetUri = under(SHEET_ROOT, sheetPath,);
    const emailUri = under(SHEET_ROOT, "outbox/001-dev@example.com.eml",);
    assertEquals(h.writes, [
      { path: sheetUri, content: "new sheet", },
      { path: emailUri, content: emailText, },
    ],);
    assertEquals(result.value.stdout, "sheet report\n",);
    assertEquals(result.value.stderr, "",);
    assertEquals(result.value.artifacts, [
      { uri: sheetUri, fileName: "2026-11-23.tji", kind: "sheet", },
      { uri: emailUri, fileName: "001-dev@example.com.eml", kind: "email", },
    ],);
    assertStrictEquals(result.value.execution, execution,);
  });

  for (const field of ["reportText", "summaryText", "emailText",] as const) {
    it(`prints ${field} through the shared output policy`, async () => {
      const h = harness({
        execution: envelope(
          section("ts-summary", { [field]: "printable\n", },),
        ),
      },);

      const result = await executeSheetApp("ts-summary", PROJECT, {}, h.port,);

      assert(result.ok,);
      assertEquals(result.value.stdout, "printable\n",);
      assertEquals(h.writes, [],);
    });
  }

  it("suppresses all dry-run files and emails while retaining printable text", async () => {
    const execution = envelope(section("ts-send", {
      reportText: "dry-run preview\n",
      files: [{ name: "TimeSheetTemplates/new.tji", contents: "new", },],
      emails: [{ to: "dev@example.com", subject: "sheet", text: "mail", },],
    },),);
    const h = harness({ execution, },);

    const result = await executeSheetApp("ts-send", PROJECT, {
      directoryUri: SHEET_ROOT,
      dryRun: true,
    }, h.port,);

    assert(result.ok,);
    assertEquals(h.executions[0]?.options.appOptions, { dryRun: true, },);
    assertEquals(result.value.stdout, "dry-run preview\n",);
    assertEquals(result.value.artifacts, [],);
    assertEquals(h.writes, [],);
    assertEquals(h.confirmations, [],);
    assertStrictEquals(result.value.execution, execution,);
    assertEquals(execution.results.sheet?.files?.length, 1,);
    assertEquals(execution.results.sheet?.emails?.length, 1,);
  });

  it("confirms one overwrite batch and writes nothing when denied", async () => {
    const target = under(SHEET_ROOT, "TimeSheets/existing.tji",);
    const warning: ExecutionMessage = {
      severity: "warning",
      id: "sheet-warning",
      text: "careful",
      file: "master.smx",
      line: 3,
    };
    const execution = envelope(
      section("ts-send", {
        files: [{ name: "TimeSheets/existing.tji", contents: "new", },],
      },),
      [warning,],
    );
    const h = harness({ execution, existing: [target,], confirm: false, },);

    const result = await executeSheetApp("ts-send", PROJECT, {
      directoryUri: SHEET_ROOT,
    }, h.port,);

    assertEquals(result.ok, false,);
    assertEquals(result.messages, [warning,],);
    assertEquals(h.confirmations, [[target,],],);
    assertEquals(h.writes, [],);
    assertEquals(h.stored.get(target,), "old",);
  });

  it("returns failed execution messages without dispatching output", async () => {
    const error: ExecutionMessage = {
      severity: "error",
      id: "sheet-failed",
      text: "sheet failed",
      file: null,
      line: null,
    };
    const execution = envelope(
      section("ts-send", {
        reportText: "must not print",
        files: [{ name: "TimeSheets/new.tji", contents: "new", },],
        emails: [{ to: "dev@example.com", subject: "sheet", text: "mail", },],
      },),
      [error,],
      false,
    );
    const h = harness({ execution, },);

    const result = await executeSheetApp("ts-send", PROJECT, {}, h.port,);

    assertEquals(result, {
      ok: false,
      error: "sheet execution failed",
      messages: [error,],
    },);
    assertEquals(h.writes, [],);
  });

  it("turns an execution exception into a structured failure", async () => {
    const h = harness({
      executeError: new Error("project execution failed",),
    },);

    const result = await executeSheetApp("ts-send", PROJECT, {}, h.port,);

    assertEquals(result, {
      ok: false,
      error: "project execution failed",
      messages: [],
    },);
    assertEquals(h.writes, [],);
  });

  it("formats envelope messages into stderr while keeping sheet text on stdout", async () => {
    const messages: ExecutionMessage[] = [{
      severity: "warning",
      id: "sheet-warning",
      text: "careful",
      file: "master.smx",
      line: 3,
    }, {
      severity: "info",
      id: "sheet-info",
      text: "processed",
      file: null,
      line: null,
    },];
    const h = harness({
      execution: envelope(
        section("ts-send", { reportText: "report", },),
        messages,
      ),
    },);

    const result = await executeSheetApp("ts-send", PROJECT, {}, h.port,);

    assert(result.ok,);
    assertEquals(result.value.stdout, "report\n",);
    assertEquals(
      result.value.stderr,
      "master.smx:3: Warning: careful\nInfo: processed\n",
    );
  });

  it("contributes all five semantic sheet commands", () => {
    const manifest = JSON.parse(
      Deno.readTextFileSync(new URL("../../package.json", import.meta.url,),),
    ) as { contributes: { commands: { command: string }[] } };
    const declared = new Set(
      manifest.contributes.commands.map((command,) => command.command),
    );
    const ids = [
      "syntaxmesh.sheet.time.send",
      "syntaxmesh.sheet.time.receive",
      "syntaxmesh.sheet.time.summary",
      "syntaxmesh.sheet.status.send",
      "syntaxmesh.sheet.status.receive",
    ];

    for (const id of ids) {
      assert((PUBLIC_COMMAND_IDS as readonly string[]).includes(id,),);
      assert(declared.has(id,), `${id} must be contributed`,);
    }
  });
});
