/** Execution-result presentation regressions for canonical command handlers. */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStrictEquals, } from "@std/assert";
import type { ExecutionResult, } from "@vanaware/syntaxmesh";
import type { CommandResult, } from "../../src/commands/contracts.ts";
import {
  commandResultOrFailure,
  guardedCommand,
  presentExecutionResult,
} from "../../src/commands/execution-actions.ts";

function envelope(ok: boolean,): ExecutionResult {
  return {
    ok,
    exitCode: ok ? 0 : 1,
    options: {
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
    },
    messages: [{
      severity: ok ? "warning" : "error",
      id: "execution-message",
      text: ok ? "warning" : "failure",
      file: "master.smx",
      line: 1,
    },],
    results: {},
  };
}

describe("guarded command results", () => {
  it("returns the action result by identity when the workspace is trusted", async () => {
    const expected: CommandResult<string> = {
      ok: true,
      value: "done",
      messages: [],
    };
    const errors: string[] = [];

    const returned = await guardedCommand(
      true,
      () => Promise.resolve(expected,),
      (message,) => errors.push(message,),
    );

    assertStrictEquals(returned, expected,);
    assertEquals(errors, [],);
  });

  it("blocks untrusted actions and returns a structured failure", async () => {
    let called = false;
    const errors: string[] = [];

    const returned = await guardedCommand(
      false,
      () => {
        called = true;
        return Promise.resolve({
          ok: true as const,
          value: "no",
          messages: [],
        },);
      },
      (message,) => errors.push(message,),
    );

    assertEquals(called, false,);
    assertEquals(returned, {
      ok: false,
      error: "SyntaxMesh: this command requires a trusted workspace.",
      messages: [],
    },);
    assertEquals(errors, [
      "SyntaxMesh: this command requires a trusted workspace.",
    ],);
  });

  it("surfaces thrown failures and preserves them as structured data", async () => {
    const errors: string[] = [];

    const returned = await guardedCommand(
      true,
      () => Promise.reject(new Error("command exploded",),),
      (message,) => errors.push(message,),
    );

    assertEquals(returned, {
      ok: false,
      error: "command exploded",
      messages: [],
    },);
    assertEquals(errors, ["SyntaxMesh: command exploded",],);
  });
});

describe("optional command results", () => {
  it("preserves an existing structured result by identity", () => {
    const result: CommandResult<string> = {
      ok: true,
      value: "done",
      messages: [],
    };

    assertStrictEquals(commandResultOrFailure(result, "cancelled",), result,);
  });

  it("turns an undefined cancellation into a structured failure", () => {
    assertEquals(commandResultOrFailure(undefined, "selection cancelled",), {
      ok: false,
      error: "selection cancelled",
      messages: [],
    },);
  });
});

describe("execution result presentation", () => {
  it("returns the same structured failure after surfacing it", () => {
    const result: CommandResult<ExecutionResult> = {
      ok: false,
      error: "execution failed",
      messages: [],
    };
    const errors: string[] = [];
    let published = 0;
    let refreshed = 0;

    const returned = presentExecutionResult("file:///master.smx", result, {
      showError: (message,) => errors.push(message,),
      publish: () => {
        published++;
      },
      refresh: () => {
        refreshed++;
      },
    },);

    assertStrictEquals(returned, result,);
    assertEquals(errors, ["SyntaxMesh: execution failed",],);
    assertEquals(published, 0,);
    assertEquals(refreshed, 0,);
  });

  for (const ok of [true, false,]) {
    it(`publishes and returns an execution envelope with ok=${ok}`, () => {
      const value = envelope(ok,);
      const result: CommandResult<ExecutionResult> = {
        ok: true,
        value,
        messages: value.messages,
      };
      const errors: string[] = [];
      const published: Array<
        { uri: string; messages: ExecutionResult["messages"] }
      > = [];
      let refreshed = 0;

      const returned = presentExecutionResult("file:///master.smx", result, {
        showError: (message,) => errors.push(message,),
        publish: (uri, messages,) => published.push({ uri, messages, },),
        refresh: () => {
          refreshed++;
        },
      },);

      assertStrictEquals(returned, result,);
      assertEquals(published, [{
        uri: "file:///master.smx",
        messages: value.messages,
      },],);
      assertEquals(errors, ok ? [] : ["SyntaxMesh: execution failed.",],);
      assertEquals(refreshed, 1,);
    });
  }
});
