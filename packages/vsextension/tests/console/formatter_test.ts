/**
 * Pure console formatter regressions (22.12.15). Every formatter consumes plain
 * command data and returns deterministic, ANSI-free text without editor APIs.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionResult,
  ExecutionResults,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import type { ArtifactResult, } from "../../src/commands/contracts.ts";
import type { ManCommandResult, } from "../../src/commands/manual.ts";
import type { Tj3RunResult, } from "../../src/commands/run.ts";
import type { SheetCommandResult, } from "../../src/commands/sheets.ts";
import type { ProjectSummary, } from "../../src/daemon/types.ts";
import {
  formatExecutionResult,
  formatManResult,
  formatProjectList,
  formatReportList,
  formatRunResult,
  formatSheetResult,
} from "../../src/console/formatter.ts";

/** Complete options echo with deterministic defaults for formatter fixtures. */
function options(
  overrides: Partial<ExecutionOptionsEcho> = {},
): ExecutionOptionsEcho {
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
    app: null,
    appOptions: null,
    ...overrides,
  };
}

/** Builds one complete execution envelope around the supplied sections. */
function execution(
  results: ExecutionResults = {},
  messages: ExecutionMessage[] = [],
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: options(),
    messages,
    results,
    ...overrides,
  };
}

/** One classified artifact fixture. */
function artifact(
  fileName: string,
  kind: ArtifactResult["kind"],
): ArtifactResult {
  return { uri: `file:///workspace/${fileName}`, fileName, kind, };
}

describe("console formatter purity and lists", () => {
  it("contains no editor, Node or host-global dependency", () => {
    const source = Deno.readTextFileSync(
      new URL("../../src/console/formatter.ts", import.meta.url,),
    );
    assert(
      !source.includes('from "vscode"',),
      "formatter imports the editor API",
    );
    assert(!source.includes("node:",), "formatter imports a Node API",);
    assert(!source.includes("Deno.",), "formatter uses a host global",);
  });

  it("formats project status, active marker, report count, intent and URI", () => {
    const projects: ProjectSummary[] = [{
      uri: "file:///workspace/master.smx",
      entry: "master.smx",
      status: "ok",
      reportCount: 2,
      addedAt: 1,
      reloadedAt: 2,
      active: true,
      lastIntent: "compile",
    }, {
      uri: "file:///workspace/other.tjp",
      entry: "other.tjp",
      status: "error",
      reportCount: 0,
      addedAt: 3,
      reloadedAt: 3,
      active: false,
      lastIntent: "inventory",
    },];
    assertEquals(
      formatProjectList(projects,),
      [
        "Projects:",
        "  * master.smx [ok] reports=2 intent=compile file:///workspace/master.smx",
        "  - other.tjp [error] reports=0 intent=inventory file:///workspace/other.tjp",
        "",
      ].join("\n",),
    );
  });

  it("formats empty project and report lists explicitly", () => {
    assertEquals(formatProjectList([],), "No projects loaded.\n",);
    assertEquals(formatReportList([],), "No reports declared.\n",);
  });

  it("formats report names and types in declaration order", () => {
    const reports: ListReportsEntry[] = [{
      name: "overview",
      type: "taskreport",
    }, {
      name: "cost",
      type: "resourcereport",
    },];
    assertEquals(
      formatReportList(reports,),
      [
        "Reports:",
        "  overview (taskreport)",
        "  cost (resourcereport)",
        "",
      ].join("\n",),
    );
  });
});

describe("console execution formatter", () => {
  it("formats status, intent, exit code, entry, syntax and messages", () => {
    const result = execution({ check: { valid: true, }, }, [{
      severity: "warning",
      id: "deprecated",
      text: "use the new attribute",
      file: "master.smx",
      line: 4,
    },], {
      options: options({ checkSyntax: true, },),
    },);
    assertEquals(
      formatExecutionResult(result,),
      [
        "Execution: ok",
        "Intent: checkSyntax",
        "Exit code: 0",
        "Entry: master.smx",
        "Syntax: valid",
        "Messages:",
        "  master.smx:4: Warning: use the new attribute",
        "",
      ].join("\n",),
    );
  });

  it("formats failed execution and report format/error summaries", () => {
    const result = execution({
      reports: {
        ok: false,
        reports: [{
          name: "overview",
          stdout: false,
          selfcontained: true,
          formats: [{ format: "html", content: "<p>ok</p>", },],
          errors: [],
        }, {
          name: "broken",
          stdout: false,
          selfcontained: false,
          formats: [],
          errors: ["unknown format",],
        },],
      },
    }, [{
      severity: "error",
      id: "schedule_failed",
      text: "schedule failed",
      file: null,
      line: null,
    },], {
      ok: false,
      exitCode: 1,
      options: options({ report: "overview", },),
    },);
    assertEquals(
      formatExecutionResult(result,),
      [
        "Execution: failed",
        "Intent: report",
        "Exit code: 1",
        "Entry: master.smx",
        "Messages:",
        "  Error: schedule failed",
        "Reports:",
        "  overview: html",
        "  broken: errors: unknown format",
        "",
      ].join("\n",),
    );
  });

  it("lists freeze files and report inventory without rendering content", () => {
    const result = execution(
      {
        freeze: {
          files: [{
            fileName: "master-header.tji",
            contents: "now 2026-11-24",
          }, {
            fileName: "master-bookings.tji",
            contents: "booking data",
          },],
        },
        listReports: [{ name: "overview", type: "taskreport", },],
      },
      [],
      {
        options: options({ freeze: { date: "2026-11-24", }, },),
      },
    );
    assertEquals(
      formatExecutionResult(result,),
      [
        "Execution: ok",
        "Intent: freeze",
        "Exit code: 0",
        "Entry: master.smx",
        "Report list:",
        "  overview (taskreport)",
        "Freeze files:",
        "  master-header.tji",
        "  master-bookings.tji",
        "",
      ].join("\n",),
    );
  });
});

