/**
 * Pure execution-message projection tests (22.12.6). These assertions protect
 * severity mapping and source metadata without importing the VS Code runtime.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";
import {
  executionDiagnosticRange,
  projectExecutionDiagnostics,
  resolveExecutionDiagnosticUri,
} from "../../src/diagnostics/execution.ts";

describe("projectExecutionDiagnostics", () => {
  it("maps every severity and preserves message order and source metadata", () => {
    const messages: ExecutionMessage[] = [
      {
        severity: "fatal",
        id: "fatal-id",
        text: "fatal text",
        file: "master.smx",
        line: 3,
      },
      {
        severity: "error",
        id: "error-id",
        text: "error text",
        file: "parts/tasks.smx",
        line: 8,
      },
      {
        severity: "warning",
        id: "warning-id",
        text: "warning text",
        file: null,
        line: null,
      },
      {
        severity: "info",
        id: "info-id",
        text: "info text",
        file: "master.smx",
        line: 1,
      },
      {
        severity: "debug",
        id: "debug-id",
        text: "debug text",
        file: "parts/tasks.smx",
        line: 12,
      },
    ];

    assertEquals(projectExecutionDiagnostics(messages,), [
      {
        file: "master.smx",
        line: 3,
        severity: "error",
        message: "fatal text",
        code: "fatal-id",
      },
      {
        file: "parts/tasks.smx",
        line: 8,
        severity: "error",
        message: "error text",
        code: "error-id",
      },
      {
        file: null,
        line: null,
        severity: "warning",
        message: "warning text",
        code: "warning-id",
      },
      {
        file: "master.smx",
        line: 1,
        severity: "information",
        message: "info text",
        code: "info-id",
      },
      {
        file: "parts/tasks.smx",
        line: 12,
        severity: "hint",
        message: "debug text",
        code: "debug-id",
      },
    ],);
  });

  it("does not invent a source line when the message has none", () => {
    assertEquals(
      projectExecutionDiagnostics([{
        severity: "error",
        id: "unknown-location",
        text: "no source location",
        file: null,
        line: null,
      },],),
      [{
        file: null,
        line: null,
        severity: "error",
        message: "no source location",
        code: "unknown-location",
      },],
    );
  });
});

describe("resolveExecutionDiagnosticUri", () => {
  const master = "file:///workspace/project/master.smx";

  it("resolves include paths relative to the master directory", () => {
    assertEquals(
      resolveExecutionDiagnosticUri(master, "parts/tasks.smx",),
      "file:///workspace/project/parts/tasks.smx",
    );
    assertEquals(
      resolveExecutionDiagnosticUri(master, "../shared.smx",),
      "file:///workspace/shared.smx",
    );
  });

  it("keeps absolute paths and explicit file URIs absolute", () => {
    assertEquals(
      resolveExecutionDiagnosticUri(master, "/opt/project.smx",),
      "file:///opt/project.smx",
    );
    assertEquals(
      resolveExecutionDiagnosticUri(master, "file:///tmp/external.smx",),
      "file:///tmp/external.smx",
    );
  });

  it("uses the master URI when the message has no source file", () => {
    assertEquals(resolveExecutionDiagnosticUri(master, null,), master,);
  });

  it("preserves remote workspace authorities while resolving includes", () => {
    assertEquals(
      resolveExecutionDiagnosticUri(
        "vscode-remote://ssh-remote+host/workspace/project/master.smx",
        "parts/tasks.smx",
      ),
      "vscode-remote://ssh-remote+host/workspace/project/parts/tasks.smx",
    );
  });
});

describe("executionDiagnosticRange", () => {
  it("converts one-based lines to zero-based ranges", () => {
    assertEquals(executionDiagnosticRange(1,), {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },);
    assertEquals(executionDiagnosticRange(8,), {
      startLine: 7,
      startCharacter: 0,
      endLine: 7,
      endCharacter: 0,
    },);
  });

  it("uses the first editor line only when the source line is absent", () => {
    assertEquals(executionDiagnosticRange(null,), {
      startLine: 0,
      startCharacter: 0,
      endLine: 0,
      endCharacter: 0,
    },);
  });
});
