/**
 * Pure console parser regressions (22.12.15). The parser owns only quote-aware
 * tokenization and semantic command normalization; F24 remains the authority for
 * `run`/`smx`/`tj3` option validation.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import {
  type ConsoleRequest,
  parseConsoleLine,
} from "../../src/console/parser.ts";

const PROJECT = "file:///workspace/master.smx";
const SPACED_PROJECT = "file:///workspace/my project.smx";

/** Parses one line and returns its request, failing the test on an error. */
function request(line: string,): ConsoleRequest {
  const result = parseConsoleLine(line,);
  assert(result.ok, result.ok ? undefined : result.error,);
  return result.value;
}

/** Asserts one exact parsed request. */
function assertRequest(line: string, expected: ConsoleRequest,): void {
  assertEquals(parseConsoleLine(line,), { ok: true, value: expected, },);
}

/** Asserts a usage error containing the relevant detail. */
function assertError(line: string, detail: string,): void {
  const result = parseConsoleLine(line,);
  assert(!result.ok, `expected parse failure for: ${line}`,);
  assertStringIncludes(result.error, detail,);
}

describe("console tokenizer and run normalization", () => {
  it("preserves quoted paths, quoted spaces and empty quoted arguments", () => {
    assertRequest(
      `run "${SPACED_PROJECT}" "" --report "overview report"`,
      {
        kind: "run",
        argv: [SPACED_PROJECT, "", "--report", "overview report",],
      },
    );
  });

  it("joins adjacent quoted and unquoted segments without invoking a shell", () => {
    assertRequest(
      `run file:///workspace/"my project".smx 'overview report'`,
      {
        kind: "run",
        argv: ["file:///workspace/my project.smx", "overview report",],
      },
    );
  });

  it("removes the run prefix and leaves F24 validation to dispatch", () => {
    assertRequest("run --debug master.smx", {
      kind: "run",
      argv: ["--debug", "master.smx",],
    },);
  });

  it("normalizes smx and tj3 to the same run request", () => {
    const expected: ConsoleRequest = {
      kind: "run",
      argv: ["master.smx", "--no-reports",],
    };
    assertRequest("smx master.smx --no-reports", expected,);
    assertRequest("tj3 master.smx --no-reports", expected,);
  });

  it("normalizes bare man, ts and ss forms to run requests", () => {
    assertRequest("man task", {
      kind: "run",
      argv: ["man", "task",],
    },);
    assertEquals(parseConsoleLine("ts summary master.smx --dry-run",), {
      ok: true,
      value: {
        kind: "run",
        argv: ["ts", "summary", "master.smx", "--dry-run",],
        useActiveProject: true,
      },
    },);
    assertEquals(parseConsoleLine("ss receive --from - master.smx",), {
      ok: true,
      value: {
        kind: "run",
        argv: ["ss", "receive", "--from", "-", "master.smx",],
        useActiveProject: true,
      },
    },);
  });

  it("marks bare sheet commands without a master for active-project fallback", () => {
    assertEquals(parseConsoleLine("ts summary --dry-run",), {
      ok: true,
      value: {
        kind: "run",
        argv: ["ts", "summary", "--dry-run",],
        useActiveProject: true,
      },
    },);
    assertEquals(parseConsoleLine("ss send --dry-run",), {
      ok: true,
      value: {
        kind: "run",
        argv: ["ss", "send", "--dry-run",],
        useActiveProject: true,
      },
    },);
  });

  it("does not mark prefixed sheet commands for active-project fallback", () => {
    for (const prefix of ["run", "smx", "tj3",]) {
      assertRequest(`${prefix} ts summary --dry-run`, {
        kind: "run",
        argv: ["ts", "summary", "--dry-run",],
      },);
    }
  });

  it("preserves receiver stdin sentinels for the host adapter", () => {
    assertRequest("run ts receive master.smx --from -", {
      kind: "run",
      argv: ["ts", "receive", "master.smx", "--from", "-",],
    },);
  });

  it("rejects unterminated single and double quotes", () => {
    assertError(`run "${PROJECT}`, "unterminated",);
    assertError("run 'master.smx", "unterminated",);
  });
});