describe("console command-result formatters", () => {
  it("formats manual stdout, execution messages and artifact names", () => {
    const manualExecution = execution({
      man: {
        format: "text",
        keywords: ["task",],
        content: "manual text\n",
        files: [],
      },
    }, [{
      severity: "info",
      id: "manual_ready",
      text: "manual ready",
      file: null,
      line: null,
    },], {
      options: options({ man: { format: "text", keywords: ["task",], }, },),
    },);
    const result: ManCommandResult = {
      execution: manualExecution,
      artifacts: [artifact("manual.txt", "manual",),],
      stdout: "manual text\n",
    };
    assertEquals(
      formatManResult(result,),
      [
        "manual text",
        "Messages:",
        "  Info: manual ready",
        "Artifacts:",
        "  manual.txt (manual)",
        "",
      ].join("\n",),
    );
  });

  it("uses manual content when stdout is empty and no file was written", () => {
    const result: ManCommandResult = {
      execution: execution(
        {
          man: {
            format: "smx",
            keywords: [],
            content: "task example\n",
            files: [],
          },
        },
        [],
        {
          options: options({ man: { format: "smx", }, },),
        },
      ),
      artifacts: [],
      stdout: "",
    };
    assertEquals(formatManResult(result,), "task example\n",);
  });

  it("formats sheet stdout, stderr, email text and artifact names", () => {
    const sheetExecution = execution(
      {
        sheet: {
          app: "ts-send",
          exitCode: 0,
          emailText: "Subject: Time sheet\n\nbody\n",
          emails: [{
            to: "dev@example.test",
            subject: "Time sheet",
            text: "Subject: Time sheet\n\nbody\n",
          },],
        },
      },
      [],
      {
        options: options({ app: "ts-send", },),
      },
    );
    const result: SheetCommandResult = {
      execution: sheetExecution,
      artifacts: [
        artifact("TimeSheets/dev.tji", "sheet",),
        artifact("outbox/dev.eml", "email",),
      ],
      stdout: "Time sheet summary\n",
      stderr: "Warning: check recipient\n",
    };
    assertEquals(
      formatSheetResult(result,),
      [
        "Time sheet summary",
        "Warning: check recipient",
        "Subject: Time sheet",
        "",
        "body",
        "Artifacts:",
        "  TimeSheets/dev.tji (sheet)",
        "  outbox/dev.eml (email)",
        "",
      ].join("\n",),
    );
  });

  it("does not duplicate email text already present in sheet stdout", () => {
    const email = "Subject: Time sheet\n\nbody\n";
    const result: SheetCommandResult = {
      execution: execution(
        {
          sheet: { app: "ts-summary", emailText: email, },
        },
        [],
        {
          options: options({ app: "ts-summary", },),
        },
      ),
      artifacts: [],
      stdout: email,
      stderr: "",
    };
    assertEquals(formatSheetResult(result,), email,);
  });

  it("formats run stdout, stderr and artifact names without re-rendering messages", () => {
    const result: Tj3RunResult = {
      execution: execution({}, [{
        severity: "error",
        id: "failed",
        text: "already rendered on stderr",
        file: null,
        line: null,
      },], { ok: false, exitCode: 1, },),
      artifacts: [artifact("overview.csv", "report",),],
      stdout: "report output\n",
      stderr: "Error: already rendered on stderr\n",
    };
    assertEquals(
      formatRunResult(result,),
      [
        "report output",
        "Error: already rendered on stderr",
        "Artifacts:",
        "  overview.csv (report)",
        "",
      ].join("\n",),
    );
  });
});
