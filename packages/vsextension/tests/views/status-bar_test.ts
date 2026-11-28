/**
 * Unit tests of the pure aggregate/busy status-bar projection (22.12.18). BDD +
 * `@std/assert`, no `vscode` runtime — cached models and activity are plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertRejects, } from "@std/assert";
import type {
  ExecutionOptionsEcho,
  ExecutionResult,
} from "@vanaware/syntaxmesh";
import type { ProjectIntent, ProjectModel, } from "../../src/daemon/types.ts";
import {
  ExecutionActivity,
  projectStatusState,
  STATUS_BAR_COMMAND,
  statusText,
} from "../../src/views/status-bar.ts";

/** Complete option echo used by cached inventory envelopes. */
const ECHO: ExecutionOptionsEcho = {
  entry: "master.tjp",
  files: ["master.tjp",],
  configContent: null,
  checkSyntax: false,
  listReports: ".",
  listReportsIsRegex: false,
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

interface ModelOptions {
  text?: string;
  reports?: number;
  status?: ProjectModel["status"];
  intent?: ProjectIntent;
  errorCount?: number;
}

/** Builds one cached model with optional execution metadata and inventory. */
function model(uri: string, options: ModelOptions = {},): ProjectModel {
  const reports = Array.from(
    { length: options.reports ?? 0, },
    (_, index,) => ({
      name: `report${index}`,
      type: "taskreport",
    }),
  );
  const envelope: ExecutionResult = {
    ok: options.status !== "error",
    exitCode: options.status === "error" ? 1 : 0,
    options: ECHO,
    messages: [],
    results: { listReports: reports, },
  };
  const lastExecution = options.intent === undefined ? undefined : {
    intent: options.intent,
    startedAt: 1,
    finishedAt: 2,
    errorCount: options.errorCount ?? 0,
  };
  return {
    uri,
    entry: "master.tjp",
    files: [{
      path: "master.tjp",
      content: options.text ??
        'project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {}',
    },],
    envelope,
    status: options.status ?? "ok",
    addedAt: 0,
    reloadedAt: 0,
    ...(lastExecution === undefined ? {} : { lastExecution, }),
  };
}

describe("status-bar (22.12.18)", () => {
  it("projects the empty registry as aggregate idle state", () => {
    const state = projectStatusState([], null, false,);

    assertEquals(state, {
      status: "idle",
      projectCount: 0,
      activeUri: null,
      busy: false,
      lastIntent: "inventory",
      errorCount: 0,
    },);
    assertEquals(
      statusText(state,),
      "SyntaxMesh: idle · 0 projects · 0 errors · inventory",
    );
  });

  it("aggregates project/error counts and preserves active locale/reports", () => {
    const first = model("file:///first/master.tjp", {
      status: "error",
      intent: "compile",
      errorCount: 2,
      reports: 1,
    },);
    const active = model("file:///active/master.tjp", {
      text:
        'language "es"\nproject prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {}',
      intent: "report",
      errorCount: 1,
      reports: 2,
    },);
    const state = projectStatusState([first, active,], active.uri, false,);

    assertEquals(state, {
      status: "error",
      locale: "es",
      reportCount: 2,
      projectCount: 2,
      activeUri: active.uri,
      busy: false,
      lastIntent: "report",
      errorCount: 3,
    },);
    assertEquals(
      statusText(state,),
      "SyntaxMesh: error · es · 2 projects · 3 errors · report",
    );
  });

  it("shows aggregate counts when no single project is active", () => {
    const project = model("file:///only/master.tjp", {
      intent: "compile",
      reports: 4,
    },);
    const state = projectStatusState([project,], null, false,);

    assertEquals(state, {
      status: "ok",
      projectCount: 1,
      activeUri: null,
      busy: false,
      lastIntent: "inventory",
      errorCount: 0,
    },);
    assertEquals(
      statusText(state,),
      "SyntaxMesh: ok · 1 projects · 0 errors · inventory",
    );
  });

  it("defaults missing execution metadata to inventory and zero errors", () => {
    const project = model("file:///new/master.tjp",);
    const state = projectStatusState([project,], project.uri, false,);

    assertEquals(state.lastIntent, "inventory",);
    assertEquals(state.errorCount, 0,);
    assertEquals(state.reportCount, 0,);
    assertEquals(state.locale, "en",);
  });

  it("renders busy state without losing locale, reports, counts or intent", () => {
    const project = model("file:///active/master.tjp", {
      text:
        'language "pt_BR"\nproject prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {}',
      intent: "scheduleOnly",
      reports: 3,
    },);
    const state = projectStatusState([project,], project.uri, true,);

    assertEquals(state.busy, true,);
    assertEquals(
      statusText(state,),
      "SyntaxMesh: busy · pt-br · 1 projects · 3 reports · 0 errors · scheduleOnly",
    );
  });

  it("uses the canonical console command for the status-bar action", () => {
    assertEquals(STATUS_BAR_COMMAND, "syntaxmesh.console.open",);
  });

  it("keeps activity busy until overlapping executions settle", async () => {
    const activity = new ExecutionActivity();
    let releaseFirst!: () => void;
    const first = activity.run(() =>
      new Promise<void>((resolve,) => {
        releaseFirst = resolve;
      },)
    );
    assertEquals(activity.busy, true,);

    const second = activity.run(() => Promise.resolve("second",));
    assertEquals(await second, "second",);
    assertEquals(activity.busy, true,);

    releaseFirst();
    await first;
    assertEquals(activity.busy, false,);
  });

  it("clears activity after a failed execution", async () => {
    const activity = new ExecutionActivity();

    await assertRejects(
      () => activity.run(() => Promise.reject(new Error("boom",),)),
      Error,
      "boom",
    );
    assertEquals(activity.busy, false,);
  });
});