describe("console project requests", () => {
  const actions = [
    ["add", "add",],
    ["remove", "remove",],
    ["set-active", "setActive",],
    ["refresh", "refresh",],
  ] as const;

  for (const [verb, action,] of actions) {
    it(`parses project ${verb} with a quoted explicit project`, () => {
      assertRequest(`project ${verb} "${SPACED_PROJECT}"`, {
        kind: "project",
        action,
        project: SPACED_PROJECT,
      },);
    });

    it(`allows project ${verb} to fall back to host resolution`, () => {
      assertRequest(`project ${verb}`, { kind: "project", action, },);
    });
  }

  it("parses project list without a project argument", () => {
    assertRequest("project list", { kind: "project", action: "list", },);
  });

  it("accepts --project and rejects a duplicate positional project", () => {
    assertRequest(`project add --project "${SPACED_PROJECT}"`, {
      kind: "project",
      action: "add",
      project: SPACED_PROJECT,
    },);
    assertError(`project add ${PROJECT} --project ${PROJECT}`, "project",);
  });
});

describe("console execution requests", () => {
  it("parses compile with every typed execution option", () => {
    assertRequest(
      `compile "${SPACED_PROJECT}" --config "config file.yaml" ` +
        "--output-dir reports --report overview " +
        `-A "hide project" --force-reports --abort-on-warnings ` +
        "--warn-ts-deltas --add-trace",
      {
        kind: "execute",
        action: "compile",
        project: SPACED_PROJECT,
        options: {
          configUri: "config file.yaml",
          outputDir: "reports",
          report: "overview",
          reportsIsRegex: false,
          dynamicAttributes: "hide project",
          forceReports: true,
          abortOnWarnings: true,
          warnTsDeltas: true,
          addTrace: true,
        },
      },
    );
  });

  it("allows compile to omit the project for active-project fallback", () => {
    assertRequest("compile", { kind: "execute", action: "compile", },);
  });

  it("maps check-syntax and no-reports semantic flags to actions", () => {
    assertRequest("compile --check-syntax", {
      kind: "execute",
      action: "checkSyntax",
    },);
    assertRequest("compile --no-reports", {
      kind: "execute",
      action: "scheduleOnly",
    },);
  });

  it("parses regex report selection through --reports", () => {
    assertRequest("compile --reports 'cost|task'", {
      kind: "execute",
      action: "compile",
      options: { report: "cost|task", reportsIsRegex: true, },
    },);
  });

  it("parses freeze date, grouping and execution options", () => {
    assertRequest(
      "freeze --freezedate 2026-11-24 --freeze-by-task --config config.yaml",
      {
        kind: "execute",
        action: "freeze",
        freezeDate: "2026-11-24",
        byTask: true,
        options: { configUri: "config.yaml", },
      },
    );
  });

  it("lets freeze flags select the freeze action from compile", () => {
    assertRequest("compile --freezebytask", {
      kind: "execute",
      action: "freeze",
      byTask: true,
    },);
  });

  it("rejects conflicting semantic actions", () => {
    assertError("compile --check-syntax --no-reports", "conflict",);
  });
});

