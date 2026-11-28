/**
 * Freeze output command tests (22.12.10). The pure command validates the core
 * envelope and submits both files as one confirmed output batch.
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
  FreezeFile,
} from "@vanaware/syntaxmesh";
import type { CommandResult, } from "../../src/commands/contracts.ts";
import type {
  ConfirmedOutputHost,
  ConfirmedWrite,
} from "../../src/cli/output-host.ts";
import { freezeOutput, } from "../../src/commands/freeze-output.ts";

const warning: ExecutionMessage = {
  severity: "warning",
  id: "freeze-warning",
  text: "freeze warning",
  file: "master.smx",
  line: 2,
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

function envelope(files: FreezeFile[],): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: echo,
    messages: [warning,],
    results: { freeze: { files, }, },
  };
}

interface OutputHarness {
  output: ConfirmedOutputHost;
  calls: { files: readonly ConfirmedWrite[]; root: string }[];
}

function outputHarness(
  result?: CommandResult<{ uri: string; fileName: string; kind: "freeze" }[]>,
): OutputHarness {
  const calls: OutputHarness["calls"] = [];
  return {
    calls,
    output: {
      resolve: (path, root,) => new URL(path, root ?? "file:///",).toString(),
      dispatch: () => Promise.reject(new Error("unused",),),
      writeAll: (files, root,) => {
        calls.push({ files, root, },);
        if (result !== undefined) return Promise.resolve(result,);
        return Promise.resolve({
          ok: true,
          value: files.map((file,) => ({
            uri: `${root.replace(/\/$/, "",)}/${file.path}`,
            fileName: file.path,
            kind: "freeze",
          })),
          messages: [],
        },);
      },
    },
  };
}

describe("freezeOutput", () => {
  it("writes header and bookings beside either supported master in order", async () => {
    for (
      const projectUri of [
        "file:///workspace/master.smx",
        "file:///workspace/master.tjp",
      ]
    ) {
      const execution = envelope([
        { fileName: "master-header.tji", contents: "now 2026-11-24-00:00\n", },
        { fileName: "master-bookings.tji", contents: "", },
      ],);
      const harness = outputHarness();
      let requested:
        | { uri: string; date?: string; byTask?: boolean }
        | undefined;

      const result = await freezeOutput({
        projectUri,
        freezeDate: "2026-11-24",
        byTask: false,
      }, {
        freeze: (uri, date, byTask,) => {
          requested = { uri, date, byTask, };
          return Promise.resolve({
            ok: true,
            value: execution,
            messages: [warning,],
          },);
        },
        output: harness.output,
      },);

      assertEquals(requested, {
        uri: projectUri,
        date: "2026-11-24",
        byTask: false,
      },);
      assertEquals(harness.calls, [{
        root: "file:///workspace/",
        files: [
          {
            path: "master-header.tji",
            content: "now 2026-11-24-00:00\n",
            kind: "freeze",
          },
          { path: "master-bookings.tji", content: "", kind: "freeze", },
        ],
      },],);
      assert(result.ok,);
      assertStrictEquals(result.value.execution, execution,);
      assertEquals(result.value.artifacts, [
        {
          uri: "file:///workspace/master-header.tji",
          fileName: "master-header.tji",
          kind: "freeze",
        },
        {
          uri: "file:///workspace/master-bookings.tji",
          fileName: "master-bookings.tji",
          kind: "freeze",
        },
      ],);
      assertEquals(result.messages, [warning,],);
    }
  });

  it("rejects empty, absolute and traversal file names before output", async () => {
    for (
      const invalid of [
        "",
        "/tmp/master-header.tji",
        "../master-header.tji",
        "dir/../master-header.tji",
        "C:\\master-header.tji",
      ]
    ) {
      const harness = outputHarness();
      const result = await freezeOutput({
        projectUri: "file:///workspace/master.smx",
      }, {
        freeze: () =>
          Promise.resolve({
            ok: true,
            value: envelope([
              { fileName: invalid, contents: "invalid\n", },
              { fileName: "master-bookings.tji", contents: "", },
            ],),
            messages: [warning,],
          },),
        output: harness.output,
      },);

      assert(!result.ok,);
      assertStringIncludes(result.error, "freeze path",);
      assertEquals(harness.calls, [],);
    }
  });

  it("submits both files as one confirmation batch", async () => {
    const harness = outputHarness();

    const result = await freezeOutput({
      projectUri: "file:///workspace/master.smx",
    }, {
      freeze: () =>
        Promise.resolve({
          ok: true,
          value: envelope([
            { fileName: "master-header.tji", contents: "now\n", },
            { fileName: "master-bookings.tji", contents: "", },
          ],),
          messages: [],
        },),
      output: harness.output,
    },);

    assert(result.ok,);
    assertEquals(harness.calls.length, 1,);
    assertEquals(harness.calls[0]?.files.length, 2,);
  });

  it("returns write failures with execution messages and no artifacts", async () => {
    const harness = outputHarness({
      ok: false,
      error: "SyntaxMesh: write failed",
      messages: [],
    },);

    const result = await freezeOutput({
      projectUri: "file:///workspace/master.smx",
    }, {
      freeze: () =>
        Promise.resolve({
          ok: true,
          value: envelope([
            { fileName: "master-header.tji", contents: "now\n", },
            { fileName: "master-bookings.tji", contents: "", },
          ],),
          messages: [warning,],
        },),
      output: harness.output,
    },);

    assertEquals(result, {
      ok: false,
      error: "SyntaxMesh: write failed",
      messages: [warning,],
    },);
  });

  it("fails without output when execution produced no freeze section", async () => {
    const harness = outputHarness();
    const execution: ExecutionResult = {
      ok: false,
      exitCode: 1,
      options: echo,
      messages: [warning,],
      results: {},
    };

    const result = await freezeOutput({
      projectUri: "file:///workspace/master.smx",
    }, {
      freeze: () =>
        Promise.resolve({ ok: true, value: execution, messages: [warning,], },),
      output: harness.output,
    },);

    assert(!result.ok,);
    assertEquals(harness.calls, [],);
    assertEquals(result.messages, [warning,],);
  });
});
