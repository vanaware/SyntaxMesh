/**
 * `runtime/suite.ts` — in-host runtime acceptance suite (26.34, F21).
 *
 * Loaded by the VS Code **Node extension host** via `extensionTestsPath`
 * (bundled CJS, `--external vscode`), NOT by `deno test`. Documented BDD
 * exception (kickoff 26.34): `@std/testing/bdd` registers `Deno.test`, which
 * cannot run inside the extension host — so the suite uses `@std/assert`
 * with a sequential `check(name, fn)` collector and throws on any failure
 * (the Deno driver then exits non-zero).
 *
 * Modes (env `SMX_RUNTIME_MODE`, set by `run.ts`):
 * - `full` — activation + LSP-in-host + all 9 manifest commands (26.34.1–.2);
 * - `untrusted` — Workspace Trust phase A (26.34.3; phase B = probe);
 * - `clean` — subset over the installed `.vsix` artifact (26.34.4).
 *
 * UI instrumentation: the suite shares the extension host process, so it
 * stubs `window.showQuickPick` (auto-pick; `pickLabel` selects by label),
 * `window.showSaveDialog` (auto-approve to `exported.tjp`) and records the
 * `show*Message` calls for assertions. Webview panels are observed through
 * `window.tabGroups.all` labels.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md
 *      (adendo 26.34)
 * @see packages/vsextension/tests/runtime/run.ts (Deno driver)
 */
import * as vscode from "vscode";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import type { ExecutionResult, ListReportsEntry, } from "@vanaware/syntaxmesh";
import {
  type CommandResult,
  LEGACY_COMMAND_IDS,
  PUBLIC_COMMAND_IDS,
  RUNTIME_ONLY_COMMAND_IDS,
} from "../../src/commands/contracts.ts";
import type { FreezeCommandResult, } from "../../src/commands/freeze-output.ts";
import type { Tj3RunResult, } from "../../src/commands/run.ts";
import type { ReportExportResult, } from "../../src/commands/service.ts";
import { EXECUTION_DIAGNOSTIC_COLLECTION, } from "../../src/diagnostics/host.ts";
import type { ProjectModel, ProjectSummary, } from "../../src/daemon/types.ts";
import { UNTRUSTED_MESSAGE, } from "../../src/trust.ts";

/** Complete extension-owned command surface, including compatibility aliases. */
const EXTENSION_COMMAND_IDS = [
  ...PUBLIC_COMMAND_IDS,
  ...LEGACY_COMMAND_IDS,
  ...RUNTIME_ONLY_COMMAND_IDS,
] as const;

/** Node-host global (absent from Deno's lib; present at runtime here). */
declare const process: { env: Record<string, string | undefined> };

/** Acceptance mode, injected by the driver via `extensionTestsEnv`. */
const MODE = process.env["SMX_RUNTIME_MODE"] ?? "full";

/** Extension id under test (publisher.name of the manifest). */
const EXTENSION_ID = "vanaware.syntaxmesh-vscode";

/** One named check result of the sequential collector. */
interface CheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

const results: CheckResult[] = [];

/** Runs one named check, recording (never aborting) its outcome. */
async function check(
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, },);
    console.log(`  ok ${name}`,);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error,);
    results.push({ name, ok: false, error: message, },);
    console.error(`  FAIL ${name}: ${message}`,);
  }
}

