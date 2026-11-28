/**
 * Report command service tests (22.12.7). A port double isolates daemon execution
 * while assertions exercise cached listing, selection mapping and report data.
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
  ListReportsEntry,
  ReportJsonEntry,
} from "@vanaware/syntaxmesh";
import {
  type CommandResult,
  type ExecutionCommandPort,
  type ExecutionCommandService,
  PUBLIC_COMMAND_IDS,
} from "../../src/commands/contracts.ts";
import type { BuildRequestOptions, } from "../../src/daemon/request-builder.ts";
import { exportReport, ProjectService, } from "../../src/commands/service.ts";
import {
  exportReportCommand,
  listReportsCommand,
  openReportCommand,
  renderReportsCommand,
  type ReportCommandDependencies,
  type ReportCommandUi,
} from "../../src/commands/report-actions.ts";
import {
  type ConfirmedOutputHost,
  OutputHost,
  type Tj3HostIo,
} from "../../src/cli/output-host.ts";
import {
  openHtmlReport,
  quickPickItems,
  type ReportPickItem,
  selectHtmlFormat,
} from "../../src/reports/report-selector.ts";

const warning: ExecutionMessage = {
  severity: "warning",
  id: "report-warning",
  text: "report warning",
  file: "master.smx",
  line: 4,
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

const inventory: ListReportsEntry[] = [
  { name: "overview", type: "taskreport", },
  { name: "resourceOverview", type: "resourcereport", },
  { name: "taskOverview", type: "taskreport", },
];

const overview: ReportJsonEntry = {
  name: "overview",
  stdout: false,
  selfcontained: true,
  formats: [
    { format: "csv", content: "id,name\n", },
    { format: "html", content: "<h1>Overview</h1>", },
  ],
  errors: [],
};

const resourceOverview: ReportJsonEntry = {
  name: "resourceOverview",
  stdout: false,
  selfcontained: false,
  formats: [{ format: "html", content: "<h1>Resources</h1>", },],
  errors: [],
};

function envelope(
  reports: ReportJsonEntry[] = [overview,],
): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: echo,
    messages: [warning,],
    results: { reports: { ok: true, reports, }, },
  };
}

function fakePort(
  overrides: Partial<ExecutionCommandPort> = {},
): ExecutionCommandPort {
  return {
    addProject: () => Promise.reject(new Error("unused",),),
    refreshProject: () => Promise.reject(new Error("unused",),),
    removeProject: () => Promise.resolve(false,),
    listProjects: () => [],
    setActiveProject: () => undefined,
    activeProject: () => undefined,
    listReports: () => inventory,
    executeProject: () => Promise.resolve(envelope(),),
    ...overrides,
  };
}

type ReportService = Pick<
  ExecutionCommandService,
  "listReports" | "renderReports" | "renderReport"
>;

function fakeReportService(
  overrides: Partial<ReportService> = {},
): ReportService {
  return {
    listReports: () =>
      Promise.resolve({ ok: true, value: inventory, messages: [], },),
    renderReports: () =>
      Promise.resolve({ ok: true, value: envelope(), messages: [warning,], },),
    renderReport: () =>
      Promise.resolve({ ok: true, value: overview, messages: [warning,], },),
    ...overrides,
  };
}

interface ReportHarness {
  dependencies: ReportCommandDependencies;
  errors: string[];
  infos: string[];
  picks: ReportPickItem[][];
  formatPicks: string[][];
  saves: { defaultUri: string }[];
  writes: {
    files: { path: string; content: string; kind: string }[];
    root: string;
  }[];
}

function reportHarness(options: {
  service?: Partial<ReportService>;
  projectUri?: ReportCommandDependencies["projectUri"];
  openHtml?: ReportCommandDependencies["openHtml"];
  output?: ConfirmedOutputHost;
  pick?: ReportPickItem;
  format?: string;
  saveUri?: string;
} = {},): ReportHarness {
  const errors: string[] = [];
  const infos: string[] = [];
  const picks: ReportPickItem[][] = [];
  const formatPicks: string[][] = [];
  const saves: { defaultUri: string }[] = [];
  const writes: ReportHarness["writes"] = [];
  const selected = Object.hasOwn(options, "pick",)
    ? options.pick
    : { label: "overview", description: "taskreport", report: "overview", };
  const ui: ReportCommandUi = {
    showErrorMessage: (message: string,) => errors.push(message,),
    showInformationMessage: (message: string,) => infos.push(message,),
    showQuickPick: (items: ReportPickItem[],) => {
      picks.push(items,);
      return Promise.resolve(selected,);
    },
    showFormatPick: (formats: string[],) => {
      formatPicks.push(formats,);
      return Promise.resolve(options.format,);
    },
    showSaveDialog: (dialog: { defaultUri: string },) => {
      saves.push(dialog,);
      return Promise.resolve(options.saveUri,);
    },
  };
  const output: ConfirmedOutputHost = options.output ?? {
    resolve: (path, root,) => new URL(path, root ?? "file:///",).toString(),
    dispatch: () => Promise.reject(new Error("unused",),),
    writeAll: (files, root,) => {
      writes.push({ files: [...files,], root, },);
      return Promise.resolve({
        ok: true,
        value: files.map((file,) => ({
          uri: `${root.replace(/\/$/, "",)}/${file.path}`,
          fileName: file.path.split("/",).at(-1,)!,
          kind: file.kind,
        })),
        messages: [],
      },);
    },
  };
  return {
    dependencies: {
      service: fakeReportService(options.service,),
      projectUri: options.projectUri ??
        ((explicit?: string,) =>
          Promise.resolve(explicit ?? "file:///master.smx",)),
      openHtml: options.openHtml ??
        (() => Promise.resolve({ ok: true, value: null, messages: [], },)),
      output,
      ui,
    },
    errors,
    infos,
    picks,
    formatPicks,
    saves,
    writes,
  };
}

describe("ProjectService report commands", () => {
  it("lists cached reports without executing or scheduling", async () => {
    let executed = false;
    let listed = "";
    const service = new ProjectService(fakePort({
      listReports: (uri,) => {
        listed = uri;
        return inventory;
      },
      executeProject: () => {
        executed = true;
        return Promise.resolve(envelope(),);
      },
    },),);

    const result = await service.listReports("file:///master.smx",);

    assertEquals(executed, false,);
    assertEquals(listed, "file:///master.smx",);
    assertEquals(result, { ok: true, value: inventory, messages: [], },);
  });

  it("filters cached reports with a regular expression", async () => {
    const result = await new ProjectService(fakePort(),).listReports(
      "file:///master.smx",
      "^task",
    );

    assertEquals(result, {
      ok: true,
      value: [{ name: "taskOverview", type: "taskreport", },],
      messages: [],
    },);
  });

  it("filters cached reports by canonical id when the display name differs", async () => {
    const listed: Array<ListReportsEntry & { id: string }> = [
      { id: "full", name: "Project TJP", type: "export", },
    ];
    const service = new ProjectService(
      fakePort({ listReports: () => listed, },),
    );

    const result = await service.listReports("file:///master.smx", "^full$",);

    assertEquals(result, { ok: true, value: listed, messages: [], },);
  });

  it("returns a structured failure for an invalid report pattern", async () => {
    let executed = false;
    const service = new ProjectService(fakePort({
      executeProject: () => {
        executed = true;
        return Promise.resolve(envelope(),);
      },
    },),);

    const result = await service.listReports("file:///master.smx", "[",);

    assertEquals(executed, false,);
    assert(!result.ok,);
    assertStringIncludes(result.error, "invalid report pattern",);
    assertEquals(result.messages, [],);
  });

  it("rejects an invalid master before reading cached reports", async () => {
    let listed = false;
    const service = new ProjectService(fakePort({
      listReports: () => {
        listed = true;
        return inventory;
      },
    },),);

    const result = await service.listReports("file:///fragment.tji",);

    assertEquals(listed, false,);
    assert(!result.ok,);
  });

  it("turns a cached-list exception into a structured failure", async () => {
    const service = new ProjectService(fakePort({
      listReports: () => {
        throw new Error("cache failed",);
      },
    },),);

    const result = await service.listReports("file:///master.smx",);

    assertEquals(result, { ok: false, error: "cache failed", messages: [], },);
  });

  it("renders one exact report and returns its in-memory envelope", async () => {
    const outcome = envelope();
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort({
      executeProject: (_uri, options,) => {
        requested = options;
        return Promise.resolve(outcome,);
      },
    },),);

    const result = await service.renderReports("file:///master.smx", {
      report: "overview",
    },);

    assertEquals(requested, { report: "overview", reportsIsRegex: false, },);
    assert(result.ok,);
    assertStrictEquals(result.value, outcome,);
    assertEquals(result.messages, [warning,],);
  });

  it("renders every report matching a regular expression", async () => {
    const outcome = envelope([overview, resourceOverview,],);
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort({
      executeProject: (_uri, options,) => {
        requested = options;
        return Promise.resolve(outcome,);
      },
    },),);

    const result = await service.renderReports("file:///master.smx", {
      report: "Overview$",
      reportsIsRegex: true,
    },);

    assertEquals(requested, {
      report: "Overview$",
      reportsIsRegex: true,
    },);
    assert(result.ok,);
    assertEquals(result.value.results.reports?.reports.map((r,) => r.name), [
      "overview",
      "resourceOverview",
    ],);
  });

  it("renders all reports when the selection is empty", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort({
      executeProject: (_uri, options,) => {
        requested = options;
        return Promise.resolve(envelope(),);
      },
    },),);

    const result = await service.renderReports("file:///master.smx", {},);

    assertEquals(requested, {},);
    assert(result.ok,);
    assertEquals(result.value.results.reports?.reports, [overview,],);
  });

  it("forwards dynamic attributes without dropping an empty snippet", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort({
      executeProject: (_uri, options,) => {
        requested = options;
        return Promise.resolve(envelope(),);
      },
    },),);

    await service.renderReports("file:///master.smx", {
      report: "overview",
      dynamicAttributes: "",
    },);

    assertEquals(requested, {
      report: "overview",
      reportsIsRegex: false,
      dynamicAttributes: "",
    },);
  });

  it("turns a render exception into a structured failure", async () => {
    const service = new ProjectService(fakePort({
      executeProject: () => Promise.reject(new Error("render failed",),),
    },),);

    const result = await service.renderReports("file:///master.smx", {},);

    assertEquals(result, { ok: false, error: "render failed", messages: [], },);
  });

  it("renders and returns one exact report entry", async () => {
    let requested: BuildRequestOptions | undefined;
    const service = new ProjectService(fakePort({
      executeProject: (_uri, options,) => {
        requested = options;
        return Promise.resolve(envelope(),);
      },
    },),);

    const result = await service.renderReport(
      "file:///master.smx",
      "overview",
      "hide empty",
    );

    assertEquals(requested, {
      report: "overview",
      reportsIsRegex: false,
      dynamicAttributes: "hide empty",
    },);
    assertEquals(result, { ok: true, value: overview, messages: [warning,], },);
  });

  it("reports a missing rendered report without losing execution messages", async () => {
    const service = new ProjectService(fakePort({
      executeProject: () => Promise.resolve(envelope([],),),
    },),);

    const result = await service.renderReport(
      "file:///master.smx",
      "missing",
    );

    assertEquals(result, {
      ok: false,
      error: "report not rendered: missing",
      messages: [warning,],
    },);
  });

  it("surfaces report-entry errors as a structured failure", async () => {
    const failed: ReportJsonEntry = {
      ...overview,
      formats: [],
      errors: ["unknown format",],
    };
    const service = new ProjectService(fakePort({
      executeProject: () => Promise.resolve(envelope([failed,],),),
    },),);

    const result = await service.renderReport(
      "file:///master.smx",
      "overview",
    );

    assertEquals(result, {
      ok: false,
      error: "report overview failed: unknown format",
      messages: [warning,],
    },);
  });
});

describe("HTML report selection", () => {
  it("selects HTML content from the declared formats", () => {
    const result = selectHtmlFormat(overview,);

    assertEquals(result, {
      ok: true,
      value: { format: "html", content: "<h1>Overview</h1>", },
      messages: [],
    },);
  });

  it("lists available formats in declaration order when HTML is absent", () => {
    const result = selectHtmlFormat({
      ...overview,
      formats: [
        { format: "markdown", content: "# Overview", },
        { format: "csv", content: "id,name\n", },
      ],
    },);

    assert(!result.ok,);
    assertStringIncludes(result.error, "overview",);
    assertStringIncludes(result.error, "markdown, csv",);
  });

  it("reports none when a report has no formats", () => {
    const result = selectHtmlFormat({ ...overview, formats: [], },);

    assert(!result.ok,);
    assertStringIncludes(result.error, "none",);
  });

  it("opens only the selected HTML content and returns null", () => {
    const opened: string[] = [];
    const result = openHtmlReport(
      overview,
      (content: string,) => opened.push(content,),
    );

    assertEquals(opened, ["<h1>Overview</h1>",],);
    assertEquals(result, { ok: true, value: null, messages: [], },);
  });

  it("does not open a panel when HTML is absent", () => {
    let opened = false;
    const result = openHtmlReport(
      { ...overview, formats: [{ format: "csv", content: "id,name\n", },], },
      () => {
        opened = true;
      },
    );

    assertEquals(opened, false,);
    assert(!result.ok,);
    assertStringIncludes(result.error, "csv",);
  });
});

describe("Report command actions", () => {
  it("lists an explicit project and pattern without prompting", async () => {
    let requestedProject: string | undefined;
    let requestedPattern: string | undefined;
    const harness = reportHarness({
      projectUri: (explicit?: string,) => {
        requestedProject = explicit;
        return Promise.resolve("file:///explicit.smx",);
      },
      service: {
        listReports: (uri, pattern,) => {
          assertEquals(uri, "file:///explicit.smx",);
          requestedPattern = pattern;
          return Promise.resolve({
            ok: true,
            value: inventory,
            messages: [],
          },);
        },
      },
    },);

    const result = await listReportsCommand(
      "file:///explicit.smx",
      "^task",
      harness.dependencies,
    );

    assertEquals(requestedProject, "file:///explicit.smx",);
    assertEquals(requestedPattern, "^task",);
    assertEquals(harness.picks, [],);
    assertEquals(result, { ok: true, value: inventory, messages: [], },);
  });

  it("surfaces list failures and returns them to the caller", async () => {
    const failure: CommandResult<ListReportsEntry[]> = {
      ok: false,
      error: "invalid report pattern",
      messages: [],
    };
    const harness = reportHarness({
      service: { listReports: () => Promise.resolve(failure,), },
    },);

    const result = await listReportsCommand(
      undefined,
      "[",
      harness.dependencies,
    );

    assertEquals(result, failure,);
    assertEquals(harness.errors, ["SyntaxMesh: invalid report pattern",],);
  });

  it("renders an explicit exact selection without prompting", async () => {
    let selection: Parameters<ReportService["renderReports"]>[1] | undefined;
    const outcome = envelope([overview, resourceOverview,],);
    const harness = reportHarness({
      service: {
        renderReports: (_uri, requested,) => {
          selection = requested;
          return Promise.resolve({
            ok: true,
            value: outcome,
            messages: [warning,],
          },);
        },
      },
    },);

    const result = await renderReportsCommand(
      "file:///master.smx",
      "overview",
      false,
      "hide empty",
      harness.dependencies,
    );

    assertEquals(selection, {
      report: "overview",
      reportsIsRegex: false,
      dynamicAttributes: "hide empty",
    },);
    assertEquals(harness.picks, [],);
    assertEquals(result, { ok: true, value: outcome, messages: [warning,], },);
  });

  it("renders all reports when no selection is supplied", async () => {
    let selection: Parameters<ReportService["renderReports"]>[1] | undefined;
    const harness = reportHarness({
      service: {
        renderReports: (_uri, requested,) => {
          selection = requested;
          return Promise.resolve({
            ok: true,
            value: envelope(),
            messages: [],
          },);
        },
      },
    },);

    await renderReportsCommand(
      undefined,
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(selection, {},);
    assertEquals(harness.picks, [],);
  });

  it("opens an explicit report without listing or prompting", async () => {
    let listed = false;
    let rendered: { uri: string; id: string; attributes?: string } | undefined;
    let opened: { entry: ReportJsonEntry; uri: string } | undefined;
    const harness = reportHarness({
      service: {
        listReports: () => {
          listed = true;
          return Promise.resolve({
            ok: true,
            value: inventory,
            messages: [],
          },);
        },
        renderReport: (uri, id, attributes,) => {
          rendered = { uri, id, attributes, };
          return Promise.resolve({
            ok: true,
            value: overview,
            messages: [warning,],
          },);
        },
      },
      openHtml: (entry: ReportJsonEntry, uri: string,) => {
        opened = { entry, uri, };
        return Promise.resolve({ ok: true, value: null, messages: [], },);
      },
    },);

    const result = await openReportCommand(
      "file:///master.smx",
      "overview",
      "hide empty",
      harness.dependencies,
    );

    assertEquals(listed, false,);
    assertEquals(rendered, {
      uri: "file:///master.smx",
      id: "overview",
      attributes: "hide empty",
    },);
    assertEquals(opened, { entry: overview, uri: "file:///master.smx", },);
    assertEquals(harness.picks, [],);
    assertEquals(result, { ok: true, value: null, messages: [], },);
  });

  it("prompts from cached inventory when open has no report argument", async () => {
    let rendered = "";
    const harness = reportHarness({
      pick: {
        label: "resourceOverview",
        description: "resourcereport",
        report: "resourceOverview",
      },
      service: {
        renderReport: (_uri, id,) => {
          rendered = id;
          return Promise.resolve({
            ok: true,
            value: resourceOverview,
            messages: [],
          },);
        },
      },
    },);

    await openReportCommand(
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(rendered, "resourceOverview",);
    assertEquals(harness.picks, [quickPickItems(inventory,),],);
  });

  it("does not render or open when the report prompt is canceled", async () => {
    let rendered = false;
    let opened = false;
    const harness = reportHarness({
      pick: undefined,
      service: {
        renderReport: () => {
          rendered = true;
          return Promise.resolve({ ok: true, value: overview, messages: [], },);
        },
      },
      openHtml: () => {
        opened = true;
        return Promise.resolve({ ok: true, value: null, messages: [], },);
      },
    },);

    const result = await openReportCommand(
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(result, undefined,);
    assertEquals(rendered, false,);
    assertEquals(opened, false,);
  });

  it("reports an empty inventory without prompting or rendering", async () => {
    let rendered = false;
    const harness = reportHarness({
      service: {
        listReports: () =>
          Promise.resolve({ ok: true, value: [], messages: [], },),
        renderReport: () => {
          rendered = true;
          return Promise.resolve({ ok: true, value: overview, messages: [], },);
        },
      },
    },);

    const result = await openReportCommand(
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(result, undefined,);
    assertEquals(rendered, false,);
    assertEquals(harness.picks, [],);
    assertEquals(harness.infos, ["SyntaxMesh: no reports declared.",],);
  });

  it("surfaces render failures without opening a panel", async () => {
    let opened = false;
    const failure: CommandResult<ReportJsonEntry> = {
      ok: false,
      error: "report not rendered: missing",
      messages: [warning,],
    };
    const harness = reportHarness({
      service: { renderReport: () => Promise.resolve(failure,), },
      openHtml: () => {
        opened = true;
        return Promise.resolve({ ok: true, value: null, messages: [], },);
      },
    },);

    const result = await openReportCommand(
      "file:///master.smx",
      "missing",
      undefined,
      harness.dependencies,
    );

    assertEquals(result, failure,);
    assertEquals(opened, false,);
    assertEquals(harness.errors, [
      "SyntaxMesh: report not rendered: missing",
    ],);
  });

  it("surfaces HTML-only failures from the presenter", async () => {
    const failure: CommandResult<null> = {
      ok: false,
      error: "report overview has no HTML format; available formats: csv",
      messages: [],
    };
    const harness = reportHarness({
      openHtml: () => Promise.resolve(failure,),
    },);

    const result = await openReportCommand(
      "file:///master.smx",
      "overview",
      undefined,
      harness.dependencies,
    );

    assertEquals(result, failure,);
    assertEquals(harness.errors, [`SyntaxMesh: ${failure.error}`,],);
  });

  it("does not call report services when project resolution is canceled", async () => {
    let called = false;
    const harness = reportHarness({
      projectUri: () => Promise.resolve(undefined,),
      service: {
        listReports: () => {
          called = true;
          return Promise.resolve({
            ok: true,
            value: inventory,
            messages: [],
          },);
        },
      },
    },);

    const result = await listReportsCommand(
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(result, undefined,);
    assertEquals(called, false,);
  });
});

describe("Report export", () => {
  it("exports the requested format and attributes to an explicit target", async () => {
    const outcome = envelope();
    let selection: Parameters<ReportService["renderReports"]>[1] | undefined;
    const harness = reportHarness({
      service: {
        renderReports: (_uri, requested,) => {
          selection = requested;
          return Promise.resolve({
            ok: true,
            value: outcome,
            messages: [warning,],
          },);
        },
      },
    },);

    const result = await exportReport({
      projectUri: "file:///master.smx",
      reportId: "overview",
      format: "csv",
      dynamicAttributes: "hide empty",
      targetRootUri: "file:///workspace/export",
      fileName: "tasks.csv",
    }, {
      renderReports: harness.dependencies.service.renderReports,
      output: harness.dependencies.output,
    },);

    assertEquals(selection, {
      report: "overview",
      reportsIsRegex: false,
      dynamicAttributes: "hide empty",
    },);
    assertEquals(harness.writes, [{
      files: [{ path: "tasks.csv", content: "id,name\n", kind: "report", },],
      root: "file:///workspace/export",
    },],);
    assert(result.ok,);
    assertStrictEquals(result.value.execution, outcome,);
    assertEquals(result.value.artifact, {
      uri: "file:///workspace/export/tasks.csv",
      fileName: "tasks.csv",
      kind: "report",
    },);
    assertEquals(result.messages, [warning,],);
  });

  it("exports an exact id when the rendered display name differs", async () => {
    const outcome = envelope([{ ...overview, name: "Project TJP", },],);
    const harness = reportHarness({
      service: {
        renderReports: () =>
          Promise.resolve({ ok: true, value: outcome, messages: [warning,], },),
      },
    },);

    const result = await exportReport({
      projectUri: "file:///master.smx",
      reportId: "full",
      format: "csv",
      targetRootUri: "file:///workspace/export",
      fileName: "project.tjp",
    }, {
      renderReports: harness.dependencies.service.renderReports,
      output: harness.dependencies.output,
    },);

    assert(result.ok,);
    assertEquals(harness.writes, [{
      files: [{ path: "project.tjp", content: "id,name\n", kind: "report", },],
      root: "file:///workspace/export",
    },],);
  });

  it("fails without writes when the requested format is unavailable", async () => {
    const harness = reportHarness();

    const result = await exportReport({
      projectUri: "file:///master.smx",
      reportId: "overview",
      format: "json",
      targetRootUri: "file:///workspace/export",
      fileName: "overview.json",
    }, {
      renderReports: harness.dependencies.service.renderReports,
      output: harness.dependencies.output,
    },);

    assert(!result.ok,);
    assertStringIncludes(result.error, "json",);
    assertStringIncludes(result.error, "csv, html",);
    assertEquals(harness.writes, [],);
  });

  it("surfaces render failures without attempting output", async () => {
    const harness = reportHarness({
      service: {
        renderReports: () =>
          Promise.resolve({
            ok: false,
            error: "render failed",
            messages: [warning,],
          },),
      },
    },);

    const result = await exportReport({
      projectUri: "file:///master.smx",
      reportId: "overview",
      format: "csv",
      targetRootUri: "file:///workspace/export",
      fileName: "tasks.csv",
    }, {
      renderReports: harness.dependencies.service.renderReports,
      output: harness.dependencies.output,
    },);

    assertEquals(result, {
      ok: false,
      error: "render failed",
      messages: [warning,],
    },);
    assertEquals(harness.writes, [],);
  });

  it("confirms an existing target once and denial leaves bytes unchanged", async () => {
    const target = "file:///workspace/export/tasks.csv";
    const files = new Map([[target, "previous report",],],);
    const confirmations: string[][] = [];
    const io: Tj3HostIo = {
      resolve: (path, root,) =>
        new URL(
          path,
          root === undefined ? "file:///" : `${root.replace(/\/$/, "",)}/`,
        ).toString(),
      print: () => {},
      write: (path, content,) => {
        files.set(path, content,);
        return Promise.resolve();
      },
      mkpath: () => Promise.resolve(),
      copy: () => Promise.resolve(),
      listDir: () => Promise.resolve([],),
      isDir: () => Promise.resolve(false,),
      exists: (path,) => Promise.resolve(files.has(path,),),
    };
    const output = new OutputHost(io, {
      confirmOverwrite: (paths,) => {
        confirmations.push([...paths,],);
        return Promise.resolve(false,);
      },
    },);
    const service = fakeReportService();

    const result = await exportReport({
      projectUri: "file:///master.smx",
      reportId: "overview",
      format: "csv",
      targetRootUri: "file:///workspace/export",
      fileName: "tasks.csv",
    }, { renderReports: service.renderReports, output, },);

    assert(!result.ok,);
    assertEquals(confirmations, [[target,],],);
    assertEquals(files.get(target,), "previous report",);
  });
});

describe("Report export command", () => {
  it("uses an explicit destination without opening a save dialog", async () => {
    const harness = reportHarness();

    const result = await exportReportCommand(
      "file:///master.smx",
      "overview",
      "csv",
      "hide empty",
      "file:///workspace/export",
      "tasks.csv",
      harness.dependencies,
    );

    assert(result?.ok,);
    assertEquals(harness.saves, [],);
    assertEquals(harness.formatPicks, [],);
    assertEquals(harness.writes, [{
      files: [{ path: "tasks.csv", content: "id,name\n", kind: "report", },],
      root: "file:///workspace/export",
    },],);
  });

  it("suggests a report file beside the master and splits the selected URI", async () => {
    const harness = reportHarness({
      saveUri: "file:///workspace/export/custom.csv",
    },);

    const result = await exportReportCommand(
      "file:///workspace/master.smx",
      "overview",
      "csv",
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assert(result?.ok,);
    assertEquals(harness.saves, [{
      defaultUri: "file:///workspace/overview.csv",
    },],);
    assertEquals(harness.writes, [{
      files: [{ path: "custom.csv", content: "id,name\n", kind: "report", },],
      root: "file:///workspace/export/",
    },],);
  });

  it("prompts for an available format and renders only once", async () => {
    let renders = 0;
    const harness = reportHarness({
      format: "csv",
      service: {
        renderReports: () => {
          renders += 1;
          return Promise.resolve({
            ok: true,
            value: envelope(),
            messages: [],
          },);
        },
      },
    },);

    const result = await exportReportCommand(
      "file:///master.smx",
      "overview",
      undefined,
      "hide empty",
      "file:///workspace/export",
      "tasks.csv",
      harness.dependencies,
    );

    assert(result?.ok,);
    assertEquals(renders, 1,);
    assertEquals(harness.formatPicks, [["csv", "html",],],);
    assertEquals(harness.writes[0]?.files, [{
      path: "tasks.csv",
      content: "id,name\n",
      kind: "report",
    },],);
  });

  it("offers formats for an exact id independently of its display name", async () => {
    const outcome = envelope([{ ...overview, name: "Project TJP", },],);
    const harness = reportHarness({
      format: "csv",
      service: {
        renderReports: () =>
          Promise.resolve({ ok: true, value: outcome, messages: [], },),
      },
    },);

    const result = await exportReportCommand(
      "file:///master.smx",
      "full",
      undefined,
      undefined,
      "file:///workspace/export",
      "project.tjp",
      harness.dependencies,
    );

    assert(result?.ok,);
    assertEquals(harness.formatPicks, [["csv", "html",],],);
    assertEquals(harness.writes[0]?.files, [{
      path: "project.tjp",
      content: "id,name\n",
      kind: "report",
    },],);
  });

  it("does not render or write when the save dialog is canceled", async () => {
    let rendered = false;
    const harness = reportHarness({
      service: {
        renderReports: () => {
          rendered = true;
          return Promise.resolve({
            ok: true,
            value: envelope(),
            messages: [],
          },);
        },
      },
    },);

    const result = await exportReportCommand(
      "file:///master.smx",
      "overview",
      "csv",
      undefined,
      undefined,
      undefined,
      harness.dependencies,
    );

    assertEquals(result, undefined,);
    assertEquals(rendered, false,);
    assertEquals(harness.writes, [],);
  });
});

describe("Report command contributions", () => {
  it("contributes list, render and open as public commands", () => {
    const manifest = JSON.parse(
      Deno.readTextFileSync(new URL("../../package.json", import.meta.url,),),
    ) as { contributes: { commands: { command: string }[] } };
    const declared = new Set(
      manifest.contributes.commands.map((command,) => command.command),
    );

    for (
      const id of [
        "syntaxmesh.report.list",
        "syntaxmesh.report.render",
        "syntaxmesh.report.open",
        "syntaxmesh.report.export",
      ]
    ) {
      assert((PUBLIC_COMMAND_IDS as readonly string[]).includes(id,),);
      assert(declared.has(id,), `${id} must be contributed`,);
    }
  });
});