describe("console report requests", () => {
  it("parses report list with a project and regular-expression pattern", () => {
    assertRequest(`report list ${PROJECT} --list-reports 'cost|task'`, {
      kind: "report",
      action: "list",
      project: PROJECT,
      pattern: "cost|task",
      reportsIsRegex: true,
    },);
  });

  it("supports a pattern without an explicit project", () => {
    assertRequest("report list --pattern overview", {
      kind: "report",
      action: "list",
      pattern: "overview",
      reportsIsRegex: true,
    },);
  });

  it("parses exact and regex render selections", () => {
    assertRequest(`report render ${PROJECT} --report overview`, {
      kind: "report",
      action: "render",
      project: PROJECT,
      report: "overview",
      reportsIsRegex: false,
    },);
    assertRequest("report render --reports 'cost|task'", {
      kind: "report",
      action: "render",
      report: "cost|task",
      reportsIsRegex: true,
    },);
  });

  it("parses report open with dynamic attributes", () => {
    assertRequest(
      `report open ${PROJECT} overview -A "hide project"`,
      {
        kind: "report",
        action: "open",
        project: PROJECT,
        report: "overview",
        dynamicAttributes: "hide project",
      },
    );
  });

  it("parses report export with format, target and dynamic attributes", () => {
    assertRequest(
      `report export ${PROJECT} overview --format csv ` +
        "--target file:///workspace/reports/ -A 'hide resource'",
      {
        kind: "report",
        action: "export",
        project: PROJECT,
        report: "overview",
        format: "csv",
        target: "file:///workspace/reports/",
        dynamicAttributes: "hide resource",
      },
    );
  });

  it("uses the first positional as project and the second as selection", () => {
    assertRequest(`report render ${PROJECT} overview`, {
      kind: "report",
      action: "render",
      project: PROJECT,
      report: "overview",
    },);
  });
});

describe("console sheet-check requests", () => {
  it("parses a sheet check with active-project fallback", () => {
    assertRequest('check-ts "time sheet.tji"', {
      kind: "sheet",
      action: "checkTimeSheet",
      sheet: "time sheet.tji",
    },);
  });

  it("parses project plus sheet and forwards sheet configuration", () => {
    assertRequest(
      `check-ss ${PROJECT} "status sheet.tji" --config config.yaml`,
      {
        kind: "sheet",
        action: "checkStatusSheet",
        project: PROJECT,
        sheet: "status sheet.tji",
        options: { configUri: "config.yaml", },
      },
    );
  });

  it("accepts an explicit project flag with one sheet positional", () => {
    assertRequest(`check-ts --project ${PROJECT} "time sheet.tji"`, {
      kind: "sheet",
      action: "checkTimeSheet",
      project: PROJECT,
      sheet: "time sheet.tji",
    },);
  });

  it("rejects a missing sheet and excess positional arguments", () => {
    assertError("check-ts", "sheet",);
    assertError(`check-ts ${PROJECT} sheet.tji extra`, "argument",);
  });
});

describe("console control requests and usage errors", () => {
  it("parses clear, help, version and exit", () => {
    assertRequest("clear", { kind: "clear", },);
    assertRequest("help", { kind: "help", },);
    assertRequest("version", { kind: "version", },);
    assertRequest("exit", { kind: "exit", },);
  });

  it("rejects empty input, unknown verbs and arbitrary command ids", () => {
    assertError("   ", "empty",);
    assertError("frobnicate", "unknown",);
    assertError("syntaxmesh.compile", "command id",);
    assertError("syntaxmesh.anything.goes", "command id",);
  });

  it("rejects missing nested actions", () => {
    assertError("project", "action",);
    assertError("report", "action",);
    assertError("project compile", "action",);
    assertError("report compile", "action",);
  });

  it("rejects missing option values", () => {
    assertError("compile --config", "requires a value",);
    assertError("compile --output-dir", "requires a value",);
    assertError("report render --report", "requires a value",);
    assertError("report list --list-reports", "requires a value",);
    assertError("report export --format", "requires a value",);
  });

  it("rejects deferred debug flags on semantic commands", () => {
    for (const flag of ["--debug", "--debuglevel", "--debugmodules",]) {
      assertError(`compile ${flag}`, "not yet available",);
    }
  });

  it("rejects values attached to boolean flags and unknown options", () => {
    assertError("compile --no-reports=true", "does not take a value",);
    assertError("compile --mystery", "unknown option",);
  });
});