/** Polls `fn` until it returns a value or the deadline passes. */
async function poll<T,>(
  fn: () => T | undefined,
  label: string,
  ms = 20000,
  step = 250,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = fn();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`,);
    await new Promise((resolve,) => setTimeout(resolve, step,));
  }
}

/** Captured `show*Message` calls, in order. */
const messages: { kind: "info" | "error" | "warning"; text: string }[] = [];

/** Quick-pick calls received by the stub (items of each call). */
const picks: unknown[][] = [];

/** Real Webview panels created by the extension, retained for HTML assertions. */
const webviewPanels: vscode.WebviewPanel[] = [];

/** Real Desktop pseudoterminals created by the extension, retained for input. */
const consolePtys: vscode.Pseudoterminal[] = [];

/** Text emitted by the Desktop console pseudoterminal. */
const consoleWrites: string[] = [];

/** Number of observed Desktop console close events. */
let consoleCloses = 0;

/** When set, the quick-pick stub selects the item with this label. */
let pickLabel: string | null = null;

/** Answer returned by the overwrite-confirmation stub. */
let overwriteDecision: string | undefined;

/** Structural view of the mutable `window` surface used by the stubs. */
interface StubWindow {
  showQuickPick: (items: unknown[], ...rest: unknown[]) => Promise<unknown>;
  showSaveDialog: (options: { defaultUri?: vscode.Uri },) => Promise<
    vscode.Uri | undefined
  >;
  showInformationMessage: (message: string, ...rest: unknown[]) => Promise<
    unknown
  >;
  showErrorMessage: (message: string, ...rest: unknown[]) => Promise<unknown>;
  showWarningMessage: (message: string, ...rest: unknown[]) => Promise<unknown>;
  createTerminal: (
    options: vscode.ExtensionTerminalOptions,
  ) => vscode.Terminal;
  createWebviewPanel: typeof vscode.window.createWebviewPanel;
}

/** Installs the UI stubs (same host process as the extension under test). */
function installStubs(workspaceRoot: vscode.Uri,): void {
  const win = vscode.window as unknown as StubWindow;
  const createTerminal = vscode.window.createTerminal.bind(vscode.window,);
  const createWebviewPanel = vscode.window.createWebviewPanel.bind(
    vscode.window,
  );
  win.showQuickPick = (items: unknown[],) => {
    picks.push(items,);
    const labeled = items as { label?: string }[];
    const chosen = pickLabel === null
      ? labeled[0]
      : labeled.find((item,) => item.label === pickLabel) ?? labeled[0];
    return Promise.resolve(chosen,);
  };
  win.showSaveDialog = (options,) => {
    const base = options.defaultUri ?? vscode.Uri.joinPath(workspaceRoot, "x",);
    return Promise.resolve(vscode.Uri.joinPath(base, "..", "exported.tjp",),);
  };
  win.showInformationMessage = (message: string,) => {
    messages.push({ kind: "info", text: message, },);
    return Promise.resolve(undefined,);
  };
  win.showErrorMessage = (message: string,) => {
    messages.push({ kind: "error", text: message, },);
    return Promise.resolve(undefined,);
  };
  win.showWarningMessage = (message: string,) => {
    messages.push({ kind: "warning", text: message, },);
    return Promise.resolve(overwriteDecision,);
  };
  win.createTerminal = (options,) => {
    const pty = options.pty;
    assert(pty !== undefined, "console terminal has no pseudoterminal",);
    consolePtys.push(pty,);
    pty.onDidWrite((text,) => {
      consoleWrites.push(text,);
    },);
    pty.onDidClose?.(() => {
      consoleCloses++;
    },);
    return createTerminal(options,);
  };
  win.createWebviewPanel = (...args) => {
    const panel = createWebviewPanel(...args,);
    webviewPanels.push(panel,);
    return panel;
  };
}

/** Last captured message of a kind (or `undefined`). */
function lastMessage(kind: "info" | "error" | "warning",): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.kind === kind) return messages[i]!.text;
  }
  return undefined;
}

/** Opens a workspace file and returns its document. */
async function openDoc(
  root: vscode.Uri,
  name: string,
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(root, name,),
  );
  await vscode.window.showTextDocument(doc,);
  return doc;
}

/** Index of the first line starting with `prefix` (throws when absent). */
function lineOf(doc: vscode.TextDocument, prefix: string,): number {
  for (let i = 0; i < doc.lineCount; i++) {
    if (doc.lineAt(i,).text.startsWith(prefix,)) return i;
  }
  throw new Error(`line not found: ${prefix}`,);
}

/** Whether a tab with the given label is open in any editor group. */
function hasTab(label: string,): boolean {
  return vscode.window.tabGroups.all.some((group,) =>
    group.tabs.some((tab,) => tab.label === label)
  );
}

/** Executes one canonical command and requires its structured result. */
async function commandResult<T,>(
  id: string,
  ...args: unknown[]
): Promise<CommandResult<T>> {
  const result = await vscode.commands.executeCommand<CommandResult<T>>(
    id,
    ...args,
  );
  assert(result !== undefined, `command returned no result: ${id}`,);
  return result;
}

/** Returns one successful command value or fails with its structured error. */
function valueOf<T,>(result: CommandResult<T>,): T {
  if (!result.ok) throw new Error(result.error,);
  return result.value;
}

/** Returns one successful execution envelope. */
function executionOf(result: CommandResult<ExecutionResult>,): ExecutionResult {
  const execution = valueOf(result,);
  assertEquals(execution.ok, true, JSON.stringify(execution.messages,),);
  return execution;
}

/** Projects loaded through the canonical command API. */
async function projectSummaries(): Promise<ProjectSummary[]> {
  return valueOf(
    await commandResult<ProjectSummary[]>("syntaxmesh.project.list",),
  );
}

/** Stable LSP-owned diagnostics, excluding the extension's execution collection. */
function lspDiagnostics(uri: vscode.Uri,): unknown[] {
  return vscode.languages.getDiagnostics(uri,)
    .filter((diagnostic,) =>
      diagnostic.source !== EXECUTION_DIAGNOSTIC_COLLECTION
    )
    .map((diagnostic,) => ({
      message: diagnostic.message,
      severity: diagnostic.severity,
      source: diagnostic.source,
      code: diagnostic.code,
      start: diagnostic.range.start,
      end: diagnostic.range.end,
    }));
}

/** Activation + LSP surface inside the real extension host (26.34.1). */
async function lspChecks(root: vscode.Uri,): Promise<void> {
  await check("extension present and activates", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID,);
    assert(ext !== undefined, `extension ${EXTENSION_ID} not found`,);
    await ext.activate();
    assertEquals(ext.isActive, true,);
  },);

  const master = await openDoc(root, "master.tjp",);
  await check("master.tjp recognized as syntaxmesh", () => {
    assertEquals(master.languageId, "syntaxmesh",);
  },);

  // Open the error fixture and wait for its diagnostics: this proves the
  // bundled server is up and processing didOpen in order, so the master's
  // (earlier) didOpen has already been answered when we assert [] below.
  const errorDoc = await openDoc(root, "error.tjp",);
  await check("error.tjp yields diagnostics with shape", async () => {
    const diagnostics = await poll(
      () => {
        const list = vscode.languages.getDiagnostics(errorDoc.uri,);
        return list.length > 0 ? list : undefined;
      },
      "error.tjp diagnostics",
    );
    for (const diagnostic of diagnostics) {
      assert(diagnostic.message.length > 0, "empty diagnostic message",);
      assert(diagnostic.range.start.line >= 0, "invalid range",);
      assert(
        diagnostic.severity >= vscode.DiagnosticSeverity.Error &&
          diagnostic.severity <= vscode.DiagnosticSeverity.Hint,
        "invalid severity",
      );
    }
  },);

  await check("master.tjp has no diagnostics", () => {
    assertEquals(vscode.languages.getDiagnostics(master.uri,).length, 0,);
  },);

  await check("hover over `task` returns markdown", async () => {
    await vscode.window.showTextDocument(master,);
    const line = lineOf(master, "task build",);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      master.uri,
      new vscode.Position(line, 1,),
    );
    assert(hovers !== undefined && hovers.length > 0, "no hover result",);
    const texts = hovers.flatMap((hover,) =>
      hover.contents.map((content,) =>
        typeof content === "string" ? content : content.value
      )
    );
    assert(
      texts.some((text,) => text.includes("task",)),
      `hover without 'task': ${JSON.stringify(texts,)}`,
    );
  },);

  await check("completion after `depends` offers `build`", async () => {
    const line = lineOf(master, "  depends build",);
    const character = "  depends ".length;
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      master.uri,
      new vscode.Position(line, character,),
    );
    assert(list !== undefined && list.items.length > 0, "no completion items",);
    assert(
      list.items.some((item,) => item.label === "build"),
      "completion missing 'build'",
    );
  },);
}

/** addProject over the real command wiring (shared by full/clean modes). */
async function checkAddProject(): Promise<void> {
  await check("addProject loads the project", async () => {
    await vscode.commands.executeCommand("syntaxmesh.addProject",);
    const info = lastMessage("info",);
    assert(
      info === "SyntaxMesh: loaded master.tjp (ok).",
      `unexpected messages: ${
        JSON.stringify({
          info,
          warning: lastMessage("warning",),
          error: lastMessage("error",),
        },)
      }`,
    );
  },);
}

/** HTML report generation opens the Webview panel (full/clean modes). */
async function checkHtmlReport(): Promise<void> {
  await check("generateReport HTML opens a webview tab", async () => {
    await vscode.commands.executeCommand("syntaxmesh.generateReport",);
    await poll(
      () => hasTab("SyntaxMesh: overview",) ? true : undefined,
      "report webview tab",
    );
  },);
}

/** Exact extension-owned command registration in the real Desktop host. */
async function registrationChecks(): Promise<void> {
  await check(
    "registers every public, legacy and runtime-only command once",
    async () => {
      const registered = await vscode.commands.getCommands(true,);
      const extensionCommands = registered.filter((id,) =>
        id.startsWith("syntaxmesh.",)
      );
      const owned = new Set<string>(EXTENSION_COMMAND_IDS,);
      assertEquals(
        extensionCommands.filter((id,) =>
          !owned.has(id,) && !id.startsWith("syntaxmesh.projectTree.",)
        ),
        [],
      );
      for (const id of EXTENSION_COMMAND_IDS) {
        assertEquals(
          registered.filter((command,) => command === id).length,
          1,
          id,
        );
      }
    },
  );
}

/** Explicit canonical project lifecycle over both master formats (22.12.22). */
async function canonicalProjectChecks(root: vscode.Uri,): Promise<void> {
  const tjp = vscode.Uri.joinPath(root, "master.tjp",).toString();
  const smx = vscode.Uri.joinPath(root, "master.smx",).toString();
  const sheet = vscode.Uri.joinPath(
    root,
    "TimeSheets",
    "2026-05-18",
    "dev.tji",
  ).toString();

  await check("canonical remove accepts an explicit TJP master", async () => {
    valueOf(await commandResult<null>("syntaxmesh.project.remove", tjp,),);
    assertEquals(await projectSummaries(), [],);
  },);

  await check(
    "canonical add accepts explicit TJP and SMX masters",
    async () => {
      const tjpModel = valueOf(
        await commandResult<ProjectModel>("syntaxmesh.project.add", tjp,),
      );
      const smxModel = valueOf(
        await commandResult<ProjectModel>("syntaxmesh.project.add", smx,),
      );
      assertEquals(tjpModel.entry, "master.tjp",);
      assertEquals(smxModel.entry, "master.smx",);
      assertEquals(tjpModel.status, "ok",);
      assertEquals(smxModel.status, "ok",);
      assertEquals(
        (await projectSummaries()).map((project,) => project.entry).sort(),
        ["master.smx", "master.tjp",],
      );
    },
  );

  await check(
    "canonical setActive and refresh accept both masters",
    async () => {
      for (const uri of [smx, tjp,]) {
        const entry = uri === smx ? "master.smx" : "master.tjp";
        const active = valueOf(
          await commandResult<ProjectModel>(
            "syntaxmesh.project.setActive",
            uri,
          ),
        );
        assertEquals(active.entry, entry,);
        const refreshed = valueOf(
          await commandResult<ProjectModel>("syntaxmesh.project.refresh", uri,),
        );
        assertEquals(refreshed.entry, entry,);
        assertEquals(refreshed.status, "ok",);
        const summaries = await projectSummaries();
        assertEquals(
          summaries.filter((project,) => project.active).map((project,) =>
            project.entry
          ),
          [entry,],
        );
      }
    },
  );

  await check(
    "canonical add rejects a TJI sheet as a project master",
    async () => {
      const result = await commandResult("syntaxmesh.project.add", sheet,);
      assertEquals(result.ok, false,);
      if (!result.ok) {
        assertStringIncludes(
          result.error,
          "invalid project master URI",
        );
      }
      assertEquals((await projectSummaries()).length, 2,);
    },
  );

  await check("canonical remove accepts an explicit SMX master", async () => {
    valueOf(await commandResult<null>("syntaxmesh.project.remove", smx,),);
    assertEquals(
      (await projectSummaries()).map((project,) => project.entry),
      ["master.tjp",],
    );
    valueOf(await commandResult<null>("syntaxmesh.project.remove", tjp,),);
    assertEquals(await projectSummaries(), [],);
  },);

  await check("canonical project lifecycle restores both masters", async () => {
    valueOf(
      await commandResult<ProjectModel>("syntaxmesh.project.add", smx,),
    );
    valueOf(
      await commandResult<ProjectModel>("syntaxmesh.project.add", tjp,),
    );
    valueOf(
      await commandResult<ProjectModel>("syntaxmesh.project.setActive", smx,),
    );
    assertEquals((await projectSummaries()).length, 2,);
  },);
}

/** Canonical parse, schedule, compile, freeze and sheet checks (22.12.22). */
async function canonicalExecutionChecks(root: vscode.Uri,): Promise<void> {
  const smx = vscode.Uri.joinPath(root, "master.smx",).toString();
  const timeSheet = vscode.Uri.joinPath(
    root,
    "TimeSheets",
    "2026-05-18",
    "dev.tji",
  ).toString();
  const statusSheet = vscode.Uri.joinPath(
    root,
    "StatusSheets",
    "2026-05-18",
    "dev.tji",
  ).toString();

  await check(
    "checkSyntax parses the SMX master without scheduling",
    async () => {
      const execution = executionOf(
        await commandResult<ExecutionResult>("syntaxmesh.checkSyntax", smx,),
      );
      assertEquals(execution.options.checkSyntax, true,);
      assertEquals(execution.results.check?.valid, true,);
    },
  );

  await check("scheduleOnly schedules without rendering reports", async () => {
    const execution = executionOf(
      await commandResult<ExecutionResult>("syntaxmesh.scheduleOnly", smx,),
    );
    assertEquals(execution.options.noReports, true,);
    assertEquals(execution.results.reports, undefined,);
  },);

  await check("compile renders every declared SMX report", async () => {
    const execution = executionOf(
      await commandResult<ExecutionResult>("syntaxmesh.compile", smx,),
    );
    assertEquals(execution.results.reports?.ok, true,);
    assertEquals(execution.results.reports?.reports.length, 3,);
  },);

  await check(
    "freeze writes the header and bookings beside the SMX master",
    async () => {
      const result = valueOf(
        await commandResult<FreezeCommandResult>(
          "syntaxmesh.freeze",
          smx,
          "2026-05-18",
        ),
      );
      assertEquals(result.artifacts.length, 2,);
      assertEquals(
        result.artifacts.map((artifact,) => artifact.fileName).sort(),
        ["master-bookings.tji", "master-header.tji",],
      );
      const header = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(root, "master-header.tji",),
      );
      assertEquals(
        new TextDecoder().decode(header,),
        "now 2026-05-18-00:00-+0000\n",
      );
      const bookings = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(root, "master-bookings.tji",),
      );
      assertStringIncludes(
        new TextDecoder().decode(bookings,),
        "supplement resource dev {",
      );
    },
  );

  await check("checkTimeSheet checks the nested time sheet", async () => {
    const execution = executionOf(
      await commandResult<ExecutionResult>(
        "syntaxmesh.checkTimeSheet",
        smx,
        timeSheet,
      ),
    );
    assertEquals(execution.options.app, "check-ts",);
    assertEquals(execution.results.sheet?.app, "check-ts",);
  },);

  await check("checkStatusSheet checks the nested status sheet", async () => {
    const execution = executionOf(
      await commandResult<ExecutionResult>(
        "syntaxmesh.checkStatusSheet",
        smx,
        statusSheet,
      ),
    );
    assertEquals(execution.options.app, "check-ss",);
    assertEquals(execution.results.sheet?.app, "check-ss",);
  },);
}

/** Execution diagnostics stay isolated from the language client (22.12.22). */
async function diagnosticsChecks(root: vscode.Uri,): Promise<void> {
  const error = vscode.Uri.joinPath(root, "error.tjp",).toString();
  await check(
    "syntax failure publishes only execution diagnostics",
    async () => {
      const doc = await openDoc(root, "error.tjp",);
      const before = lspDiagnostics(doc.uri,);
      assert(before.length > 0, "LSP diagnostics missing before execution",);
      assertEquals(
        vscode.languages.getDiagnostics(doc.uri,)
          .filter((diagnostic,) =>
            diagnostic.source === EXECUTION_DIAGNOSTIC_COLLECTION
          ).length,
        0,
      );

      const result = await commandResult<ExecutionResult>(
        "syntaxmesh.checkSyntax",
        error,
      );
      const execution = valueOf(result,);
      assertEquals(execution.ok, false,);
      await poll(
        () =>
          vscode.languages.getDiagnostics(doc.uri,).some((diagnostic,) =>
              diagnostic.source === EXECUTION_DIAGNOSTIC_COLLECTION
            )
            ? true
            : undefined,
        "execution diagnostics",
      );
      assertEquals(lspDiagnostics(doc.uri,), before,);
      const published = vscode.languages.getDiagnostics(doc.uri,).filter((
        diagnostic,
      ) => diagnostic.source === EXECUTION_DIAGNOSTIC_COLLECTION);
      assert(published.length > 0, "execution diagnostics missing",);
    },
  );
}

/** Canonical report rendering, output and large-export acceptance (22.12.22). */
async function reportOutputChecks(root: vscode.Uri,): Promise<void> {
  const tjp = vscode.Uri.joinPath(root, "master.tjp",).toString();
  const smx = vscode.Uri.joinPath(root, "master.smx",).toString();

  await check("report list filters cached report ids", async () => {
    const reports = valueOf(
      await commandResult<ListReportsEntry[]>("syntaxmesh.report.list", tjp,),
    );
    assertEquals(
      reports.map((report,) => report.id ?? report.name),
      ["overview", "full",],
    );
    assertEquals(reports.map((report,) => report.name), [
      "overview",
      "Project TJP",
    ],);
    const filtered = valueOf(
      await commandResult<ListReportsEntry[]>(
        "syntaxmesh.report.list",
        tjp,
        "full",
      ),
    );
    assertEquals(filtered.map((report,) => report.id ?? report.name), [
      "full",
    ],);
  },);

  await check(
    "report render returns HTML without opening a panel",
    async () => {
      const before = webviewPanels.length;
      const execution = executionOf(
        await commandResult<ExecutionResult>(
          "syntaxmesh.report.render",
          tjp,
          "overview",
          false,
          undefined,
        ),
      );
      const reports = execution.results.reports?.reports ?? [];
      assertEquals(reports.length, 1,);
      assertEquals(reports[0]?.name, "overview",);
      const html = reports[0]?.formats.find((format,) =>
        format.format === "html"
      );
      assertStringIncludes(html?.content ?? "", "Runtime fixture tasks",);
      assertEquals(webviewPanels.length, before,);
    },
  );

  await check(
    "report open maps bundled assets into the real Webview",
    async () => {
      const before = webviewPanels.length;
      valueOf(
        await commandResult<null>(
          "syntaxmesh.report.open",
          tjp,
          "overview",
          undefined,
        ),
      );
      const panel = await poll(
        () =>
          webviewPanels.slice(before,).find((candidate,) =>
            candidate.title === "SyntaxMesh: overview"
          ),
        "canonical report webview",
      );
      const extension = vscode.extensions.getExtension(EXTENSION_ID,);
      assert(extension !== undefined, "extension missing for asset paths",);
      const css = vscode.Uri.joinPath(
        vscode.Uri.file(extension.extensionPath,),
        "assets",
        "css",
        "tjreport.css",
      );
      const script = vscode.Uri.joinPath(
        vscode.Uri.file(extension.extensionPath,),
        "assets",
        "scripts",
        "wz_tooltip.js",
      );
      assertStringIncludes(
        panel.webview.html,
        panel.webview.asWebviewUri(css,).toString(),
      );
      assertStringIncludes(
        panel.webview.html,
        panel.webview.asWebviewUri(script,).toString(),
      );
      assertStringIncludes(panel.webview.html, "smx-save",);
      assertStringIncludes(panel.webview.html, "Content-Security-Policy",);
      assertEquals(
        (await vscode.workspace.fs.stat(css,)).type,
        vscode.FileType.File,
      );
      assertEquals(
        (await vscode.workspace.fs.stat(script,)).type,
        vscode.FileType.File,
      );
    },
  );

  await check("report export writes TJP from an SMX master", async () => {
    const exported = valueOf(
      await commandResult<ReportExportResult>(
        "syntaxmesh.report.export",
        smx,
        "full",
        "tjp",
        undefined,
        root.toString(),
        "from-smx.tjp",
      ),
    );
    assertEquals(exported.artifact.fileName, "from-smx.tjp",);
    const content = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(root, "from-smx.tjp",),
      ),
    );
    assertStringIncludes(content, "project runtime",);
    assertStringIncludes(content, "task build",);
  },);

  await check("report export writes TJP from a TJP master", async () => {
    valueOf(
      await commandResult<ReportExportResult>(
        "syntaxmesh.report.export",
        tjp,
        "full",
        "tjp",
        undefined,
        root.toString(),
        "from-tjp.tjp",
      ),
    );
    const content = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(root, "from-tjp.tjp",),
      ),
    );
    assertStringIncludes(content, "project prj",);
    assertStringIncludes(content, "task build",);
  },);

  await check(
    "report export overwrite denial preserves the existing file",
    async () => {
      const destination = vscode.Uri.joinPath(root, "confirmed.csv",);
      await vscode.workspace.fs.writeFile(
        destination,
        new TextEncoder().encode("keep me\n",),
      );
      overwriteDecision = "Cancel";
      try {
        const result = await commandResult<ReportExportResult>(
          "syntaxmesh.report.export",
          tjp,
          "overview",
          "csv",
          undefined,
          root.toString(),
          "confirmed.csv",
        );
        assertEquals(result.ok, false,);
        if (!result.ok) assertStringIncludes(result.error, "output cancelled",);
        assertEquals(
          new TextDecoder().decode(
            await vscode.workspace.fs.readFile(destination,),
          ),
          "keep me\n",
        );
        assertStringIncludes(lastMessage("warning",) ?? "", "already exist",);
      } finally {
        overwriteDecision = undefined;
      }
    },
  );

  await check(
    "report export overwrite approval replaces the existing file",
    async () => {
      const destination = vscode.Uri.joinPath(root, "confirmed.csv",);
      overwriteDecision = "Overwrite";
      try {
        valueOf(
          await commandResult<ReportExportResult>(
            "syntaxmesh.report.export",
            tjp,
            "overview",
            "csv",
            undefined,
            root.toString(),
            "confirmed.csv",
          ),
        );
      } finally {
        overwriteDecision = undefined;
      }
      const content = new TextDecoder().decode(
        await vscode.workspace.fs.readFile(destination,),
      );
      assert(
        !content.includes("keep me",),
        "overwrite did not replace the file",
      );
      assertStringIncludes(content, "Build",);
    },
  );

  await check(
    "stdout report prints through the CLI-compatible adapter",
    async () => {
      const result = valueOf(
        await commandResult<Tj3RunResult>(
          "syntaxmesh.run",
          ["stdout.smx",],
          { cwd: root.toString(), },
        ),
      );
      assertEquals(
        result.execution.ok,
        true,
        JSON.stringify(result.execution.messages,),
      );
      assertStringIncludes(result.stdout, "Visible stdout task",);
      const report = result.execution.results.reports?.reports[0];
      assertEquals(report?.stdout, true,);
      assertEquals(result.artifacts.length, 0,);
    },
  );

  await check(
    "large TJP export exercises more than one hundred tasks",
    async () => {
      const large = vscode.Uri.joinPath(root, "large.smx",).toString();
      valueOf(
        await commandResult<ProjectModel>("syntaxmesh.project.add", large,),
      );
      try {
        valueOf(
          await commandResult<ReportExportResult>(
            "syntaxmesh.report.export",
            large,
            "full",
            "tjp",
            undefined,
            root.toString(),
            "large-export.tjp",
          ),
        );
        const content = new TextDecoder().decode(
          await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(root, "large-export.tjp",),
          ),
        );
        assertEquals(content.match(/^\s*task t\d+/gm,)?.length, 105,);
        assertStringIncludes(content, "task t105",);
      } finally {
        valueOf(
          await commandResult<null>("syntaxmesh.project.remove", large,),
        );
      }
    },
  );
}

/** Opens the real Desktop console and returns its production pseudoterminal. */
async function openConsole(): Promise<vscode.Pseudoterminal> {
  await vscode.commands.executeCommand("syntaxmesh.console.open",);
  const pty = await poll(
    () => consolePtys[0],
    "SyntaxMesh console pseudoterminal",
  );
  await poll(
    () =>
      consoleWrites.join("",).includes("SyntaxMesh console",) ||
      undefined,
    "SyntaxMesh console introduction",
  );
  await poll(
    () => consoleWrites.join("",).includes("syntaxmesh> ",) || undefined,
    "SyntaxMesh console initial prompt",
  );
  return pty;
}

/** Submits one console line and waits for its next production prompt. */
async function consoleLine(
  pty: vscode.Pseudoterminal,
  line: string,
): Promise<string> {
  const start = consoleWrites.length;
  pty.handleInput?.(`${line}\r`,);
  await poll(
    () =>
      consoleWrites.slice(start,).join("",).includes("syntaxmesh> ",) ||
      undefined,
    `console prompt after ${line}`,
  );
  return consoleWrites.slice(start,).join("",);
}

/** Real Desktop pseudo-terminal command acceptance (22.12.22 Step 6). */
async function consoleChecks(): Promise<void> {
  const pty = await openConsole();

  await check(
    "Desktop console dispatches project and semantic commands",
    async () => {
      const projects = await consoleLine(pty, "project list",);
      assertStringIncludes(projects, "Projects:",);
      assertStringIncludes(projects, "master.smx",);
      assertStringIncludes(projects, "master.tjp",);

      const syntax = await consoleLine(pty, "check-syntax",);
      assertStringIncludes(syntax, "Execution: ok",);
      assertStringIncludes(syntax, "Intent: checkSyntax",);
      assertStringIncludes(syntax, "Syntax: valid",);

      const schedule = await consoleLine(pty, "run master.smx --no-reports",);
      const summaries = await projectSummaries();
      assertEquals(schedule.includes("Error:",), false, schedule,);
      const active = summaries.find((project,) =>
        project.entry === "master.smx"
      );
      assertEquals(active?.lastIntent, "scheduleOnly",);
    },
  );

  await check(
    "Desktop console normalizes run, smx and tj3 prefixes",
    async () => {
      const reports = await consoleLine(
        pty,
        "smx master.smx --list-reports 'cost|task'",
      );
      assertStringIncludes(reports, "Cost",);
      assertStringIncludes(reports, "Tasks",);

      const manual = await consoleLine(pty, "tj3 man task",);
      assertStringIncludes(manual, "Keyword:",);

      const stdout = await consoleLine(pty, "run stdout.smx",);
      assertStringIncludes(stdout, "Visible stdout task",);
    },
  );

  await check("Desktop console dry-runs explicit sheet commands", async () => {
    const time = await consoleLine(
      pty,
      "run ts summary master.smx --config sheet.yaml --enddate 2026-05-18 --dry-run",
    );
    assertEquals(time.includes("Error:",), false, time,);
    assertStringIncludes(time, "0 errors",);

    const status = await consoleLine(
      pty,
      "smx ss send master.tjp --config sheet.yaml --enddate 2026-05-18 --dry-run",
    );
    assertEquals(status.includes("Error:",), false, status,);
    assertStringIncludes(status, "0 errors",);

    const summaries = await projectSummaries();
    assertEquals(
      summaries.find((project,) => project.entry === "master.smx")?.lastIntent,
      "sheet",
    );
    assertEquals(
      summaries.find((project,) => project.entry === "master.tjp")?.lastIntent,
      "sheet",
    );
  },);

  await check(
    "Desktop console preserves bare and prefixed project paths",
    async () => {
      const manual = await consoleLine(pty, "man task",);
      assertStringIncludes(manual, "Keyword:",);

      const summary = await consoleLine(
        pty,
        "ts summary --config sheet.yaml --enddate 2026-05-18 --dry-run",
      );
      assertEquals(summary.includes("Error:",), false, summary,);
      assertStringIncludes(summary, "0 errors",);
      const active = (await projectSummaries()).find((project,) =>
        project.active
      );
      assertEquals(active?.entry, "master.smx",);
      assertEquals(active?.lastIntent, "sheet",);

      const rejected = await consoleLine(pty, "smx ts summary --dry-run",);
      assertStringIncludes(rejected, "No input file given.",);
    },
  );

  await check(
    "Desktop console clears and exits the pseudoterminal",
    async () => {
      const cleared = await consoleLine(pty, "clear",);
      assertStringIncludes(cleared, "\x1b[2J\x1b[H",);

      const closesBefore = consoleCloses;
      pty.handleInput?.("exit\r",);
      await poll(
        () => consoleCloses > closesBefore || undefined,
        "SyntaxMesh console close",
      );
    },
  );
}

/** All 9 manifest commands over the real UI wiring (26.34.2, full mode). */
async function commandChecks(root: vscode.Uri,): Promise<void> {
  const master = await openDoc(root, "master.tjp",);

  await registrationChecks();
  await checkAddProject();

  await check("reloadProject reloads the project", async () => {
    await vscode.commands.executeCommand("syntaxmesh.reloadProject",);
    assertEquals(
      lastMessage("info",),
      "SyntaxMesh: reloaded master.tjp (ok).",
    );
  },);

  await check("listProjects shows the loaded project", async () => {
    picks.length = 0;
    await vscode.commands.executeCommand("syntaxmesh.listProjects",);
    assertEquals(picks.length, 1,);
    const items = picks[0] as { label: string; description: string }[];
    assertEquals(items.length, 1,);
    assertEquals(items[0]!.label, "master.tjp",);
    assertStringIncludes(items[0]!.description, "2 reports",);
  },);

  await check("removeProject removes, re-add restores", async () => {
    await vscode.commands.executeCommand("syntaxmesh.removeProject",);
    assertEquals(
      lastMessage("info",),
      `SyntaxMesh: removed ${vscode.Uri.joinPath(root, "master.tjp",)}.`,
    );
    await vscode.commands.executeCommand("syntaxmesh.addProject",);
    assertEquals(lastMessage("info",), "SyntaxMesh: loaded master.tjp (ok).",);
  },);

  await checkHtmlReport();

  await check("generateReport CSV saves the selected destination", async () => {
    const config = vscode.workspace.getConfiguration("syntaxmesh",);
    await config.update(
      "report.defaultFormat",
      "csv",
      vscode.ConfigurationTarget.Workspace,
    );
    try {
      const result = await vscode.commands.executeCommand<{
        ok: boolean;
        error?: string;
      }>("syntaxmesh.generateReport",);
      assertEquals(result.ok, true, result.error,);
      const csv = vscode.Uri.joinPath(root, "exported.tjp",);
      const stat = await vscode.workspace.fs.stat(csv,);
      assert(stat.size > 0, "empty CSV report",);
    } finally {
      await config.update(
        "report.defaultFormat",
        undefined,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  },);

  await check("exportTjp writes exported.tjp", async () => {
    await vscode.window.showTextDocument(master,);
    await vscode.commands.executeCommand("syntaxmesh.exportTjp",);
    const exported = vscode.Uri.joinPath(root, "exported.tjp",);
    const bytes = await vscode.workspace.fs.readFile(exported,);
    assertEquals(new TextDecoder().decode(bytes,), master.getText(),);
    assertEquals(lastMessage("info",), "SyntaxMesh: exported master.tjp.",);
  },);

  await check("switchLanguage inserts the pt-BR directive", async () => {
    await vscode.window.showTextDocument(master,);
    pickLabel = "pt-BR";
    try {
      await vscode.commands.executeCommand("syntaxmesh.switchLanguage",);
    } finally {
      pickLabel = null;
    }
    assertStringIncludes(master.getText(), 'language "pt-BR"',);
    assertEquals(
      lastMessage("info",),
      "SyntaxMesh: language set to pt-BR.",
    );
  },);

  await check("switchLanguage back to en replaces in place", async () => {
    pickLabel = "en";
    try {
      await vscode.commands.executeCommand("syntaxmesh.switchLanguage",);
    } finally {
      pickLabel = null;
    }
    assertStringIncludes(master.getText(), 'language "en"',);
    assertEquals(lastMessage("info",), "SyntaxMesh: language set to en.",);
  },);

  await check("openManual opens a manual webview", async () => {
    await vscode.commands.executeCommand("syntaxmesh.openManual",);
    await poll(
      () =>
        vscode.window.tabGroups.all.some((group,) =>
            group.tabs.some((tab,) =>
              tab.label.startsWith("SyntaxMesh Manual:",)
            )
          ) ?
          true :
          undefined,
      "manual webview tab",
    );
  },);

  await check("showProjectTree focuses the tree view", async () => {
    await vscode.commands.executeCommand("syntaxmesh.showProjectTree",);
  },);

  await canonicalProjectChecks(root,);
  await canonicalExecutionChecks(root,);
  await diagnosticsChecks(root,);
  await reportOutputChecks(root,);
  await consoleChecks();
}

/**
 * Workspace Trust over the real runtime (26.34.3, phase A of the two-phase
 * untrusted run).
 *
 * The manifest declares no `untrustedWorkspaces` capability, so VS Code
 * itself keeps the extension DISABLED in a restricted workspace (commands
 * never register) — the first trust layer. The in-command gate
 * (`assertTrusted`, unit-tested in P4) is the second layer.
 *
 * Insiders 1.147 exposes NO command that grants trust programmatically
 * (`workbench.action.trustWorkspace` does not exist; `workbench.trust.manage`
 * only opens the trust editor UI), and test windows use in-memory storage.
 * Documented fallback (kickoff 26.34): this phase asserts the restricted
 * state in a fresh profile; the driver then persists the SAME trust entry
 * the UI "Trust" button writes and a NORMAL window runs the probe extension
 * (`probe/probe.ts`) asserting grant -> active -> executing.
 */
async function untrustedChecks(): Promise<void> {
  await check("fresh workspace starts untrusted", () => {
    assertEquals(vscode.workspace.isTrusted, false,);
  },);

  await check("extension disabled while untrusted", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID,);
    assert(ext !== undefined, `extension ${EXTENSION_ID} not found`,);
    assertEquals(ext.isActive, false,);
    const registered = await vscode.commands.getCommands(true,);
    for (const id of EXTENSION_COMMAND_IDS) {
      assertEquals(registered.includes(id,), false, id,);
    }
  },);

  // Keep the pure gate constant referenced: it is the message the
  // in-command layer surfaces when trust is lost mid-session (P4 unit).
  assertStringIncludes(UNTRUSTED_MESSAGE, "trusted workspace",);
}

/** Entry point invoked by the VS Code test runner (`exports.run`). */
export async function run(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  assert(folders !== undefined && folders.length > 0, "no workspace folder",);
  const root = folders[0]!.uri;
  console.log(`RUNTIME SUITE mode=${MODE} workspace=${root.toString()}`,);
  installStubs(root,);

  if (MODE === "full") {
    await lspChecks(root,);
    await commandChecks(root,);
  } else if (MODE === "clean") {
    await lspChecks(root,);
    // addProject acts on the ACTIVE editor — make master active again
    // (lspChecks ends on the completion provider, editor focus may drift).
    await openDoc(root, "master.tjp",);
    await checkAddProject();
    await checkHtmlReport();
  } else if (MODE === "untrusted") {
    await untrustedChecks();
  } else {
    throw new Error(`unknown mode: ${MODE}`,);
  }

  const failed = results.filter((result,) => !result.ok);
  console.log(
    `RUNTIME SUITE ${MODE}: ${results.length - failed.length} passed, ` +
      `${failed.length} failed`,
  );
  // No explicit window close here: the test runner derives the exit code
  // from `run()`'s promise and closes the window itself — an early
  // `closeWindow` races that propagation and can turn a green run red.
  if (failed.length > 0) {
    throw new Error(
      `runtime suite failures: ${failed.map((f,) => f.name).join("; ",)}`,
    );
  }
}
